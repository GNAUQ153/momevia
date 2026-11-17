import { MySqlClient } from '../../infrastructure/mysql/client.mjs';

function mysqlTimestampToIso(value) {
  if (value instanceof Date) return value.toISOString();
  return new Date(`${String(value).replace(' ', 'T').replace(/Z$/, '')}Z`).toISOString();
}

export class MySqlSupportRepository {
  constructor(client = new MySqlClient()) { this.client = client; }

  async all() {
    const [rows] = await this.client.execute(`
      SELECT id, code, COALESCE(user_id, legacy_user_id) AS userId,
             name, email, topic, message, status, created_at AS createdAt
      FROM support_requests
      ORDER BY created_at DESC
    `);
    return rows.map(row => ({ ...row, createdAt: mysqlTimestampToIso(row.createdAt) }));
  }

  async insert(ticket) {
    // Identity vẫn ở JSON: không tạo FK giả. Giữ nguyên mã nguồn trong cột bridge.
    const utcDate = ticket.createdAt.replace('T', ' ').replace('Z', '');
    await this.client.execute(`
      INSERT INTO support_requests
        (id, code, user_id, legacy_user_id, name, email, topic, message, status, created_at)
      VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)
    `, [ticket.id, ticket.code, ticket.userId, ticket.name,
      ticket.email, ticket.topic, ticket.message, ticket.status, utcDate]);
    return ticket;
  }

  async close() { await this.client.close(); }
}
