import { randomUUID } from 'node:crypto';
import { localizedError } from '../../shared/http.mjs';
import { sanitizeText } from '../../shared/security.mjs';
import { verifiedReceiptSql } from './receipt-policy.mjs';
import { refundAssessmentQuery, refundAssessment } from './refund-assessment.mjs';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const refundReasons = Object.freeze([
  'duplicate_payment', 'technical_problem', 'not_as_described', 'other',
]);
export const refundStates = Object.freeze([
  'submitted', 'in_review', 'awaiting_provider', 'closed_declined',
]);
// Bộ lọc hàng đợi chỉ nhận giá trị đã định nghĩa; không ghép chuỗi client vào SQL.
export const refundQueueFilters = Object.freeze([
  'active', 'submitted', 'in_review', 'awaiting_provider', 'closed_declined', 'all',
]);
const queueCursorTimestamp = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/;

export function readRefundQueueCursor(value, filter) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.length > 256 || !/^[A-Za-z0-9_-]+$/.test(value))
    throw localizedError(400, 'refund.queue.invalidCursor');
  try {
    const bytes = Buffer.from(value, 'base64url');
    if (bytes.toString('base64url') !== value) throw new Error('Non-canonical cursor');
    const cursor = JSON.parse(bytes.toString('utf8'));
    if (!cursor || cursor.v !== 1 || cursor.filter !== filter
      || typeof cursor.time !== 'string' || !queueCursorTimestamp.test(cursor.time)
      || typeof cursor.id !== 'string' || !uuidPattern.test(cursor.id))
      throw new Error('Malformed cursor');
    return { time: cursor.time, id: cursor.id };
  } catch {
    throw localizedError(400, 'refund.queue.invalidCursor');
  }
}

export function writeRefundQueueCursor(row, filter) {
  if (!queueCursorTimestamp.test(String(row.page_created)) || !uuidPattern.test(String(row.id)))
    throw new Error('Invalid database refund cursor fields');
  return Buffer.from(JSON.stringify({
    v: 1, filter, time: String(row.page_created), id: String(row.id),
  })).toString('base64url');
}

const transitions = Object.freeze({
  submitted: ['in_review', 'closed_declined'],
  in_review: ['awaiting_provider', 'closed_declined'],
  awaiting_provider: ['in_review'],
  closed_declined: [],
});

export function requireRefundId(value) {
  if (typeof value !== 'string' || !uuidPattern.test(value))
    throw localizedError(400, 'errors.payment.invalidOrder');
  return value;
}

export function validRefundRequest(body) {
  if (!body || typeof body !== 'object' || !refundReasons.includes(body.reasonCode))
    throw localizedError(400, 'refund.errors.reason');
  const detail = sanitizeText(body.detail, 500);
  if (detail.length < 10) throw localizedError(400, 'refund.errors.detail');
  return { reasonCode: body.reasonCode, detail };
}

export function validRefundTransition(body) {
  if (!body || typeof body !== 'object' || !refundStates.includes(body.expectedStatus)
    || !refundStates.includes(body.status) || !transitions[body.expectedStatus].includes(body.status))
    throw localizedError(400, 'refund.errors.transition');
  // Cần ghi nhận lý do; không chấp nhận thao tác im lặng khi thay đổi trạng thái.
  const note = sanitizeText(body.note, 500);
  if (note.length < 10) throw localizedError(400, 'refund.errors.detail');
  return { expectedStatus: body.expectedStatus, status: body.status, note };
}

export function publicRefundRow(row, { admin = false } = {}) {
  return {
    id: String(row.id), orderId: String(row.order_id),
    status: row.status, reasonCode: row.reason_code, detail: row.reason_detail,
    provider: ['momo', 'payos'].includes(row.payment_provider) ? row.payment_provider : 'unknown',
    sandbox: Boolean(row.is_test), amountVnd: Number(row.gross_vnd),
    createdAt: row.created_at, updatedAt: row.updated_at,
    ...(admin ? { requesterId: row.requester_id, ...(row.receipt_consistent == null ? {} : { assessment: refundAssessment(row) }) } : {}),
    // Không trả về mã ngân hàng, nội dung webhook hoặc dữ liệu khóa thanh toán.
    canRefund: false,
  };
}

export class RefundReviewRepository {
  constructor(client) { this.client = client; }

  async byBuyer(orderId, requesterId) {
    const [rows] = await this.client.execute(`SELECT r.*,o.payment_provider,o.is_test,o.gross_vnd
      FROM refund_review_requests r JOIN orders o ON o.id=r.order_id
      WHERE r.order_id=? AND r.requester_id=? LIMIT 1`, [orderId, requesterId]);
    return rows[0] ? publicRefundRow(rows[0]) : null;
  }

  async createBuyerRequest({ orderId, requesterId, reasonCode, detail }) {
    const id = randomUUID();
    try {
      return await this.client.withTransaction(async tx => {
        // Khoá đơn theo chủ sở hữu; chỉ nhận đơn paid có biên nhận xác thực, không nhận đơn demo.
        const [orders] = await tx.execute(`SELECT o.id,o.user_id,o.status,o.payment_provider,o.is_test,
          o.gross_vnd,r.order_id AS receipt_order
          FROM orders o JOIN payment_receipts r ON r.order_id=o.id
          JOIN payment_intents p ON p.order_id=o.id
          WHERE o.id=? AND o.user_id=? AND o.status='paid'
            AND (${verifiedReceiptSql}) FOR UPDATE`, [orderId, requesterId]);
        if (!orders.length) throw localizedError(404, 'refund.errors.notEligible');
        await tx.execute(`INSERT INTO refund_review_requests
          (id,order_id,requester_id,reason_code,reason_detail,status)
          VALUES (?,?,?,?,?,'submitted')`, [id, orderId, requesterId, reasonCode, detail]);
        await tx.execute(`INSERT INTO refund_review_events
          (request_id,actor_id,from_status,to_status,note)
          VALUES (?,?,NULL,'submitted',?)`, [id, requesterId, 'Người mua gửi yêu cầu rà soát']);
        return { id, orderId, status: 'submitted', reasonCode, detail,
          provider: orders[0].payment_provider, sandbox: Boolean(orders[0].is_test),
          amountVnd: Number(orders[0].gross_vnd), canRefund: false };
      });
    } catch (error) {
      if (error.code !== 'ER_DUP_ENTRY') throw error;
      const existing = await this.byBuyer(orderId, requesterId);
      if (existing) {
        // Chỉ replay đúng nội dung cũ mới được trả về thành công.
        // Tránh báo đã nhận yêu cầu mới khi hồ sơ cũ có lý do hoặc mô tả khác.
        if (existing.reasonCode !== reasonCode || existing.detail !== detail)
          throw localizedError(409, 'refund.errors.duplicatePayload');
        return existing;
      }
      throw error;
    }
  }

  async listAdmin(limit) {
    const { projection, joins } = await refundAssessmentQuery(this.client);
    const [rows] = await this.client.execute(`SELECT r.*,o.payment_provider,o.is_test,o.gross_vnd,${projection}
      FROM refund_review_requests r JOIN orders o ON o.id=r.order_id ${joins}
      ORDER BY r.created_at DESC,r.id DESC LIMIT ?`, [limit]);
    return rows.map(row => publicRefundRow(row, { admin: true }));
  }

  async pageAdmin({ limit, filter, cursor }) {
    const conditions = [];
    const params = [];
    if (filter === 'active') conditions.push("r.status IN ('submitted','in_review','awaiting_provider')");
    else if (filter !== 'all') {
      conditions.push('r.status=?');
      params.push(filter);
    }
    if (cursor) {
      conditions.push('(r.created_at < ? OR (r.created_at = ? AND r.id < ?))');
      params.push(cursor.time, cursor.time, cursor.id);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    // LIMIT + 1 chỉ dùng để xác định còn trang sau, không trả thừa dữ liệu ra client.
    const { projection, joins } = await refundAssessmentQuery(this.client);
    const [rows] = await this.client.execute(`SELECT r.*,o.payment_provider,o.is_test,o.gross_vnd,${projection},
      DATE_FORMAT(r.created_at,'%Y-%m-%d %H:%i:%s.%f') AS page_created
      FROM refund_review_requests r JOIN orders o ON o.id=r.order_id ${joins}
      ${where} ORDER BY r.created_at DESC,r.id DESC LIMIT ?`, [...params, limit + 1]);
    const page = rows.slice(0, limit);
    return {
      requests: page.map(row => publicRefundRow(row, { admin: true })),
      nextCursor: rows.length > limit ? writeRefundQueueCursor(page.at(-1), filter) : null,
    };
  }

  async historyAdmin(requestId, limit) {
    const [rows] = await this.client.execute(`SELECT e.id,e.actor_id,e.from_status,
      e.to_status,e.note,e.created_at FROM refund_review_events e
      WHERE e.request_id=? ORDER BY e.id DESC LIMIT ?`, [requestId, limit]);
    return rows.map(row => ({ id: String(row.id), actorId: row.actor_id,
      fromStatus: row.from_status, toStatus: row.to_status,
      note: row.note, createdAt: row.created_at }));
  }

  async moveAdmin({ requestId, actorId, expectedStatus, status, note }) {
    return this.client.withTransaction(async tx => {
      const [rows] = await tx.execute(`SELECT r.*,o.payment_provider,o.is_test,o.gross_vnd
        FROM refund_review_requests r JOIN orders o ON o.id=r.order_id
        WHERE r.id=? FOR UPDATE`, [requestId]);
      if (!rows.length) throw localizedError(404, 'refund.errors.notFound');
      if (rows[0].status !== expectedStatus)
        throw localizedError(409, 'refund.errors.conflict');
      const [updated] = await tx.execute(`UPDATE refund_review_requests SET status=?,updated_at=UTC_TIMESTAMP(3)
        WHERE id=? AND status=?`, [status, requestId, expectedStatus]);
      if (updated.affectedRows !== 1) throw localizedError(409, 'refund.errors.conflict');
      await tx.execute(`INSERT INTO refund_review_events
        (request_id,actor_id,from_status,to_status,note) VALUES (?,?,?,?,?)`,
      [requestId, actorId, expectedStatus, status, note]);
      return { ...publicRefundRow(rows[0], { admin: true }), status };
    });
  }
}

export class RefundReviewService {
  constructor({ repository, env = process.env }) { this.repository = repository; this.env = env; }
  requireMySql() {
    if (this.env.CHECKOUT_STORAGE !== 'mysql') throw localizedError(503, 'errors.payment.storage');
  }
  requireUser(user) {
    if (!user?.sub) throw localizedError(401, 'errors.unauthorized');
  }
  requireAdmin(user) {
    this.requireUser(user);
    if (user.role !== 'admin') throw localizedError(403, 'errors.forbidden');
  }
  limit(value) {
    if (value == null || value === '') return 50;
    if (!/^[1-9][0-9]{0,2}$/.test(String(value)) || Number(value) > 100)
      throw localizedError(400, 'errors.payment.reviewLimit');
    return Number(value);
  }
  async buyerGet(user, orderId) {
    this.requireUser(user);
    this.requireMySql();
    return this.repository.byBuyer(requireRefundId(orderId), user.sub);
  }
  async buyerCreate(user, orderId, body) {
    this.requireUser(user);
    this.requireMySql();
    return this.repository.createBuyerRequest({
      orderId: requireRefundId(orderId), requesterId: user.sub, ...validRefundRequest(body),
    });
  }
  async adminList(user, limit) {
    this.requireAdmin(user);
    this.requireMySql();
    return this.repository.listAdmin(this.limit(limit));
  }
  async adminQueue(user, { limit, filter = 'active', cursor } = {}) {
    this.requireAdmin(user);
    this.requireMySql();
    if (!refundQueueFilters.includes(filter))
      throw localizedError(400, 'refund.queue.invalidFilter');
    return this.repository.pageAdmin({
      limit: this.limit(limit == null ? 20 : limit),
      filter, cursor: readRefundQueueCursor(cursor, filter),
    });
  }
  async adminHistory(user, requestId, limit) {
    this.requireAdmin(user);
    this.requireMySql();
    return this.repository.historyAdmin(requireRefundId(requestId), this.limit(limit));
  }
  async adminMove(user, requestId, body) {
    this.requireAdmin(user);
    this.requireMySql();
    return this.repository.moveAdmin({
      requestId: requireRefundId(requestId), actorId: user.sub, ...validRefundTransition(body),
    });
  }
}
