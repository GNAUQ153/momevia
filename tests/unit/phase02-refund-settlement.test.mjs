import test from 'node:test';
import assert from 'node:assert/strict';
import { RefundSettlementQa, refundQaPlan, requireRefundQa } from '../../src/modules/payments/refund-settlement-qa.mjs';

const id = '11111111-1111-4111-8111-111111111111';
const args = { requestId: id, actorId: id, simulationId: id };
const ref = `qa-refund:${id}`;
const env = { REFUND_SETTLEMENT_QA_ENABLED: 'true', NODE_ENV: 'test', PAYMENT_ENV: 'sandbox', CANVAS_QA_MYSQL_ISOLATED: 'true' };
const target = { MYSQL_HOST: '127.0.0.1', MYSQL_DATABASE: 'momevia_canvas_qa_refund' };
const base = { review_status: 'awaiting_provider', requester_id: 'buyer', user_id: 'buyer', template_id: 'template',
  order_id: 'order', order_status: 'paid', is_test: 1, provider: 'momo', provider_reference: 'payment', receipt_consistent: 1,
  entitlement_id: 'entitlement', entitlement_user: 'buyer', entitlement_template: 'template', revoked_at: null,
  credit_id: 'entitlement', gift_id: null, consumed_at: null, gross_vnd: 10000, creator_amount_vnd: 8000 };
const paid = { status: 'paid', provider: 'momo', provider_reference: 'payment', amount_vnd: 10000 };
const sale = { category: 'sale', creator_id: 'original-creator', amount_vnd: 8000 };
const refunded = { ...paid, status: 'refunded', provider_reference: ref, simulated: 'true' };
const reversal = { ...sale, category: 'refund', amount_vnd: -8000 };

test('Chỉ QA loopback được phép chạy mô phỏng; mặc định tắt', () => {
  assert.equal(requireRefundQa({ env: target }, env), target.MYSQL_DATABASE);
  for (const bad of [{}, { ...env, NODE_ENV: 'production' }, { ...env, RAILWAY_ENVIRONMENT: 'qa' }, { ...env, PAYMENT_LIVE_ENABLED: 'true' }, { ...env, PAYMENT_ENV: 'live' }])
    assert.throws(() => requireRefundQa({ env: target }, bad), { status: 503 });
  for (const bad of [{ ...target, MYSQL_HOST: 'remote' }, { ...target, MYSQL_DATABASE: 'momevia' }])
    assert.throws(() => requireRefundQa({ env: bad }, env), { status: 503 });
});

test('Chỉ hoàn toàn phần khi receipt, entitlement, credit và sale khớp; đảo đúng Creator gốc', () => {
  assert.deepEqual(refundQaPlan(base, [paid], [sale], ref), { replayed: false, sale });
  assert.deepEqual(refundQaPlan({ ...base, creator_amount_vnd: 0 }, [paid], [], ref), { replayed: false, sale: null });
});

test('Chặn quyền lịch sử, credit đã dùng, dữ liệu sai hoặc đơn Live', () => {
  for (const bad of [{ credit_id: null }, { gift_id: 'gift', consumed_at: 'now' }, { consumed_at: 'now' },
    { is_test: 0 }, { receipt_consistent: 0 }, { entitlement_user: 'other' }, { requester_id: 'other' },
    { review_status: 'submitted' }, { revoked_at: 'now' }, { gross_vnd: '10000' }])
    assert.throws(() => refundQaPlan({ ...base, ...bad }, [paid], [sale], ref), { status: 409 });
});

test('Chặn giao dịch thiếu, lệch số tiền và ledger thiếu hoặc có điều chỉnh', () => {
  for (const transactions of [[], [paid, paid], [{ ...paid, amount_vnd: 1 }], [{ ...paid, provider_reference: 'wrong' }], [paid, refunded]])
    assert.throws(() => refundQaPlan(base, transactions, [sale], ref), { status: 409 });
  for (const ledger of [[], [sale, sale], [{ ...sale, amount_vnd: 1 }], [sale, reversal], [sale, { category: 'payout' }]])
    assert.throws(() => refundQaPlan(base, [paid], ledger, ref), { status: 409 });
});

test('Replay đúng mã và dữ liệu đã hoàn; mã khác hoặc thiếu bút toán bị chặn', () => {
  const row = { ...base, order_status: 'refunded', revoked_at: 'now' };
  assert.equal(refundQaPlan(row, [paid, refunded], [sale, reversal], ref).replayed, true);
  assert.throws(() => refundQaPlan(row, [paid, refunded], [sale, reversal], 'other'), { status: 409 });
  assert.throws(() => refundQaPlan(row, [paid, refunded], [sale], ref), { status: 409 });
  assert.throws(() => refundQaPlan(row, [paid, { ...refunded, simulated: 'false' }], [sale, reversal], ref), { status: 409 });
});

function fixture({ row = base, transactions = [paid], ledger = [sale], role = 'admin', db = target.MYSQL_DATABASE, failAt } = {}) {
  const writes = [];
  let committed = false;
  const client = { env: target, withTransaction: async work => {
    const staged = [];
    const result = await work({ execute: async (sql, params = []) => {
      if (sql.startsWith('SELECT DATABASE')) return [[{ db }]];
      if (sql.includes('FROM schema_migrations')) return [[{ version: '018_publication_credits' }]];
      if (sql.includes('LIMIT 0')) return [[]];
      if (sql.startsWith('SELECT role')) return [[{ role }]];
      if (sql.startsWith('SELECT requester_id')) return [[{ requester_id: 'buyer' }]];
      if (sql.startsWith('SELECT id FROM users')) return [[{ id: 'buyer' }]];
      if (sql.includes('FROM refund_review_requests q')) return [[row]];
      if (sql.includes('FROM payment_transactions')) return [transactions];
      if (sql.includes('FROM creator_ledger')) return [ledger];
      assert.match(sql, /^(UPDATE|INSERT)/);
      if (failAt && sql.includes(failAt)) throw new Error('injected');
      staged.push({ sql, params });
      return [{ affectedRows: 1 }];
    } });
    writes.push(...staged); committed = true; return result;
  } };
  return { service: new RefundSettlementQa(client, env), writes, committed: () => committed };
}

test('Mô phỏng ghi order, revoke, giao dịch, ledger và audit trong cùng transaction', async () => {
  const f = fixture();
  assert.deepEqual(await f.service.simulate(args), { simulated: true, orderId: 'order', amountVnd: 10000, replayed: false });
  assert.equal(f.writes.length, 5);
  assert.deepEqual(f.writes[3].params.slice(1), ['order', 'original-creator', -8000]);
  assert.match(f.writes[2].params.at(-1), /"simulated":true/);
  assert.equal(f.committed(), true);
});

test('Replay không ghi; sai database hoặc role không ghi', async () => {
  const replay = fixture({ row: { ...base, order_status: 'refunded', revoked_at: 'now' }, transactions: [paid, refunded], ledger: [sale, reversal] });
  assert.equal((await replay.service.simulate(args)).replayed, true);
  assert.equal(replay.writes.length, 0);
  for (const f of [fixture({ db: 'production' }), fixture({ role: 'sender' })]) {
    await assert.rejects(f.service.simulate(args));
    assert.equal(f.writes.length, 0);
  }
});

test('Lỗi ledger khiến transaction mô phỏng không commit', async () => {
  const f = fixture({ failAt: 'INSERT INTO creator_ledger' });
  await assert.rejects(f.service.simulate(args), /injected/);
  assert.equal(f.committed(), false);
  assert.equal(f.writes.length, 0);
});
