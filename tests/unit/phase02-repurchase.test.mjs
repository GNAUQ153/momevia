import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MySqlPaymentRepository } from '../../src/modules/payments/mysql.repository.mjs';
import { PaymentService } from '../../src/modules/payments/payment.service.mjs';

const previousOrderId = '00000000-0000-4000-8000-000000000001';
const input = { userId: 'buyer', templateId: 'premium', title: 'QA', amount: 10000, provider: 'momo', isTest: true, previousOrderId };
const spent = { id: 'right', credit_id: 'right', gift_id: 'gift' };
const replay = { id: 'intent', order_id: 'new-order', order_user: 'buyer', order_template: 'premium', is_test: 1,
  provider: 'momo', amount_vnd: 10000, status: 'pending', provider_order_code: '123' };
const qa = { quotaEnabled: true, scopedCheckout: true };
function fixture({ migrated = true, owner = true, prior = true, existing, rights = [spent], pending = false, fail = false, options = qa } = {}) {
  const calls = []; let committed = false;
  const db = { async withTransaction(work) {
    const result = await work({ async execute(sql, params = []) {
      calls.push([sql, params]);
      if (sql.includes('FROM schema_migrations')) return [migrated ? [{ version: '019_publication_repurchases' }] : []];
      if (sql.includes('FROM users')) return [owner ? [{ id: 'buyer' }] : []];
      if (sql.includes('SELECT o.id FROM orders')) return [prior ? [{ id: previousOrderId }] : []];
      if (sql.includes('FROM publication_repurchases r JOIN')) return [existing ? [existing] : []];
      if (sql.includes('FROM template_entitlements e')) return [rights];
      if (sql.includes('SELECT p.id FROM payment_intents')) return [pending ? [{ id: 'pending' }] : []];
      if (fail && sql.includes('INSERT INTO publication_repurchases')) throw Error('key failure');
      return [{ affectedRows: 1 }];
    } });
    committed = true; return result;
  } };
  return { repo: new MySqlPaymentRepository(db, options), calls, committed: () => committed };
}
const inserts = f => f.calls.filter(([sql]) => sql.includes('INSERT INTO'));

test('Mua thêm chỉ dành cho sandbox có quota và khóa scope; schema hoặc chủ không hợp lệ bị chặn', async () => {
  for (const [options, status] of [[{ options: {} }, 503], [{ options: { quotaEnabled: true } }, 503], [{ migrated: false }, 503], [{ owner: false }, 403], [{ prior: false }, 409]]) {
    const f = fixture(options);
    await assert.rejects(f.repo.createPending(input), { status });
    assert.equal(inserts(f).length, 0); assert.equal(f.committed(), false);
  }
  const f = fixture();
  await assert.rejects(f.repo.createPending({ ...input, isTest: false }), { status: 503 });
  await assert.rejects(f.repo.createPending({ ...input, provider: 'payos' }), { status: 503 });
  assert.equal(f.calls.length, 0);
});

test('Đơn mua thêm độc lập, lưu liên kết với đơn đã dùng trong cùng transaction', async () => {
  const f = fixture(); const intent = await f.repo.createPending(input);
  assert.notEqual(intent.orderId, previousOrderId);
  assert.equal(intent.status, 'pending'); assert.equal(intent.isTest, true);
  assert.equal(inserts(f).length, 3);
  assert.deepEqual(inserts(f)[2][1], [previousOrderId, intent.id]);
  assert.match(f.calls.find(([sql]) => sql.includes('FROM users'))[0], /FOR UPDATE/);
  const prior = f.calls.find(([sql]) => sql.includes('SELECT o.id FROM orders'));
  assert.deepEqual(prior[1], [previousOrderId, 'buyer', 'premium']);
  assert.match(prior[0], /o\.is_test=1.*o\.status='paid'/s);
  assert.match(prior[0], /e\.revoked_at IS NULL/);
  assert.match(prior[0], /c\.gift_id IS NOT NULL/);
  assert(f.committed());
});

test('Còn lượt, có quyền lịch sử hoặc giao dịch pending khác thì không mua thêm', async () => {
  for (const [options, key] of [[{ rights: [{ ...spent, gift_id: null }] }, 'errors.payment.alreadyLicensed'],
    [{ rights: [{ ...spent, credit_id: null }] }, 'errors.payment.alreadyLicensed'], [{ pending: true }, 'errors.payment.previousClosed']]) {
    const f = fixture(options);
    await assert.rejects(f.repo.createPending(input), { status: 409, messageKey: key });
    assert.equal(inserts(f).length, 0);
  }
});

test('Retry cùng đơn gốc đọc lại intent kể cả sau khi đã thanh toán, không cấp đơn mới', async () => {
  for (const status of ['pending', 'paid', 'failed']) {
    const f = fixture({ existing: { ...replay, status }, rights: [{ ...spent, gift_id: null }] });
    assert.equal((await f.repo.createPending(input)).id, replay.id);
    assert.equal(inserts(f).length, 0);
  }
  for (const changes of [{ order_user: 'other' }, { order_template: 'other' }, { is_test: 0 }, { provider: 'payos' }]) {
    const f = fixture({ existing: { ...replay, ...changes } });
    await assert.rejects(f.repo.createPending(input), { status: 409 });
    assert.equal(inserts(f).length, 0);
  }
});

test('Lỗi ghi khóa mua thêm rollback đơn và intent', async () => {
  const f = fixture({ fail: true });
  await assert.rejects(f.repo.createPending(input), /key failure/);
  assert.equal(f.committed(), false);
});

const env = { NODE_ENV: 'test', PAYMENT_ENV: 'sandbox', PAYMENT_ENABLED: 'true', PUBLIC_BASE_URL: 'https://qa.example.test',
  CHECKOUT_STORAGE: 'mysql', IDENTITY_STORAGE: 'mysql', CATALOG_STORAGE: 'mysql', MOMO_PARTNER_CODE: 'qa', MOMO_ACCESS_KEY: 'qa', MOMO_SECRET_KEY: 'qa' };
const buyer = { sub: 'buyer' };
function service(repo, override = {}) {
  let calls = 0;
  const s = new PaymentService({ repository: repo, env: { ...env, ...override }, checkout: { hasLicense: async () => true },
    catalog: { getTemplate: async id => ({ id, price: 10000, title: 'QA' }) }, providers: { momo: { async create() {
      calls++; await new Promise(resolve => setTimeout(resolve, 5)); return { checkoutUrl: 'https://test-payment.momo.vn/qa' };
    } } } });
  return { s, calls: () => calls };
}

test('Service chặn yêu cầu mua thêm ngoài QA và kiểm tra UUID, giữ nguyên mua lần đầu', async () => {
  for (const override of [{ NODE_ENV: 'production' }, { PAYMENT_ENV: 'production' }, { RAILWAY_SERVICE_ID: 'qa' }, { PAYMENT_LIVE_ENABLED: 'true' }]) {
    const { s } = service(qa, override);
    try { await assert.rejects(s.create(buyer, 'premium', 'momo', previousOrderId), { status: 503 }); } finally { s.close(); }
  }
  const { s } = service(qa);
  try {
    await assert.rejects(s.create(buyer, 'premium', 'momo', 'bad'), { status: 400 });
    await assert.rejects(s.create(buyer, 'premium', 'momo'), { status: 409 });
  } finally { s.close(); }
});

test('Service dùng lại link trong hai yêu cầu đồng thời và không trả link đơn đã đóng', async () => {
  const intent = { id: 'intent', orderId: 'new-order', status: 'pending', provider: 'momo', isTest: true, amount: 10000, code: '123' };
  let latest = { ...intent };
  const { s, calls } = service({ ...qa, async createPending(q) { assert.equal(q.previousOrderId, previousOrderId); return { ...intent }; },
    async forUser(id, userId) { assert.equal(id, intent.orderId); assert.equal(userId, buyer.sub); return latest; },
    async setLink(id, link) { latest = { ...latest, ...link }; } });
  try {
    const [a,b] = await Promise.all([s.create(buyer, 'premium', 'momo', previousOrderId), s.create(buyer, 'premium', 'momo', previousOrderId)]);
    assert.equal(a.checkoutUrl, b.checkoutUrl); assert.equal(calls(), 1);
    assert.equal((await s.create(buyer, 'premium', 'momo', previousOrderId)).checkoutUrl, a.checkoutUrl);
    assert.equal(calls(), 1);
    latest = { ...latest, status: 'paid' };
    await assert.rejects(s.create(buyer, 'premium', 'momo', previousOrderId), { status: 409 });
    assert.equal(calls(), 1);
  } finally { s.close(); }
});

test('Candidate chỉ đọc đúng chủ và mẫu, không đề xuất nếu còn quyền', async () => {
  const { repurchaseCandidate } = await import('../../src/modules/payments/publication-repurchase.mjs');
  for (const active of [false, true]) {
    const calls = [];
    const db = { async execute(sql, args) {
      calls.push([sql,args]);
      if (sql.includes('FROM schema_migrations')) return [[{ version: '019_publication_repurchases' }]];
      if (sql.includes('FROM template_entitlements e')) return [[active ? { ...spent, gift_id: null } : spent]];
      if (sql.includes('SELECT o.id FROM orders')) return [[{ id: previousOrderId }]];
      return [[]];
    } };
    assert.equal(await repurchaseCandidate(db, 'buyer', 'premium'), active ? null : previousOrderId);
    if (!active) assert.deepEqual(calls.at(-1)[1], ['buyer','premium']);
    else assert(!calls.some(([sql]) => sql.includes('SELECT o.id FROM orders')));
  }
});

test('Migration 019 chỉ thêm bảng với khóa duy nhất cho đơn trước và intent mới', () => {
  const sql = readFileSync(new URL('../../database/migrations/019_publication_repurchases.sql', import.meta.url), 'utf8');
  assert.match(sql, /previous_order_id .* PRIMARY KEY/);
  assert.match(sql, /UNIQUE KEY publication_repurchase_intent_uk \(intent_id\)/);
  assert.doesNotMatch(sql, /\b(?:ALTER|DROP|DELETE|UPDATE)\b/i);
});

test('HTTP candidate yêu cầu session; create dùng chủ từ session và khóa mua thêm từ body', async () => {
  const { default: http } = await import('node:http');
  const { once } = await import('node:events');
  const { Router, HttpError } = await import('../../src/shared/http.mjs');
  const { registerPaymentRoutes } = await import('../../src/modules/payments/routes.mjs');
  const router = new Router();
  const calls = [];
  const s = { methods: () => [], env: {}, repurchaseAvailable: () => true,
    async repurchaseCandidate(user, templateId) { calls.push([user.sub, templateId]); return { previousOrderId }; },
    async create(user, templateId, method, prior) { calls.push([user.sub, templateId, method, prior]); return { status: 'pending' }; } };
  registerPaymentRoutes(router, { config: {}, service: s, resolveUser: async req => {
    if (!req.headers['x-fixture-user']) throw new HttpError(401, 'Cần đăng nhập');
    return { sub: req.headers['x-fixture-user'] };
  } });
  const server = http.createServer((req, res) => router.handle(req, res));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(base + '/payments/repurchase/premium')).status, 401);
    const response = await fetch(base + '/payments/repurchase/premium?userId=other', { headers: { 'x-fixture-user': 'buyer' } });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { previousOrderId });
    const create = await fetch(base + '/payments/create', { method: 'POST', headers: { 'content-type': 'application/json', 'x-fixture-user': 'buyer' },
      body: JSON.stringify({ templateId: 'premium', method: 'momo', previousOrderId, userId: 'other' }) });
    assert.equal(create.status, 201);
    assert.deepEqual(calls, [['buyer', 'premium'], ['buyer', 'premium', 'momo', previousOrderId]]);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
