import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { summarizePublications } from '../../src/modules/checkout/publication-usage.mjs';
import { CheckoutService } from '../../src/modules/checkout/checkout.service.mjs';
import { MySqlCheckoutRepository } from '../../src/modules/checkout/mysql.repository.mjs';
import { MySqlPaymentRepository } from '../../src/modules/payments/mysql.repository.mjs';
import { registerRoutes } from '../../src/modules/checkout/routes.mjs';
import { Router, HttpError } from '../../src/shared/http.mjs';

const buyer = { sub: 'buyer' };
const expected = { basis: 'existing_gifts', sources: { legacy: 1, template: 2 }, total: 3, quotaEnforced: false };

test('Đối soát chỉ đếm bản ghi thiệp, phân loại legacy/Canvas, không suy ra hạn mức', () => {
  assert.deepEqual(summarizePublications([{ source: 'legacy', total: '1' }, { source: 'template', total: 2 }]), expected);
  assert.deepEqual(summarizePublications([]), { ...expected, sources: { legacy: 0, template: 0 }, total: 0 });
  assert.deepEqual(summarizePublications([{ source: 'legacy', total: 1 }, { source: 'template', total: 1 }, { source: 'template', total: 1 }]), expected);
  for (const row of [{ source: 'blank', total: 1 }, { source: '__proto__', total: 1 }, { source: 'template', total: -1 }, { source: 'legacy', total: 1.5 }, { source: 'legacy', total: 'invalid' }])
    assert.throws(() => summarizePublications([row]));
  assert.throws(() => summarizePublications([{ source: 'legacy', total: Number.MAX_SAFE_INTEGER }, { source: 'template', total: 1 }]));
});

test('MySQL chỉ đọc số thiệp của một tài khoản/mẫu; không join lượt mở hay lọc thiệp thu hồi', async () => {
  const calls = [];
  const repo = new MySqlCheckoutRepository({ async execute(sql, args) {
    calls.push([sql, args]);
    return [[{ source: 'legacy', total: 1 }, { source: 'template', total: 2 }]];
  } });
  const service = new CheckoutService({ repository: repo });
  assert.deepEqual(await service.publicationUsage(buyer, 'premium'), { templateId: 'premium', ...expected });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][1], ['buyer', 'premium']);
  assert.match(calls[0][0], /SELECT source_kind AS source, COUNT\(\*\) AS total\s+FROM gifts WHERE user_id=\? AND template_id=\? GROUP BY source_kind/);
  assert.doesNotMatch(calls[0][0], /payload|expires_at|revoked_at|JOIN|UPDATE|DELETE|INSERT/);
});

test('Không báo số lượt bằng 0 giả trên JSON khi thiếu nguồn dữ liệu', async () => {
  const service = new CheckoutService({ repository: { all() { throw Error('Must not infer from orders'); } } });
  await assert.rejects(service.publicationUsage(buyer, 'premium'), { status: 503 });
});

test('HTTP: cần session, chỉ dùng chủ thiệp đã xác thực và không trả dữ liệu cá nhân', async () => {
  const service = new CheckoutService({ repository: { async publicationGroups(userId, templateId) {
    assert.equal(templateId, 'premium');
    return userId === 'buyer' ? [{ source: 'template', total: 2 }] : [];
  } } });
  const router = new Router();
  registerRoutes(router, { service, config: {}, resolveUser: async req => {
    const actor = req.headers['x-fixture-user'];
    if (!actor) throw new HttpError(401, 'Unauthorized');
    return { sub: actor };
  } });
  const server = http.createServer((req, res) => router.handle(req, res));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const get = actor => fetch(`http://127.0.0.1:${server.address().port}/licenses/premium/publications?userId=buyer`, { headers: actor ? { 'x-fixture-user': actor } : {} });
  try {
    assert.equal((await get()).status, 401);
    const other = await get('other');
    assert.equal(other.status, 200);
    assert.equal(other.headers.get('cache-control'), 'no-store');
    assert.equal((await other.json()).total, 0);
    const own = await (await get('buyer')).json();
    assert.equal(own.total, 2);
    assert.doesNotMatch(JSON.stringify(own), /userId|slug|message|recipientName|remaining/);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

const purchase = { userId: 'buyer', templateId: 'premium', title: 'Mẫu', amount: 10000, provider: 'momo', isTest: true };
function duplicateFixture(mode) {
  const queries = [];
  const duplicate = Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' });
  return { queries, repo: new MySqlPaymentRepository({
    async withTransaction() { throw duplicate; },
    async execute(sql, args) {
      queries.push([sql, args]);
      return [[{ id: 'intent', order_id: 'order', provider: 'momo', amount_vnd: 10000, status: 'pending',
        checkout_url: 'https://example.test/checkout', is_test: mode }]];
    },
  }) };
}

test('Checkout retry đúng môi trường trả intent cũ và truy vấn đúng chủ/mẫu', async () => {
  const { repo, queries } = duplicateFixture(1);
  const replay = await repo.createPending(purchase);
  assert.equal(replay.id, 'intent');
  assert.equal(replay.isTest, true);
  assert.deepEqual(queries[0][1], ['buyer', 'premium']);
  assert.match(queries[0][0], /JOIN orders o ON o.id=p.order_id/);
  assert.match(queries[0][0], /o.user_id=k.user_id AND o.template_id=k.template_id/);
  assert.equal((await duplicateFixture(0).repo.createPending({ ...purchase, isTest: false })).isTest, false);
});

test('Checkout retry khác môi trường hoặc thiếu mode trả 409, không xóa khóa và không lộ QR', async () => {
  for (const [mode, isTest] of [[1, false], [0, true], [null, true], [undefined, false], [2, true]]) {
    const { repo, queries } = duplicateFixture(mode);
    await assert.rejects(repo.createPending({ ...purchase, isTest }), error => error.status === 409 && !error.message.includes('example.test'));
    assert.equal(queries.length, 1);
    assert.doesNotMatch(queries[0][0], /DELETE|UPDATE|INSERT/);
  }
  const { repo, queries } = duplicateFixture(1);
  await assert.rejects(repo.createPending({ ...purchase, isTest: 'true' }), /Invalid checkout environment/);
  assert.equal(queries.length, 0);
});
