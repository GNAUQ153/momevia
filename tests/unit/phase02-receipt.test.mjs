import test from 'node:test';
import assert from 'node:assert/strict';
import { MySqlPaymentRepository } from '../../src/modules/payments/mysql.repository.mjs';
import { ReconciliationAudit } from '../../src/modules/payments/reconciliation-audit.mjs';
import { PaymentService } from '../../src/modules/payments/payment.service.mjs';
import { verifiedReceiptSql, paidAtIso } from '../../src/modules/payments/receipt-policy.mjs';
import { paymentReceipt, paymentStatusPanel } from '../../web/js/pages/payment-status.js';

const row = { receipt_no: 'MV-RC-1', order_id: 'order', template_id: 'premium',
  payload: { templateTitle: 'Mẫu thử', privateData: 'not public' }, amount_vnd: 25000,
  currency: 'VND', provider: 'momo', provider_reference: 'ref', is_test: 1,
  issued_at: '2026-11-25 08:00:01.000', paid_at: '2026-11-25 08:00:00.123' };

test('Biên nhận chỉ truy vấn đơn đã trả tiền của chủ sở hữu và đối chiếu intent', async () => {
  let call;
  const repo = new MySqlPaymentRepository({ async execute(sql, params) { call = { sql, params }; return [[row]]; } });
  const receipt = await repo.receipt('order', 'buyer');
  assert.deepEqual(call.params, ['order', 'buyer']);
  assert.match(call.sql, /o\.user_id=\? AND o\.status='paid'/);
  assert.match(call.sql, /JOIN payment_intents p ON p\.order_id=o\.id/);
  assert(call.sql.includes(verifiedReceiptSql));
  assert.equal(receipt.paidAt, '2026-11-25T08:00:00.123Z');
  assert.equal(receipt.testPayment, true);
  assert.equal(receipt.issuedAt, row.issued_at);
  assert(!JSON.stringify(receipt).includes('privateData'));
});

test('Admin và API biên nhận dùng chung quy tắc đối soát, kể cả NULL', async () => {
  let query;
  const audit = new ReconciliationAudit({ async execute(sql) { query = sql; return [[]]; } });
  await audit.exceptions(10);
  assert(query.includes(`NOT COALESCE((${verifiedReceiptSql}), 0)`));
  for (const clause of ["p.status='paid'", 'p.amount_vnd=o.gross_vnd', 'r.amount_vnd=o.gross_vnd',
    'BINARY p.provider=BINARY o.payment_provider', 'BINARY r.provider=BINARY p.provider',
    'BINARY r.provider_reference=BINARY p.provider_reference', "o.currency='VND'", 'o.is_test IN (0,1)',
    'CHAR_LENGTH(TRIM(r.provider_reference))>0']) assert(verifiedReceiptSql.includes(clause));
});

test('Biên nhận không tồn tại hoặc không qua đối soát trả 404, không tiết lộ lý do', async () => {
  const repo = new MySqlPaymentRepository({ async execute() { return [[]]; } });
  const service = new PaymentService({ repository: repo, reconcileLimiter: { consume: () => true } });
  await assert.rejects(service.receipt({ sub: 'buyer' }, 'order'), { status: 404, messageKey: 'errors.payment.receiptUnavailable' });
});

test('Thời điểm xác nhận dùng UTC, bỏ ngày lỗi và không suy diễn múi giờ máy khách', () => {
  assert.equal(paidAtIso('2026-11-25 08:00:00'), '2026-11-25T08:00:00.000Z');
  assert.equal(paidAtIso(new Date('2026-11-25T08:00:00Z')), '2026-11-25T08:00:00.000Z');
  for (const value of [null, '2026-02-30 08:00:00', '2026-11-25 24:00:00', 'invalid', new Date(NaN)]) assert.equal(paidAtIso(value), null);
});

test('Biên nhận hiển thị mã đơn, thời điểm xác nhận, cảnh báo Sandbox và không phải hóa đơn', () => {
  const html = paymentReceipt({ receiptNo: 'MV-RC-1', orderId: '<script>order</script>', templateTitle: '<img>',
    amountVnd: 25000, provider: 'momo', transactionReference: '<ref>', testPayment: true, paidAt: '2026-11-25T08:00:00Z' });
  assert.match(html, /Mã đơn hàng:/);
  assert.match(html, /Thanh toán được xác nhận lúc:/);
  assert.match(html, /\(UTC\)/);
  assert.match(html, /không thu tiền thật/);
  assert.match(html, /không phải hóa đơn điện tử VAT/);
  assert.match(html, /data-action="print-receipt"/);
  for (const value of ['<script>', '<img>', '<ref>']) assert(!html.includes(value));
});

test('Frontend cũ thiếu paidAt không hiện thời gian giả; Sandbox rõ cả khi biên nhận chưa tải', async () => {
  const repository = { async forUser() { return { orderId: 'order', status: 'paid', provider: 'momo', amount: 25000, isTest: true }; } };
  const service = new PaymentService({ repository, reconcileLimiter: { consume: () => true } });
  const payment = await service.status({ sub: 'buyer' }, 'order');
  assert.equal(payment.testPayment, true);
  assert.match(paymentStatusPanel(payment), /không thu tiền thật/);
  assert.doesNotMatch(paymentStatusPanel({ ...payment, testPayment: undefined }), /không thu tiền thật/);
  assert.doesNotMatch(paymentReceipt({ receiptNo: 'old' }), /Thanh toán được xác nhận lúc:/);
});
