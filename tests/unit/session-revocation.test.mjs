import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonRepository } from '../../src/shared/storage.mjs';
import { SessionStore } from '../../src/modules/identity/sessions.service.mjs';
import { MySqlSessionStore } from '../../src/modules/identity/mysql.repositories.mjs';
import { signSession, verifySession } from '../../src/shared/security.mjs';
import { registerSessionRevocationRoute, sessionActionRef } from '../../src/modules/identity/session-inventory.mjs';
import { inventoryView, mountSessionInventory } from '../../web/js/features/account/session-inventory.js';

const secret = 'test-only-session-revoke-secret';
const now = () => Math.floor(Date.now() / 1000);
function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), 'session-revoke-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const users = new JsonRepository(join(dir, 'users.json'));
  const repo = new JsonRepository(join(dir, 'sessions.json'));
  const alice = users.insert({ id: 'alice', role: 'sender', credentialVersion: 0 });
  const bob = users.insert({ id: 'bob', role: 'creator', credentialVersion: 0 });
  const store = new SessionStore(repo, users, secret);
  return { users, repo, alice, bob, store };
}

test('JSON thu hồi đúng một phiên, giữ phiên hiện tại, phiên khác và tài khoản khác', t => {
  const f = setup(t), a = f.store.create(f.alice), b = f.store.create(f.alice), c = f.store.create(f.alice), d = f.store.create(f.bob);
  const claims = verifySession(a, secret), target = verifySession(b, secret);
  const ref = sessionActionRef(claims, target.jti, secret);
  const list = f.store.listActive(a);
  assert.equal(list.sessions.find(row => row.current).revokeRef, undefined);
  assert(list.sessions.some(row => row.revokeRef === ref));
  assert(!JSON.stringify(list).includes(target.jti));
  assert.equal(f.store.revokeOne(a, ref), true);
  const restarted = new SessionStore(new JsonRepository(f.repo.filepath), f.users, secret);
  assert.equal(restarted.find(b), null);
  assert(restarted.find(a)); assert(restarted.find(c)); assert(restarted.find(d));
  assert.equal(restarted.revokeOne(a, ref), false);
});

test('JSON chống sử dụng tham chiếu từ phiên hoặc tài khoản khác, không tự thu hồi phiên đang dùng', t => {
  const f = setup(t), a = f.store.create(f.alice), b = f.store.create(f.alice), c = f.store.create(f.alice), d = f.store.create(f.bob);
  const ca = verifySession(a, secret), cb = verifySession(b, secret), cd = verifySession(d, secret);
  const ref = sessionActionRef(ca, cb.jti, secret);
  for (const [actor, supplied] of [[c, ref], [d, ref], [a, sessionActionRef(ca, cd.jti, secret)], [a, sessionActionRef(ca, ca.jti, secret)], [a, cb.jti], [a, '0'.repeat(64)]]) assert.equal(f.store.revokeOne(actor, supplied), false);
  assert(f.store.find(a)); assert(f.store.find(b)); assert(f.store.find(c)); assert(f.store.find(d));
  assert.equal(f.store.revokeOne(signSession(f.alice, secret), ref), null);
  f.store.revoke(a); assert.equal(f.store.revokeOne(a, ref), null);
});

test('JSON không thu hồi phiên legacy, hết hạn, credential cũ hoặc nằm ngoài cửa sổ 50', t => {
  const f = setup(t), a = f.store.create(f.alice), ca = verifySession(a, secret);
  const rows = f.repo.all();
  rows.push({ id: 'legacy', userId: 'alice', exp: now() + 100 },
    { id: 'expired', userId: 'alice', credentialVersion: 0, exp: now() - 1 },
    { id: 'old', userId: 'alice', credentialVersion: 9, exp: now() + 100 },
    { id: 'outside', userId: 'alice', credentialVersion: 0, exp: now() + 10 });
  for (let i = 0; i < 50; i++) rows.push({ id: `visible-${i}`, userId: 'alice', credentialVersion: 0, exp: now() + 1000 + i });
  f.repo.write(rows);
  for (const id of ['legacy', 'expired', 'old', 'outside']) assert.equal(f.store.revokeOne(a, sessionActionRef(ca, id, secret)), false);
  assert.equal(f.store.listActive(a).sessions.length, 50);
  assert.equal(f.store.listActive(a).unclassifiedCount, 1);
  f.users.update('alice', { credentialVersion: 1 });
  assert.equal(f.store.revokeOne(a, sessionActionRef(ca, 'visible-0', secret)), null);
});

test('MySQL khóa user và phiên hiện tại trước khi xóa đúng hàng bằng parameterized SQL', async () => {
  const user = { id: 'alice', role: 'sender', credentialVersion: 2 };
  const token = signSession(user, secret), claims = verifySession(token, secret);
  let current = true, cv = 2, candidates = [{ id: 'target' }], affectedRows = 1;
  const calls = [];
  const client = { withTransaction: fn => fn({ async execute(sql, args) {
    calls.push({ sql, args });
    if (sql.startsWith('SELECT * FROM users')) return [[{ id: user.id, role: user.role, legacy_payload: { credentialVersion: cv }, created_at: '2026-11-28 00:00:00.000' }]];
    if (sql.startsWith('SELECT id FROM sessions') && sql.includes('id=? AND user_id=?')) return [current ? [{ id: claims.jti }] : []];
    if (sql.startsWith('SELECT id FROM sessions')) return [candidates];
    if (sql.startsWith('DELETE FROM sessions')) return [{ affectedRows }];
    throw new Error('Unexpected SQL');
  } }) };
  const store = new MySqlSessionStore(client, {}, secret);
  const ref = sessionActionRef(claims, 'target', secret);
  assert.equal(await store.revokeOne(token, ref), true);
  assert(calls.slice(0, 3).every(c => c.sql.includes('FOR UPDATE')));
  assert.deepEqual(calls[2].args, [user.id, claims.jti, 2, 49]);
  assert.match(calls[2].sql, /user_id=\? AND id<>\? AND credential_version=\?/);
  assert.deepEqual(calls[3].args, ['target', user.id, claims.jti, 2]);
  assert.match(calls[3].sql, /id=\? AND user_id=\? AND id<>\?/);
  calls.length = 0; candidates = [];
  assert.equal(await store.revokeOne(token, ref), false); assert.equal(calls.length, 3);
  candidates = [{ id: 'target' }]; affectedRows = 0;
  assert.equal(await store.revokeOne(token, ref), false);
  calls.length = 0; current = false;
  assert.equal(await store.revokeOne(token, ref), null); assert.equal(calls.length, 2);
  calls.length = 0; cv = 3;
  assert.equal(await store.revokeOne(token, ref), null); assert.equal(calls.length, 1);
});

test('POST requires literal confirmation and opaque ref; reuses rate limit and ignores caller userId', async t => {
  const f = setup(t), a = f.store.create(f.alice), b = f.store.create(f.alice), d = f.store.create(f.bob);
  const ref = f.store.listActive(a).sessions.find(row => !row.current).revokeRef;
  let handler, count = 0;
  registerSessionRevocationRoute({ on(method, path, fn) { assert.equal(method, 'POST'); assert.equal(path, '/sessions/revoke'); handler = fn; } }, f.store, { consume(kind) { assert.equal(kind, 'session'); count++; } });
  async function call(body, token) {
    const req = Readable.from([Buffer.from(JSON.stringify(body))]); req.headers = { 'content-type': 'application/json', cookie: `session=${token}` };
    const res = { writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { this.body = JSON.parse(body); } };
    await handler({ req, res }); return res;
  }
  await assert.rejects(call({ ref, confirm: 'true' }, a), { status: 400 });
  await assert.rejects(call({ ref: 'invalid', confirm: true }, a), { status: 400 });
  await assert.rejects(call({ ref, confirm: true }, 'invalid'), { status: 401 });
  await assert.rejects(call({ ref, confirm: true }, d), { status: 404 });
  const result = await call({ ref, confirm: true, userId: 'bob' }, a);
  assert.equal(result.status, 200); assert.deepEqual(result.body, { ok: true }); assert.equal(result.headers['cache-control'], 'no-store');
  await assert.rejects(call({ ref, confirm: true }, a), { status: 404 });
  assert.equal(count, 6); assert(f.store.find(a)); assert(!f.store.find(b)); assert(f.store.find(d));
});

const ref = 'a'.repeat(64), secondRef = 'b'.repeat(64);
const current = { current: true, issuedAt: null, expiresAt: '2027-01-01T00:00:00Z' };
const sample = { sessions: [current, { ...current, current: false, revokeRef: ref }, { ...current, current: false, revokeRef: secondRef }], truncated: false, unclassifiedCount: 1 };
test('View renders action only on known other sessions, rejects duplicate and malformed refs', () => {
  assert.equal((inventoryView(sample).match(/data-session-revoke=/g) || []).length, 2);
  assert.equal((inventoryView(sample, ref).match(/data-session-confirm=/g) || []).length, 1);
  assert.doesNotMatch(inventoryView({ ...sample, sessions: [current] }), /data-session-revoke=/);
  assert.throws(() => inventoryView({ ...sample, sessions: [{ ...current, revokeRef: ref }] }));
  assert.throws(() => inventoryView({ ...sample, sessions: [current, { ...sample.sessions[1], revokeRef: '<script>' }] }));
  assert.throws(() => inventoryView({ ...sample, sessions: [current, sample.sessions[1], sample.sessions[1]] }));
});
function fixture() {
  return { innerHTML: '', setAttribute() {}, removeAttribute() {}, replaceChildren() { this.innerHTML = ''; }, addEventListener(name, listener, { signal }) {
    this.click = (selector, value) => { if (!signal.aborted) listener({ target: { closest: sel => sel === selector ? { dataset: { sessionRevoke: value, sessionConfirm: value } } : null } }); };
  } };
}
const turn = () => new Promise(resolve => setImmediate(resolve));
test('Controller requires confirmation, cancels safely, suppresses double click and reloads list on success', async () => {
  const host = fixture(), posts = []; let resolve, reads = 0;
  const c = mountSessionInventory(host, { api: { async get() { return ++reads === 1 ? sample : { ...sample, sessions: [current, sample.sessions[2]] }; }, post(path, body) { posts.push({ path, body }); return new Promise(r => { resolve = r; }); } } });
  await c.ready;
  host.click('[data-session-confirm]', ref); assert.equal(posts.length, 0);
  host.click('[data-session-revoke]', ref); host.click('[data-session-cancel]'); assert.equal(posts.length, 0);
  host.click('[data-session-revoke]', ref); host.click('[data-session-confirm]', secondRef); assert.equal(posts.length, 0);
  host.click('[data-session-confirm]', ref); host.click('[data-session-confirm]', ref);
  assert.deepEqual(posts, [{ path: '/auth/sessions/revoke', body: { ref, confirm: true } }]);
  resolve({ ok: true }); await turn(); assert.equal(reads, 2); assert.match(host.innerHTML, /Đã thu hồi/); assert(!host.innerHTML.includes(ref));
  c.dispose(); assert.equal(host.innerHTML, '');
});
test('Controller network error requires refresh; late response after route dispose is ignored', async () => {
  const host = fixture(); let mode = 'error', resolve, posts = 0;
  const c = mountSessionInventory(host, { api: { get: async () => sample, post() { posts++; if (mode === 'error') return Promise.reject(Error('offline')); return new Promise(r => { resolve = r; }); } } });
  await c.ready; host.click('[data-session-revoke]', ref); host.click('[data-session-confirm]', ref); await turn();
  assert.match(host.innerHTML, /role="alert"/); assert.match(host.innerHTML, /data-session-refresh/); host.click('[data-session-confirm]', ref); assert.equal(posts, 1);
  host.click('[data-session-refresh]'); await turn(); mode = 'late'; host.click('[data-session-revoke]', ref); host.click('[data-session-confirm]', ref); c.dispose(); resolve({ ok: true }); await turn(); assert.equal(host.innerHTML, '');
});
