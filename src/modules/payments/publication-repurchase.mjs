import { localizedError } from '../../shared/http.mjs';
import { activeEntitlementSql } from '../checkout/entitlement-policy.mjs';
import { readPublicationAuthority } from '../checkout/publication-credit.mjs';
import { storedPaymentScope } from './payment-scope.mjs';

const eligible = `o.is_test=1 AND o.status='paid' AND o.payment_provider='momo'
  AND ${activeEntitlementSql} AND c.gift_id IS NOT NULL AND c.consumed_at IS NOT NULL`;

export async function requireRepurchaseSchema(db) {
  const [rows] = await db.execute("SELECT version FROM schema_migrations WHERE version='019_publication_repurchases'");
  if (rows.length !== 1) throw localizedError(503, 'errors.payment.storage');
  await db.execute('SELECT previous_order_id,intent_id FROM publication_repurchases LIMIT 0');
}

// Chỉ đề xuất đơn đã dùng của chủ tài khoản, không lấy ID đơn từ người dùng khác.
export async function repurchaseCandidate(db, userId, templateId) {
  await requireRepurchaseSchema(db);
  if ((await readPublicationAuthority(db, userId, templateId)).allowed) return null;
  const [rows] = await db.execute(`SELECT o.id FROM orders o
    JOIN template_entitlements e ON e.order_id=o.id
    JOIN publication_credits c ON c.entitlement_id=e.id
    WHERE o.user_id=? AND o.template_id=? AND ${eligible}
    AND NOT EXISTS (SELECT 1 FROM publication_repurchases r JOIN payment_intents p ON p.id=r.intent_id
      WHERE r.previous_order_id=o.id AND p.status<>'pending')
    ORDER BY c.consumed_at DESC,o.id DESC LIMIT 1`, [userId, templateId]);
  return rows[0]?.id ?? null;
}

export async function findRepurchase(tx, { userId, templateId, previousOrderId, isTest, provider }) {
  if (isTest !== true || provider !== 'momo') throw localizedError(503, 'errors.payment.reviewEnvironment');
  await requireRepurchaseSchema(tx);
  // Cùng khóa chủ tài khoản với hai luồng xuất bản và checkout theo scope.
  const [users] = await tx.execute('SELECT id FROM users WHERE id=? FOR UPDATE', [userId]);
  if (!users.length) throw localizedError(403, 'errors.forbidden');
  const [previous] = await tx.execute(`SELECT o.id FROM orders o
    JOIN template_entitlements e ON e.order_id=o.id
    JOIN publication_credits c ON c.entitlement_id=e.id
    WHERE o.id=? AND o.user_id=? AND o.template_id=? AND ${eligible} FOR UPDATE`,
    [previousOrderId, userId, templateId]);
  if (!previous.length) throw localizedError(409, 'errors.payment.previousClosed');
  const [replays] = await tx.execute(`SELECT p.*,o.is_test,o.user_id AS order_user,o.template_id AS order_template
    FROM publication_repurchases r JOIN payment_intents p ON p.id=r.intent_id
    JOIN orders o ON o.id=p.order_id WHERE r.previous_order_id=? FOR UPDATE`, [previousOrderId]);
  const replay = replays[0];
  if (replay) {
    if (replay.order_user !== userId || replay.order_template !== templateId || storedPaymentScope(replay.is_test) !== true || replay.provider !== provider)
      throw localizedError(409, 'errors.payment.previousClosed');
    return replay;
  }
  if ((await readPublicationAuthority(tx, userId, templateId, { lock: true })).allowed)
    throw localizedError(409, 'errors.payment.alreadyLicensed');
  // Không giải phóng đơn pending chỉ vì timeout; phải đối soát provider trước.
  const [pending] = await tx.execute(`SELECT p.id FROM payment_intents p JOIN orders o ON o.id=p.order_id
    WHERE o.user_id=? AND o.template_id=? AND (p.status='pending' OR o.status='pending_payment') LIMIT 1 FOR UPDATE`, [userId, templateId]);
  if (pending.length) throw localizedError(409, 'errors.payment.previousClosed');
  return null;
}

export async function rememberRepurchase(tx, previousOrderId, intentId) {
  await tx.execute('INSERT INTO publication_repurchases(previous_order_id,intent_id) VALUES (?,?)', [previousOrderId, intentId]);
}
