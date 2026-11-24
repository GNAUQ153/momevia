import { MySqlClient } from '../../infrastructure/mysql/client.mjs';
import { localizedError } from '../../shared/http.mjs';
import { mysqlDate } from '../identity/mysql.repositories.mjs';
import { requireGiftPermission } from './access.mjs';
import { checkReplyReplay } from './replies.mjs';
import { readPublicationAuthority, consumePublicationCredit } from '../checkout/publication-credit.mjs';

function iso(value) {
  if (value instanceof Date) return value.toISOString();
  return new Date(`${String(value).replace(' ', 'T').replace(/Z$/, '')}Z`).toISOString();
}
function asGift(row) {
  if (!row) return null;
  const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload || {});
  return { ...payload, id: row.id, slug: row.slug, userId: row.user_id,
    templateId: row.template_id, recipientName: row.recipient_name, senderName: row.sender_name,
    message: row.message, imageFile: row.image_file, replyCount: Number(row.reply_count),
    createdAt: iso(row.created_at), expiresAt: iso(row.expires_at), unreadCount: Number(row.unread_count ?? 0) };
}
function asReply(row) {
  return { id: row.id, giftId: row.gift_id, name: row.name,
    recipientId: row.recipient_id || undefined, cardName: row.card_name || undefined,
    message: row.message, createdAt: iso(row.created_at), readStatus: row.read_status };
}

export class MySqlGiftsRepository {
  constructor(client = new MySqlClient(), { quotaEnabled = false } = {}) { this.client = client; this.quotaEnabled = quotaEnabled === true; }
  async get(id) {
    const [rows] = await this.client.execute('SELECT * FROM gifts WHERE id=? LIMIT 1', [id]);
    return asGift(rows[0]);
  }
  async mutateGift(giftId, update) {
    return this.client.withTransaction(async tx => {
      const [rows] = await tx.execute('SELECT * FROM gifts WHERE id=? FOR UPDATE', [giftId]);
      if (!rows.length) throw localizedError(404, 'errors.gift.notFound');
      const gift = asGift(rows[0]);
      const previousExpiry = gift.expiresAt;
      const result = update(gift);
      // Hạn trong cột SQL là nguồn đọc chính; ghi cùng payload trong transaction.
      if (gift.expiresAt !== previousExpiry) {
        await tx.execute('UPDATE gifts SET expires_at=?,payload=? WHERE id=?', [mysqlDate(gift.expiresAt), JSON.stringify(gift), giftId]);
      } else await tx.execute('UPDATE gifts SET payload=? WHERE id=?', [JSON.stringify(gift), giftId]);
      return result;
    });
  }
  async getBySlug(slug) {
    const [rows] = await this.client.execute(`SELECT g.*, (SELECT COUNT(*) FROM gift_replies r WHERE r.gift_id=g.id AND r.read_status='unread') AS unread_count
      FROM gifts g WHERE g.slug=? LIMIT 1`, [slug]);
    return asGift(rows[0]);
  }
  async allForUser(userId) {
    const [rows] = await this.client.execute(`SELECT g.*, (SELECT COUNT(*) FROM gift_replies r WHERE r.gift_id=g.id AND r.read_status='unread') AS unread_count
      FROM gifts g WHERE g.user_id=? ORDER BY g.created_at DESC, g.id DESC`, [userId]);
    return rows.map(asGift);
  }
  async insert(gift) {
    const persist = async db => {
      await db.execute(`INSERT INTO gifts
        (id, slug, user_id, template_id, recipient_name, sender_name, message,
         image_file, reply_count, created_at, expires_at, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [gift.id, gift.slug, gift.userId, gift.templateId, gift.recipientName, gift.senderName,
        gift.message, gift.imageFile, 0, mysqlDate(gift.createdAt), mysqlDate(gift.expiresAt), JSON.stringify(gift)]);
      return gift;
    };
    if (!this.quotaEnabled) return persist(this.client);
    return this.client.withTransaction(async tx => {
      // Cùng thứ tự khóa với Canvas; GiftService xử lý replay và dọn ảnh thừa sau lỗi.
      const [owners] = await tx.execute('SELECT id FROM users WHERE id=? FOR UPDATE', [gift.userId]);
      if (!owners.length) throw localizedError(403, 'errors.forbidden');
      const [existing] = await tx.execute('SELECT id FROM gifts WHERE id=? FOR UPDATE', [gift.id]);
      if (existing.length) throw localizedError(409, 'errors.payment.previousClosed');
      const [templates] = await tx.execute('SELECT price_vnd,status FROM templates WHERE id=? FOR UPDATE', [gift.templateId]);
      if (!templates.length || templates[0].status !== 'published') throw localizedError(404, 'errors.gift.notFound');
      const authority = Number(templates[0].price_vnd) > 0
        ? await readPublicationAuthority(tx, gift.userId, gift.templateId, { lock: true }) : null;
      if (authority && !authority.allowed) throw localizedError(402, 'errors.gift.licenseRequired');
      await persist(tx);
      if (authority) await consumePublicationCredit(tx, authority, gift.id);
      return gift;
    });
  }
  async revoke(ownerId, giftId, revokedAt) {
    return this.client.withTransaction(async tx => {
      const [rows] = await tx.execute('SELECT * FROM gifts WHERE id=? AND user_id=? FOR UPDATE', [giftId, ownerId]);
      if (!rows.length) throw localizedError(404, 'errors.gift.notFound');
      const gift = asGift(rows[0]);
      if (!gift.revokedAt) {
        gift.revokedAt = revokedAt;
        await tx.execute("UPDATE gifts SET payload=JSON_SET(payload,'$.revokedAt',?) WHERE id=?", [revokedAt, giftId]);
      }
      return gift;
    });
  }
  async addReply(giftId, reply, invite, acceptNew = () => {}) {
    return this.client.withTransaction(async tx => {
      const [rows] = await tx.execute('SELECT expires_at,payload FROM gifts WHERE id=? FOR UPDATE', [giftId]);
      if (!rows.length) throw localizedError(404, 'errors.gift.notFound');
      const { expires_at, payload } = rows[0];
      requireGiftPermission({ ...(typeof payload === 'string' ? JSON.parse(payload) : payload), expiresAt: iso(expires_at) }, invite, 'canSend');
      const [existing] = await tx.execute('SELECT * FROM gift_replies WHERE gift_id=? AND id=?', [giftId, reply.id]);
      if (existing.length) return checkReplyReplay(asReply(existing[0]), reply);
      acceptNew();
      await tx.execute(`INSERT INTO gift_replies(id, gift_id, name, message, created_at, read_status, recipient_id, card_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [reply.id, giftId, reply.name, reply.message, mysqlDate(reply.createdAt), reply.readStatus ?? null, reply.recipientId || null, reply.cardName || null]);
      await tx.execute('UPDATE gifts SET reply_count=reply_count+1 WHERE id=?', [giftId]);
      return reply;
    });
  }
}

export class MySqlRepliesRepository {
  constructor(client) { this.client = client; }
  async allForGift(giftId) {
    const [rows] = await this.client.execute('SELECT * FROM gift_replies WHERE gift_id=? ORDER BY created_at, id', [giftId]);
    return rows.map(asReply);
  }
  async markRead(giftId, ids) {
    await this.client.execute(`UPDATE gift_replies SET read_status='read' WHERE gift_id=? AND read_status='unread'
      AND id IN (${[...ids].map(() => '?').join(',')})`, [giftId, ...ids]);
    const [[{ count }]] = await this.client.execute("SELECT COUNT(*) AS count FROM gift_replies WHERE gift_id=? AND read_status='unread'", [giftId]);
    return Number(count);
  }
}
