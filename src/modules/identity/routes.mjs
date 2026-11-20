import { parseJson, sendJson, requireInternal, localizedError } from '../../shared/http.mjs';
import { sessionToken, cookie, randomId, sanitizeText } from '../../shared/security.mjs';
import { createHash } from 'node:crypto';
import { publicUser } from './credentials.service.mjs';
import { requestLocale } from '../../shared/locale.mjs';

export function registerRoutes(router, { config, credentials, sessions, authLimits, roles, service, recovery }) {
  router.on('GET', '/health', ({res}) => sendJson(res, 200, { name: 'identity', ok: true }));
  router.on('GET', '/providers', ({res}) => sendJson(res, 200, {
    demo: config.demoEnabled,
    google: Boolean(config.googleId && config.googleSecret),
    zalo: Boolean(config.zaloId && config.zaloSecret),
    recoveryEmail: Boolean(recovery?.sendMail),
  }));
  router.on('GET', '/me', async ({req, res}) => {
    const user = await service.findCurrent(req);
    return sendJson(res, 200, { user: publicUser(user) });
  });
  // Đăng ký/đăng nhập bằng email. Mật khẩu được băm với scrypt + salt riêng.
  router.on('POST', '/register', async ({req, res}) => {
    authLimits.consume('register', req, res);
    const body = await parseJson(req, 16_384);
    if (body.confirmPassword !== body.password) throw localizedError(400, 'auth.password.mismatch');
    const user = await credentials.register(body);
    await service.issueSession(res, user);
    sendJson(res, 201, { user: publicUser(user) });
  });
  router.on('POST', '/login', async ({req, res}) => {
    const body = await parseJson(req, 16_384);
    authLimits.consume('login', req, res, body.email);
    const user = await credentials.login(body);
    await service.issueSession(res, user);
    sendJson(res, 200, { user: publicUser(user) });
  });
  router.on('POST', '/verify-email/request', async ({ req, res }) => {
    const user = await service.findCurrent(req);
    if (user?.provider !== 'email') throw localizedError(403, 'errors.auth.verifySignIn');
    authLimits.consume('recovery', req, res, user.email);
    await recovery.start(user, 'verify', requestLocale(req));
    sendJson(res, 202, { ok: true });
  });
  router.on('POST', '/verify-email/confirm', async ({ req, res }) => {
    const user = await service.findCurrent(req);
    if (user?.provider !== 'email') throw localizedError(403, 'errors.auth.verifySignIn');
    authLimits.consume('recovery', req, res, user.email);
    const { code } = await parseJson(req, 4096);
    const updated = await recovery.finish(user, 'verify', code);
    sendJson(res, 200, { user: publicUser(updated) });
  });
  router.on('POST', '/recover/request', async ({ req, res }) => {
    const { email } = await parseJson(req, 4096);
    authLimits.consume('recovery', req, res, email);
    await recovery.start(await recovery.byEmail(email), 'reset', requestLocale(req));
    sendJson(res, 202, { ok: true });
  });
  router.on('POST', '/recover/confirm', async ({ req, res }) => {
    const { email, code, password, confirmPassword } = await parseJson(req, 4096);
    authLimits.consume('recovery', req, res, email);
    if (password !== confirmPassword) throw localizedError(400, 'auth.password.mismatch');
    const user = await recovery.finish(await recovery.byEmail(email), 'reset', code, password);
    await service.issueSession(res, user);
    sendJson(res, 200, { user: publicUser(user) });
  });

  router.on('POST', '/demo', async ({req, res}) => {
    if (!config.demoEnabled) throw localizedError(403, 'errors.auth.demoDisabled');
    authLimits.consume('demo', req, res);
    const body = await parseJson(req, 16_384);
    const name = sanitizeText(body.name, 50);
    const providerId = sanitizeText(body.deviceId || randomId(12), 128);
    const user = await service.findOrCreate('demo', providerId, { name });
    await service.issueSession(res, user);
    sendJson(res, 200, { user: publicUser(user) });
  });
  router.on('POST', '/demo-admin', async ({req, res}) => {
    if (!config.demoEnabled || !config.adminCode) throw localizedError(403, 'errors.auth.demoAdminDenied');
    authLimits.consume('admin', req, res);
    const body = await parseJson(req, 4096);
    if (body.code !== config.adminCode) throw localizedError(403, 'errors.auth.adminCode');
    const admin = await service.demoAdmin();
    await service.issueSession(res, admin);
    sendJson(res, 200, { user: publicUser(admin) });
  });
  // Compatibility route: không còn tự nâng quyền; Admin phải chỉ định userId.
  router.on('POST', '/creator', async ({req, res}) => {
    const session = await sessions.find(sessionToken(req));
    if (!session) throw localizedError(401, 'errors.unauthorized');
    await roles.requireAdmin(session.sub);
    const body = await parseJson(req, 4096);
    const updated = await roles.change(session.sub, body.userId, 'creator');
    // Không cấp cookie của tài khoản đích cho Admin đang thực hiện thao tác.
    sendJson(res, 200, { user: publicUser(updated) });
  });

  router.on('GET', '/admin/users', async ({req, res}) => {
    const session = await sessions.find(sessionToken(req));
    if (!session) throw localizedError(401, 'errors.unauthorized');
    sendJson(res, 200, { users: (await roles.list(session.sub)).map(publicUser) });
  });

  router.on('POST', '/admin/users/:id/role', async ({req, res, params}) => {
    const session = await sessions.find(sessionToken(req));
    if (!session) throw localizedError(401, 'errors.unauthorized');
    await roles.requireAdmin(session.sub);
    const body = await parseJson(req, 4096);
    const updated = await roles.change(session.sub, params.id, body.role);
    sendJson(res, 200, { user: publicUser(updated) });
  });
  router.on('POST', '/logout', async ({req,res}) => {
    await sessions.revoke(sessionToken(req));
    res.setHeader('set-cookie', cookie('session', '', 0));
    sendJson(res, 200, { ok: true });
  });

  router.on('POST', '/internal/session', async ({req,res}) => {
    requireInternal(req, config.internalKey);
    const body = await parseJson(req, 8192);
    sendJson(res, 200, { user: await sessions.find(body.token) });
  });

  router.on('GET', '/google', ({res, url}) => {
    if (!config.googleId || !config.googleSecret) throw localizedError(503, 'errors.auth.googleDisabled');
    const state = randomId(24);
    const query = new URLSearchParams({
      client_id: config.googleId,
      redirect_uri: config.googleCallback,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });
    res.setHeader('set-cookie', service.oauthCookie('google', state, url.searchParams.get('recover') === '1' ? 'recover' : ''));
    res.writeHead(302, { location: `https://accounts.google.com/o/oauth2/v2/auth?${query}`, 'cache-control': 'no-store' });
    res.end();
  });
  router.on('GET', '/google/callback', async ({req, res, url}) => {
    if (url.searchParams.has('error')) throw localizedError(401, 'errors.auth.googleCancelled');
    const recovering = service.consumeState(req, 'google', url.searchParams.get('state')) === 'recover';
    const code = url.searchParams.get('code');
    if (!code) throw localizedError(400, 'errors.auth.googleCode');
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: config.googleId, client_secret: config.googleSecret, redirect_uri: config.googleCallback, grant_type: 'authorization_code' }),
      signal: AbortSignal.timeout(10000),
    });
    const token = await response.json();
    if (!response.ok || !token.access_token) throw localizedError(401, 'errors.auth.googleFailed');
    const infoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(10000),
    });
    const info = await infoResponse.json();
    if (!infoResponse.ok || !info.sub) throw localizedError(401, 'errors.auth.googleProfile');
    await service.finishOAuth(res, 'google', { id: info.sub, name: info.name || info.email || 'Người dùng Google', email: info.email, avatar: info.picture }, recovering);
  });
  router.on('GET', '/zalo', ({res}) => {
    if (!config.zaloId || !config.zaloSecret) throw localizedError(503, 'errors.auth.zaloDisabled');
    const state = randomId(24);
    const verifier = randomId(40);
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const query = new URLSearchParams({ app_id: config.zaloId, redirect_uri: config.zaloCallback, code_challenge: challenge, state });
    res.setHeader('set-cookie', service.oauthCookie('zalo', state, verifier));
    res.writeHead(302, { location: `https://oauth.zaloapp.com/v4/permission?${query}`, 'cache-control': 'no-store' });
    res.end();
  });
  router.on('GET', '/zalo/callback', async ({req, res, url}) => {
    if (url.searchParams.has('error')) throw localizedError(401, 'errors.auth.zaloCancelled');
    const verifier = service.consumeState(req, 'zalo', url.searchParams.get('state'));
    const code = url.searchParams.get('code');
    if (!code) throw localizedError(400, 'errors.auth.zaloCode');
    const response = await fetch('https://oauth.zaloapp.com/v4/access_token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', secret_key: config.zaloSecret },
      body: new URLSearchParams({ code, app_id: config.zaloId, grant_type: 'authorization_code', code_verifier: verifier }),
      signal: AbortSignal.timeout(10000),
    });
    const token = await response.json();
    if (!response.ok || !token.access_token) throw localizedError(401, 'errors.auth.zaloFailed');
    const infoResponse = await fetch('https://graph.zalo.me/v2.0/me?fields=id,name,picture', {
      headers: { access_token: token.access_token },
      signal: AbortSignal.timeout(10000),
    });
    const info = await infoResponse.json();
    if (!infoResponse.ok || !info.id || info.error) throw localizedError(401, 'errors.auth.zaloProfile');
    await service.finishOAuth(res, 'zalo', { id: info.id, name: info.name || 'Người dùng Zalo', avatar: info.picture?.data?.url });
  });

}
