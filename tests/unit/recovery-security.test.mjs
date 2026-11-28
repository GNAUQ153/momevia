import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonRepository } from '../../src/shared/storage.mjs';
import { SessionStore } from '../../src/modules/identity/sessions.service.mjs';
import assert from 'node:assert/strict';
import { RecoveryService, recoveryTtlMs } from '../../src/modules/identity/recovery.service.mjs';
import { CredentialsService } from '../../src/modules/identity/credentials.service.mjs';

function fixture() {
  let current = { id: 'u', provider: 'email', email: 'qa@example.test', passwordHash: 'old', credentialVersion: 0 };
  let now = 2_000_000;
  let hashes = 0;
  let code;
  let hashHook = async () => 'new-hash';
  const users = { async mutate(id, fn) {
    if (id !== current.id) return null;
    const patch = fn(current);
    if (patch) current = { ...current, ...patch };
    return current;
  } };
  const credentials = { validatePassword() {}, async hashPassword(password) { hashes++; return hashHook(password); } };
  const recovery = new RecoveryService({ users, credentials, secret: 'test-only', now: () => now,
    sendMail: async message => { code = /\b\d{8}\b/.exec(message.text)[0]; } });
  return { recovery, get user() { return current; }, get code() { return code; }, get hashes() { return hashes; },
    patch(fields) { current = { ...current, ...fields }; }, advance(ms) { now += ms; }, setHashHook(fn) { hashHook = fn; },
    async start() { await recovery.start(current, 'reset'); }, finish(value = code) { return recovery.finish(current, 'reset', value, 'NewPass123'); } };
}
const wrong = code => code === '00000000' ? '11111111' : '00000000';

test('OTP sai, thiếu hoặc hết hạn không chạy scrypt; năm lần sai vô hiệu hóa mã', async () => {
  const f = fixture();
  await assert.rejects(f.finish('12345678'), { status: 422 });
  await f.start();
  for (let i = 0; i < 5; i++) await assert.rejects(f.finish(wrong(f.code)), { status: 422 });
  assert.equal(f.user.recoveryChallenge, null);
  await assert.rejects(f.finish(), { status: 422 });
  f.advance(61_000); await f.start(); f.advance(recoveryTtlMs);
  await assert.rejects(f.finish(), { status: 422 });
  assert.equal(f.hashes, 0);
  assert.equal(f.user.passwordHash, 'old');
});

test('OTP đúng chỉ đổi mật khẩu một lần khi hai yêu cầu đồng thời', async () => {
  const f = fixture(); await f.start();
  const results = await Promise.allSettled([f.finish(), f.finish()]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected' && r.reason.status === 422).length, 1);
  assert.equal(f.user.credentialVersion, 1);
  assert.equal(f.user.recoveryChallenge, null);
  assert.equal(f.user.passwordHash, 'new-hash');
});

test('challenge hết hạn trong lúc băm không thay đổi mật khẩu', async () => {
  const f = fixture(); await f.start();
  f.setHashHook(async () => { f.advance(recoveryTtlMs); return 'new-hash'; });
  await assert.rejects(f.finish(), { status: 422 });
  assert.equal(f.user.passwordHash, 'old');
  assert.equal(f.user.credentialVersion, 0);
});

test('mã được cấp lại trong lúc băm không bị ghi đè hoặc tiêu thụ', async () => {
  const f = fixture(); await f.start();
  f.setHashHook(async () => { f.advance(61_000); await f.start(); return 'new-hash'; });
  await assert.rejects(f.finish(), { status: 422 });
  assert.equal(f.user.passwordHash, 'old');
  assert.ok(f.user.recoveryChallenge);
});

test('credential version thay đổi trong lúc băm không bị ghi đè', async () => {
  const f = fixture(); await f.start();
  f.setHashHook(async () => { f.patch({ credentialVersion: 1, passwordHash: 'other' }); return 'new-hash'; });
  await assert.rejects(f.finish(), { status: 422 });
  assert.equal(f.user.passwordHash, 'other');
  assert.equal(f.user.credentialVersion, 1);
});

test('hash thất bại không tiêu thụ OTP, có thể thử lại trước khi hết hạn', async () => {
  const f = fixture(); await f.start();
  f.setHashHook(async () => { throw Object.assign(new Error('busy'), { status: 503 }); });
  await assert.rejects(f.finish(), { status: 503 });
  assert.ok(f.user.recoveryChallenge);
  assert.equal(f.user.passwordHash, 'old');
  f.setHashHook(async () => 'new-hash');
  assert.equal((await f.finish()).credentialVersion, 1);
});

test('challenge hỏng hoặc sai mục đích trả 422, không băm mật khẩu', async () => {
  const f = fixture(); await f.start();
  const challenge = f.user.recoveryChallenge;
  for (const patch of [{ digest: 'zz'.repeat(32) }, { attempts: -1 }, { expiresAt: '99999999' }, { purpose: 'verify' }]) {
    f.patch({ recoveryChallenge: { ...challenge, ...patch } });
    await assert.rejects(f.finish(), { status: 422 });
  }
  assert.equal(f.hashes, 0);
});

test('password hash không đúng định dạng không gọi hàm derive', async () => {
  const credentials = new CredentialsService({});
  let calls = 0;
  credentials.derivePassword = async () => { calls++; return Buffer.alloc(64); };
  const valid = 'ab'.repeat(16) + ':' + '00'.repeat(64);
  for (const stored of [null, {}, valid + '\n', valid + ':extra', 'zz'.repeat(16) + ':' + '00'.repeat(64), 'ab'.repeat(16) + ':' + 'zz'.repeat(64)]) {
    assert.equal(await credentials.verifyPassword('Password123', stored), false);
  }
  assert.equal(calls, 0);
  assert.equal(await credentials.verifyPassword('Password123', valid), true);
  assert.equal(calls, 1);
});


test('reset thành công trên JSON thật lưu mật khẩu mới và vô hiệu hóa JWT cũ', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'momevia-recovery-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const users = new JsonRepository(join(dir, 'users.json'));
  const sessionRepo = new JsonRepository(join(dir, 'sessions.json'));
  const credentials = new CredentialsService(users);
  const user = await credentials.register({ name: 'QA User', email: 'qa@example.test', password: 'OldPass123' });
  const sessions = new SessionStore(sessionRepo, users, 'qa-session-secret');
  const oldToken = sessions.create(user);
  assert.ok(sessions.find(oldToken));
  let code;
  const recovery = new RecoveryService({ users, credentials, secret: 'qa-recovery-secret',
    sendMail: async message => { code = /\b\d{8}\b/.exec(message.text)[0]; } });
  await recovery.start(user, 'reset');
  const updated = await recovery.finish(user, 'reset', code, 'NewPass123');
  const reopened = new JsonRepository(join(dir, 'users.json'));
  assert.equal(reopened.get(user.id).credentialVersion, 1);
  assert.equal(reopened.get(user.id).recoveryChallenge, null);
  assert.equal(sessions.find(oldToken), null);
  assert.ok(sessions.find(sessions.create(updated)));
  await assert.rejects(credentials.login({ email: user.email, password: 'OldPass123' }), { status: 401 });
  assert.equal((await credentials.login({ email: user.email, password: 'NewPass123' })).id, user.id);
});
