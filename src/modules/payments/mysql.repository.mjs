import { randomUUID, randomInt } from 'node:crypto';
import { MySqlClient } from '../../infrastructure/mysql/client.mjs';
import { localizedError } from '../../shared/http.mjs';
import { mysqlDate } from '../identity/mysql.repositories.mjs';
import { canonicalText } from '../../../web/js/shared/locale.js';
import { FinanceReport } from './finance-report.mjs';
import { ReconciliationAudit } from './reconciliation-audit.mjs';
import { RefundReviewRepository } from './refund-review.mjs';
import { storedPaymentScope, samePaymentScope } from './payment-scope.mjs';

const fromJson = value => typeof value === 'string' ? JSON.parse(value) : (value || {});
const receiptNo = id => `MV-RC-${id.replace(/-/g, '').toUpperCase()}`;

export class MySqlPaymentRepository {
  constructor(client = new MySqlClient()) { this.client = client; this.finance = new FinanceReport(client); this.audit = new ReconciliationAudit(client); this.refunds = new RefundReviewRepository(client); }

  async creatorStatement(creatorId, limit) { return this.finance.creatorStatement(creatorId, limit); }
  async adminFinance() { return this.finance.adminOverview(); }
  async adminFinanceExceptions(limit) { return this.audit.exceptions(limit); }

  async createPending({ userId, templateId, title, amount, provider, isTest }) {
    if (typeof isTest !== 'boolean') throw new Error('Invalid checkout environment');
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
          [orderId, userId, templateId, amount, platformFee, amount - platformFee, provider, isTest ? 1 : 0,
            mysqlDate(now), JSON.stringify(payload)]);
        await tx.execute(`INSERT INTO payment_intents
          (id,order_id,provider,provider_order_code,amount_vnd,status)
          VALUES (?,?,?,?,?,'pending')`, [intentId, orderId, provider, code, amount]);
        await tx.execute(`INSERT INTO payment_checkout_keys (user_id,template_id,intent_id)
          VALUES (?,?,?)`, [userId, templateId, intentId]);
      });
      return { id: intentId, orderId, code, amount, provider, status: 'pending', checkoutUrl: null, qrPayload: null, isTest };
    } catch (error) {
      if (error.code !== 'ER_DUP_ENTRY') throw error;
      const [rows] = await this.client.execute(`SELECT p.*, o.is_test FROM payment_checkout_keys k
        JOIN payment_intents p ON p.id=k.intent_id JOIN orders o ON o.id=p.order_id
        WHERE k.user_id=? AND k.template_id=? AND o.user_id=k.user_id AND o.template_id=k.template_id LIMIT 1`,
        [userId, templateId]);
      if (!rows.length) throw error; // Không coi xung đột khóa khác là giao dịch thành công.
      // Không trả QR/URL sandbox cho thanh toán thật (hoặc ngược lại). Giữ khóa để đối soát.
      if (!samePaymentScope(isTest, storedPaymentScope(rows[0].is_test)))
        throw localizedError(409, 'errors.payment.previousClosed');
      return this.intentRow(rows[0]);
    }
  }

  intentRow(row) {
    const createdAt = row.created_at instanceof Date ? row.created_at.toISOString()
      : (row.created_at ? `${String(row.created_at).replace(' ', 'T').replace(/Z$/, '')}Z` : null);
    return {
      id: row.id, orderId: row.order_id, code: row.provider_order_code,
      amount: Number(row.amount_vnd), provider: row.provider, status: row.status,
      checkoutUrl: row.checkout_url || null, qrPayload: row.qr_payload || null, createdAt,
      providerPaymentId: row.provider_payment_id || null,
      isTest: storedPaymentScope(row.is_test)
    };
  }
  async setLink(intentId, link) {
    await this.client.execute(`UPDATE payment_intents SET checkout_url=?, qr_payload=?,provider_payment_id=?
      WHERE id=? AND status='pending'`, [link.checkoutUrl, link.qrPayload || '', link.providerPaymentId || '', intentId]);
  }
  async forUser(orderId, userId) {
    const [rows] = await this.client.execute(`SELECT p.*, o.is_test FROM payment_intents p
      JOIN orders o ON o.id=p.order_id WHERE o.id=? AND o.user_id=? LIMIT 1`, [orderId, userId]);
    return rows[0] ? this.intentRow(rows[0]) : null;
  }
  async receipt(orderId, userId) {
    const [rows] = await this.client.execute(`SELECT r.*,o.user_id,o.template_id,o.gross_vnd,o.currency,
      o.is_test,o.status,o.payload FROM payment_receipts r
      JOIN orders o ON o.id=r.order_id WHERE o.id=? AND o.user_id=? AND o.status='paid' LIMIT 1`,
      [orderId, userId]);
    const row = rows[0];
    if (!row) return null;
    const data = fromJson(row.payload);
    return {
      receiptNo: row.receipt_no, orderId: row.order_id, templateId: row.template_id,
      templateTitle: data.templateTitle || '', amountVnd: Number(row.amount_vnd),
      currency: row.currency, provider: row.provider,
      transactionReference: row.provider_reference, issuedAt: row.issued_at,
      testPayment: Boolean(row.is_test), status: 'paid',
      note: canonicalText('payment.receipt.taxNote'),
    };
  }

  // Read-only operator queue. Never expose merchant credentials, QR payloads, or payment URLs.
  async pendingReview(limit = 50) {
    const [rows] = await this.client.execute(`SELECT p.id AS intent_id, p.order_id,
      p.provider, p.amount_vnd, p.created_at, o.is_test,
      (SELECT a.outcome FROM payment_reconciliation_attempts a
        WHERE a.intent_id=p.id ORDER BY a.id DESC LIMIT 1) AS last_inquiry_outcome,
      (SELECT MAX(a.checked_at) FROM payment_reconciliation_attempts a
        WHERE a.intent_id=p.id) AS last_inquiry_at
      FROM payment_intents p JOIN orders o ON o.id=p.order_id
      WHERE p.status='pending' AND o.status='pending_payment'
        AND p.created_at <= UTC_TIMESTAMP(3) - INTERVAL 30 MINUTE
      ORDER BY p.created_at ASC LIMIT ?`, [limit]);
    return rows.map(row => ({ orderId: row.order_id, intentId: row.intent_id,
      provider: row.provider, amountVnd: Number(row.amount_vnd),
      pendingSince: row.created_at, sandbox: Boolean(row.is_test),
      lastInquiryOutcome: row.last_inquiry_outcome || null,
      lastInquiryAt: row.last_inquiry_at || null }));
  }

  async reconciliationHistory(orderId, limit = 50) {
    const [rows] = await this.client.execute(`SELECT a.id, a.outcome, a.checked_at
      FROM payment_reconciliation_attempts a
      JOIN payment_intents p ON p.id=a.intent_id
      WHERE p.order_id=? ORDER BY a.id DESC LIMIT ?`, [orderId, limit]);
    return rows.map(row => ({ id: String(row.id), outcome: row.outcome, checkedAt: row.checked_at }));
  }

  // Store metadata only, never provider response bodies, tokens or signatures.
  async recordReconciliation({ intentId, actorId, outcome }) {
    const allowed = ['pending','paid','terminal_review','provider_error','invalid_response','mismatch','settlement_error'];
    if (!allowed.includes(outcome)) throw new Error('Invalid reconciliation audit outcome');
    await this.client.execute(`INSERT INTO payment_reconciliation_attempts (intent_id,actor_id,outcome)
      VALUES (?,?,?)`, [intentId, actorId, outcome]);
  }

  async settleVerified(event, expectedIsTest) {
    // Bắt buộc caller nội bộ truyền phạm vi xác thực đã được xác định ở server.
    if (typeof expectedIsTest !== 'boolean') throw localizedError(503, 'errors.payment.reviewEnvironment');
    const { provider, code, reference, amount, currency, success } = event;
    if (!success) return { settled: false, reason: 'not-paid' };
    if (!Number.isSafeInteger(amount) || amount <= 0 || currency !== 'VND' || !reference || reference.length > 191)
      throw localizedError(400, 'errors.payment.invalidTransaction');
    return this.client.withTransaction(async tx => {
      const [matches] = await tx.execute(`SELECT p.*,o.user_id,o.template_id,o.is_test,
        o.creator_amount_vnd,o.status AS order_status,t.creator_id AS seller_id
        FROM payment_intents p JOIN orders o ON o.id=p.order_id
        LEFT JOIN templates t ON t.id=o.template_id
        WHERE p.provider=? AND p.provider_order_code=? FOR UPDATE`, [provider, code]);
      const item = matches[0];
      if (!item) throw localizedError(404, 'errors.payment.orderNotFound');
      if (Number(item.amount_vnd) !== amount) throw localizedError(400, 'errors.payment.amountMismatch');
      // Kiểm tra trên đơn đã khóa, trước cả nhánh replay và mọi ghi dữ liệu.
      if (!samePaymentScope(expectedIsTest, storedPaymentScope(item.is_test)))
        throw localizedError(409, 'errors.payment.reviewEnvironment');
      if (item.status === 'paid' && item.order_status === 'paid') return { settled: true, replay: true, orderId: item.order_id };
      if (item.status !== 'pending' || item.order_status !== 'pending_payment') throw localizedError(409, 'errors.payment.orderState');
      // Event and entitlement are committed together. A failed transaction can be retried safely.
      await tx.execute('INSERT INTO payment_events(provider,event_key,payload) VALUES (?,?,?)',
        [provider, reference, JSON.stringify({ provider, code, reference, amount, currency })]);
      await tx.execute(`UPDATE payment_intents SET status='paid',provider_reference=?,paid_at=UTC_TIMESTAMP(3)
        WHERE id=? AND status='pending'`, [reference, item.id]);
      await tx.execute(`UPDATE orders SET status='paid',payload=JSON_SET(payload,'$.status','paid') WHERE id=?`, [item.order_id]);
      await tx.execute(`INSERT INTO payment_transactions
        (id,order_id,provider,provider_reference,amount_vnd,status,provider_payload)
        VALUES (?,?,?,?,?,'paid',?)`,
        [randomUUID(), item.order_id, provider, reference, amount, JSON.stringify({ verified: true, sandbox: Boolean(item.is_test) })]);
      await tx.execute(`INSERT INTO template_entitlements(id,user_id,template_id,order_id,granted_at)
        VALUES (?,?,?,?,UTC_TIMESTAMP(3))`, [randomUUID(), item.user_id, item.template_id, item.order_id]);
      await tx.execute(`INSERT INTO payment_receipts
        (order_id,receipt_no,provider,provider_reference,amount_vnd) VALUES (?,?,?,?,?)`,
        [item.order_id, receiptNo(item.order_id), provider, reference, amount]);
      // Ghim Creator tại thời điểm xác nhận thanh toán, trong cùng transaction.
      // UUID order là khóa sale duy nhất: webhook lặp không được ghi doanh thu lần hai.
      if (item.seller_id && Number(item.creator_amount_vnd) > 0) {
        await tx.execute(`INSERT INTO creator_ledger
          (id,order_id,creator_id,amount_vnd,category) VALUES (?,?,?,?,'sale')`,
          [item.order_id, item.order_id, item.seller_id, Number(item.creator_amount_vnd)]);
      }
      return { settled: true, replay: false, orderId: item.order_id };
    });
  }
  async close() { await this.client.close(); }
}
