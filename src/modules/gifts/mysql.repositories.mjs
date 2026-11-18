import { MySqlClient } from '../../infrastructure/mysql/client.mjs';
import { HttpError } from '../../shared/http.mjs';
import { mysqlDate } from '../identity/mysql.repositories.mjs';
import { requireGiftPermission } from './access.mjs';
import { checkReplyReplay } from './replies.mjs';

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
    message: row.message, createdAt: iso(row.created_at), readStatus: row.read_status };
}

export class MySqlGiftsRepository {
  constructor(client = new MySqlClient()) { this.client = client; }
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
    await this.client.execute(`INSERT INTO gifts
      (id, slug, user_id, template_id, recipient_name, sender_name, message,
       image_file, reply_count, created_at, expires_at, payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [gift.id, gift.slug, gift.userId, gift.templateId, gift.recipientName, gift.senderName,
      gift.message, gift.imageFile, 0, mysqlDate(gift.createdAt), mysqlDate(gift.expiresAt), JSON.stringify(gift)]);
    return gift;
  }
  async revoke(ownerId, giftId, revokedAt) {
    return this.client.withTransaction(async tx => {
      const [rows] = await tx.execute('SELECT * FROM gifts WHERE id=? AND user_id=? FOR UPDATE', [giftId, ownerId]);
      if (!rows.length) throw new HttpError(404, 'Không tìm thấy món quà.');
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
      if (!rows.length) throw new HttpError(404, 'Không tìm thấy món quà.');
      const { expires_at, payload } = rows[0];
      requireGiftPermission({ ...(typeof payload === 'string' ? JSON.parse(payload) : payload), expiresAt: iso(expires_at) }, invite, 'canSend');
      const [existing] = await tx.execute('SELECT * FROM gift_replies WHERE gift_id=? AND id=?', [giftId, reply.id]);
      if (existing.length) return checkReplyReplay(asReply(existing[0]), reply);
      acceptNew();
      await tx.execute(`INSERT INTO gift_replies(id, gift_id, name, message, created_at, read_status)
        VALUES (?, ?, ?, ?, ?, ?)`,
      [reply.id, giftId, reply.name, reply.message, mysqlDate(reply.createdAt), reply.readStatus ?? null]);
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
