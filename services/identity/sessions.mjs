import { signSession, verifySession } from '../shared/security.mjs';

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
    active.push({ id: claims.jti, userId: user.id, exp: claims.exp });
    this.repository.write(active);
    return token;
  }
  find(token) {
    const claims = verifySession(token, this.secret);
    if (!claims) return null;
    if (!this.repository.all().some(row => row.id === claims.jti && row.userId === claims.sub && row.exp > Date.now() / 1000)) return null;
    const user = this.users.get(claims.sub);
    return user ? { ...claims, role: user.role, name: user.name } : null;
  }
  revoke(token) {
    const claims = verifySession(token, this.secret);
    if (!claims) return;
    this.repository.write(this.repository.all().filter(row => row.id !== claims.jti && row.exp > Date.now() / 1000));
  }
}
