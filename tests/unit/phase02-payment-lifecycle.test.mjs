import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { parsePayOsInquiry, parsePayOsWebhook, createMomoProvider } from '../../src/modules/payments/providers.mjs';
import { PaymentService } from '../../src/modules/payments/payment.service.mjs';
import { MySqlPaymentRepository } from '../../src/modules/payments/mysql.repository.mjs';
import { paymentReference, providerInteger } from '../../src/modules/payments/settlement-evidence.mjs';

const params = { code: '123', amount: 25000, providerPaymentId: 'link-1' };
const webhook = { orderCode: 123, amount: 25000, paymentLinkId: 'link-1', reference: 'bank-1', currency: 'VND', code: '00' };
const envelope = { success: true, code: '00' };
const inquiry = { orderCode: 123, id: 'link-1', amount: 25000, amountPaid: 25000, status: 'PAID', transactions: [{ amount: 25000, reference: 'bank-1' }] };

test('payOS inquiry và webhook dùng cùng mã giao dịch, tách ID link', () => {
  const { state, ...result } = parsePayOsInquiry(inquiry, params);
  assert.equal(state, 'paid');
  assert.deepEqual({ ...result, success: true }, parsePayOsWebhook(webhook, envelope));
});

test('payOS thiếu bằng chứng giao dịch hoặc chuyển nhiều lần phải rà soát', () => {
  for (const transactions of [undefined, [], [{ amount: 25000, reference: '' }], [{ amount: 25000, reference: ' bank ' }],
    [{ amount: 10000, reference: 'a' }, { amount: 15000, reference: 'b' }], [{ amount: 26000, reference: 'a' }]]) {
    assert.deepEqual(parsePayOsInquiry({ ...inquiry, transactions }, params), { state: 'terminal_review' });
  }
  for (const status of ['EXPIRED', 'CANCELLED'])
    assert.deepEqual(parsePayOsInquiry({ ...inquiry, status }, params), { state: 'terminal_review' });
});

test('payOS webhook thành công không được dùng ID link thay reference hoặc mặc định currency', () => {
  for (const change of [{ reference: undefined }, { paymentLinkId: '' }, { currency: undefined }, { currency: 'USD' }, { amount: true }])
    assert.throws(() => parsePayOsWebhook({ ...webhook, ...change }, envelope), { status: 400 });
  assert.equal(parsePayOsWebhook({ ...webhook, code: '01' }, envelope).success, false);
});

test('Bằng chứng không ép kiểu null, boolean, chuỗi rỗng hoặc số không an toàn', () => {
  for (const invalid of [null, undefined, false, true, '', ' ', [], {}, -1, '1e2', 1.5, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(providerInteger(invalid), null);
  assert.equal(providerInteger('0'), 0);
  assert.equal(providerInteger(25000), 25000);
  for (const invalid of ['', ' ', 'abc\n', '\x00abc', null, {}, 1, 'x'.repeat(192)]) assert.equal(paymentReference(invalid), false);
});

const momoEnv = { PAYMENT_ENV: 'sandbox', NODE_ENV: 'test', MOMO_PARTNER_CODE: 'MOMOX', MOMO_ACCESS_KEY: 'accesskey', MOMO_SECRET_KEY: 'secretkey' };
test('MoMo inquiry không xác nhận paid từ resultCode lỗi hoặc transId không hợp lệ', async () => {
  let extra;
  const adapter = createMomoProvider(momoEnv, async (_url, opts) => {
    const { requestId, orderId } = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ partnerCode: 'MOMOX', requestId, orderId, amount: 25000, transId: 12345, resultCode: 0, ...extra }) };
  });
  for (const change of [{ resultCode: null }, { resultCode: false }, { resultCode: '' }, { resultCode: [] }, { transId: '000' }, { transId: Number.MAX_SAFE_INTEGER + 1 }]) {
    extra = change;
    await assert.rejects(adapter.queryStatus({ code: '123', amount: 25000 }), { status: 502 });
  }
  extra = { resultCode: '0' };
  assert.equal((await adapter.queryStatus({ code: '123', amount: 25000 })).state, 'paid');
});

test('MoMo IPN dù chữ ký đúng vẫn chặn mã giao dịch lỗi hoặc request không khớp', async () => {
  const adapter = createMomoProvider(momoEnv);
  const base = { partnerCode: 'MOMOX', orderId: '123', requestId: '123', amount: 25000, extraData: '', message: 'OK',
    orderInfo: 'MOMEVIA 123', orderType: 'momo_wallet', payType: 'qr', responseTime: 1700000000000, resultCode: 0, transId: 12345 };
  const fields = ['accessKey', 'amount', 'extraData', 'message', 'orderId', 'orderInfo', 'orderType', 'partnerCode', 'payType', 'requestId', 'responseTime', 'resultCode', 'transId'];
  function signed(change) {
    const data = { ...base, ...change, accessKey: 'accesskey' };
    return { ...data, signature: createHmac('sha256', 'secretkey').update(fields.map(k => `${k}=${data[k]}`).join('&')).digest('hex') };
  }
  for (const change of [{ resultCode: false }, { resultCode: '' }, { transId: '000' }, { requestId: 'other' }])
    await assert.rejects(adapter.verifyWebhook(signed(change)), { status: 400 });
  assert.equal((await adapter.verifyWebhook(signed({}))).success, true);
});

function repoFixture({ paid = false, link = 'link-1' } = {}) {
  const calls = [];
  const repo = new MySqlPaymentRepository({ withTransaction: work => work({ async execute(sql, args) {
    calls.push([sql, args]);
    if (sql.includes('FROM payment_intents p JOIN orders o')) return [[{ id: 'intent', order_id: 'order', amount_vnd: 25000, is_test: 0,
      status: paid ? 'paid' : 'pending', order_status: paid ? 'paid' : 'pending_payment', provider_payment_id: link,
      provider_reference: paid ? 'bank-1' : null, user_id: 'user', template_id: 'template' }]];
    return [{ affectedRows: 1 }];
  } }) });
  return { repo, calls };
}
const event = parsePayOsWebhook(webhook, envelope);
test('Replay cùng reference thành công; reference khác hoặc link sai bị từ chối trước khi ghi', async () => {
  const valid = repoFixture({ paid: true });
  assert.equal((await valid.repo.settleVerified(event, false)).replay, true);
  assert.equal(valid.calls.length, 1);
  for (const change of [{ reference: 'bank-2' }, { providerPaymentId: 'link-2' }]) {
    const f = repoFixture({ paid: true });
    await assert.rejects(f.repo.settleVerified({ ...event, ...change }, false), { status: 409 });
    assert.equal(f.calls.length, 1);
  }
});

test('Webhook đến trước khi lưu link: ghi ID link đã xác minh cùng settlement', async () => {
  const f = repoFixture({ link: null });
  assert.equal((await f.repo.settleVerified(event, false)).replay, false);
  const update = f.calls.find(([sql]) => sql.includes('UPDATE payment_intents'));
  assert.deepEqual(update[1], ['bank-1', 'link-1', 'intent']);
  assert.equal(f.calls.filter(([sql]) => sql.includes('INSERT INTO payment_receipts')).length, 1);
});

test('Đối soát được đơn pending bị mất ACK tạo link, vẫn kiểm tra chủ đơn và môi trường', async () => {
  const calls = [];
  const repository = { async forUser(id, owner) { return owner === 'user' ? { id: 'intent', orderId: id, provider: 'momo', code: '123', amount: 25000,
    status: 'pending', isTest: true, checkoutUrl: null } : null; }, async recordReconciliation(audit) { calls.push(audit); } };
  const service = new PaymentService({ repository, env: momoEnv, reconcileLimiter: { consume: () => true }, providers: { momo: {
    async queryStatus(args) { calls.push(args); return { state: 'pending' }; }
  } } });
  await assert.rejects(service.reconcile({ sub: 'other' }, 'order'), { status: 404 });
  assert.deepEqual(calls, []);
  assert.equal((await service.reconcile({ sub: 'user' }, 'order')).providerState, 'pending');
  assert.equal(calls[0].code, '123');
  assert.equal(calls[1].outcome, 'pending');
});
