import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { CheckoutService } from '../../src/modules/checkout/checkout.service.mjs';
import { demoPurchaseAllowed } from '../../src/modules/checkout/demo-policy.mjs';
import { registerRoutes } from '../../src/modules/checkout/routes.mjs';
import { registerPaymentRoutes } from '../../src/modules/payments/routes.mjs';
import { Router, HttpError } from '../../src/shared/http.mjs';
import { createGiftViews } from '../../web/js/pages/gifts.js';
import { api } from '../../web/js/core/api.js';

const buyer = { sub: 'buyer' };
const demo = { demoEnabled: true, demoTemplateCheckout: true };
const env = { NODE_ENV: 'test', PAYMENT_ENABLED: 'false', PAYMENT_LIVE_ENABLED: 'false' };
const catalog = { async getTemplate(id) {
  if (!['free', 'premium', 'invalid'].includes(id)) throw new HttpError(404, 'Không tìm thấy mẫu.');
  return { id, price: id === 'free' ? 0 : id === 'invalid' ? -1 : 59000, title: 'Mẫu QA' };
} };
function fixture(config = demo, override = env) {
  const orders = [];
  const repository = { all: () => orders, insert(order) { orders.push(order); return order; } };
  return { orders, service: new CheckoutService({ repository, config, catalog, env: override }) };
}

test('Demo checkout yêu cầu cả hai cờ và không hoạt động trong production hoặc khi bật thanh toán', () => {
  assert.equal(demoPurchaseAllowed(demo, env), true);
  for (const config of [{}, { demoEnabled: true }, { demoTemplateCheckout: true }, { demoEnabled: true, demoTemplateCheckout: 'true' }])
    assert.equal(demoPurchaseAllowed(config, env), false);
  for (const flags of [{ NODE_ENV: 'production' }, { PAYMENT_ENABLED: 'true' }, { PAYMENT_LIVE_ENABLED: 'true' }])
    assert.equal(demoPurchaseAllowed(demo, { ...env, ...flags }), false);
});

test('Gọi thẳng API/service mua thử khi tắt quyền không tạo đơn hoặc cấp quyền', async () => {
  for (const [config, flags] of [[{ demoEnabled: true }, env], [demo, { ...env, NODE_ENV: 'production' }], [demo, { ...env, PAYMENT_ENABLED: 'true' }]]) {
    const { service, orders } = fixture(config, flags);
    await assert.rejects(service.purchase(buyer, 'premium'), { status: 503 });
    assert.equal(orders.length, 0);
    assert.equal(await service.hasLicense(buyer.sub, 'premium'), false);
  }
});

test('Mẫu miễn phí không cần đọc quyền hoặc tạo đơn hàng', async () => {
  const service = new CheckoutService({ repository: { hasLicense() { throw Error('Không cần đọc quyền'); } }, config: {}, catalog, env });
  assert.deepEqual(await service.accessFor(buyer, 'free'), { templateId: 'free', free: true, licensed: true });
  await assert.rejects(service.accessFor(buyer, 'invalid'), { status: 503 });
  await assert.rejects(service.accessFor(buyer, 'hidden'), { status: 404 });
});

test('MySQL dùng quyền repository, không suy quyền từ đơn đã thanh toán', async () => {
  const calls = [];
  const service = new CheckoutService({ repository: { async hasLicense(...args) { calls.push(args); return false; }, allForUser() { throw Error('Không được đọc đơn'); } }, config: {}, catalog, env });
  assert.deepEqual(await service.accessFor(buyer, 'premium'), { templateId: 'premium', free: false, licensed: false });
  assert.deepEqual(calls, [['buyer', 'premium']]);
  service.repository.hasLicense = async () => { throw new Error('DB unavailable'); };
  await assert.rejects(service.accessFor(buyer, 'premium'), /DB unavailable/);
});

test('JSON chỉ xác nhận quyền mẫu của đúng chủ đơn và không tạo trùng đơn demo', async () => {
  const { service, orders } = fixture();
  orders.push({ userId: buyer.sub, templateId: 'premium', status: 'pending_payment' });
  assert.equal((await service.accessFor(buyer, 'premium')).licensed, false);
  const first = await service.purchase(buyer, 'premium');
  assert.equal((await service.purchase(buyer, 'premium')).id, first.id);
  assert.equal(orders.length, 2);
  assert.equal((await service.accessFor(buyer, 'premium')).licensed, true);
  assert.equal((await service.accessFor({ sub: 'other' }, 'premium')).licensed, false);
});

test('API quyền mẫu yêu cầu session và cờ demo công khai khớp chính sách cấp quyền', async () => {
  const { service } = fixture({ ...demo });
  const router = new Router();
  const resolveUser = async req => {
    const session = req.headers['x-fixture-user'];
    if (!session) throw new HttpError(401, 'Cần đăng nhập.');
    return { sub: session };
  };
  // Bộ xác thực giả chỉ dùng trong fixture HTTP này; route production dùng session thật.
  registerRoutes(router, { config: service.config, service, resolveUser });
  registerPaymentRoutes(router, { config: service.config, service: { methods: () => [], env }, resolveUser });
  const server = http.createServer((req, res) => router.handle(req, res));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = (path, actor) => fetch(base + path, { headers: actor ? { 'x-fixture-user': actor } : {} });
  try {
    assert.equal((await get('/licenses/premium')).status, 401);
    assert.equal((await get('/payments/methods').then(r => r.json())).demoPurchaseAvailable, true);
    await service.purchase(buyer, 'premium');
    const response = await get('/licenses/premium?userId=other', buyer.sub);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { templateId: 'premium', free: false, licensed: true });
    assert.equal((await get('/licenses/premium?userId=buyer', 'other').then(r => r.json())).licensed, false);
    // Route giữ cùng object cấu hình, giống bootstrap thật.
    service.config.demoTemplateCheckout = false;
    assert.deepEqual(await get('/payments/methods').then(r => r.json()), { methods: [] });
    const denied = await fetch(base + '/orders/demo-purchase', { method: 'POST', headers: { 'x-fixture-user': 'other', 'content-type': 'application/json' }, body: JSON.stringify({ templateId: 'premium' }) });
    assert.equal(denied.status, 503);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('Form legacy chỉ hiển thị nút xuất bản/mua khi backend xác nhận; không đọc lịch sử đơn', async () => {
  const original = api.get;
  const template = { id: 'premium', title: 'Mẫu QA', theme: 'rose', price: 59000 };
  const view = createGiftViews({ state: { user: { name: 'QA' } } });
  let entitlement = { licensed: false }, methods = { methods: [] };
  api.get = async url => {
    if (url === '/checkout/licenses/premium') {
      if (!entitlement) throw Error('API unavailable');
      return entitlement;
    }
    assert.equal(url, '/checkout/payments/methods');
    return methods;
  };
  try {
    let html = await view.createPage(template);
    assert.doesNotMatch(html, /type="submit"|data-action="demo-buy"|data-action="payment-options"/);
    methods = { methods: [], demoPurchaseAvailable: true };
    html = await view.createPage(template);
    assert.match(html, /data-action="demo-buy"/);
    methods = { methods: [{ id: 'payos' }], demoPurchaseAvailable: true };
    html = await view.createPage(template);
    assert.match(html, /data-action="payment-options"/);
    assert.doesNotMatch(html, /data-action="demo-buy"/);
    entitlement = null;
    html = await view.createPage(template);
    assert.doesNotMatch(html, /type="submit"|data-action="demo-buy"|data-action="payment-options"/);
    entitlement = { licensed: true };
    html = await view.createPage(template);
    assert.match(html, /type="submit"/);
    assert.doesNotMatch(html, /data-action="demo-buy"|data-action="payment-options"/);
    assert.match(await view.createPage({ ...template, price: 0 }), /type="submit"/);
  } finally { api.get = original; }
});
