import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PaymentService } from '../../src/modules/payments/payment.service.mjs';
import { MySqlPaymentRepository } from '../../src/modules/payments/mysql.repository.mjs';
import { registerPaymentRoutes } from '../../src/modules/payments/routes.mjs';

const admin = { sub: 'admin-1', role: 'admin' };
const sender = { sub: 'buyer-1', role: 'sender' };
const now = new Date().toISOString();
const intent = { id: 'intent-1', orderId: 'order-1', code: '1001234567', amount: 25000,
  provider: 'momo', providerPaymentId: 'payment-1', checkoutUrl: 'https://momo.vn/test',
  status: 'pending', isTest: true, createdAt: now };
const env = { PAYMENT_ENV: 'sandbox', NODE_ENV: 'development' };

function serviceFixture(overrides = {}) {
  const calls = [];
  const repository = {
    async pendingReview(limit) { calls.push(['review', limit]); return []; },
    async reconciliationHistory(orderId, limit) { calls.push(['history', orderId, limit]); return []; },
    async forUser(orderId, userId) { calls.push(['lookup', orderId, userId]); return { ...intent }; },
    async settleVerified(event) { calls.push(['settle', event]); return { settled: true }; },
    async recordReconciliation(event) { calls.push(['audit', event]); },
    ...overrides.repository,
  };
  const provider = { async queryStatus() { return { state: 'pending' }; }, ...overrides.provider };
  const service = new PaymentService({ repository, env, providers: { momo: provider },
    reconcileLimiter: { consume: () => true } });
  return { calls, service };
}

test('Admin review requires current Admin role before querying the repository', async () => {
  const { service, calls } = serviceFixture();
  await assert.rejects(service.pendingReview(sender, 50), { status: 403 });
  await assert.rejects(service.pendingReview({ ...admin, role: 'creator' }, 50), { status: 403 });
  await assert.rejects(service.reconciliationHistory(sender, '00000000-0000-4000-8000-000000000001'), { status: 403 });
  assert.deepEqual(calls, []);
  assert.deepEqual(await service.pendingReview(admin), []);
  assert.deepEqual(calls, [['review', 50]]);
});

test('Admin review has bounded limit and validates history order ID', async () => {
  const { service, calls } = serviceFixture();
  for (const limit of [0, -1, 101, 'hello', '1;DROP TABLE orders', 1.2]) {
    await assert.rejects(service.pendingReview(admin, limit), { status: 400 });
  }
  await assert.rejects(service.reconciliationHistory(admin, 'invalid', 10), { status: 400 });
  await service.pendingReview(admin, 100);
  await service.reconciliationHistory(admin, '00000000-0000-4000-8000-000000000001', 10);
  assert.deepEqual(calls, [['review', 100], ['history', '00000000-0000-4000-8000-000000000001', 10]]);
});

test('Admin queue returns only stale pending orders, never checkout link or buyer details', async () => {
  const sqls = [];
  const client = { async execute(sql, args) {
    sqls.push([sql, args]);
    return [[{ intent_id:'intent-1', order_id:'order-1', provider:'momo', amount_vnd:25000,
      created_at:'2026-11-18 06:00:00', is_test:1,
      last_inquiry_outcome:'terminal_review', last_inquiry_at:'2026-11-18 08:00:00',
      checkout_url:'https://private.example', email:'secret@example.com' }]];
  }};
  const data = await new MySqlPaymentRepository(client).pendingReview(25);
  assert.equal(data.length, 1);
  assert.equal(data[0].orderId, 'order-1');
  assert.equal(data[0].lastInquiryOutcome, 'terminal_review');
  assert(!JSON.stringify(data).includes('checkout_url'));
  assert(!JSON.stringify(data).includes('secret@example.com'));
  assert.match(sqls[0][0], /p\.status='pending'/);
  assert.match(sqls[0][0], /30 MINUTE/);
  assert.match(sqls[0][0], /ORDER BY p\.created_at ASC LIMIT \?/);
  assert.deepEqual(sqls[0][1], [25]);
});

test('History and audit are parameterized and store only safe metadata', async () => {
  const seen = [];
  const repo = new MySqlPaymentRepository({ execute: async (sql, args) => {
    seen.push([sql, args]); return sql.startsWith('SELECT') ? [[{ id:'2', outcome:'pending', checked_at:now }]] : [{ affectedRows: 1 }];
  }});
  const history = await repo.reconciliationHistory('order-1', 3);
  assert.deepEqual(history, [{ id: '2', outcome: 'pending', checkedAt: now }]);
  assert.deepEqual(seen[0][1], ['order-1', 3]);
  await repo.recordReconciliation({ intentId:'intent-1', actorId:'buyer-1', outcome:'pending' });
  assert.deepEqual(seen[1][1], ['intent-1','buyer-1','pending']);
  await assert.rejects(repo.recordReconciliation({ intentId:'intent-1', actorId:'buyer-1', outcome:'paid; DROP TABLE' }), /Invalid/);
  assert.equal(seen.length, 2);
});

test('Provider pending/paid/terminal inquiry outcomes are audited, not manual grants', async () => {
  for (const state of ['pending', 'terminal_review', 'paid']) {
    const result = state === 'paid' ? { state, provider:'momo', code:intent.code,
      amount:intent.amount, currency:'VND', reference:'12345' } : { state };
    const { service, calls } = serviceFixture({ provider: { queryStatus: async () => result } });
    const answer = await service.reconcile(sender, intent.orderId);
    assert.equal(answer.providerState, state);
    assert.deepEqual(calls.find(([op]) => op === 'audit')[1], {
      intentId:'intent-1', actorId:'buyer-1', outcome:state,
    });
    assert.equal(calls.filter(([op]) => op === 'settle').length, state === 'paid' ? 1 : 0);
  }
});

test('Provider errors and mismatches are recorded without leaking provider payloads', async () => {
  const failure = serviceFixture({ provider: { queryStatus: async () => { throw new Error('secret-private-credential'); } } });
  await assert.rejects(failure.service.reconcile(sender, intent.orderId), /secret-private-credential/);
  assert.equal(failure.calls.find(([op]) => op === 'audit')[1].outcome, 'provider_error');
  assert(!JSON.stringify(failure.calls.find(([op]) => op === 'audit')).includes('secret-private-credential'));

  const mismatch = serviceFixture({ provider: { queryStatus: async () => ({ state:'paid',
    provider:'momo',code:intent.code,amount:1,currency:'VND',reference:'12345' }) } });
  await assert.rejects(mismatch.service.reconcile(sender, intent.orderId), { status: 502 });
  assert.equal(mismatch.calls.find(([op]) => op === 'audit')[1].outcome, 'mismatch');
  assert(!mismatch.calls.some(([op]) => op === 'settle'));
});

test('Migration 009 is append-only audit with FK, InnoDB and migration marker', () => {
  const sql = readFileSync(new URL('../../database/migrations/009_payment_reconciliation_audit.sql', import.meta.url), 'utf8');
  for (const marker of ['payment_reconciliation_attempts','AUTO_INCREMENT','reconciliation_intent_fk',
    'reconciliation_actor_fk', 'ENGINE=InnoDB', '009_payment_reconciliation_audit'])
    assert(sql.includes(marker), marker);
  assert(!/UPDATE payment_intents|DELETE FROM payment_checkout_keys/i.test(sql));
});

test('Admin HTTP review routes resolve the authenticated session, never trust query role', async () => {
  const handlers = new Map();
  const router = { on(method, path, fn) { handlers.set(`${method} ${path}`, fn); } };
  const { service } = serviceFixture();
  const roles = [sender, admin];
  registerPaymentRoutes(router, { service, config: { jwtSecret: 'unused' }, resolveUser: async () => roles[0] });
  const handler = handlers.get('GET /payments/admin/review');
  assert.equal(typeof handler, 'function');
  const fakeResponse = () => ({ writeHead(code) { this.code = code; }, end(body) { this.body = JSON.parse(body); } });
  const url = new URL('http://localhost/payments/admin/review?limit=12&role=admin');
  await assert.rejects(handler({ req: {}, res: fakeResponse(), url }), { status: 403 });
  roles[0] = admin;
  const res = fakeResponse();
  await handler({ req: {}, res, url });
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { orders: [] });
});
