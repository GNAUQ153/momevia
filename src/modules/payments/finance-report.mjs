// Báo cáo chỉ đọc: doanh thu đã xác nhận, KHÔNG phải số dư có thể rút.
// Không đưa thông tin người mua, khóa giao dịch hay dữ liệu nhà cung cấp ra API.

const blank = () => ({ orders: 0, grossVnd: 0, platformFeeVnd: 0, creatorVnd: 0 });

function toSafeVnd(value) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) throw new Error('Invalid finance total');
  return result;
}

function summarize(rows) {
  const result = { live: blank(), sandbox: blank() };
  for (const row of rows) {
    const slot = Number(row.is_test) ? result.sandbox : result.live;
    slot.orders = toSafeVnd(row.order_count);
    slot.grossVnd = toSafeVnd(row.gross_vnd);
    slot.platformFeeVnd = toSafeVnd(row.platform_fee_vnd);
    slot.creatorVnd = toSafeVnd(row.creator_vnd);
  }
  return result;
}

export class FinanceReport {
  constructor(client) { this.client = client; }

  async creatorStatement(creatorId, limit) {
    // Chỉ đọc ghi nhận sale sinh ra trong cùng giao dịch webhook đã xác thực.
    const [totals] = await this.client.execute(`SELECT o.is_test, COUNT(*) AS order_count,
      COALESCE(SUM(o.gross_vnd),0) AS gross_vnd,
      COALESCE(SUM(o.platform_fee_vnd),0) AS platform_fee_vnd,
      COALESCE(SUM(l.amount_vnd),0) AS creator_vnd
      FROM creator_ledger l JOIN orders o ON o.id=l.order_id
      JOIN payment_receipts r ON r.order_id=o.id
      WHERE l.creator_id=? AND l.category='sale' AND o.status='paid'
      GROUP BY o.is_test`, [creatorId]);
    const [rows] = await this.client.execute(`SELECT l.order_id,o.template_id,o.gross_vnd,
      o.platform_fee_vnd,l.amount_vnd,o.is_test,l.created_at
      FROM creator_ledger l JOIN orders o ON o.id=l.order_id
      JOIN payment_receipts r ON r.order_id=o.id
      WHERE l.creator_id=? AND l.category='sale' AND o.status='paid'
      ORDER BY l.created_at DESC,l.id DESC LIMIT ?`, [creatorId, limit]);
    return {
      currency: 'VND', scope: 'verified_paid_sales', canPayout: false,
      summary: summarize(totals), limit,
      recent: rows.map(row => ({
        orderId: row.order_id, templateId: row.template_id,
        grossVnd: toSafeVnd(row.gross_vnd),
        platformFeeVnd: toSafeVnd(row.platform_fee_vnd),
        creatorVnd: toSafeVnd(row.amount_vnd),
        sandbox: Boolean(row.is_test), bookedAt: row.created_at,
      })),
    };
  }

  async adminOverview() {
    const [totals] = await this.client.execute(`SELECT o.is_test, COUNT(*) AS order_count,
      COALESCE(SUM(o.gross_vnd),0) AS gross_vnd,
      COALESCE(SUM(o.platform_fee_vnd),0) AS platform_fee_vnd,
      COALESCE(SUM(l.amount_vnd),0) AS creator_vnd
      FROM orders o JOIN payment_receipts r ON r.order_id=o.id
      LEFT JOIN creator_ledger l ON l.id=o.id AND l.category='sale'
      WHERE o.status='paid' AND o.payment_provider IN ('momo','payos')
      GROUP BY o.is_test`);
    // Phát hiện giao dịch đã xác nhận nhưng chưa ghi ledger sale (dữ liệu cũ, thiếu attribution...).
    const [missing] = await this.client.execute(`SELECT COUNT(*) AS missing_count
      FROM orders o JOIN payment_receipts r ON r.order_id=o.id
      JOIN templates t ON t.id=o.template_id
      LEFT JOIN creator_ledger l ON l.id=o.id AND l.category='sale'
      WHERE o.status='paid' AND o.payment_provider IN ('momo','payos')
        AND t.creator_id IS NOT NULL AND o.creator_amount_vnd > 0 AND l.id IS NULL`);
    return {
      currency: 'VND', scope: 'verified_paid_sales', canPayout: false,
      summary: summarize(totals), missingSaleEntries: toSafeVnd(missing[0]?.missing_count || 0),
    };
  }
}
