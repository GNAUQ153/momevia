import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createGatewayServer } from '../../src/gateway/app.mjs';
import { Router } from '../../src/shared/http.mjs';
import { JsonRepository } from '../../src/shared/storage.mjs';
import { CredentialsService } from '../../src/modules/identity/credentials.service.mjs';
import { SessionStore } from '../../src/modules/identity/sessions.service.mjs';
import { IdentityService } from '../../src/modules/identity/identity.service.mjs';
import { AuthLimits } from '../../src/modules/identity/auth-limits.mjs';
import { registerRoutes } from '../../src/modules/identity/routes.mjs';
import { registrationConsent } from '../../web/js/shared/registration-consent.js';
import { runAuthBoundary } from '../integration/auth-boundary.mjs';

const password = 'FixtureOnly123';
const listen = async server => { server.listen(0, '127.0.0.1'); await once(server, 'listening'); return server.address().port; };
const close = server => new Promise(resolve => server.close(resolve));
async function request(base, path, { method = 'GET', body, cookie, headers = {} } = {}) {
  const response = await fetch(base + path, { method, redirect: 'manual', signal: AbortSignal.timeout(5000),
    headers: { ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json().catch(() => null);
  return { status: response.status, data, headers: { ...Object.fromEntries(response.headers), 'set-cookie': response.headers.getSetCookie().length ? response.headers.getSetCookie() : undefined } };
}
const sessionCookie = result => result.headers['set-cookie'][0].split(';')[0];
function secureCookie(value, name, maxAge) {
  assert.match(value, new RegExp(`^${name}=`));
  for (const pattern of [/; Path=\//i, /; HttpOnly\b/i, /; SameSite=Lax\b/i, /; Secure\b/i]) assert.match(value, pattern);
  assert.match(value, new RegExp(`; Max-Age=${maxAge}(?:;|$)`, 'i'));
  assert.doesNotMatch(value, /; Domain=/i);
}

// Explicit fixture config; never load local .env. HTTPS public origin tests cookie serialization,
// not TLS transport: both actual HTTP listeners bind to loopback only.
async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'momevia-gateway-auth-'));
  const original = process.env.PUBLIC_BASE_URL;
  process.env.PUBLIC_BASE_URL = 'https://momevia.example';
  const secret = 'fixture-gateway-auth-key-not-for-production';
  const config = { baseUrl: process.env.PUBLIC_BASE_URL, allowedOrigins: [], jwtSecret: secret, internalKey: 'fixture-internal-key', demoEnabled: false,
    googleId: 'fixture-google', googleSecret: 'fixture-google-secret', googleCallback: 'https://momevia.example/api/auth/google/callback',
    zaloId: 'fixture-zalo', zaloSecret: 'fixture-zalo-secret', zaloCallback: 'https://momevia.example/api/auth/zalo/callback' };
  const users = new JsonRepository(join(dir, 'users.json'));
  const sessions = new SessionStore(new JsonRepository(join(dir, 'sessions.json')), users, secret);
  const credentials = new CredentialsService(users), service = new IdentityService({ users, sessions, config });
  const authLimits = new AuthLimits(), router = new Router();
  registerRoutes(router, { config, credentials, sessions, authLimits, service });
  const identity = http.createServer((req, res) => router.handle(req, res));
  let gateway;
  t.after(async () => {
    authLimits.close();
    if (gateway?.listening) await close(gateway);
    if (identity.listening) await close(identity);
    if (original === undefined) delete process.env.PUBLIC_BASE_URL; else process.env.PUBLIC_BASE_URL = original;
    rmSync(dir, { recursive: true, force: true });
  });
  const target = await listen(identity);
  // Permit the actual loopback frontend origin in this fixture, just like local dev.
  gateway = createGatewayServer(config, [['/api/auth', target]]);
  const base = `http://127.0.0.1:${await listen(gateway)}`;
  config.allowedOrigins.push(base);
  const call = (path, options) => request(base, `/api/auth${path}`, options);
  const register = email => call('/register', { method: 'POST', body: { email, name: 'QA', password, confirmPassword: password, consent: registrationConsent(true, true) }, headers: { origin: base } });
  const login = email => call('/login', { method: 'POST', body: { email, password }, headers: { origin: base } });
  return { base, call, register, login, identity, users };
}

test('Gateway thật: CSRF, cookie, private cache, phương thức HTTP và session không bị thay đổi khi từ chối', async t => {
  const f = await fixture(t);
  const first = await f.register('alice@example.test');
  assert.equal(first.status, 201); secureCookie(first.headers['set-cookie'][0], 'session', 7 * 86400);
  const second = await f.login('alice@example.test');
  assert.equal(second.status, 200);
  const cookie = sessionCookie(first), other = sessionCookie(second);
  await runAuthBoundary(f.base, request, cookie);
  const inventory = await f.call('/sessions', { cookie });
  assert.equal(inventory.data.sessions.length, 2);
  const ref = inventory.data.sessions.find(row => !row.current).revokeRef;
  const revoked = await f.call('/sessions/revoke', { method: 'POST', cookie, body: { confirm: true, ref }, headers: { origin: f.base } });
  assert.equal(revoked.status, 200);
  assert.equal((await f.call('/sessions', { cookie: other })).status, 401);
  assert.equal((await f.call('/sessions', { cookie })).data.sessions.length, 1);
  const logout = await f.call('/logout', { method: 'POST', cookie, body: {}, headers: { origin: f.base } });
  assert.equal(logout.status, 200); secureCookie(logout.headers['set-cookie'][0], 'session', 0);
  assert.equal((await f.call('/sessions', { cookie })).status, 401);
});

test('Gateway thật: OAuth state cookies, PKCE và callback sai bị từ chối trước khi gọi provider', async t => {
  const f = await fixture(t);
  for (const provider of ['google', 'zalo']) {
    const result = await f.call(`/${provider}/start`, { method: 'POST', headers: { origin: f.base }, body: { consent: registrationConsent(true, true) } });
    assert.equal(result.status, 200);
    assert.equal(result.headers['cache-control'], 'no-store');
    secureCookie(result.headers['set-cookie'][0], `oauth_${provider}`, 600);
    const url = new URL(result.data.url);
    assert.ok(url.searchParams.get('state')); assert.ok(url.searchParams.get('code_challenge'));
    const denied = await f.call(`/${provider}/callback?state=invalid&code=fixture`, { cookie: sessionCookie(result) });
    assert.equal(denied.status, 403); assert.equal(denied.headers['set-cookie'], undefined);
    assert.equal(denied.headers['cache-control'], 'no-store');
  }
  assert.equal(f.users.all().length, 0);
});

test('Gateway thật: upstream unavailable 502 không cache và không cấp cookie', async t => {
  const f = await fixture(t);
  await close(f.identity);
  const result = await f.call('/me');
  assert.equal(result.status, 502); assert.equal(result.headers['cache-control'], 'no-store');
  assert.equal(result.headers['x-content-type-options'], 'nosniff'); assert.equal(result.headers['set-cookie'], undefined);
});
