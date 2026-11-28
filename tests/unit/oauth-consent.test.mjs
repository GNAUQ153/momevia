import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { Router } from '../../src/shared/http.mjs';
import { IdentityService } from '../../src/modules/identity/identity.service.mjs';
import { registerRoutes } from '../../src/modules/identity/routes.mjs';
import { registrationConsent, registrationPolicyVersion } from '../../web/js/shared/registration-consent.js';

const config = { baseUrl: 'https://momevia.example', jwtSecret: 'fixture-only-oauth-secret-32-characters',
  googleId: 'google-fixture', googleSecret: 'google-fixture-secret', googleCallback: 'https://momevia.example/api/auth/google/callback',
  zaloId: 'zalo-fixture', zaloSecret: 'zalo-fixture-secret', zaloCallback: 'https://momevia.example/api/auth/zalo/callback' };
function fixture() {
  const rows = [], issued = [], exchanges = [];
  const users = { findByProvider: async (provider, id) => rows.find(row => row.provider === provider && row.providerId === id),
    insert: async user => { rows.push(user); return user; }, update: async (id, patch) => Object.assign(rows.find(row => row.id === id), patch) };
  const service = new IdentityService({ users, sessions: { create: async user => { issued.push(user.id); return 'fixture-session'; } }, config });
  const router = new Router();
  registerRoutes(router, { config, service, authLimits: { consume() {} }, credentials: {}, sessions: {}, roles: {}, recovery: {} });
  async function call(path, { body, cookie, locale = 'en' } = {}) {
    const req = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
    req.method = body ? 'POST' : 'GET'; req.url = path;
    req.headers = { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), 'x-momevia-locale': locale };
    const result = { headers: {} };
    const res = { setHeader(key, value) { result.headers[key] = value; }, writeHead(status, headers) { result.status = status; Object.assign(result.headers, headers); }, end(data) { result.data = data ? JSON.parse(data) : null; } };
    await router.handle(req, res);
    return result;
  }
  async function start(provider, body) {
    const result = await call(`/${provider}${body ? '/start' : ''}`, { body });
    const url = new URL(result.data?.url || result.headers.location);
    return { result, url, state: url.searchParams.get('state'), cookie: result.headers['set-cookie'].split(';')[0] };
  }
  const callback = (provider, flow, code = 'person-1') => call(`/${provider}/callback?state=${flow.state}&code=${code}`, { cookie: flow.cookie });
  const mockFetch = async (url, options) => {
    const host = new URL(url).hostname;
    if (host === 'oauth2.googleapis.com' || host === 'oauth.zaloapp.com') {
      exchanges.push({ host, verifier: options.body.get('code_verifier') });
      return Response.json({ access_token: options.body.get('code') });
    }
    if (host === 'openidconnect.googleapis.com') return Response.json({ sub: options.headers.authorization.slice(7), name: 'Test Google' });
    if (host === 'graph.zalo.me') return Response.json({ id: options.headers.access_token, name: 'Test Zalo' });
    throw new Error('Unexpected fetch');
  };
  return { rows, issued, exchanges, service, call, start, callback, mockFetch };
}

for (const provider of ['google', 'zalo']) {
  test(`${provider}: thiếu consent hoặc phiên bản sai bị từ chối trước khi chuyển OAuth`, async () => {
    const f = fixture();
    for (const consent of [undefined, { terms: 'true', privacy: true, version: registrationPolicyVersion }, registrationConsent(true, false)]) {
      const result = await f.call(`/${provider}/start`, { body: { consent } });
      assert.equal(result.status, 400);
      assert.equal(result.headers['set-cookie'], undefined);
    }
    assert.equal((await f.call(`/${provider}/start`, { body: { consent: { ...registrationConsent(true, true), version: 'old' } } })).status, 409);
    assert.equal(f.rows.length, 0);
    assert.equal(f.issued.length, 0);
  });
  test(`${provider}: người dùng mới cần consent, lưu bằng chứng và giữ đăng nhập cũ`, async () => {
    const f = fixture(); const previous = globalThis.fetch; globalThis.fetch = f.mockFetch;
    try {
      const login = await f.start(provider);
      const denied = await f.callback(provider, login);
      assert.equal(denied.status, 302);
      assert.match(denied.headers.location, /\/register\?oauth=consent$/);
      assert.equal(f.rows.length, 0); assert.equal(f.issued.length, 0);
      assert.match(denied.headers['set-cookie'], /Max-Age=0/);
      const register = await f.start(provider, { consent: { ...registrationConsent(true, true), acceptedAt: 'fake', source: 'fake' }, role: 'admin' });
      assert.equal(register.result.status, 200);
      const opened = await f.callback(provider, register);
      assert.equal(opened.status, 302); assert.match(opened.headers.location, /\/studio\?login=success$/);
      assert.equal(f.rows.length, 1); assert.equal(f.issued.length, 1);
      const row = f.rows[0]; assert.equal(row.role, 'sender');
      assert.equal(row.registrationConsent.source, `${provider}-registration`);
      assert.equal(row.registrationConsent.locale, 'en');
      assert.notEqual(row.registrationConsent.acceptedAt, 'fake');
      assert.equal(row.registrationConsent.version, registrationPolicyVersion);
      assert.match(row.registrationConsent.policyDigest, /^[a-f0-9]{64}$/);
      assert.equal(createHash('sha256').update(f.exchanges.at(-1).verifier).digest('base64url'), register.url.searchParams.get('code_challenge'));
      const saved = structuredClone(row.registrationConsent);
      await f.callback(provider, await f.start(provider));
      assert.equal(f.rows.length, 1); assert.equal(f.issued.length, 2);
      assert.deepEqual(row.registrationConsent, saved);
      await f.callback(provider, await f.start(provider, { consent: registrationConsent(true, true) }));
      assert.equal(f.rows.length, 1); assert.deepEqual(row.registrationConsent, saved);
    } finally { globalThis.fetch = previous; }
  });
}

test('State chống sửa nội dung, sai provider, sai state và hết hạn phía server', async () => {
  const f = fixture();
  const flow = await f.start('google', { consent: registrationConsent(true, true) });
  const raw = flow.cookie.slice('oauth_google='.length);
  const [payload, mac] = raw.split('.');
  const altered = JSON.parse(Buffer.from(payload, 'base64url').toString()); altered.consent.source = 'zalo-registration';
  const tampered = `oauth_google=${Buffer.from(JSON.stringify(altered)).toString('base64url')}.${mac}`;
  for (const [provider, cookie, state] of [['google', tampered, flow.state], ['zalo', `oauth_zalo=${raw}`, flow.state], ['google', flow.cookie, 'wrong'], ['google', `oauth_google=${payload}`, flow.state]]) {
    assert.throws(() => f.service.consumeState({ headers: { cookie } }, provider, state), { status: 403 });
  }
  const realNow = Date.now;
  try { Date.now = () => realNow() + 601_000;
    assert.throws(() => f.service.consumeState({ headers: { cookie: flow.cookie } }, 'google', flow.state), { status: 403 });
  } finally { Date.now = realNow; }
  assert.equal(f.issued.length, 0);
});

test('Google recovery không tự tạo tài khoản hoặc ghi consent giả cho tài khoản cũ', async () => {
  const f = fixture(); const previous = globalThis.fetch; globalThis.fetch = f.mockFetch;
  try {
    const start = await f.call('/google?recover=1');
    const flow = { state: new URL(start.headers.location).searchParams.get('state'), cookie: start.headers['set-cookie'].split(';')[0] };
    const denied = await f.callback('google', flow);
    assert.match(denied.headers.location, /\/recover\?google=unlinked$/);
    assert.equal(f.rows.length, 0); assert.equal(f.issued.length, 0);
    f.rows.push({ id: 'legacy', provider: 'google', providerId: 'person-1', name: 'Legacy', role: 'sender' });
    const next = await f.call('/google?recover=1');
    await f.callback('google', { state: new URL(next.headers.location).searchParams.get('state'), cookie: next.headers['set-cookie'].split(';')[0] });
    assert.deepEqual(f.issued, ['legacy']); assert.equal(f.rows[0].registrationConsent, undefined);
  } finally { globalThis.fetch = previous; }
});
