import { randomUUID } from 'node:crypto';
import { MySqlClient } from '../../infrastructure/mysql/client.mjs';
import { mysqlDate } from '../identity/mysql.repositories.mjs';
import { localizedError } from '../../shared/http.mjs';
import { activeEntitlementSql, entitlementSourceSql, entitlementStateSql } from './entitlement-policy.mjs';
import { readPublicationAuthority, grantPublicationCredit } from './publication-credit.mjs';

function iso(value) {
  if (value instanceof Date) return value.toISOString();
  return new Date(`${String(value).replace(' ', 'T').replace(/Z$/, '')}Z`).toISOString();
}
function rowToOrder(row) {
  if (!row) return null;
  const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload || {});
  return { ...payload, id: row.id, userId: row.user_id, templateId: row.template_id,
    grossAmount: Number(row.gross_vnd), platformFee: Number(row.platform_fee_vnd),
    creatorAmount: Number(row.creator_amount_vnd), currency: row.currency,
    status: row.status, paymentProvider: row.payment_provider, createdAt: iso(row.created_at) };
}

// The database enforces one demo license per user/template. There is no real payment or payout.
export class MySqlCheckoutRepository {
  constructor(client = new MySqlClient(), { quotaEnabled = false } = {}) { this.client = client; this.quotaEnabled = quotaEnabled === true; }

  async allForUser(userId) {
    const [rows] = await this.client.execute('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC, id DESC', [userId]);
    return rows.map(rowToOrder);
  }

  async hasLicense(userId, templateId) {
    if (this.quotaEnabled) return (await readPublicationAuthority(this.client, userId, templateId)).allowed;
    const [rows] = await this.client.execute(`SELECT 1 AS licensed FROM template_entitlements e
      INNER JOIN orders o ON o.id=e.order_id
      WHERE e.user_id=? AND e.template_id=? AND ${activeEntitlementSql}
      LIMIT 1`, [userId, templateId]);
    return rows.length > 0;
  }

  async publicationQuota(userId, templateId) {
    const { remaining, consumed, legacyUnlimited } = await readPublicationAuthority(this.client, userId, templateId);
    return { remaining, consumed, legacyUnlimited };
  }

  // Đếm thiệp đã lưu, không đếm yêu cầu retry, lượt mở hay số khách nhận.
  async publicationGroups(userId, templateId) {
    const [rows] = await this.client.execute(`SELECT source_kind AS source, COUNT(*) AS total
      FROM gifts WHERE user_id=? AND template_id=? GROUP BY source_kind`, [userId, templateId]);
    return rows;
  }

  // Tổng hợp chỉ đọc; không trả ID đơn, ID người dùng hoặc payload giao dịch.
  async entitlementGroups(userId, templateId) {
    const scoped = userId !== undefined && templateId !== undefined;
    if (!scoped && (userId !== undefined || templateId !== undefined)) throw new Error('Incomplete entitlement scope');
    const [rows] = await this.client.execute(`SELECT ${entitlementSourceSql} AS source,
      ${entitlementStateSql} AS state, COUNT(*) AS total
      FROM template_entitlements e INNER JOIN orders o ON o.id=e.order_id
      ${scoped ? 'WHERE e.user_id=? AND e.template_id=?' : ''}
      GROUP BY source, state`, scoped ? [userId, templateId] : []);
    return rows;
  }

  async purchaseDemo({ userId, templateId, templateTitle, grossAmount }) {
    const fee = Math.round(grossAmount * 0.2);
    const order = {
      id: randomUUID(), userId, templateId, templateTitle,
      grossAmount, platformFee: fee, creatorAmount: grossAmount - fee,
      currency: 'VND', status: 'demo_paid', paymentProvider: 'local_demo_only',
      createdAt: new Date().toISOString(),
    };
    try {
      await this.client.withTransaction(async tx => {
        // Insert order and unique demo key in ONE transaction. If two callers race,
        // the losing transaction rolls back its order and returns the winning order.
        await tx.execute(`INSERT INTO orders
          (id, user_id, template_id, gross_vnd, platform_fee_vnd, creator_amount_vnd,
           currency, status, payment_provider, is_test, created_at, payload)
          VALUES (?, ?, ?, ?, ?, ?, 'VND', 'demo_paid', 'local_demo_only', 1, ?, ?)`,
        [order.id, userId, templateId, grossAmount, fee, order.creatorAmount,
          mysqlDate(order.createdAt), JSON.stringify(order)]);
        await tx.execute(`INSERT INTO demo_purchases(user_id, template_id, order_id)
          VALUES (?, ?, ?)`, [userId, templateId, order.id]);
        const entitlementId = randomUUID();
        await tx.execute(`INSERT INTO template_entitlements
          (id, user_id, template_id, order_id, granted_at)
          VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))`,
        [entitlementId, userId, templateId, order.id]);
        if (this.quotaEnabled) await grantPublicationCredit(tx, entitlementId);
      });
      return order;
    } catch (error) {
      if (error?.code !== 'ER_DUP_ENTRY') throw error;
      // Chỉ trả lại giao dịch demo cũ nếu chính entitlement của đơn đó vẫn hợp lệ.
      // Không cấp lại quyền đã thu hồi và không trả thành công giả khi thiếu entitlement.
      const [rows] = await this.client.execute(`SELECT o.*, CASE WHEN e.id IS NOT NULL
        AND o.user_id=d.user_id AND o.template_id=d.template_id
        AND o.payment_provider='local_demo_only' AND o.is_test=1 AND o.status='demo_paid'
        AND ${activeEntitlementSql} THEN 1 ELSE 0 END AS active_demo FROM demo_purchases d
        INNER JOIN orders o ON o.id=d.order_id
        LEFT JOIN template_entitlements e ON e.order_id=o.id
        WHERE d.user_id=? AND d.template_id=? LIMIT 1`, [userId, templateId]);
      if (!rows.length) throw error;
      if (Number(rows[0].active_demo) !== 1) throw localizedError(409, 'errors.payment.previousClosed');
      return rowToOrder(rows[0]);
    }
  }
  async close() { await this.client.close(); }
}
