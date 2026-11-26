import { verifiedReceiptSql } from './receipt-policy.mjs';
import { activeEntitlementSql } from '../checkout/entitlement-policy.mjs';

// Chỉ đọc dữ liệu nội bộ; không suy ra đủ điều kiện hoàn tiền từ các cờ này.
// Migration credit có thể chưa được chạy trên production, nên không tham chiếu bảng khi chưa có marker.
export async function refundAssessmentQuery(db) {
  const [versions] = await db.execute("SELECT version FROM schema_migrations WHERE version='018_publication_credits'");
  const hasCredits = versions.length === 1;
  const credit = hasCredits ? `CASE
    WHEN c.entitlement_id IS NULL THEN 'not_recorded'
    WHEN c.gift_id IS NULL AND c.consumed_at IS NULL THEN 'unused'
    WHEN c.gift_id IS NOT NULL AND c.consumed_at IS NOT NULL THEN 'consumed'
    ELSE 'unknown' END` : "'unavailable'";
  return {
    projection: `CASE WHEN o.status='paid' AND o.user_id=r.requester_id AND EXISTS (
      SELECT 1 FROM payment_receipts r JOIN payment_intents p ON p.order_id=r.order_id
      WHERE r.order_id=o.id AND (${verifiedReceiptSql})
    ) THEN 1 ELSE 0 END AS receipt_consistent,
    CASE WHEN e.id IS NULL THEN 'missing'
      WHEN e.user_id<>o.user_id OR e.template_id<>o.template_id THEN 'mismatch'
      WHEN e.revoked_at IS NOT NULL THEN 'revoked'
      WHEN ${activeEntitlementSql} THEN 'active' ELSE 'inactive' END AS entitlement_state,
    ${credit} AS credit_state,
    (SELECT COUNT(*) FROM creator_ledger l WHERE l.order_id=o.id AND l.category='sale') AS sale_entries,
    (SELECT COUNT(*) FROM creator_ledger l WHERE l.order_id=o.id AND l.category='refund') AS refund_entries`,
    joins: `LEFT JOIN template_entitlements e ON e.order_id=o.id${hasCredits
      ? ' LEFT JOIN publication_credits c ON c.entitlement_id=e.id' : ''}`,
  };
}

export const refundEntitlementStates = Object.freeze(['missing', 'mismatch', 'revoked', 'active', 'inactive', 'unknown']);
export const refundCreditStates = Object.freeze(['not_recorded', 'unused', 'consumed', 'unavailable', 'unknown']);

function count(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

// Không đưa mã giao dịch, ID thiệp, nội dung webhook hoặc thông tin người nhận vào API.
export function refundAssessment(row) {
  return {
    receipt: row.receipt_consistent === 1 || row.receipt_consistent === '1' ? 'consistent' : 'review',
    entitlement: refundEntitlementStates.includes(row.entitlement_state) ? row.entitlement_state : 'unknown',
    credit: refundCreditStates.includes(row.credit_state) ? row.credit_state : 'unknown',
    creatorSaleEntries: count(row.sale_entries),
    creatorRefundEntries: count(row.refund_entries),
  };
}
