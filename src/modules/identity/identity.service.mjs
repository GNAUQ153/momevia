import { randomUUID } from 'node:crypto';
import { HttpError } from '../../shared/http.mjs';
import { sessionToken, cookie, parseCookies } from '../../shared/security.mjs';

export class IdentityService {
  constructor({ users, sessions, config }) { this.users = users; this.sessions = sessions; this.config = config; }

  async findOrCreate(provider, providerId, profile) {
    let user = this.users.findByProvider
      ? await this.users.findByProvider(provider, String(providerId))
      : this.users.all().find(item => item.provider === provider && item.providerId === String(providerId));
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
    try { return await this.users.insert(user); }
    catch (error) {
      // Concurrent OAuth requests for the same provider ID may race to INSERT.
      if (error.status !== 409 || !this.users.findByProvider) throw error;
      const existing = await this.users.findByProvider(provider, String(providerId));
      if (!existing) throw error;
      return this.users.update(existing.id, { name: profile.name || existing.name, avatar: profile.avatar || existing.avatar });
    }
  }
  async demoAdmin() {
    const user = await this.findOrCreate('local-admin', 'local-admin', { name: 'Quản trị viên demo' });
    await this.users.update(user.id, { role: 'admin' });
    return this.users.get(user.id);
  }
  async issueSession(res, user, cookies = []) {
    res.setHeader('set-cookie', [cookie('session', await this.sessions.create(user), 7 * 86400), ...cookies]);
  }
  async findCurrent(req) {
    const session = await this.sessions.find(sessionToken(req));
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
  async finishOAuth(res, provider, profile, recovery = false) {
    const user = recovery
      ? (this.users.findByProvider ? await this.users.findByProvider(provider, profile.id)
        : this.users.all().find(item => item.provider === provider && item.providerId === profile.id))
      : await this.findOrCreate(provider, profile.id, profile);
    if (!user) {
      res.setHeader('set-cookie', cookie(`oauth_${provider}`, '', 0));
      res.writeHead(302, { location: `${this.config.baseUrl}/recover?google=unlinked`, 'cache-control': 'no-store' });
      res.end();
      return;
    }
    await this.issueSession(res, user, [cookie(`oauth_${provider}`, '', 0)]);
    res.writeHead(302, { location: `${this.config.baseUrl}/studio?login=success`, 'cache-control': 'no-store' });
    res.end();
  }
}
