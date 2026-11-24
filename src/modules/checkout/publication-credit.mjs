import { localizedError } from '../../shared/http.mjs';
import { activeEntitlementSql } from './entitlement-policy.mjs';

export async function requireCreditSchema(db) {
  const [rows] = await db.execute("SELECT version FROM schema_migrations WHERE version='018_publication_credits'");
  if (rows.length !== 1) throw localizedError(503, 'errors.payment.storage');
  await db.execute('SELECT entitlement_id,gift_id,consumed_at FROM publication_credits LIMIT 0');
}

// Quyền lịch sử không có dòng credit vẫn giữ quyền cũ; không suy diễn từ số thiệp đã tạo.
export function publicationAuthority(rows) {
  const legacyUnlimited = rows.some(row => row.credit_id === null);
  const available = rows.filter(row => row.credit_id !== null && row.gift_id === null);
  const consumed = rows.filter(row => row.credit_id !== null && row.gift_id !== null).length;
  return { allowed: legacyUnlimited || available.length > 0, creditId: legacyUnlimited ? null : available[0]?.credit_id ?? null,
    legacyUnlimited, remaining: available.length, consumed };
}

export async function readPublicationAuthority(db, ownerId, templateId, { lock = false } = {}) {
  const [rows] = await db.execute(`SELECT e.id,c.entitlement_id AS credit_id,c.gift_id
    FROM template_entitlements e JOIN orders o ON o.id=e.order_id
    LEFT JOIN publication_credits c ON c.entitlement_id=e.id
    WHERE e.user_id=? AND e.template_id=? AND ${activeEntitlementSql}
    ORDER BY e.granted_at,e.id${lock ? ' FOR UPDATE' : ''}`, [ownerId, templateId]);
  return publicationAuthority(rows);
}

// Cấp trong cùng transaction tạo entitlement; khóa chính chống cấp hai lần.
export async function grantPublicationCredit(tx, entitlementId) {
  await tx.execute('INSERT INTO publication_credits(entitlement_id) VALUES (?)', [entitlementId]);
}

// Chỉ gọi sau khi INSERT gift, nhưng trước COMMIT của cùng transaction.
export async function consumePublicationCredit(tx, authority, giftId) {
  if (!authority.allowed) throw localizedError(402, 'errors.gift.licenseRequired');
  if (authority.creditId === null) return;
  const [result] = await tx.execute(`UPDATE publication_credits SET gift_id=?,consumed_at=UTC_TIMESTAMP(3)
    WHERE entitlement_id=? AND gift_id IS NULL AND consumed_at IS NULL`, [giftId, authority.creditId]);
  if (result.affectedRows !== 1) throw localizedError(409, 'errors.payment.previousClosed');
}
