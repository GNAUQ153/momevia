import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { JsonRepository } from '../../src/shared/storage.mjs';
import { CredentialsService } from '../../src/modules/identity/credentials.service.mjs';
import { SessionStore } from '../../src/modules/identity/sessions.service.mjs';
import { registerRoutes } from '../../src/modules/identity/routes.mjs';
import { privacyPage } from '../../web/js/pages/privacy.js';
import { mountPasswordChange } from '../../web/js/features/privacy/password-change.js';

const old = 'OldPass123', password = 'NewPass456';
const payload = { currentPassword: old, password, confirmPassword: password, confirmLogout: true };
async function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), 'momevia-password-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const users = new JsonRepository(join(dir, 'users.json'));
  const credentials = new CredentialsService(users);
  const account = users.insert({ id: 'u', provider: 'email', email: 'qa@example.test', role: 'sender',
    passwordHash: await credentials.hashPassword(old), registrationConsent: { version: 'test' },
    recoveryChallenge: { digest: 'old' }, emailVerifiedAt: '2026-01-01' });
  const sessions = new SessionStore(new JsonRepository(join(dir, 'sessions.json')), users, 'fixture-secret');
  const token = sessions.create(account), other = sessions.create(account);
  return { users, credentials, sessions, token, other, account,
    change: (body = payload, commit = update => sessions.mutateAuthenticated(token, update)) => credentials.changePassword(sessions.find(token), body, commit) };
}

test('đổi mật khẩu thật, bảo toàn consent và tài khoản khác, vô hiệu mọi phiên cũ và OTP', async t => {
  const f = await setup(t);
  const stranger = f.users.insert({ id: 'other', provider: 'google', role: 'sender' });
  const strangerToken = f.sessions.create(stranger);
  const updated = await f.change();
  assert.equal(updated.credentialVersion, 1); assert.equal(updated.recoveryChallenge, null);
  assert.deepEqual(updated.registrationConsent, f.account.registrationConsent);
  assert.equal(updated.emailVerifiedAt, f.account.emailVerifiedAt); assert.equal(updated.role, 'sender');
  assert.equal(f.sessions.find(f.token), null); assert.equal(f.sessions.find(f.other), null);
  assert(f.sessions.find(strangerToken));
  const reopened = new CredentialsService(new JsonRepository(f.users.filepath));
  await assert.rejects(reopened.login({ email: f.account.email, password: old }), { status: 401 });
  const user = await reopened.login({ email: f.account.email, password });
  assert(f.sessions.find(f.sessions.create(user)));
});

test('mật khẩu cũ sai, mật khẩu mới yếu, không khớp hoặc không đổi đều không ghi', async t => {
  const f = await setup(t);
  for (const body of [{ ...payload, currentPassword: 'wrong' }, { ...payload, password: 'lowercase1', confirmPassword: 'lowercase1' },
    { ...payload, confirmPassword: 'bad' }, { ...payload, password: old, confirmPassword: old }]) {
    await assert.rejects(f.change(body), { status: 400 });
    assert.deepEqual(f.users.get('u'), f.account);
  }
});

test('OAuth không có mật khẩu local, token hết hiệu lực không được đổi', async t => {
  const f = await setup(t);
  const oauth = f.users.insert({ id: 'social', provider: 'google' });
  await assert.rejects(f.credentials.changePassword(f.sessions.find(f.sessions.create(oauth)), payload, () => true), { status: 403 });
  f.sessions.revoke(f.token);
  await assert.rejects(f.change(), { status: 401 });
});

test('phiên bị thu hồi trong khi băm không được ghi mật khẩu', async t => {
  const f = await setup(t);
  const hash = f.credentials.hashPassword.bind(f.credentials);
  f.credentials.hashPassword = async value => { const result = await hash(value); f.sessions.revoke(f.token); return result; };
  await assert.rejects(f.change(), { status: 401 });
  assert.deepEqual(f.users.get('u'), f.account);
});

test('hai yêu cầu cùng credential version chỉ ghi một lần tại commit', async t => {
  const f = await setup(t);
  const claims = f.sessions.find(f.token);
  let count = 0, release;
  const gate = new Promise(resolve => { release = resolve; });
  const commit = async update => { if (++count === 2) release(); await gate; return f.sessions.mutateAuthenticated(f.token, update); };
  const results = await Promise.allSettled([f.credentials.changePassword(claims, payload, commit), f.credentials.changePassword(claims, payload, commit)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.status, 401);
  assert.equal(f.users.get('u').credentialVersion, 1);
});

test('route chỉ dùng session, yêu cầu xác nhận rõ ràng, xóa cookie và không trả dữ liệu nhạy cảm', async t => {
  const f = await setup(t); let handler, calls = 0;
  registerRoutes({ on(method, path, fn) { if (method === 'POST' && path === '/password/change') handler = fn; } }, {
    config: {}, credentials: f.credentials, sessions: f.sessions, service: {}, roles: {}, recovery: {}, authLimits: { consume(kind) { assert.equal(kind, 'password'); calls++; } },
  });
  function req(body, token = f.token) { const r = Readable.from([Buffer.from(JSON.stringify(body))]); r.headers = { 'content-type': 'application/json', cookie: `session=${token}` }; return r; }
  const res = { setHeader(key, value) { this[key] = value; }, writeHead(code, headers) { this.code = code; this.headers = headers; }, end(body) { this.body = JSON.parse(body); } };
  await assert.rejects(handler({ req: req(payload, 'bad'), res }), { status: 401 });
  await assert.rejects(handler({ req: req({ ...payload, confirmLogout: 'true' }), res }), { status: 400 });
  await handler({ req: req({ ...payload, userId: 'other' }), res });
  assert.equal(calls, 3); assert.equal(res.code, 200); assert.deepEqual(res.body, { ok: true });
  assert.match(res['set-cookie'], /Max-Age=0/i); assert.equal(res.headers['cache-control'], 'no-store');
});

test('form chỉ xuất hiện cho tài khoản email và controller không lưu mật khẩu', () => {
  assert.match(privacyPage({ provider: 'email' }), /data-password-change/);
  assert.doesNotMatch(privacyPage({ provider: 'google' }), /data-password-change/);
  assert.doesNotMatch(privacyPage({ provider: 'zalo' }), /data-password-change/);
  const inputs = Object.fromEntries(['currentPassword', 'password', 'confirmPassword', 'confirmLogout'].map(name => [name, { value: '', checked: false, setAttribute() {}, focus() {} }]));
  const submit = { disabled: false }, error = { textContent: '' };
  const form = { elements: inputs, querySelector: () => submit, querySelectorAll: () => Object.values(inputs), reset() { Object.values(inputs).forEach(i => { i.value = ''; i.checked = false; }); }, setAttribute() {}, removeAttribute() {} };
  const host = { innerHTML: '', querySelector(sel) { return sel === '[data-password-form]' ? form : error; }, contains: () => true, addEventListener(name, fn) { this.fire = () => fn({ target: form, preventDefault() {} }); }, replaceChildren() { this.innerHTML = ''; } };
  let sent;
  const controller = mountPasswordChange(host, { api: { async post(url, body) { sent = { url, body: { ...body } }; return { ok: true }; } } });
  assert.match(host.innerHTML, /autocomplete="current-password"/);
  assert.match(host.innerHTML, /<form[^>]+method="post"/);
  return (async () => {
    await host.fire(); assert.equal(sent, undefined); assert(error.textContent);
    inputs.currentPassword.value = old; inputs.password.value = inputs.confirmPassword.value = password; inputs.confirmLogout.checked = true;
    await host.fire(); assert.equal(sent.url, '/auth/password/change'); assert.deepEqual(sent.body, payload);
    assert.equal(inputs.password.value, ''); assert.match(host.innerHTML, /href="\/login"/);
    controller.dispose(); assert.equal(host.innerHTML, '');
  })();
});
