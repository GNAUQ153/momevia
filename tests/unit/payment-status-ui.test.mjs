import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentStatusPanel } from '../../web/js/pages/payment-status.js';

const order = {
  orderId: '11111111-1111-4111-8111-111111111111',
  status: 'pending',
  amountVnd: 59000,
  needsReview: false,
};

test('Đơn đang chờ chỉ hiển thị nút xem và đối soát, không thể tự thanh toán lại', () => {
  const html = paymentStatusPanel(order);
  assert.match(html, /Đang xác nhận thanh toán/);
  assert.match(html, /data-action="refresh-payment"/);
  assert.match(html, /data-action="reconcile-payment"/);
  assert.match(html, /Không thanh toán lại/);
  assert.doesNotMatch(html, /data-action="(?:retry-payment|mark-paid|refund-payment|cancel-payment)"/);
});

test('Đơn cần xem xét hiển thị mã đơn và nút hỗ trợ', () => {
  const html = paymentStatusPanel({ ...order, needsReview: true, notice: 'Đơn đã chờ quá lâu.' });
  assert.match(html, /role="alert"/);
  assert.match(html, /data-action="support"/);
  assert.match(html, /Đơn đã chờ quá lâu/);
});

test('Đơn paid không còn nút đối soát hoặc thanh toán lại', () => {
  const html = paymentStatusPanel({ ...order, status: 'paid' });
  assert.match(html, /Thanh toán thành công/);
  assert.doesNotMatch(html, /data-action="reconcile-payment"/);
  assert.doesNotMatch(html, /data-action="refresh-payment"/);
});

test('Mã đơn và thông báo phản hồi luôn được escape HTML', () => {
  const html = paymentStatusPanel({ ...order, orderId: '<img src=x>', needsReview: true, notice: '<script>unsafe</script>' });
  assert(!html.includes('<img'));
  assert(!html.includes('<script>'));
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script/);
});
