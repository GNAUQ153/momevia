import test from 'node:test';
import assert from 'node:assert/strict';
import { RecoveryService, recoveryTtlMs } from '../../src/modules/identity/recovery.service.mjs';
import { CredentialsService } from '../../src/modules/identity/credentials.service.mjs';

function fixture({ verified = false, nowMs = 2_000_000 } = {}) {
  const user = { id: 'account-a', email: 'new@example.test', provider: 'email',
    credentialVersion: 0, emailVerifiedAt: verified ? '2026-01-01T00:00:00.000Z' : null };
  let current = user;
  const messages = [];
  let clock = nowMs;
  const users = {
    async mutate(id, callback) {
      if (id !== current.id) return null;
      const patch = callback(current);
      if (patch) current = { ...current, ...patch };
      return current;
    },
    async findByEmail(email) { return email === current.email ? current : null; },
  };
  const credentials = new CredentialsService(users);
  const recovery = new RecoveryService({ users, credentials, secret: 'fake-secret-for-tests',
    now: () => clock, sendMail: async message => { messages.push(message); } });
  return { recovery, credentials, messages, get current() { return current; }, advance: ms => { clock += ms; } };
}
const extractCode = message => /\b\d{8}\b/.exec(message.text)?.[0];

test('Unverified account can reset using email proof; token verifies email and revokes old credential version', async () => {
  const f = fixture();
  await f.recovery.start(f.current, 'reset');
  assert.equal(f.messages.length, 1);
  const code = extractCode(f.messages[0]);
  assert.match(code, /^\d{8}$/);
  const original = f.current.credentialVersion;
  const updated = await f.recovery.finish(f.current, 'reset', code, 'NewPassword123');
  assert.equal(updated.credentialVersion, original + 1);
  assert.match(updated.emailVerifiedAt, /^1970-/);
  assert.equal(await f.credentials.verifyPassword('NewPassword123', updated.passwordHash), true);
  await assert.rejects(f.recovery.finish(f.current, 'reset', code, 'OtherPassword123'), { status: 422 });
});

test('Verified email timestamp is preserved when resetting a previously verified account', async () => {
  const f = fixture({ verified: true });
  await f.recovery.start(f.current, 'reset');
  const old = f.current.emailVerifiedAt;
  const updated = await f.recovery.finish(f.current, 'reset', extractCode(f.messages[0]), 'NewPassword123');
  assert.equal(updated.emailVerifiedAt, old);
});

test('Wrong code, expiry and cooldown remain enforced for unverified reset', async () => {
  const f = fixture();
  await f.recovery.start(f.current, 'reset');
  const code = extractCode(f.messages[0]);
  await f.recovery.start(f.current, 'reset');
  assert.equal(f.messages.length, 1, 'cooldown must prevent resend');
  await assert.rejects(f.recovery.finish(f.current, 'reset', '99999999' === code ? '88888888' : '99999999', 'NewPassword123'), { status: 422 });
  f.advance(recoveryTtlMs);
  await assert.rejects(f.recovery.finish(f.current, 'reset', code, 'NewPassword123'), { status: 422 });
  assert.equal(f.current.emailVerifiedAt, null);
});

test('Normal verify-email remains available only until email is verified', async () => {
  const f = fixture();
  await f.recovery.start(f.current, 'verify');
  assert.equal((await f.recovery.finish(f.current, 'verify', extractCode(f.messages[0]))).emailVerifiedAt !== null, true);
  f.advance(61_000);
  await f.recovery.start(f.current, 'verify');
  assert.equal(f.messages.length, 1, 'verified email must not resend verify code');
});

test('Unknown or OAuth-only accounts do not reveal account existence via delivery', async () => {
  const f = fixture();
  await f.recovery.start(null, 'reset');
  await f.recovery.start({ id: 'oauth', email: 'another@example.test', provider: 'google' }, 'reset');
  assert.equal(f.messages.length, 0);
});
