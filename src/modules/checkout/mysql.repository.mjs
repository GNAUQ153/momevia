import { randomUUID } from 'node:crypto';
import { MySqlClient } from '../../infrastructure/mysql/client.mjs';
import { mysqlDate } from '../identity/mysql.repositories.mjs';

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
  constructor(client = new MySqlClient()) { this.client = client; }

  async allForUser(userId) {
    const [rows] = await this.client.execute('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC, id DESC', [userId]);
    return rows.map(rowToOrder);
  }

  async hasLicense(userId, templateId) {
    const [rows] = await this.client.execute(`SELECT 1 AS licensed FROM template_entitlements e
      INNER JOIN orders o ON o.id=e.order_id
      WHERE e.user_id=? AND e.template_id=? AND e.revoked_at IS NULL
        AND (o.status='paid' OR (o.status='demo_paid' AND o.is_test=1))
        AND o.user_id=e.user_id AND o.template_id=e.template_id
      LIMIT 1`, [userId, templateId]);
    return rows.length > 0;
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
        await tx.execute(`INSERT INTO template_entitlements
          (id, user_id, template_id, order_id, granted_at)
          VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))`,
        [randomUUID(), userId, templateId, order.id]);
      });
      return order;
    } catch (error) {
      if (error?.code !== 'ER_DUP_ENTRY') throw error;
      // Never blindly turn duplicate-key errors into success; ensure the license key exists.
      const [rows] = await this.client.execute(`SELECT o.* FROM demo_purchases d
        INNER JOIN orders o ON o.id=d.order_id
        WHERE d.user_id=? AND d.template_id=? LIMIT 1`, [userId, templateId]);
      if (!rows.length) throw error;
      return rowToOrder(rows[0]);
    }
  }
  async close() { await this.client.close(); }
}
