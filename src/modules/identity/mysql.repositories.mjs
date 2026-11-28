import { MySqlClient } from '../../infrastructure/mysql/client.mjs';
import { localizedError } from '../../shared/http.mjs';
import { signSession, verifySession } from '../../shared/security.mjs';
import { findRevocationTarget, inventoryResult, sessionInventoryLimit } from './session-inventory.mjs';
import { mysqlDate, mysqlTimestampToIso as fromMysqlDate } from '../../infrastructure/mysql/datetime.mjs';

// Giữ đường dẫn import cũ cho các công cụ migration và consumer hiện có.
export { mysqlDate };
function payload(value) { return typeof value === 'string' ? JSON.parse(value) : (value || {}); }
function userFromRow(row) {
  if (!row) return null;
  return {
    ...payload(row.legacy_payload), id: row.id, provider: row.provider, providerId: row.provider_id,
    name: row.name, email: row.email, passwordHash: row.password_hash, avatar: row.avatar,
    role: row.role, createdAt: fromMysqlDate(row.created_at),
  };
}
function duplicated(error) {
  if (error?.code === 'ER_DUP_ENTRY') throw localizedError(409, 'errors.auth.duplicate');
  throw error;
}
export class MySqlUsersRepository {
  constructor(client = new MySqlClient()) { this.client = client; }
  async all() {
    const [rows] = await this.client.execute('SELECT * FROM users ORDER BY created_at, id');
    return rows.map(userFromRow);
  }
  async findByProvider(provider, providerId) {
    const [rows] = await this.client.execute('SELECT * FROM users WHERE provider=? AND provider_id=? LIMIT 1', [provider, String(providerId)]);
    return userFromRow(rows[0]);
  }
  async findAnyByEmail(email) {
    const [rows] = await this.client.execute('SELECT * FROM users WHERE LOWER(email)=? LIMIT 1', [email]);
    return userFromRow(rows[0]);
  }
  async findByEmail(email) {
    const [rows] = await this.client.execute(`SELECT * FROM users WHERE email_login=? AND provider='email' LIMIT 1`, [email]);
    return userFromRow(rows[0]);
  }
  async get(id) {
    const [rows] = await this.client.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
    return userFromRow(rows[0]);
  }
  async insert(user) {
    try {
      await this.client.execute(`INSERT INTO users
        (id, provider, provider_id, name, email, password_hash, avatar, role, created_at, legacy_payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, user.provider, user.providerId, user.name, user.email || null,
        user.passwordHash || null, user.avatar || null, user.role, mysqlDate(user.createdAt), JSON.stringify(user)]);
      return user;
    } catch (error) { duplicated(error); }
  }
  async update(id, patch) {
    return this.mutate(id, () => patch);
  }
  async mutate(id, update, { session = null } = {}) {
    try {
      return await this.client.withTransaction(async tx => {
        const [rows] = await tx.execute('SELECT * FROM users WHERE id = ? FOR UPDATE', [id]);
        if (!rows.length) return null;
        const current = userFromRow(rows[0]);
        if (session) {
          if (session.sub !== id || (current.credentialVersion || 0) !== (session.cv || 0))
            throw localizedError(401, 'errors.unauthorized');
          // Khóa theo cùng thứ tự với revokeOne/revokeOthers: user rồi session.
          const [active] = await tx.execute(`SELECT id FROM sessions
            WHERE id=? AND user_id=? AND expires_at > UTC_TIMESTAMP(3) FOR UPDATE`, [session.jti, id]);
          if (!active.length || session.exp <= Date.now() / 1000)
            throw localizedError(401, 'errors.unauthorized');
        }
        const patch = update(current);
        if (!patch) return current;
        const user = { ...current, ...patch, id };
        await tx.execute(`UPDATE users SET provider=?, provider_id=?, name=?, email=?, password_hash=?, avatar=?,
          role=?, legacy_payload=? WHERE id=?`,
        [user.provider, user.providerId, user.name, user.email || null, user.passwordHash || null,
          user.avatar || null, user.role, JSON.stringify(user), id]);
        return user;
      });
    } catch (error) { duplicated(error); }
  }
}

// JWT signature is not sufficient: every request verifies jti against the database.
export class MySqlSessionStore {
  constructor(client, users, secret) { Object.assign(this, { client, users, secret }); }
  async create(user) {
    const token = signSession(user, this.secret);
    const claims = verifySession(token, this.secret);
    await this.client.execute('DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP(3)');
    await this.client.execute('INSERT INTO sessions (id, user_id, expires_at, credential_version, issued_at) VALUES (?, ?, ?, ?, ?)',
      [claims.jti, user.id, mysqlDate(new Date(claims.exp * 1000).toISOString()), claims.cv, mysqlDate(new Date().toISOString())]);
    return token;
  }
  async find(token) {
    const claims = verifySession(token, this.secret);
    if (!claims) return null;
    const [rows] = await this.client.execute(`SELECT id FROM sessions
      WHERE id=? AND user_id=? AND expires_at > UTC_TIMESTAMP(3) LIMIT 1`, [claims.jti, claims.sub]);
    if (!rows.length) return null;
    const user = await this.users.get(claims.sub);
    return user && (user.credentialVersion || 0) === (claims.cv || 0) ? { ...claims, role: user.role, name: user.name } : null;
  }
  async mutateAuthenticated(token, update) {
    const claims = verifySession(token, this.secret);
    if (!claims) throw localizedError(401, 'errors.unauthorized');
    const result = await this.users.mutate(claims.sub, update, { session: claims });
    if (!result) throw localizedError(401, 'errors.unauthorized');
    return result;
  }
  // Khóa hàng tài khoản để hai thao tác đồng thời không thu hồi chéo phiên đang dùng.
  async revokeOthers(token) {
    const claims = verifySession(token, this.secret);
    if (!claims) return false;
    return this.client.withTransaction(async tx => {
      const [users] = await tx.execute('SELECT * FROM users WHERE id = ? FOR UPDATE', [claims.sub]);
      const user = userFromRow(users[0]);
      if (!user || (user.credentialVersion || 0) !== (claims.cv || 0)) return false;
      const [rows] = await tx.execute(`SELECT id FROM sessions
        WHERE id=? AND user_id=? AND expires_at > UTC_TIMESTAMP(3) FOR UPDATE`, [claims.jti, claims.sub]);
      if (!rows.length || claims.exp <= Date.now() / 1000) return false;
      await tx.execute('DELETE FROM sessions WHERE user_id=? AND id<>?', [claims.sub, claims.jti]);
      return true;
    });
  }
  async listActive(token) {
    const claims = await this.find(token);
    if (!claims) return null;
    const [rows] = await this.client.execute(`SELECT id, issued_at, expires_at FROM sessions
      WHERE user_id=? AND expires_at > UTC_TIMESTAMP(3) AND (id=? OR credential_version=?)
      ORDER BY (id=?) DESC, expires_at DESC, id LIMIT ?`,
    [claims.sub, claims.jti, claims.cv || 0, claims.jti, sessionInventoryLimit + 1]);
    const [counts] = await this.client.execute(`SELECT COUNT(*) AS total FROM sessions
      WHERE user_id=? AND expires_at > UTC_TIMESTAMP(3) AND credential_version IS NULL AND id<>?`, [claims.sub, claims.jti]);
    return inventoryResult(rows.map(row => ({ id: row.id, issuedAt: row.issued_at == null ? null : fromMysqlDate(row.issued_at),
      expiresAt: fromMysqlDate(row.expires_at) })), claims, Number(counts[0].total), this.secret);
  }
  async revokeOne(token, ref) {
    const claims = verifySession(token, this.secret);
    if (!claims) return null;
    return this.client.withTransaction(async tx => {
      const [users] = await tx.execute('SELECT * FROM users WHERE id = ? FOR UPDATE', [claims.sub]);
      const user = userFromRow(users[0]);
      if (!user || (user.credentialVersion || 0) !== (claims.cv || 0)) return null;
      const [current] = await tx.execute(`SELECT id FROM sessions
        WHERE id=? AND user_id=? AND expires_at > UTC_TIMESTAMP(3) FOR UPDATE`, [claims.jti, claims.sub]);
      if (!current.length || claims.exp <= Date.now() / 1000) return null;
      const [rows] = await tx.execute(`SELECT id FROM sessions
        WHERE user_id=? AND id<>? AND credential_version=? AND expires_at > UTC_TIMESTAMP(3)
        ORDER BY expires_at DESC, id LIMIT ? FOR UPDATE`, [claims.sub, claims.jti, claims.cv || 0, sessionInventoryLimit - 1]);
      const target = findRevocationTarget(rows, claims, ref, this.secret);
      if (!target) return false;
      if (claims.exp <= Date.now() / 1000) return null;
      const [result] = await tx.execute(`DELETE FROM sessions WHERE id=? AND user_id=? AND id<>?
        AND credential_version=? AND expires_at > UTC_TIMESTAMP(3)`, [target.id, claims.sub, claims.jti, claims.cv || 0]);
      return result.affectedRows === 1;
    });
  }
  async revoke(token) {
    const claims = verifySession(token, this.secret);
    if (claims) await this.client.execute('DELETE FROM sessions WHERE id=? AND user_id=?', [claims.jti, claims.sub]);
  }
}

export class MySqlRoleService {
  constructor(users) { this.users = users; }
  async requireAdmin(actorId) {
    if ((await this.users.get(actorId))?.role !== 'admin')
      throw localizedError(403, 'errors.auth.adminRole');
  }
  async list(actorId) { await this.requireAdmin(actorId); return this.users.all(); }
  async change(actorId, userId, role) {
    await this.requireAdmin(actorId);
    if (typeof userId !== 'string' || !userId || userId.length > 100 || !['sender','creator','admin'].includes(role))
      throw localizedError(400, 'errors.auth.invalidRole');
    const user = await this.users.get(userId);
    if (!user) throw localizedError(404, 'errors.auth.noAccount');
    return user.role === role ? user : this.users.update(userId, { role });
  }
}
