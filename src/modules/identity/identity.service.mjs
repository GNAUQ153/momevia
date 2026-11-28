import { randomUUID } from 'node:crypto';
import { localizedError } from '../../shared/http.mjs';
import { sessionToken, cookie } from '../../shared/security.mjs';
import { oauthStateCookie, readOAuthState } from './oauth-state.mjs';
import { registrationPolicyVersion } from '../../../web/js/shared/registration-consent.js';

export class IdentityService {
  constructor({ users, sessions, config }) { this.users = users; this.sessions = sessions; this.config = config; }

  async findOrCreate(provider, providerId, profile, consent = null) {
    let user = this.users.findByProvider
      ? await this.users.findByProvider(provider, String(providerId))
      : this.users.all().find(item => item.provider === provider && item.providerId === String(providerId));
    if (user) return this.users.update(user.id, { name: profile.name || user.name, avatar: profile.avatar || user.avatar });
    if (['google', 'zalo'].includes(provider) && (consent?.version !== registrationPolicyVersion ||
      consent.terms !== true || consent.privacy !== true || consent.source !== `${provider}-registration`)) {
      throw localizedError(400, 'errors.auth.consentRequired');
    }
    user = {
      id: randomUUID(),
      provider,
      providerId: String(providerId),
      name: profile.name,
      email: profile.email || null,
      avatar: profile.avatar || null,
      role: 'sender',
      ...(consent ? { registrationConsent: consent } : {}),
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
  oauthCookie(provider, state, verifier = '', context = {}) {
    return oauthStateCookie(this.config.jwtSecret, provider, state, verifier, context);
  }
  consumeState(req, provider, state) {
    return readOAuthState(this.config.jwtSecret, req, provider, state);
  }
  async finishOAuth(res, provider, profile, { recovery = false, consent = null } = {}) {
    const existing = this.users.findByProvider ? await this.users.findByProvider(provider, String(profile.id))
      : this.users.all().find(item => item.provider === provider && item.providerId === String(profile.id));
    if (!existing && (recovery || !consent || consent.version !== registrationPolicyVersion)) {
      // Không tạo tài khoản hay cấp session cho người dùng mới chưa xác nhận chính sách.
      res.setHeader('set-cookie', cookie(`oauth_${provider}`, '', 0));
      const path = recovery ? '/recover?google=unlinked' : '/register?oauth=consent';
      res.writeHead(302, { location: `${this.config.baseUrl}${path}`, 'cache-control': 'no-store' });
      res.end();
      return;
    }
    const user = recovery ? existing : await this.findOrCreate(provider, profile.id, profile, consent);
    await this.issueSession(res, user, [cookie(`oauth_${provider}`, '', 0)]);
    res.writeHead(302, { location: `${this.config.baseUrl}/studio?login=success`, 'cache-control': 'no-store' });
    res.end();
  }
}
