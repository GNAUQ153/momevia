import { signSession, verifySession } from '../../shared/security.mjs';
import { localizedError } from '../../shared/http.mjs';
import { findRevocationTarget, inventoryResult, sessionInventoryLimit } from './session-inventory.mjs';

// Identity sở hữu phiên; các service khác xác minh qua endpoint nội bộ.
export class SessionStore {
  constructor(repository, users, secret) {
    this.repository = repository;
    this.users = users;
    this.secret = secret;
  }
  create(user) {
    const token = signSession(user, this.secret);
    const claims = verifySession(token, this.secret);
    const active = this.repository.all().filter(row => row.exp > Date.now() / 1000);
    active.push({ id: claims.jti, userId: user.id, exp: claims.exp, credentialVersion: claims.cv, issuedAt: new Date().toISOString() });
    this.repository.write(active);
    return token;
  }
  find(token) {
    const claims = verifySession(token, this.secret);
    if (!claims) return null;
    if (!this.repository.all().some(row => row.id === claims.jti && row.userId === claims.sub && row.exp > Date.now() / 1000)) return null;
    const user = this.users.get(claims.sub);
    return user && (user.credentialVersion || 0) === (claims.cv || 0) ? { ...claims, role: user.role, name: user.name } : null;
  }
  // JSON chỉ phục vụ một tiến trình: không await giữa kiểm tra phiên và mutate.
  mutateAuthenticated(token, update) {
    const claims = this.find(token);
    if (!claims) throw localizedError(401, 'errors.unauthorized');
    return this.users.mutate(claims.sub, update);
  }
  // Chỉ thu hồi phiên khác thuộc tài khoản của token đang hợp lệ.
  revokeOthers(token) {
    const current = this.find(token);
    if (!current) return false;
    this.repository.write(this.repository.all().filter(row => row.userId !== current.sub || row.id === current.jti));
    return true;
  }
  listActive(token) {
    const claims = this.find(token);
    if (!claims) return null;
    const records = this.repository.all().filter(row => row.userId === claims.sub && row.exp > Date.now() / 1000);
    const eligible = records.filter(row => row.id === claims.jti || row.credentialVersion === (claims.cv || 0));
    eligible.sort((a, b) => Number(b.id === claims.jti) - Number(a.id === claims.jti) || b.exp - a.exp || a.id.localeCompare(b.id));
    const rows = eligible.slice(0, sessionInventoryLimit + 1).map(row => ({ id: row.id,
      issuedAt: row.issuedAt ?? null, expiresAt: new Date(row.exp * 1000).toISOString() }));
    return inventoryResult(rows, claims, records.filter(row => row.id !== claims.jti && row.credentialVersion == null).length, this.secret);
  }
  revokeOne(token, ref) {
    const claims = this.find(token);
    if (!claims) return null;
    const records = this.repository.all();
    const candidates = records.filter(row => row.userId === claims.sub && row.id !== claims.jti &&
      row.exp > Date.now() / 1000 && row.credentialVersion === (claims.cv || 0));
    candidates.sort((a, b) => b.exp - a.exp || a.id.localeCompare(b.id));
    const target = findRevocationTarget(candidates.slice(0, sessionInventoryLimit - 1), claims, ref, this.secret);
    if (!target) return false;
    this.repository.write(records.filter(row => !(row.id === target.id && row.userId === claims.sub)));
    return true;
  }
  revoke(token) {
    const claims = verifySession(token, this.secret);
    if (!claims) return;
    this.repository.write(this.repository.all().filter(row => row.id !== claims.jti && row.exp > Date.now() / 1000));
  }
}
