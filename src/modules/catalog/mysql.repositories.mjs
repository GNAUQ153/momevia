import { MySqlClient } from '../../infrastructure/mysql/client.mjs';
import { HttpError } from '../../shared/http.mjs';
import { mysqlDate } from '../identity/mysql.repositories.mjs';

function iso(value) {
  return value instanceof Date ? value.toISOString() : new Date(`${String(value).replace(' ', 'T').replace(/Z$/, '')}Z`).toISOString();
}
function fromRow(row) {
  if (!row) return null;
  const extra = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
  return { ...extra, id: row.id, creatorId: row.creator_id || 'system', title: row.title,
    style: row.style, theme: row.theme, price: row.price_vnd, status: row.status, createdAt: iso(row.created_at) };
}
export class MySqlTemplatesRepository {
  constructor(client = new MySqlClient()) { this.client = client; }
  async all() {
    const [rows] = await this.client.execute('SELECT * FROM templates ORDER BY created_at, id');
    return rows.map(fromRow);
  }
  async get(id) {
    const [rows] = await this.client.execute('SELECT * FROM templates WHERE id=? LIMIT 1', [id]);
    return fromRow(rows[0]);
  }
  async insert(item) {
    await this.client.execute(`INSERT INTO templates
      (id, creator_id, title, style, theme, price_vnd, status, created_at, payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [item.id, item.creatorId === 'system' ? null : (item.creatorId || null), item.title, item.style,
      item.theme, item.price, item.status, mysqlDate(item.createdAt), JSON.stringify(item)]);
    return item;
  }
  async insertUnique(item) { return this.insert(item); }
  async update(id, patch) {
    return this.mutate(id, () => patch);
  }
  async mutate(id, update) {
    return this.client.withTransaction(async tx => {
      const [rows] = await tx.execute('SELECT * FROM templates WHERE id=? FOR UPDATE', [id]);
      if (!rows.length) return null;
      const current = fromRow(rows[0]);
      const patch = update(current);
      if (!patch) return current;
      const value = { ...current, ...patch, id };
      await tx.execute(`UPDATE templates SET creator_id=?, title=?, style=?, theme=?, price_vnd=?, status=?, payload=?
        WHERE id=?`, [value.creatorId === 'system' ? null : (value.creatorId || null), value.title, value.style,
        value.theme, value.price, value.status, JSON.stringify(value), id]);
      return value;
    });
  }
}
export class MySqlFavoritesService {
  constructor(client = new MySqlClient()) { this.client = client; }
  async list(userId, publishedIds) {
    const [rows] = await this.client.execute('SELECT template_id AS templateId FROM favorites WHERE user_id=?', [userId]);
    return rows.map(row => row.templateId).filter(id => publishedIds.has(id));
  }
  async set(userId, templateId, saved, publishedIds) {
    if (!publishedIds.has(templateId)) throw new HttpError(404, 'Mẫu chưa được phát hành.');
    if (typeof saved !== 'boolean') throw new HttpError(400, 'Trạng thái yêu thích không hợp lệ.');
    if (saved) {
      await this.client.execute(`INSERT INTO favorites(user_id, template_id, created_at) VALUES (?, ?, UTC_TIMESTAMP(3))
        ON DUPLICATE KEY UPDATE template_id=VALUES(template_id)`, [userId, templateId]);
    } else {
      await this.client.execute('DELETE FROM favorites WHERE user_id=? AND template_id=?', [userId, templateId]);
    }
    return { templateId, saved };
  }
}
