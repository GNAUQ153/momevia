// Điều kiện dùng chung cho API biên nhận và báo cáo đối soát.
// Chỉ dùng với các alias SQL cố định o (order), p (intent), r (receipt).
export const verifiedReceiptSql = `o.currency='VND'
  AND o.is_test IN (0,1)
  AND o.payment_provider IN ('momo','payos')
  AND p.status='paid' AND p.amount_vnd=o.gross_vnd
  AND BINARY p.provider=BINARY o.payment_provider
  AND r.amount_vnd=o.gross_vnd AND r.amount_vnd>0
  AND BINARY r.provider=BINARY p.provider
  AND CHAR_LENGTH(TRIM(r.provider_reference))>0
  AND BINARY r.provider_reference=BINARY p.provider_reference`;

// paid_at được ghi bằng UTC_TIMESTAMP(3); mysql2 trả DATETIME dưới dạng chuỗi.
export function paidAtIso(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/.test(value)) return null;
  const date = new Date(value.replace(' ', 'T') + 'Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,19) === value.replace(' ', 'T').slice(0,19)
    ? date.toISOString() : null;
}
