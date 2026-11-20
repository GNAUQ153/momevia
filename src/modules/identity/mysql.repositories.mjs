import { MySqlClient } from '../../infrastructure/mysql/client.mjs';
import { localizedError } from '../../shared/http.mjs';
import { signSession, verifySession } from '../../shared/security.mjs';

export function mysqlDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) throw new Error('Invalid MySQL datetime');
  return date.toISOString().slice(0, 23).replace('T', ' ');
}
function fromMysqlDate(value) {
  if (value instanceof Date) return value.toISOString();
  return new Date(`${String(value).replace(' ', 'T').replace(/Z$/, '')}Z`).toISOString();
}
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
  async mutate(id, update) {
    try {
      return await this.client.withTransaction(async tx => {
        const [rows] = await tx.execute('SELECT * FROM users WHERE id = ? FOR UPDATE', [id]);
        if (!rows.length) return null;
        const current = userFromRow(rows[0]);
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
    await this.client.execute('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
      [claims.jti, user.id, mysqlDate(new Date(claims.exp * 1000).toISOString())]);
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
