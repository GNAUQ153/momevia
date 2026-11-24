import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { CheckoutService } from '../../src/modules/checkout/checkout.service.mjs';
import { MySqlCheckoutRepository } from '../../src/modules/checkout/mysql.repository.mjs';
import { activeEntitlementSql, entitlementSourceSql, entitlementStateSql, summarizeEntitlements } from '../../src/modules/checkout/entitlement-policy.mjs';
import { registerRoutes } from '../../src/modules/checkout/routes.mjs';
import { Router, HttpError } from '../../src/shared/http.mjs';

const catalog = { async getTemplate(id) { return { id, price: id === 'free' ? 0 : 59000 }; } };
const buyer = { sub: 'buyer', role: 'sender' };
const demoOrder = { userId: buyer.sub, templateId: 'premium', status: 'demo_paid', paymentProvider: 'local_demo_only', privatePayload: 'secret' };
const fixture = () => new CheckoutService({ config: {}, catalog, repository: { all: () => [
  demoOrder,
  { ...demoOrder, status: 'paid', paymentProvider: 'momo', isTest: false },
  { ...demoOrder, status: 'pending_payment' },
  { ...demoOrder, userId: 'other' },
] } });

test('Summary tách nguồn và trạng thái, cộng nhóm trùng nhưng không chấp nhận dữ liệu lỗi', () => {
  const summary = summarizeEntitlements([
    { source: 'live', state: 'active', total: '2' },
    { source: 'live', state: 'active', total: 1 },
    { source: 'sandbox', state: 'revoked', total: 4 },
    { source: 'unknown', state: 'inactive', total: 1 },
  ], 'entitlements');
  assert.deepEqual(summary.totals, { active: 3, revoked: 4, inactive: 1 });
  assert.equal(summary.sources.demo.active, 0);
  for (const row of [{ source: '__proto__', state: 'active', total: 1 }, { source: 'live', state: 'bad', total: 1 },
    { source: 'live', state: 'active', total: -1 }, { source: 'live', state: 'active', total: 1.2 }])
    assert.throws(() => summarizeEntitlements([row], 'entitlements'));
});

test('MySQL chỉ dùng cột chuẩn, đếm theo nhóm, giữ điều kiện quyền và không lấy payload', async () => {
  const calls = [];
  const repo = new MySqlCheckoutRepository({ async execute(sql, params) {
    calls.push([sql, params]);
    return [[{ source: 'sandbox', state: 'revoked', total: 2 }]];
  } });
  await repo.entitlementGroups('buyer', 'premium');
  await repo.entitlementGroups();
  await assert.rejects(repo.entitlementGroups('buyer'), /Incomplete/);
  await repo.hasLicense('buyer', 'premium');
  assert.deepEqual(calls.map(([, params]) => params), [['buyer', 'premium'], [], ['buyer', 'premium']]);
  assert(calls[0][0].includes(entitlementSourceSql));
  assert(calls[0][0].includes(entitlementStateSql));
  assert(calls[2][0].includes(activeEntitlementSql));
  assert.match(calls[0][0], /WHERE e\.user_id=\? AND e\.template_id=\?/);
  assert.match(calls[1][0], /GROUP BY source, state/);
  assert.doesNotMatch(calls[0][0], /payload|SELECT \*/i);
});

test('JSON chỉ xác nhận demo rõ nguồn; paid cũ chưa chứng minh live, quyền cũ không đổi', async () => {
  const service = fixture();
  const result = await service.entitlementDetails(buyer, 'premium');
  assert.equal(result.basis, 'legacy_orders');
  assert.equal(result.sources.demo.active, 1);
  assert.equal(result.sources.unknown.active, 1);
  assert.equal(result.sources.unknown.inactive, 1);
  assert.equal(result.sources.live.active, 0);
  assert.equal(result.licensed, await service.hasLicense(buyer.sub, 'premium'));
  assert.equal((await service.entitlementDetails({ sub: 'other' }, 'premium')).totals.active, 1);
  assert.equal((await service.entitlementDetails(buyer, 'free')).licensed, true);
  await assert.rejects(service.entitlementSummary('buyer'), /Incomplete/);
  await assert.rejects(service.adminEntitlementSummary(buyer), { status: 403 });
  assert.equal((await service.adminEntitlementSummary({ role: 'admin' })).totals.active, 3);
});

test('Quyền MySQL: đơn đã thu hồi hoặc không hợp lệ không được tính active; không suy quyền từ đơn hàng', async () => {
  const calls = [];
  const service = new CheckoutService({ catalog, repository: {
    all() { throw Error('Must not read orders'); },
    async entitlementGroups(...args) {
      calls.push(args);
      return [{ source: 'live', state: 'revoked', total: 1 }, { source: 'sandbox', state: 'inactive', total: 1 }];
    },
  } });
  const result = await service.entitlementDetails(buyer, 'premium');
  assert.equal(result.licensed, false);
  assert.equal(result.basis, 'entitlements');
  assert.deepEqual(result.totals, { active: 0, revoked: 1, inactive: 1 });
  assert.deepEqual(calls, [['buyer', 'premium']]);
});

test('HTTP: chi tiết chỉ của session; Admin tổng hợp riêng, không lộ payload, không cache', async () => {
  const service = fixture();
  const router = new Router();
  const resolveUser = async req => {
    const actor = req.headers['x-fixture-user'];
    if (!actor) throw new HttpError(401, 'Unauthorized');
    return { sub: actor, role: actor === 'admin' ? 'admin' : 'sender' };
  };
  registerRoutes(router, { service, config: {}, resolveUser });
  const server = http.createServer((req, res) => router.handle(req, res));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const get = (path, actor) => fetch(`http://127.0.0.1:${server.address().port}${path}`, { headers: actor ? { 'x-fixture-user': actor } : {} });
  try {
    assert.equal((await get('/licenses/premium/details')).status, 401);
    const response = await get('/licenses/premium/details?userId=other', buyer.sub);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const details = await response.json();
    assert.equal(details.totals.active, 2);
    assert.doesNotMatch(JSON.stringify(details), /secret|privatePayload|userId|orderId/);
    assert.equal((await get('/licenses/premium/details?userId=buyer', 'other').then(r => r.json())).totals.active, 1);
    assert.equal((await get('/admin/entitlements/summary')).status, 401);
    assert.equal((await get('/admin/entitlements/summary?role=admin', buyer.sub)).status, 403);
    const adminResponse = await get('/admin/entitlements/summary', 'admin');
    assert.equal(adminResponse.status, 200);
    assert.equal((await adminResponse.json()).totals.active, 3);
    // Hợp đồng cũ vẫn giữ nguyên.
    assert.deepEqual(await get('/licenses/premium', buyer.sub).then(r => r.json()), { templateId: 'premium', free: false, licensed: true });
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
