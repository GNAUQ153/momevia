import test from 'node:test';
import assert from 'node:assert/strict';
import { refundAssessmentQuery, refundAssessment, refundEntitlementStates, refundCreditStates } from '../../src/modules/payments/refund-assessment.mjs';
import { publicRefundRow } from '../../src/modules/payments/refund-review.mjs';
import { verifiedReceiptSql } from '../../src/modules/payments/receipt-policy.mjs';
import { activeEntitlementSql } from '../../src/modules/checkout/entitlement-policy.mjs';
import { refundAdminPanel } from '../../web/js/pages/refund-review.js';
import vi from '../../web/assets/locales/vi.json' with { type: 'json' };
import en from '../../web/assets/locales/en.json' with { type: 'json' };

const db = (available) => ({ execute: async sql => {
  assert.match(sql, /FROM schema_migrations WHERE version='018_publication_credits'/);
  return [available ? [{ version: '018_publication_credits' }] : []];
} });

test('Đối soát Admin dùng chung quy tắc biên nhận và entitlement; không ghi dữ liệu', async () => {
  const { projection, joins } = await refundAssessmentQuery(db(false));
  assert(projection.includes(verifiedReceiptSql));
  assert(projection.includes(activeEntitlementSql));
  assert.match(projection, /o.user_id=r.requester_id/);
  assert.match(projection, /e.user_id<>o.user_id OR e.template_id<>o.template_id/);
  assert.match(projection, /category='refund'/);
  assert.doesNotMatch(projection + joins, /\b(?:UPDATE|INSERT|DELETE)\b/);
});

test('Không tham chiếu bảng credit khi migration 018 chưa được áp dụng', async () => {
  const { projection, joins } = await refundAssessmentQuery(db(false));
  assert.match(projection, /'unavailable' AS credit_state/);
  assert.doesNotMatch(projection + joins, /publication_credits|c\.gift_id/);
});

test('Migration 018 có mặt: phân biệt credit chưa ghi nhận, đã dùng và chưa dùng', async () => {
  const { projection, joins } = await refundAssessmentQuery(db(true));
  assert.match(joins, /LEFT JOIN publication_credits c ON c.entitlement_id=e.id/);
  assert.match(projection, /c.entitlement_id IS NULL THEN 'not_recorded'/);
  assert.match(projection, /c.gift_id IS NULL AND c.consumed_at IS NULL THEN 'unused'/);
  assert.match(projection, /c.gift_id IS NOT NULL AND c.consumed_at IS NOT NULL THEN 'consumed'/);
});

test('API đánh dấu sai lệch và không tiết lộ dữ liệu giao dịch, credit hoặc người nhận', () => {
  const row = { id: 'request', order_id: 'order', requester_id: 'buyer', receipt_consistent: 0,
    entitlement_state: 'revoked', credit_state: 'consumed', sale_entries: '1', refund_entries: 0,
    gift_id: 'private-gift', provider_reference: 'private-reference', payload: 'private-payload' };
  const admin = publicRefundRow(row, { admin: true });
  assert.deepEqual(admin.assessment, { receipt: 'review', entitlement: 'revoked', credit: 'consumed', creatorSaleEntries: 1, creatorRefundEntries: 0 });
  assert.equal(admin.canRefund, false);
  assert.doesNotMatch(JSON.stringify(admin), /private-/);
  assert.equal(publicRefundRow(row).assessment, undefined);
});

test('Dữ liệu đối soát lỗi không được diễn giải thành kết quả tốt hoặc số 0', () => {
  assert.deepEqual(refundAssessment({ receipt_consistent: true, entitlement_state: 'forged', credit_state: 'forged', sale_entries: null, refund_entries: '1e3' }), {
    receipt: 'review', entitlement: 'unknown', credit: 'unknown', creatorSaleEntries: null, creatorRefundEntries: null,
  });
});

test('Giao diện không dựng mã hoặc giá trị bất thường từ dữ liệu đối soát', () => {
  const html = refundAdminPanel([{ id: 'a', orderId: 'b', status: 'submitted', reasonCode: 'other', amountVnd: 59000,
    assessment: { receipt: '<script>', entitlement: '<script>', credit: '<script>', creatorSaleEntries: '<script>', creatorRefundEntries: 0 } }]);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /refund-review__summary/);
  assert.doesNotMatch(html, /refund-execute|payout-execute/);
  for (const lang of [vi, en]) {
    for (const state of refundEntitlementStates) assert(lang[`refund.assessment.entitlement.${state}`]);
    for (const state of refundCreditStates) assert(lang[`refund.assessment.credit.${state}`]);
  }
});
