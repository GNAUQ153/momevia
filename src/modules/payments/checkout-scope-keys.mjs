import { localizedError } from '../../shared/http.mjs';
import { storedPaymentScope } from './payment-scope.mjs';

function validateKey(row, userId, templateId) {
  if (!row) return null;
  if (row.order_user !== userId || row.order_template !== templateId || storedPaymentScope(row.is_test) === null)
    throw localizedError(409, 'errors.payment.previousClosed');
  return row;
}

// Khóa theo chủ tài khoản trước khi đọc/tạo intent. Cả hai khóa nằm cùng transaction.
export async function findScopedCheckout(tx, userId, templateId, isTest) {
  const [schema] = await tx.execute("SELECT version FROM schema_migrations WHERE version='017_payment_scope_keys'");
  if (!schema.length) throw localizedError(503, 'errors.payment.storage');
  const [users] = await tx.execute('SELECT id FROM users WHERE id=? FOR UPDATE', [userId]);
  if (!users.length) throw localizedError(403, 'errors.forbidden');
  const [scopedRows] = await tx.execute(`SELECT p.*,o.is_test,o.user_id AS order_user,o.template_id AS order_template
    FROM payment_checkout_scope_keys k JOIN payment_intents p ON p.id=k.intent_id JOIN orders o ON o.id=p.order_id
    WHERE k.user_id=? AND k.template_id=? AND k.is_test=? FOR UPDATE`, [userId, templateId, Number(isTest)]);
  const scoped = validateKey(scopedRows[0], userId, templateId);
  if (scoped && storedPaymentScope(scoped.is_test) !== isTest)
    throw localizedError(409, 'errors.payment.previousClosed');
  const [legacyRows] = await tx.execute(`SELECT p.*,o.is_test,o.user_id AS order_user,o.template_id AS order_template
    FROM payment_checkout_keys k JOIN payment_intents p ON p.id=k.intent_id JOIN orders o ON o.id=p.order_id
    WHERE k.user_id=? AND k.template_id=? FOR UPDATE`, [userId, templateId]);
  const legacy = validateKey(legacyRows[0], userId, templateId);
  const matchingLegacy = legacy && storedPaymentScope(legacy.is_test) === isTest ? legacy : null;
  if (scoped && matchingLegacy && scoped.id !== matchingLegacy.id)
    throw localizedError(409, 'errors.payment.previousClosed');
  // Không sao chép khóa lịch sử; luôn đọc lại, kể cả khóa tạo sau migration.
  return { existing: scoped || matchingLegacy, legacy };
}

export async function rememberScopedCheckout(tx, userId, templateId, isTest, intentId, legacy) {
  await tx.execute(`INSERT INTO payment_checkout_scope_keys (user_id,template_id,is_test,intent_id)
    VALUES (?,?,?,?)`, [userId, templateId, Number(isTest), intentId]);
  // Giữ khóa đầu tiên cho runtime cũ: khi tắt tính năng, không tạo lại một giao dịch khác.
  if (!legacy) await tx.execute(`INSERT INTO payment_checkout_keys (user_id,template_id,intent_id)
    VALUES (?,?,?)`, [userId, templateId, intentId]);
}
