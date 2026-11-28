import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { SessionStore } from '../../src/modules/identity/sessions.service.mjs';
import { MySqlSessionStore } from '../../src/modules/identity/mysql.repositories.mjs';
import { registerRoutes } from '../../src/modules/identity/routes.mjs';
import { signSession, verifySession } from '../../src/shared/security.mjs';
import { mountSessionSecurity } from '../../web/js/features/privacy/session-security.js';
import { privacyPage } from '../../web/js/pages/privacy.js';

const secret = 'session-security-test-secret';
const a = { id: 'a', name: 'A', role: 'sender' };
const b = { id: 'b', name: 'B', role: 'creator' };
const users = { get: id => [a, b].find(user => user.id === id) };
const turn = () => new Promise(resolve => setImmediate(resolve));

test('JSON chỉ thu hồi các phiên khác cùng tài khoản, giữ phiên hiện tại và tài khoản khác', () => {
  let rows = [];
  const repo = { all: () => rows, write: value => { rows = value; } };
  const store = new SessionStore(repo, users, secret);
  const first = store.create(a), second = store.create(a), third = store.create(b);
  assert.equal(store.revokeOthers(first), true);
  const restarted = new SessionStore(repo, users, secret);
  assert(restarted.find(first)); assert.equal(restarted.find(second), null); assert(restarted.find(third));
  assert.equal(restarted.revokeOthers(first), true);
  assert.equal(restarted.revokeOthers(second), false);
  assert.equal(restarted.revokeOthers(signSession(a, secret)), false);
  assert.equal(restarted.revokeOthers(signSession(a, secret, -1)), false);
  assert.equal(restarted.revokeOthers('bad'), false);
  assert(restarted.find(third));
});

test('MySQL kiểm tra credential version, khóa tài khoản và phiên hiện hành trước DELETE giới hạn phạm vi', async () => {
  const token = signSession(a, secret), claims = verifySession(token, secret);
  let version = 0, exists = true, calls = [];
  const tx = { async execute(sql, args) {
    calls.push({ sql, args });
    if (sql.startsWith('SELECT * FROM users')) return [[{ id: a.id, role: a.role, legacy_payload: { credentialVersion: version }, created_at: '2026-01-01 00:00:00' }]];
    if (sql.startsWith('SELECT id FROM sessions')) return [exists ? [{ id: claims.jti }] : []];
    assert.equal(sql, 'DELETE FROM sessions WHERE user_id=? AND id<>?');
    return [{ affectedRows: 2 }];
  } };
  const store = new MySqlSessionStore({ withTransaction: fn => fn(tx) }, users, secret);
  assert.equal(await store.revokeOthers(token), true);
  assert.match(calls[0].sql, /FOR UPDATE/); assert.match(calls[1].sql, /FOR UPDATE/);
  assert.deepEqual(calls[2].args, [a.id, claims.jti]);
  calls = []; exists = false;
  assert.equal(await store.revokeOthers(token), false); assert.equal(calls.length, 2);
  calls = []; version = 1;
  assert.equal(await store.revokeOthers(token), false); assert.equal(calls.length, 1);
  calls = []; assert.equal(await store.revokeOthers('bad'), false); assert.equal(calls.length, 0);
});

test('API xác nhận rõ ràng, chỉ dùng token phiên, không nhận userId đích', async () => {
  let handler, calls = [], allowed = true;
  registerRoutes({ on(method, route, fn) { if (method === 'POST' && route === '/sessions/revoke-others') handler = fn; } }, {
    config: {}, credentials: {}, roles: {}, service: {}, recovery: {}, authLimits: { consume(kind) { assert.equal(kind, 'session'); } },
    sessions: { revokeOthers(token) { calls.push(token); return allowed; } },
  });
  function request(body) {
    const req = Readable.from([Buffer.from(JSON.stringify(body))]);
    req.headers = { 'content-type': 'application/json', cookie: 'session=fixture' };
    return req;
  }
  const res = { writeHead(code, headers) { this.code = code; this.headers = headers; }, end(body) { this.body = JSON.parse(body); } };
  await assert.rejects(handler({ req: request({ confirm: 'true' }), res }), { status: 400 });
  assert.deepEqual(calls, []);
  allowed = false;
  await assert.rejects(handler({ req: request({ confirm: true }), res }), { status: 401 });
  allowed = true;
  await handler({ req: request({ confirm: true, userId: b.id }), res });
  assert.deepEqual(calls, ['fixture', 'fixture']);
  assert.equal(res.code, 200); assert.deepEqual(res.body, { ok: true });
  assert.equal(res.headers['cache-control'], 'no-store');
});

function fixture() {
  const host = { innerHTML: '', replaceChildren() { this.innerHTML = ''; },
    addEventListener(name, fn, { signal }) { this.click = action => { if (!signal.aborted) fn({ target: { closest: () => ({ dataset: { sessionAction: action } }) } }); }; } };
  return host;
}

test('UI xác nhận hai bước, hủy không gọi API, khóa gửi lặp và hiển thị thành công', async () => {
  const host = fixture(); let resolve, calls = [];
  const controller = mountSessionSecurity(host, { api: { post(...args) { calls.push(args); return new Promise(r => { resolve = r; }); } } });
  assert.match(privacyPage(), /data-session-security/);
  host.click('open'); host.click('cancel'); assert.equal(calls.length, 0);
  host.click('open'); host.click('confirm'); host.click('confirm');
  assert.equal(calls.length, 1); assert.equal(calls[0][0], '/auth/sessions/revoke-others'); assert.deepEqual(calls[0][1], { confirm: true });
  assert.match(host.innerHTML, /disabled/); resolve({ ok: true }); await turn();
  assert.match(host.innerHTML, /role="status"/); controller.dispose(); assert.equal(host.innerHTML, '');
});

test('UI lỗi mạng không báo thành công, hết phiên có link đăng nhập, phản hồi muộn không render sau dispose', async () => {
  const host = fixture(); let mode = 'network', resolve;
  const controller = mountSessionSecurity(host, { api: { async post() {
    if (mode === 'network') throw new Error('network');
    if (mode === 'expired') throw Object.assign(new Error('expired'), { status: 401 });
    return new Promise(r => { resolve = r; });
  } } });
  host.click('open'); host.click('confirm'); await turn(); assert.match(host.innerHTML, /role="alert"/);
  mode = 'expired'; host.click('open'); host.click('confirm'); await turn(); assert.match(host.innerHTML, /href="\/login"/); controller.dispose();
  mode = 'late'; const next = mountSessionSecurity(host, { api: { post() { return new Promise(r => { resolve = r; }); } } });
  host.click('open'); host.click('confirm'); next.dispose(); resolve({ ok: true }); await turn(); assert.equal(host.innerHTML, '');
});
