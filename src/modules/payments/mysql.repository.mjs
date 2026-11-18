import { randomUUID, randomInt } from 'node:crypto';
import { MySqlClient } from '../../infrastructure/mysql/client.mjs';
import { HttpError } from '../../shared/http.mjs';
import { mysqlDate } from '../identity/mysql.repositories.mjs';

const fromJson = value => typeof value === 'string' ? JSON.parse(value) : (value || {});
const receiptNo = id => `MV-RC-${id.replace(/-/g, '').toUpperCase()}`;

export class MySqlPaymentRepository {
  constructor(client = new MySqlClient()) { this.client = client; }

  async createPending({ userId, templateId, title, amount, provider, isTest }) {
    const now = new Date().toISOString();
    const orderId = randomUUID();
    const intentId = randomUUID();
    // payOS requires a numeric order code; MoMo also accepts numeric string IDs.
    const code = String(randomInt(1_000_000_000, 2_147_483_647));
    const platformFee = Math.round(amount * .2);
    const payload = {
      id: orderId, userId, templateId, templateTitle: title, grossAmount: amount,
      platformFee, creatorAmount: amount - platformFee, currency: 'VND',
      status: 'pending_payment', paymentProvider: provider, createdAt: now,
    };
    try {
      await this.client.withTransaction(async tx => {
        await tx.execute(`INSERT INTO orders
          (id,user_id,template_id,gross_vnd,platform_fee_vnd,creator_amount_vnd,currency,
           status,payment_provider,is_test,created_at,payload)
          VALUES (?,?,?,?,?,?,'VND','pending_payment',?,?,?,?)`,
        [orderId,userId,templateId,amount,platformFee,amount-platformFee,provider,isTest ? 1 : 0,
          mysqlDate(now),JSON.stringify(payload)]);
        await tx.execute(`INSERT INTO payment_intents
          (id,order_id,provider,provider_order_code,amount_vnd,status)
          VALUES (?,?,?,?,?,'pending')`, [intentId,orderId,provider,code,amount]);
        await tx.execute(`INSERT INTO payment_checkout_keys (user_id,template_id,intent_id)
          VALUES (?,?,?)`, [userId,templateId,intentId]);
      });
      return { id: intentId, orderId, code, amount, provider, status: 'pending', checkoutUrl: null, qrPayload: null };
    } catch (error) {
      if (error.code !== 'ER_DUP_ENTRY') throw error;
      const [rows] = await this.client.execute(`SELECT p.* FROM payment_checkout_keys k
        JOIN payment_intents p ON p.id=k.intent_id WHERE k.user_id=? AND k.template_id=? LIMIT 1`,
      [userId,templateId]);
      if (!rows.length) throw error; // A code collision or unrelated constraint must NOT be treated as success.
      return this.intentRow(rows[0]);
    }
  }

  intentRow(row) {
    const createdAt = row.created_at instanceof Date ? row.created_at.toISOString()
      : (row.created_at ? `${String(row.created_at).replace(' ', 'T').replace(/Z$/, '')}Z` : null);
    return { id: row.id, orderId: row.order_id, code: row.provider_order_code,
      amount: Number(row.amount_vnd), provider: row.provider, status: row.status,
      checkoutUrl: row.checkout_url || null, qrPayload: row.qr_payload || null, createdAt };
  }
  async setLink(intentId, link) {
    await this.client.execute(`UPDATE payment_intents SET checkout_url=?, qr_payload=?,provider_payment_id=?
      WHERE id=? AND status='pending'`, [link.checkoutUrl,link.qrPayload || '',link.providerPaymentId || '',intentId]);
  }
  async forUser(orderId, userId) {
    const [rows] = await this.client.execute(`SELECT p.* FROM payment_intents p
      JOIN orders o ON o.id=p.order_id WHERE o.id=? AND o.user_id=? LIMIT 1`, [orderId,userId]);
    return rows[0] ? this.intentRow(rows[0]) : null;
  }
  async receipt(orderId, userId) {
    const [rows] = await this.client.execute(`SELECT r.*,o.user_id,o.template_id,o.gross_vnd,o.currency,
      o.is_test,o.status,o.payload FROM payment_receipts r
      JOIN orders o ON o.id=r.order_id WHERE o.id=? AND o.user_id=? AND o.status='paid' LIMIT 1`,
    [orderId,userId]);
    const row = rows[0];
    if (!row) return null;
    const data = fromJson(row.payload);
    return {
      receiptNo: row.receipt_no, orderId: row.order_id, templateId: row.template_id,
      templateTitle: data.templateTitle || '', amountVnd: Number(row.amount_vnd),
      currency: row.currency, provider: row.provider,
      transactionReference: row.provider_reference, issuedAt: row.issued_at,
      testPayment: Boolean(row.is_test), status: 'paid',
      note: 'Biên nhận thanh toán; không phải hóa đơn điện tử VAT.',
    };
  }

  async settleVerified(event) {
    const { provider, code, reference, amount, currency, success } = event;
    if (!success) return { settled: false, reason: 'not-paid' };
    if (!Number.isSafeInteger(amount) || amount <= 0 || currency !== 'VND' || !reference || reference.length > 191)
      throw new HttpError(400, 'Thông tin giao dịch không hợp lệ.');
    return this.client.withTransaction(async tx => {
      const [matches] = await tx.execute(`SELECT p.*, o.user_id,o.template_id,o.is_test,o.status AS order_status
        FROM payment_intents p JOIN orders o ON o.id=p.order_id
        WHERE p.provider=? AND p.provider_order_code=? FOR UPDATE`, [provider,code]);
      const item = matches[0];
      if (!item) throw new HttpError(404, 'Không tìm thấy đơn tương ứng.');
      if (Number(item.amount_vnd) !== amount) throw new HttpError(400, 'Số tiền thanh toán không trùng khớp.');
      if (item.status === 'paid' && item.order_status === 'paid') return { settled: true, replay: true, orderId: item.order_id };
      if (item.status !== 'pending' || item.order_status !== 'pending_payment') throw new HttpError(409, 'Trạng thái đơn hàng không hợp lệ.');
      // Event and entitlement are committed together. A failed transaction can be retried safely.
      await tx.execute('INSERT INTO payment_events(provider,event_key,payload) VALUES (?,?,?)',
        [provider, reference, JSON.stringify({ provider, code, reference, amount, currency })]);
      await tx.execute(`UPDATE payment_intents SET status='paid',provider_reference=?,paid_at=UTC_TIMESTAMP(3)
        WHERE id=? AND status='pending'`, [reference,item.id]);
      await tx.execute(`UPDATE orders SET status='paid',payload=JSON_SET(payload,'$.status','paid') WHERE id=?`, [item.order_id]);
      await tx.execute(`INSERT INTO payment_transactions
        (id,order_id,provider,provider_reference,amount_vnd,status,provider_payload)
        VALUES (?,?,?,?,?,'paid',?)`,
      [randomUUID(),item.order_id,provider,reference,amount,JSON.stringify({ verified: true, sandbox: Boolean(item.is_test) })]);
      await tx.execute(`INSERT INTO template_entitlements(id,user_id,template_id,order_id,granted_at)
        VALUES (?,?,?,?,UTC_TIMESTAMP(3))`, [randomUUID(),item.user_id,item.template_id,item.order_id]);
      await tx.execute(`INSERT INTO payment_receipts
        (order_id,receipt_no,provider,provider_reference,amount_vnd) VALUES (?,?,?,?,?)`,
      [item.order_id,receiptNo(item.order_id),provider,reference,amount]);
      return { settled: true, replay: false, orderId: item.order_id };
    });
  }
  async close() { await this.client.close(); }
}
