// Kiểm soát đối soát chỉ đọc cho Admin.
// Phát hiện sai lệch nội bộ; KHÔNG suy ra giao dịch đã hoàn tiền hay có thể chi trả.
const ISSUE_COLUMNS = Object.freeze({
  intent: 'intent_issue',
  receipt: 'receipt_issue',
  entitlement: 'entitlement_issue',
  creatorSale: 'creator_sale_issue',
  split: 'split_issue',
});

function safeMoney(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error('Invalid financial amount');
  return number;
}

export function sanitizeAuditRow(row) {
  // Chỉ trả mã đơn, provider và cờ đối soát; tuyệt đối không trả PII/token/reference.
  const issues = Object.entries(ISSUE_COLUMNS)
    .filter(([, column]) => Number(row[column]) === 1)
    .map(([name]) => name);
  return {
    orderId: String(row.order_id),
    provider: row.payment_provider === 'momo' ? 'momo' : 'payos',
    sandbox: Number(row.is_test) === 1,
    amountVnd: safeMoney(row.gross_vnd),
    createdAt: row.created_at,
    issues,
  };
}

export class ReconciliationAudit {
  constructor(client) { this.client = client; }

  async exceptions(limit) {
    // MySQL 8: CTE giữ điều kiện nhất quán giữa phần đánh dấu và phần lọc.
    // Kiểm tra cả đơn đã xác nhận nhưng thiếu biên nhận, quyền mua, hoặc sai bút toán.
    // LIMIT đã được kiểm tra ở service; không cho client cung cấp biểu thức SQL.
    const [rows] = await this.client.execute(`WITH paid_orders AS (
      SELECT o.id AS order_id, o.payment_provider, o.is_test, o.gross_vnd, o.created_at,
        CASE WHEN p.id IS NULL OR p.status <> 'paid' OR p.amount_vnd <> o.gross_vnd
          THEN 1 ELSE 0 END AS intent_issue,
        CASE WHEN r.order_id IS NULL OR r.amount_vnd <> o.gross_vnd
          OR r.provider <> o.payment_provider THEN 1 ELSE 0 END AS receipt_issue,
        CASE WHEN e.order_id IS NULL OR e.revoked_at IS NOT NULL
          THEN 1 ELSE 0 END AS entitlement_issue,
        CASE WHEN t.creator_id IS NOT NULL AND o.creator_amount_vnd > 0
          AND (l.id IS NULL OR l.creator_id <> t.creator_id OR l.amount_vnd <> o.creator_amount_vnd)
          THEN 1 ELSE 0 END AS creator_sale_issue,
        CASE WHEN o.gross_vnd <> o.platform_fee_vnd + o.creator_amount_vnd
          THEN 1 ELSE 0 END AS split_issue
      FROM orders o
      LEFT JOIN payment_intents p ON p.order_id=o.id
      LEFT JOIN payment_receipts r ON r.order_id=o.id
      LEFT JOIN template_entitlements e ON e.order_id=o.id
      LEFT JOIN templates t ON t.id=o.template_id
      LEFT JOIN creator_ledger l ON l.id=o.id AND l.category='sale'
      WHERE o.status='paid' AND o.payment_provider IN ('momo','payos')
    )
    SELECT order_id,payment_provider,is_test,gross_vnd,created_at,
      intent_issue,receipt_issue,entitlement_issue,creator_sale_issue,split_issue
    FROM paid_orders
    WHERE intent_issue=1 OR receipt_issue=1 OR entitlement_issue=1
      OR creator_sale_issue=1 OR split_issue=1
    ORDER BY created_at DESC, order_id DESC LIMIT ?`, [limit]);
    return {
      scope: 'internal_paid_order_exceptions',
      canRefund: false,
      canPayout: false,
      scanLimit: limit,
      records: rows.map(sanitizeAuditRow),
    };
  }
}
