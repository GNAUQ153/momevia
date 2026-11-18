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
             name, email, topic, message, status, created_at AS createdAt,
             report_kind AS reportKind, report_target AS reportTarget, assigned_to AS assignedTo, resolution
      FROM support_requests
      ORDER BY created_at DESC
    `);
    return rows.map(row => ({ ...row, createdAt: mysqlTimestampToIso(row.createdAt) }));
  }

  async insert(ticket) {
    // Identity on MySQL: enforce the actual user FK. Legacy JSON: keep the ID
    // in the bridge column rather than inventing a user row.
    const identityMysql = process.env.IDENTITY_STORAGE === 'mysql';
    const utcDate = ticket.createdAt.replace('T', ' ').replace('Z', '');
    const values = identityMysql ? '?, ?, ?, NULL, ?, ?, ?, ?, ?, ?' : '?, ?, NULL, ?, ?, ?, ?, ?, ?, ?';
    const reportColumns = ticket.reportKind ? ', report_kind, report_target' : '';
    const reportParameters = ticket.reportKind ? ', ?, ?' : '';
    await this.client.execute(`
      INSERT INTO support_requests
        (id, code, user_id, legacy_user_id, name, email, topic, message, status, created_at${reportColumns})
      VALUES (${values}${reportParameters})
    `, [ticket.id, ticket.code, ticket.userId, ticket.name,
      ticket.email, ticket.topic, ticket.message, ticket.status, utcDate,
      ...(ticket.reportKind ? [ticket.reportKind, ticket.reportTarget] : [])]);
    return ticket;
  }

  async updateRequest(id, patch, expected) {
    const [result] = await this.client.execute(`UPDATE support_requests SET status=?, assigned_to=?, resolution=?
      WHERE id=? AND status=? AND assigned_to <=> ?`,
    [patch.status, patch.assignedTo, patch.resolution, id, expected.status, expected.assignedTo || null]);
    return result.affectedRows === 1;
  }
  async updateReport(id, patch, expected) { return this.updateRequest(id, patch, expected); }

  async close() { await this.client.close(); }
}
