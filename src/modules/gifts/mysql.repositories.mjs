import { MySqlClient } from '../../infrastructure/mysql/client.mjs';
import { HttpError } from '../../shared/http.mjs';
import { mysqlDate } from '../identity/mysql.repositories.mjs';

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
    createdAt: iso(row.created_at), expiresAt: iso(row.expires_at) };
}
function asReply(row) {
  return { id: row.id, giftId: row.gift_id, name: row.name,
    message: row.message, createdAt: iso(row.created_at) };
}

export class MySqlGiftsRepository {
  constructor(client = new MySqlClient()) { this.client = client; }
  async getBySlug(slug) {
    const [rows] = await this.client.execute('SELECT * FROM gifts WHERE slug=? LIMIT 1', [slug]);
    return asGift(rows[0]);
  }
  async allForUser(userId) {
    const [rows] = await this.client.execute('SELECT * FROM gifts WHERE user_id=? ORDER BY created_at DESC, id DESC', [userId]);
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
  async addReply(giftId, reply) {
    return this.client.withTransaction(async tx => {
      const [rows] = await tx.execute('SELECT expires_at FROM gifts WHERE id=? FOR UPDATE', [giftId]);
      if (!rows.length) throw new HttpError(404, 'Không tìm thấy món quà.');
      if (new Date(iso(rows[0].expires_at)) < new Date())
        throw new HttpError(410, 'Món quà đã hết thời gian hoạt động.');
      await tx.execute(`INSERT INTO gift_replies(id, gift_id, name, message, created_at)
        VALUES (?, ?, ?, ?, ?)`,
      [reply.id, giftId, reply.name, reply.message, mysqlDate(reply.createdAt)]);
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
}
