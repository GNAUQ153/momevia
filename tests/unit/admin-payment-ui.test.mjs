import test from 'node:test';
import assert from 'node:assert/strict';
import { adminPaymentsPage, filterPendingReviews, paymentAuditRows, paymentReviewRows } from '../../web/js/pages/admin-payments.js';

const orders = [
  { orderId: '11111111-1111-4111-8111-111111111111', provider: 'momo', amountVnd: 25000,
    sandbox: true, pendingSince: '2026-11-18T10:00:00Z', lastInquiryOutcome: 'terminal_review', lastInquiryAt: null },
  { orderId: '22222222-2222-4222-8222-222222222222', provider: 'payos', amountVnd: 30000,
    sandbox: false, pendingSince: '2026-11-18T09:00:00Z', lastInquiryOutcome: 'pending', lastInquiryAt: '2026-11-18T10:15:00Z' },
];

test('Admin UI describes stale pending scope and never offers manual paid/refund/unlock actions', () => {
  const html = adminPaymentsPage(orders);
  assert.match(html, /chờ trên 30 phút/);
  assert.match(html, /Giám sát thanh toán/);
  assert.match(html, /data-action="admin-payment-audit"/);
  assert.match(html, /Không thể xác nhận đã thanh toán/);
  assert.doesNotMatch(html, /data-action="(?:mark-paid|refund|cancel-payment|unlock-retry)"/);
  assert.match(html, /\/admin/);
});

test('Client filters support order ID, provider and suspicious outcome without changing server data', () => {
  assert.equal(filterPendingReviews(orders, { provider: 'momo' }).length, 1);
  assert.equal(filterPendingReviews(orders, { provider: 'payos', outcome: 'needs-review' }).length, 0);
  assert.equal(filterPendingReviews(orders, { outcome: 'needs-review' })[0].provider, 'momo');
  assert.equal(filterPendingReviews(orders, { search: '222222' })[0].provider, 'payos');
  assert.equal(orders.length, 2);
});

test('Provider and audit fields are escaped to avoid unsafe HTML', () => {
  const html = paymentReviewRows([{ ...orders[0], orderId: '<img src=x onerror=alert(1)>', provider: '<script>bad()</script>', lastInquiryOutcome: '<svg/onload=alert(1)>' }]);
  assert(!html.includes('<img'));
  assert(!html.includes('<script>'));
  assert(!html.includes('<svg'));
  assert.match(html, /&lt;img/);
  const audit = paymentAuditRows([{ outcome: '<img src=x>', checkedAt: '2026-11-18T10:00:00Z' }]);
  assert(!audit.includes('<img'));
  assert.match(audit, /&lt;img/);
});

test('Empty and failed loads display actionable but non-sensitive text', () => {
  assert.match(adminPaymentsPage([], { error: 'Chưa thể kết nối' }), /Chưa thể kết nối/);
  assert.match(paymentReviewRows([]), /Không có giao dịch phù hợp/);
  assert.match(paymentAuditRows([]), /Chưa có lần đối soát/);
});
