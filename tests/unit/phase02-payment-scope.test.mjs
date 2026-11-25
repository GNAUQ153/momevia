import test from 'node:test';
import assert from 'node:assert/strict';
import { configuredPaymentScope, storedPaymentScope, samePaymentScope } from '../../src/modules/payments/payment-scope.mjs';
import { PaymentService } from '../../src/modules/payments/payment.service.mjs';
import { MySqlPaymentRepository } from '../../src/modules/payments/mysql.repository.mjs';

const live = { PAYMENT_ENV: 'production', NODE_ENV: 'production', PAYMENT_ENABLED: 'false' };
const sandbox = { PAYMENT_ENV: 'sandbox', NODE_ENV: 'test' };
const verified = { provider: 'momo', code: '123', amount: 25000, reference: 'ref', currency: 'VND', success: true };
const user = { sub: 'buyer' };

function serviceFixture(env, record = {}, event = verified) {
  const calls = [];
  const repo = {
    async settleVerified(value, scope) { calls.push(['settle', value, scope]); return { settled: true }; },
    async forUser(orderId, userId) { calls.push(['read', orderId, userId]); return { orderId, provider: 'momo',
      status: 'pending', amount: 25000, checkoutUrl: 'https://example.test/checkout', isTest: true, ...record }; },
  };
  const provider = { async verifyWebhook() { calls.push(['verify']); return event; } };
  const service = new PaymentService({ repository: repo, env, providers: { momo: provider, payos: provider },
    reconcileLimiter: { consume: () => true } });
  return { service, calls };
}

function transactionFixture(mode, paid = false) {
  const queries = [];
  const repo = new MySqlPaymentRepository({ async withTransaction(work) {
    return work({ async execute(sql, params) {
      queries.push([sql, params]);
      if (sql.includes('FROM payment_intents p JOIN orders o')) return [[{ id: 'intent', order_id: 'order',
        amount_vnd: 25000, provider_reference: paid ? verified.reference : null, is_test: mode, status: paid ? 'paid' : 'pending', order_status: paid ? 'paid' : 'pending_payment',
        user_id: 'buyer', template_id: 'template', seller_id: null }]];
      return [{ affectedRows: 1 }];
    } });
  } });
  return { repo, queries };
}

test('Phạm vi được xác định từ cấu hình hợp lệ; không ép kiểu từ DB', () => {
  assert.equal(configuredPaymentScope(live, 'momo'), false);
  assert.equal(configuredPaymentScope(live, 'payos'), false);
  assert.equal(configuredPaymentScope(sandbox, 'momo'), true);
  for (const [env, provider] of [[sandbox, 'payos'], [{}, 'momo'], [{ ...sandbox, NODE_ENV: 'production' }, 'momo'], [live, 'unknown']])
    assert.equal(configuredPaymentScope(env, provider), null);
  for (const value of [null, undefined, 2, '0', '1', 'false']) assert.equal(storedPaymentScope(value), null);
  assert.equal(storedPaymentScope(0), false);
  assert.equal(storedPaymentScope(1), true);
  assert.equal(samePaymentScope(null, null), false);
});

test('Webhook truyền phạm vi server kể cả khi tắt tạo giao dịch mới; bỏ qua isTest do body tự khai', async () => {
  for (const [env, expected] of [[live, false], [sandbox, true]]) {
    const { service, calls } = serviceFixture(env, {}, { ...verified, isTest: !expected });
    assert.deepEqual(await service.webhook('momo', { isTest: !expected }), { settled: true });
    assert.equal(calls[1][2], expected);
  }
});

test('Webhook chặn cấu hình không hợp lệ và payOS sandbox trước khi gọi provider', async () => {
  for (const [env, provider] of [[{}, 'momo'], [{ ...sandbox, NODE_ENV: 'production' }, 'momo'], [sandbox, 'payos']]) {
    const { service, calls } = serviceFixture(env);
    await assert.rejects(service.webhook(provider, {}), { status: 503 });
    assert.deepEqual(calls, []);
  }
});

test('Transaction chặn môi trường sai hoặc không rõ trước mọi ghi dữ liệu và nhánh replay', async () => {
  for (const paid of [false, true]) for (const [mode, expected] of [[0, true], [1, false], [null, true], [2, true], ['1', true]]) {
    const { repo, queries } = transactionFixture(mode, paid);
    await assert.rejects(repo.settleVerified(verified, expected), { status: 409 });
    assert.equal(queries.length, 1);
    assert.match(queries[0][0], /FOR UPDATE/);
  }
  const { repo, queries } = transactionFixture(1);
  await assert.rejects(repo.settleVerified(verified), { status: 503 });
  assert.deepEqual(queries, []);
});

test('Transaction đúng môi trường cấp quyền một lần; replay không ghi thêm', async () => {
  for (const [mode, expected] of [[0, false], [1, true]]) {
    const { repo, queries } = transactionFixture(mode);
    assert.equal((await repo.settleVerified(verified, expected)).replay, false);
    assert.equal(queries.filter(([sql]) => sql.includes('INSERT INTO template_entitlements')).length, 1);
    assert.equal(queries.filter(([sql]) => sql.includes('INSERT INTO payment_receipts')).length, 1);
    const paid = transactionFixture(mode, true);
    assert.equal((await paid.repo.settleVerified(verified, expected)).replay, true);
    assert.equal(paid.queries.length, 1);
  }
});

test('Status giữ lịch sử đơn nhưng chỉ trả link pending đúng phạm vi, truy vấn theo session', async () => {
  for (const [env, record, allowed] of [[sandbox, {}, true], [live, {}, false], [live, { isTest: false }, true],
    [sandbox, { isTest: null }, false], [sandbox, { isTest: 'true' }, false], [sandbox, { status: 'paid' }, false],
    [sandbox, { provider: 'payos' }, false], [{}, {}, false]]) {
    const { service, calls } = serviceFixture(env, record);
    const result = await service.status(user, 'order');
    assert.equal(result.checkoutUrl, allowed ? 'https://example.test/checkout' : null);
    assert.equal(result.status, record.status || 'pending');
    assert.deepEqual(calls, [['read', 'order', 'buyer']]);
  }
});
