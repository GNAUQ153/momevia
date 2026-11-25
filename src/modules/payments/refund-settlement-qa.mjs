import { randomUUID } from 'node:crypto';
import { requireRefundId } from './refund-review.mjs';
import { verifiedReceiptSql } from './receipt-policy.mjs';
import { requireCreditSchema } from '../checkout/publication-credit.mjs';
import { localizedError } from '../../shared/http.mjs';

const conflict = () => localizedError(409, 'errors.payment.orderState');
const integer = value => typeof value === 'number' && Number.isSafeInteger(value);

// Đây là mô phỏng hoàn tiền toàn phần trong QA, không phải bằng chứng hoàn tiền từ ngân hàng.
// Không đăng ký HTTP route hoặc gọi provider; cấm cả database từ xa và môi trường Railway.
export function requireRefundQa(client, env = process.env) {
  const target = client.env;
  if (env.REFUND_SETTLEMENT_QA_ENABLED !== 'true' || env.NODE_ENV !== 'test'
    || Object.keys(env).some(key => key.startsWith('RAILWAY_'))
    || env.PAYMENT_ENV !== 'sandbox' || env.PAYMENT_LIVE_ENABLED === 'true' || env.CANVAS_QA_MYSQL_ISOLATED !== 'true'
    || target?.MYSQL_HOST !== '127.0.0.1'
    || !/^momevia_canvas_qa_[a-z0-9_]+$/.test(target.MYSQL_DATABASE || ''))
    throw localizedError(503, 'errors.payment.reviewEnvironment');
  return target.MYSQL_DATABASE;
}

export function refundQaPlan(row, transactions, ledger, reference) {
  if (!row || row.review_status !== 'awaiting_provider' || row.requester_id !== row.user_id
    || ![1, '1'].includes(row.is_test) || !['momo', 'payos'].includes(row.provider)
    || ![1, '1'].includes(row.receipt_consistent) || !row.entitlement_id
    || row.entitlement_user !== row.user_id || row.entitlement_template !== row.template_id
    || !row.credit_id || row.gift_id !== null || row.consumed_at !== null
    || !integer(row.gross_vnd) || row.gross_vnd <= 0
    || !integer(row.creator_amount_vnd) || row.creator_amount_vnd < 0) throw conflict();
  const paid = transactions.filter(t => t.status === 'paid');
  const refunds = transactions.filter(t => t.status === 'refunded');
  if (paid.length !== 1 || paid[0].provider !== row.provider
    || paid[0].provider_reference !== row.provider_reference || paid[0].amount_vnd !== row.gross_vnd
    || transactions.length !== paid.length + refunds.length) throw conflict();
  const sales = ledger.filter(l => l.category === 'sale');
  const reversals = ledger.filter(l => l.category === 'refund');
  // Không suy ra Creator từ chủ mẫu hiện tại; đảo đúng bút toán sale đã ghim.
  if (ledger.length !== sales.length + reversals.length
    || (row.creator_amount_vnd > 0 ? sales.length !== 1 || sales[0].amount_vnd !== row.creator_amount_vnd
      || !sales[0].creator_id : sales.length !== 0)) throw conflict();
  const sale = sales[0] || null;
  if (row.order_status === 'refunded') {
    if (!row.revoked_at || refunds.length !== 1 || refunds[0].provider !== row.provider
      || refunds[0].provider_reference !== reference || refunds[0].amount_vnd !== row.gross_vnd
      || refunds[0].simulated !== 'true'
      || (sale ? reversals.length !== 1 || reversals[0].creator_id !== sale.creator_id
        || reversals[0].amount_vnd !== -sale.amount_vnd : reversals.length !== 0)) throw conflict();
    return { replayed: true, sale };
  }
  if (row.order_status !== 'paid' || row.revoked_at !== null || refunds.length || reversals.length) throw conflict();
  return { replayed: false, sale };
}

async function updateOne(tx, sql, params) {
  const [result] = await tx.execute(sql, params);
  if (result.affectedRows !== 1) throw conflict();
}

export class RefundSettlementQa {
  constructor(client, env = process.env) { this.client = client; this.env = env; }

  async simulate({ requestId, actorId, simulationId }) {
    const database = requireRefundQa(this.client, this.env);
    for (const id of [requestId, actorId, simulationId]) requireRefundId(id);
    const reference = `qa-refund:${simulationId.toLowerCase()}`;
    return this.client.withTransaction(async tx => {
      const [[target]] = await tx.execute('SELECT DATABASE() AS db');
      if (target?.db !== database) throw localizedError(503, 'errors.payment.reviewEnvironment');
      await requireCreditSchema(tx);
      const [[actor]] = await tx.execute('SELECT role FROM users WHERE id=?', [actorId]);
      if (actor?.role !== 'admin') throw localizedError(403, 'errors.forbidden');
      const [[request]] = await tx.execute('SELECT requester_id FROM refund_review_requests WHERE id=?', [requestId]);
      if (!request) throw localizedError(404, 'refund.errors.notFound');
      // Cùng thứ tự khóa chủ tài khoản như luồng xuất bản Canvas và Legacy.
      const [[owner]] = await tx.execute('SELECT id FROM users WHERE id=? FOR UPDATE', [request.requester_id]);
      if (!owner) throw conflict();
      const [[row]] = await tx.execute(`SELECT q.requester_id,q.status AS review_status,o.id AS order_id,
        o.user_id,o.template_id,o.status AS order_status,o.gross_vnd,o.creator_amount_vnd,o.is_test,
        p.provider,p.provider_reference,CASE WHEN (${verifiedReceiptSql}) THEN 1 ELSE 0 END AS receipt_consistent,
        e.id AS entitlement_id,e.user_id AS entitlement_user,e.template_id AS entitlement_template,e.revoked_at,
        c.entitlement_id AS credit_id,c.gift_id,c.consumed_at
        FROM refund_review_requests q JOIN orders o ON o.id=q.order_id
        JOIN payment_intents p ON p.order_id=o.id JOIN payment_receipts r ON r.order_id=o.id
        JOIN template_entitlements e ON e.order_id=o.id JOIN publication_credits c ON c.entitlement_id=e.id
        WHERE q.id=? AND q.requester_id=? FOR UPDATE`, [requestId, owner.id]);
      if (!row) throw conflict();
      const [transactions] = await tx.execute(`SELECT provider,provider_reference,amount_vnd,status,
        JSON_UNQUOTE(JSON_EXTRACT(provider_payload,'$.simulated')) AS simulated
        FROM payment_transactions WHERE order_id=? FOR UPDATE`, [row.order_id]);
      const [ledger] = await tx.execute(`SELECT creator_id,amount_vnd,category
        FROM creator_ledger WHERE order_id=? FOR UPDATE`, [row.order_id]);
      const plan = refundQaPlan(row, transactions, ledger, reference);
      if (!plan.replayed) {
        await updateOne(tx, `UPDATE orders SET status='refunded',payload=JSON_SET(payload,'$.status','refunded')
          WHERE id=? AND status='paid' AND is_test=1`, [row.order_id]);
        await updateOne(tx, `UPDATE template_entitlements SET revoked_at=UTC_TIMESTAMP(3)
          WHERE id=? AND revoked_at IS NULL`, [row.entitlement_id]);
        // Giữ receipt, intent và giao dịch paid ban đầu. Không xóa credit hoặc khóa checkout.
        await tx.execute(`INSERT INTO payment_transactions
          (id,order_id,provider,provider_reference,amount_vnd,status,provider_payload)
          VALUES (?,?,?,?,?,'refunded',?)`, [randomUUID(), row.order_id, row.provider, reference, row.gross_vnd,
          JSON.stringify({ simulated: true, requestId, actorId })]);
        if (plan.sale) await tx.execute(`INSERT INTO creator_ledger
          (id,order_id,creator_id,amount_vnd,category) VALUES (?,?,?,?,'refund')`,
        [randomUUID(), row.order_id, plan.sale.creator_id, -plan.sale.amount_vnd]);
        // Hồ sơ vẫn chờ provider vì không có xác nhận hoàn tiền thật.
        await tx.execute(`INSERT INTO refund_review_events(request_id,actor_id,from_status,to_status,note)
          VALUES (?,?,'awaiting_provider','awaiting_provider',?)`, [requestId, actorId, 'QA: mô phỏng hoàn tiền toàn phần, không chuyển tiền']);
      }
      return { simulated: true, orderId: row.order_id, amountVnd: row.gross_vnd, replayed: plan.replayed };
    });
  }
}
