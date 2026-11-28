import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SessionStore } from '../../src/modules/identity/sessions.service.mjs';
import { MySqlSessionStore } from '../../src/modules/identity/mysql.repositories.mjs';
import { registerSessionInventoryRoute } from '../../src/modules/identity/session-inventory.mjs';
import { JsonRepository } from '../../src/shared/storage.mjs';
import { signSession, verifySession } from '../../src/shared/security.mjs';
import { authDestination } from '../../web/js/core/auth-return.js';
import { inventoryView, mountSessionInventory, sessionPage } from '../../web/js/features/account/session-inventory.js';

const secret = 'fixture-only-secret';
const sample = { sessions: [{ current: true, issuedAt: null, expiresAt: '2026-12-05T00:00:00Z' }], truncated: false, unclassifiedCount: 1 };
const setup = t => {
  const directory = mkdtempSync(join(tmpdir(), 'session-inventory-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const users = new JsonRepository(join(directory, 'users.json'));
  const user = users.insert({ id: 'alice', role: 'sender', credentialVersion: 0 });
  const other = users.insert({ id: 'bob', role: 'sender', credentialVersion: 0 });
  const repo = new JsonRepository(join(directory, 'sessions.json'));
  return { users, user, other, repo, store: new SessionStore(repo, users, secret) };
};

test('JSON lists only live matching-credential sessions for the current account, without identifiers', t => {
  const f = setup(t);
  const first = f.store.create(f.user), second = f.store.create(f.user);
  f.store.create(f.other);
  const legacy = signSession(f.user, secret), lc = verifySession(legacy, secret);
  f.repo.insert({ id: lc.jti, userId: f.user.id, exp: lc.exp });
  f.repo.insert({ id: 'expired', userId: f.user.id, credentialVersion: 0, exp: 1 });
  const result = new SessionStore(new JsonRepository(f.repo.filepath), f.users, secret).listActive(first);
  assert.equal(result.sessions.length, 2);
  assert.equal(result.sessions[0].current, true); assert.equal(result.sessions[1].current, false);
  assert.equal(result.unclassifiedCount, 1); assert.equal(result.truncated, false);
  for (const row of result.sessions) assert.deepEqual(Object.keys(row).sort(), row.current ? ['current', 'expiresAt', 'issuedAt'] : ['current', 'expiresAt', 'issuedAt', 'revokeRef']);
  assert.match(result.sessions[1].revokeRef, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(result), /alice|bob|credentialVersion|jti|token/);
  f.store.revoke(second); assert.equal(f.store.listActive(first).sessions.length, 1);
  const oldCurrent = f.store.listActive(legacy);
  assert.equal(oldCurrent.sessions[0].current, true); assert.equal(oldCurrent.sessions[0].issuedAt, null);
  assert.equal(oldCurrent.unclassifiedCount, 0);
});

test('Password change removes old credential versions from inventory; old session and unissued token rejected', t => {
  const f = setup(t), old = f.store.create(f.user);
  const freshUser = f.users.update(f.user.id, { credentialVersion: 1 });
  const fresh = f.store.create(freshUser);
  assert.equal(f.store.listActive(old), null);
  assert.equal(f.store.listActive(signSession(freshUser, secret)), null);
  assert.equal(f.store.listActive('invalid'), null);
  assert.equal(f.store.listActive(fresh).sessions.length, 1);
  f.store.revoke(fresh); assert.equal(f.store.listActive(fresh), null);
});

test('Limit 50 retains current session even with many other sessions', t => {
  const f = setup(t), token = f.store.create(f.user);
  const rows = f.repo.all();
  for (let i = 0; i < 52; i++) rows.push({ id: `session-${i}`, userId: f.user.id, credentialVersion: 0, exp: Math.floor(Date.now()/1000) + 900000 + i, issuedAt: null });
  f.repo.write(rows);
  const result = f.store.listActive(token);
  assert.equal(result.sessions.length, 50); assert.equal(result.sessions[0].current, true);
  assert.equal(result.truncated, true);
});

test('MySQL creation records credential version and issue time; reads scoped and bounded SQL', async () => {
  const user = { id: 'alice', role: 'sender', credentialVersion: 2 };
  let issued, active = true; const calls = [];
  const client = { async execute(sql, args=[]) {
    calls.push({ sql, args });
    if (sql.startsWith('DELETE')) return [{}];
    if (sql.startsWith('INSERT')) { issued = args; return [{}]; }
    if (sql.startsWith('SELECT id FROM sessions')) return [active ? [{ id: issued[0] }] : []];
    if (sql.startsWith('SELECT id, issued_at')) return [[{ id: issued[0], issued_at: issued[4], expires_at: issued[2] }, { id: 'other-session', issued_at: null, expires_at: issued[2] }]];
    if (sql.startsWith('SELECT COUNT')) return [[{ total: 3 }]];
    throw Error('unexpected SQL');
  } };
  const store = new MySqlSessionStore(client, { get: async id => id === user.id ? user : null }, secret);
  const token = await store.create(user), claims = verifySession(token, secret);
  assert.equal(issued[3], 2); assert.match(issued[4], /^\d{4}-\d{2}-\d{2} /);
  const result = await store.listActive(token);
  assert.equal(result.sessions.length, 2); assert.equal(result.sessions[0].current, true); assert.equal(result.unclassifiedCount, 3);
  const list = calls.find(x => x.sql.startsWith('SELECT id, issued_at'));
  assert.match(list.sql, /WHERE user_id=\? AND expires_at > UTC_TIMESTAMP\(3\) AND \(id=\? OR credential_version=\?\)/);
  assert.match(list.sql, /LIMIT \?/); assert.deepEqual(list.args, ['alice', claims.jti, 2, claims.jti, 51]);
  const count = calls.find(x => x.sql.startsWith('SELECT COUNT'));
  assert.deepEqual(count.args, ['alice', claims.jti]);
  assert.match(count.sql, /credential_version IS NULL/);
  assert.doesNotMatch(JSON.stringify(result), /alice|other-session/);
  active = false; assert.equal(await store.listActive(token), null);
});

test('Route reads only authenticated session token, ignores caller-provided ID and forbids cache', async () => {
  let handler; const tokens = [];
  registerSessionInventoryRoute({ on(method, path, fn) { assert.equal(method, 'GET'); assert.equal(path, '/sessions'); handler = fn; } }, {
    listActive: async token => { tokens.push(token); return token === 'valid' ? sample : null; },
  });
  const res = { writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { this.body = JSON.parse(body); } };
  await assert.rejects(handler({ req: { headers: {} }, res }), { status: 401 });
  await handler({ req: { headers: { cookie: 'session=valid' } }, params: { userId: 'bob' }, res });
  assert.deepEqual(tokens, [undefined, 'valid']); assert.deepEqual(res.body, sample);
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('View distinguishes current and legacy sessions, refuses malformed data; return path remains local', () => {
  assert.match(sessionPage(), /data-session-inventory/);
  const html = inventoryView(sample); assert.match(html, /Phiên hiện tại/); assert.match(html, /Chưa ghi nhận/); assert.match(html, /bản ghi phiên cũ/);
  assert.throws(() => inventoryView({ ...sample, sessions: [{ current: false, issuedAt: null, expiresAt: 'bad' }] }));
  assert.throws(() => inventoryView({ ...sample, sessions: [{ current: true, issuedAt: '<script>', expiresAt: '2026-12-05T00:00:00Z' }] }));
  const old = globalThis.location; globalThis.location = new URL('https://example.test/');
  try { assert.equal(authDestination('/account-sessions'), '/account-sessions'); assert.equal(authDestination('/account-sessions?userId=bob'), null); assert.equal(authDestination('//evil.test/account-sessions'), null); }
  finally { globalThis.location = old; }
});

test('Controller retries errors, deduplicates refresh, aborts and suppresses stale results', async () => {
  const host = { innerHTML: '', setAttribute() {}, removeAttribute() {}, replaceChildren() { this.innerHTML = ''; }, addEventListener(_, fn) { this.refresh = () => fn({ target: { closest: () => true } }); } };
  const calls = []; let resolve, current = true;
  const controller = mountSessionInventory(host, { isCurrent: () => current, api: { get(path, options) { calls.push({ path, options }); if (calls.length === 1) return Promise.reject(Error('offline')); return new Promise(r => { resolve = r; }); } } });
  await controller.ready; assert.match(host.innerHTML, /role="alert"/);
  host.refresh(); host.refresh(); assert.equal(calls.length, 2);
  resolve(sample); await new Promise(r => setImmediate(r)); assert.match(host.innerHTML, /Phiên hiện tại/);
  host.refresh(); current = false; controller.dispose(); resolve(sample); await new Promise(r => setImmediate(r)); assert.equal(host.innerHTML, '');
  assert(calls.every(c => c.path === '/auth/sessions' && c.options.signal.aborted && c.options.cache === 'no-store'));
});

test('V4D.1 revokeOthers remains compatible with inventory and legacy sessions', t => {
  const f = setup(t);
  const current = f.store.create(f.user), another = f.store.create(f.user), stranger = f.store.create(f.other);
  const legacy = signSession(f.user, secret), claims = verifySession(legacy, secret);
  f.repo.insert({ id: claims.jti, userId: f.user.id, exp: claims.exp });
  assert.equal(f.store.listActive(current).unclassifiedCount, 1);
  assert.equal(f.store.revokeOthers(current), true);
  assert.equal(f.store.listActive(current).sessions.length, 1);
  assert.equal(f.store.listActive(current).unclassifiedCount, 0);
  assert.equal(f.store.find(another), null);
  assert.equal(f.store.find(legacy), null);
  assert.ok(f.store.find(stranger));
  assert.equal(f.store.revokeOthers(another), false);
});

test('MySQL V4D.1 revokeOthers keeps current JTI and locks owner before deleting other sessions', async () => {
  const user = { id: 'alice', role: 'sender', credentialVersion: 2 };
  const token = signSession(user, secret), claims = verifySession(token, secret);
  const calls = [];
  const client = { withTransaction: fn => fn({ async execute(sql, args) {
    calls.push({ sql, args });
    if (sql.startsWith('SELECT * FROM users')) return [[{ id: user.id, role: user.role,
      created_at: '2026-11-28 00:00:00.000', legacy_payload: { credentialVersion: 2 } }]];
    if (sql.startsWith('SELECT id FROM sessions')) return [[{ id: claims.jti }]];
    return [{ affectedRows: 2 }];
  } }) };
  const store = new MySqlSessionStore(client, { get: async () => user }, secret);
  assert.equal(await store.revokeOthers(token), true);
  assert.match(calls[0].sql, /FOR UPDATE/);
  assert.match(calls[1].sql, /FOR UPDATE/);
  assert.deepEqual(calls[2], { sql: 'DELETE FROM sessions WHERE user_id=? AND id<>?', args: [user.id, claims.jti] });
});

test('Both account routes are allowed without permitting arbitrary return URLs', () => {
  const previous = globalThis.location;
  globalThis.location = new URL('https://example.test');
  try {
    assert.equal(authDestination('/privacy-center'), '/privacy-center');
    assert.equal(authDestination('/account-sessions'), '/account-sessions');
    for (const path of ['/privacy-center?userId=bob', '/account-sessions?userId=bob', '//bad.test/privacy-center']) assert.equal(authDestination(path), null);
  } finally { globalThis.location = previous; }
});
