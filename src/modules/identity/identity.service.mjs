import { randomUUID } from 'node:crypto';
import { HttpError } from '../../shared/http.mjs';
import { sessionToken, cookie, parseCookies } from '../../shared/security.mjs';

export class IdentityService {
  constructor({ users, sessions, config }) { this.users = users; this.sessions = sessions; this.config = config; }

  findOrCreate(provider, providerId, profile) {
    let user = this.users.all().find(item => item.provider === provider && item.providerId === String(providerId));
    if (user) return this.users.update(user.id, { name: profile.name || user.name, avatar: profile.avatar || user.avatar });
    user = {
      id: randomUUID(),
      provider,
      providerId: String(providerId),
      name: profile.name,
      email: profile.email || null,
      avatar: profile.avatar || null,
      role: 'sender',
      createdAt: new Date().toISOString(),
    };
    return this.users.insert(user);
  }
  demoAdmin() {
    const user = this.findOrCreate('local-admin', 'local-admin', { name: 'Quản trị viên demo' });
    this.users.update(user.id, { role: 'admin' });
    return this.users.get(user.id);
  }
  issueSession(res, user, cookies = []) {
    res.setHeader('set-cookie', [cookie('session', this.sessions.create(user), 7 * 86400), ...cookies]);
  }
  findCurrent(req) {
    const session = this.sessions.find(sessionToken(req));
    return session ? this.users.get(session.sub) : null;
  }
  oauthCookie(provider, state, verifier = '') {
    // Lưu state và PKCE verifier trong cookie HttpOnly tạm thời.
    return cookie(`oauth_${provider}`, Buffer.from(JSON.stringify({ state, verifier })).toString('base64url'), 600);
  }
  consumeState(req, provider, state) {
    const raw = parseCookies(req.headers.cookie || '')[`oauth_${provider}`];
    let stored;
    try { stored = JSON.parse(Buffer.from(raw || '', 'base64url').toString()); } catch { stored = null; }
    if (!stored || !state || state !== stored.state) throw new HttpError(403, 'Phiên xác thực OAuth không hợp lệ hoặc đã hết hạn.');
    return stored.verifier;
  }
  finishOAuth(res, provider, profile) {
    const user = this.findOrCreate(provider, profile.id, profile);
    this.issueSession(res, user, [cookie(`oauth_${provider}`, '', 0)]);
    res.writeHead(302, { location: `${this.config.baseUrl}/studio?login=success`, 'cache-control': 'no-store' });
    res.end();
  }
}
