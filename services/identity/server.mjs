import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { environment } from '../shared/config.mjs';
import { JsonRepository } from '../shared/storage.mjs';
import { Router, HttpError, parseJson, sendJson } from '../shared/http.mjs';
import { signSession, currentUser, cookie, parseCookies, randomId, sanitizeText } from '../shared/security.mjs';
import { CredentialsService, publicUser } from './credentials.mjs';

const config = environment();
const repo = new JsonRepository(path.resolve('services/identity/data/users.json'));
const credentials = new CredentialsService(repo);

class IdentityService {
  findOrCreate(provider, providerId, profile) {
    let user = repo.all().find(item => item.provider === provider && item.providerId === String(providerId));
    if (user) return repo.update(user.id, { name: profile.name || user.name, avatar: profile.avatar || user.avatar });
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
    return repo.insert(user);
  }
  issueSession(res, user, cookies = []) {
    res.setHeader('set-cookie', [cookie('session', signSession(user, config.jwtSecret), 7 * 86400), ...cookies]);
  }
  findCurrent(req) {
    const session = currentUser(req, config.jwtSecret, false);
    return session ? repo.get(session.sub) : null;
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
    res.writeHead(302, { location: `${config.baseUrl}/studio?login=success`, 'cache-control': 'no-store' });
    res.end();
  }
}
const service = new IdentityService();
const router = new Router();

router.on('GET', '/health', ({res}) => sendJson(res, 200, { name: 'identity', ok: true }));
router.on('GET', '/providers', ({res}) => sendJson(res, 200, {
  demo: config.demoEnabled,
  google: Boolean(config.googleId && config.googleSecret),
  zalo: Boolean(config.zaloId && config.zaloSecret),
}));
router.on('GET', '/me', ({req, res}) => {
  const user = service.findCurrent(req);
  return sendJson(res, 200, { user: publicUser(user) });
});
// Đăng ký/đăng nhập bằng email. Mật khẩu được băm với scrypt + salt riêng.
router.on('POST', '/register', async ({req, res}) => {
  const body = await parseJson(req, 16_384);
  if (body.confirmPassword !== body.password) throw new HttpError(400, 'Xác nhận mật khẩu không khớp.');
  const user = await credentials.register(body);
  service.issueSession(res, user);
  sendJson(res, 201, { user: publicUser(user) });
});
router.on('POST', '/login', async ({req, res}) => {
  const body = await parseJson(req, 16_384);
  const user = await credentials.login(body);
  service.issueSession(res, user);
  sendJson(res, 200, { user: publicUser(user) });
});

router.on('POST', '/demo', async ({req, res}) => {
  if (!config.demoEnabled) throw new HttpError(403, 'Chế độ dùng thử đã bị tắt.');
  const body = await parseJson(req);
  const name = sanitizeText(body.name, 50);
  const providerId = sanitizeText(body.deviceId || randomId(12), 128);
  const user = service.findOrCreate('demo', providerId, { name });
  service.issueSession(res, user);
  sendJson(res, 200, { user: publicUser(user) });
});
router.on('POST', '/demo-admin', async ({req, res}) => {
  if (!config.demoEnabled || !config.adminCode) throw new HttpError(403, 'Không được phép.');
  const body = await parseJson(req);
  if (body.code !== config.adminCode) throw new HttpError(403, 'Mã quản trị không chính xác.');
  const user = service.findOrCreate('local-admin', 'local-admin', { name: 'Quản trị viên demo' });
  repo.update(user.id, { role: 'admin' });
  const admin = repo.get(user.id);
  service.issueSession(res, admin);
  sendJson(res, 200, { user: publicUser(admin) });
});
router.on('POST', '/creator', ({req, res}) => {
  const session = currentUser(req, config.jwtSecret);
  const user = repo.get(session.sub);
  if (!user) throw new HttpError(401, 'Tài khoản không tồn tại.');
  const updated = repo.update(user.id, { role: user.role === 'admin' ? 'admin' : 'creator' });
  service.issueSession(res, updated);
  sendJson(res, 200, { user: publicUser(updated) });
});
router.on('POST', '/logout', ({res}) => {
  res.setHeader('set-cookie', cookie('session', '', 0));
  sendJson(res, 200, { ok: true });
});

router.on('GET', '/google', ({res}) => {
  if (!config.googleId || !config.googleSecret) throw new HttpError(503, 'Chưa cấu hình đăng nhập Google.');
  const state = randomId(24);
  const query = new URLSearchParams({
    client_id: config.googleId,
    redirect_uri: config.googleCallback,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  res.setHeader('set-cookie', service.oauthCookie('google', state));
  res.writeHead(302, { location: `https://accounts.google.com/o/oauth2/v2/auth?${query}`, 'cache-control': 'no-store' });
  res.end();
});
router.on('GET', '/google/callback', async ({req, res, url}) => {
  if (url.searchParams.has('error')) throw new HttpError(401, 'Bạn đã hủy đăng nhập Google.');
  service.consumeState(req, 'google', url.searchParams.get('state'));
  const code = url.searchParams.get('code');
  if (!code) throw new HttpError(400, 'Không có mã xác thực Google.');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: config.googleId, client_secret: config.googleSecret, redirect_uri: config.googleCallback, grant_type: 'authorization_code' }),
    signal: AbortSignal.timeout(10000),
  });
  const token = await response.json();
  if (!response.ok || !token.access_token) throw new HttpError(401, 'Google không xác thực được tài khoản.');
  const infoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(10000),
  });
  const info = await infoResponse.json();
  if (!infoResponse.ok || !info.sub) throw new HttpError(401, 'Không đọc được hồ sơ Google.');
  service.finishOAuth(res, 'google', { id: info.sub, name: info.name || info.email || 'Người dùng Google', email: info.email, avatar: info.picture });
});
router.on('GET', '/zalo', ({res}) => {
  if (!config.zaloId || !config.zaloSecret) throw new HttpError(503, 'Chưa cấu hình đăng nhập Zalo.');
  const state = randomId(24);
  const verifier = randomId(40);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const query = new URLSearchParams({ app_id: config.zaloId, redirect_uri: config.zaloCallback, code_challenge: challenge, state });
  res.setHeader('set-cookie', service.oauthCookie('zalo', state, verifier));
  res.writeHead(302, { location: `https://oauth.zaloapp.com/v4/permission?${query}`, 'cache-control': 'no-store' });
  res.end();
});
router.on('GET', '/zalo/callback', async ({req, res, url}) => {
  if (url.searchParams.has('error')) throw new HttpError(401, 'Bạn đã hủy đăng nhập Zalo.');
  const verifier = service.consumeState(req, 'zalo', url.searchParams.get('state'));
  const code = url.searchParams.get('code');
  if (!code) throw new HttpError(400, 'Không có mã xác thực Zalo.');
  const response = await fetch('https://oauth.zaloapp.com/v4/access_token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', secret_key: config.zaloSecret },
    body: new URLSearchParams({ code, app_id: config.zaloId, grant_type: 'authorization_code', code_verifier: verifier }),
    signal: AbortSignal.timeout(10000),
  });
  const token = await response.json();
  if (!response.ok || !token.access_token) throw new HttpError(401, 'Zalo không xác thực được tài khoản.');
  const infoResponse = await fetch('https://graph.zalo.me/v2.0/me?fields=id,name,picture', {
    headers: { access_token: token.access_token },
    signal: AbortSignal.timeout(10000),
  });
  const info = await infoResponse.json();
  if (!infoResponse.ok || !info.id || info.error) throw new HttpError(401, 'Không đọc được hồ sơ Zalo.');
  service.finishOAuth(res, 'zalo', { id: info.id, name: info.name || 'Người dùng Zalo', avatar: info.picture?.data?.url });
});

router.listen(4101);
