import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Router } from '../../src/shared/http.mjs';
import { JsonRepository } from '../../src/shared/storage.mjs';
import { signSession, verifySession } from '../../src/shared/security.mjs';
import { CredentialsService } from '../../src/modules/identity/credentials.service.mjs';
import { IdentityService } from '../../src/modules/identity/identity.service.mjs';
import { SessionStore } from '../../src/modules/identity/sessions.service.mjs';
import { MySqlSessionStore, MySqlUsersRepository } from '../../src/modules/identity/mysql.repositories.mjs';
import { RecoveryService } from '../../src/modules/identity/recovery.service.mjs';
import { AuthLimits } from '../../src/modules/identity/auth-limits.mjs';
import { registerRoutes } from '../../src/modules/identity/routes.mjs';
import { registrationConsent } from '../../web/js/shared/registration-consent.js';

const secret = 'qa-only-auth-integration-secret-1234';
const oldPassword = 'OldPass123', newPassword = 'NewPass456';

// HTTP thật trên loopback, storage tạm, không dùng .env hoặc mạng production.
async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'momevia-auth-http-'));
  const users = new JsonRepository(join(dir, 'users.json'));
  const sessions = new SessionStore(new JsonRepository(join(dir, 'sessions.json')), users, secret);
  const credentials = new CredentialsService(users);
  const config = { jwtSecret: secret, internalKey: 'qa-only-internal-secret-different', demoEnabled: false };
  const service = new IdentityService({ users, sessions, config });
  const authLimits = new AuthLimits();
  let otp;
  const recovery = new RecoveryService({ users, credentials, secret, sendMail: async mail => { otp = /\b\d{8}\b/.exec(mail.text)[0]; } });
  const router = new Router();
  registerRoutes(router, { config, credentials, sessions, authLimits, service, recovery });
  const server = http.createServer((req, res) => router.handle(req, res));
  t.after(async () => {
    authLimits.close();
    await new Promise(resolve => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, status, { body, cookie, locale = 'vi' } = {}) => {
    const headers = { 'x-momevia-locale': locale, ...(cookie ? { cookie } : {}) };
    const response = await fetch(base + path, body === undefined ? { headers } : {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await response.json();
    assert.equal(response.status, status, `${path}: ${JSON.stringify(data)}`);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return { data, cookie: response.headers.getSetCookie()[0]?.split(';')[0], headers: response.headers };
  };
  const register = (email) => call('/register', 201, { body: { name: 'QA account', email, password: oldPassword,
    confirmPassword: oldPassword, consent: registrationConsent(true, true) } });
  const login = (email, password = oldPassword) => call('/login', 200, { body: { email, password } });
  return { users, sessions, credentials, call, register, login, get otp() { return otp; } };
}

test('HTTP: consent, danh sách phiên, cách ly tài khoản, thu hồi và đổi mật khẩu cùng một vòng đời', async t => {
  const f = await fixture(t), email = 'alice@example.test';
  const a = await f.register(email), b = await f.login(email), c = await f.login(email);
  const other = await f.register('bob@example.test');
  assert.equal(a.data.user.emailVerified, false);
  assert(!('passwordHash' in a.data.user));
  const history = await f.call('/consent/history', 200, { cookie: a.cookie, locale: 'en' });
  assert.equal(history.data.confirmed, true);
  assert.equal(history.data.current.locale, 'en');
  await f.call('/sessions', 401);
  const list = (await f.call('/sessions', 200, { cookie: a.cookie })).data;
  assert.equal(list.sessions.length, 3);
  const target = list.sessions.find(row => !row.current).revokeRef;
  await f.call('/sessions/revoke', 404, { cookie: other.cookie, body: { ref: target, confirm: true } });
  await f.call('/sessions/revoke', 200, { cookie: a.cookie, body: { ref: target, confirm: true } });
  const states = await Promise.all([b, c].map(x => f.call('/me', 200, { cookie: x.cookie })));
  assert.equal(states.filter(x => x.data.user).length, 1);
  await f.call('/sessions/revoke-others', 200, { cookie: a.cookie, body: { confirm: true } });
  assert.equal((await f.call('/sessions', 200, { cookie: a.cookie })).data.sessions.length, 1);
  const changed = await f.call('/password/change', 200, { cookie: a.cookie, body: {
    currentPassword: oldPassword, password: newPassword, confirmPassword: newPassword, confirmLogout: true,
  } });
  assert.match(changed.headers.getSetCookie()[0], /Max-Age=0/);
  for (const x of [a, b, c]) assert.equal((await f.call('/me', 200, { cookie: x.cookie })).data.user, null);
  assert((await f.call('/me', 200, { cookie: other.cookie })).data.user);
  await f.call('/login', 401, { body: { email, password: oldPassword } });
  const fresh = await f.login(email, newPassword);
  assert.equal((await f.call('/consent/history', 200, { cookie: fresh.cookie })).data.history.length, 1);
  await f.call('/logout', 200, { cookie: fresh.cookie, body: {} });
  await f.call('/sessions', 401, { cookie: fresh.cookie });
});

test('HTTP: OTP thật trong fixture, reset một lần và loại phiên credential cũ', async t => {
  const f = await fixture(t), email = 'reset@example.test';
  const a = await f.register(email);
  await f.call('/recover/request', 202, { body: { email } });
  assert.match(f.otp, /^\d{8}$/);
  const payload = { email, code: f.otp, password: newPassword, confirmPassword: newPassword };
  const recovered = await f.call('/recover/confirm', 200, { body: payload });
  assert.equal(recovered.data.user.emailVerified, true);
  await f.call('/recover/confirm', 422, { body: payload });
  assert.equal((await f.call('/me', 200, { cookie: a.cookie })).data.user, null);
  assert.equal((await f.call('/sessions', 200, { cookie: recovered.cookie })).data.sessions.length, 1);
});

test('MySQL: xác thực dưới khóa user/session, không ghi khi session đã bị thu hồi', async () => {
  const user = { id: 'alice', role: 'sender', credentialVersion: 1 };
  const token = signSession(user, secret), claims = verifySession(token, secret);
  const calls = [];
  let active = false, version = 1;
  const client = { withTransaction: fn => fn({ async execute(sql, args) {
    calls.push({ sql, args });
    if (sql.startsWith('SELECT * FROM users')) return [[{ id: user.id, role: user.role, provider: 'email',
      legacy_payload: { credentialVersion: version }, created_at: '2026-11-28 00:00:00.000' }]];
    if (sql.startsWith('SELECT id FROM sessions')) return [active ? [{ id: claims.jti }] : []];
    if (sql.startsWith('UPDATE users')) return [{ affectedRows: 1 }];
    throw new Error('Unexpected SQL');
  } }) };
  const repo = new MySqlUsersRepository(client), sessions = new MySqlSessionStore(client, repo, secret);
  const update = () => ({ credentialVersion: 2 });
  await assert.rejects(sessions.mutateAuthenticated(token, update), { status: 401 });
  assert.equal(calls.length, 2);
  calls.length = 0; active = true; version = 2;
  await assert.rejects(sessions.mutateAuthenticated(token, update), { status: 401 });
  assert.equal(calls.length, 1);
  calls.length = 0; version = 1;
  assert.equal((await sessions.mutateAuthenticated(token, update)).credentialVersion, 2);
  assert.equal(calls.length, 3);
  assert(calls.slice(0, 2).every(call => call.sql.includes('FOR UPDATE')));
  assert.deepEqual(calls[1].args, [claims.jti, claims.sub]);
  assert.match(calls[2].sql, /^UPDATE users/);
  calls.length = 0;
  await assert.rejects(sessions.mutateAuthenticated('invalid', update), { status: 401 });
  assert.equal(calls.length, 0);
});
