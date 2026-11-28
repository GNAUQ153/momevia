import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { policyDigest } from '../../src/modules/identity/policy-archive.mjs';
import { CredentialsService } from '../../src/modules/identity/credentials.service.mjs';
import { registerRoutes } from '../../src/modules/identity/routes.mjs';
import { JsonRepository } from '../../src/shared/storage.mjs';
import { registrationConsent, registrationPolicyVersion } from '../../web/js/shared/registration-consent.js';

const password = 'SyntheticConsent123';
const account = { name: 'Consent QA', email: 'consent@example.test', password, confirmPassword: password };

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'momevia-consent-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'users.json');
  const users = new JsonRepository(file);
  const credentials = new CredentialsService(users);
  let handler, sessions = 0;
  registerRoutes({ on(method, path, fn) { if (method === 'POST' && path === '/register') handler = fn; } }, {
    config: {}, credentials, authLimits: { consume() {} },
    service: { async issueSession() { sessions++; } },
  });
  const call = async (body, locale = 'vi') => {
    const req = Readable.from([Buffer.from(JSON.stringify(body))]);
    req.headers = { 'content-type': 'application/json', 'x-momevia-locale': locale };
    let status, response;
    await handler({ req, res: { writeHead(code) { status = code; }, end(data) { response = JSON.parse(data); } } });
    return { status, response };
  };
  return { call, users, credentials, file, sessions: () => sessions };
}

test('API từ chối consent thiếu, false và kiểu dữ liệu giả trước khi tạo tài khoản', async t => {
  const f = fixture(t);
  for (const consent of [undefined, null, {}, registrationConsent(false, true), registrationConsent(true, false), registrationConsent('true', true), registrationConsent(true, 1)]) {
    await assert.rejects(f.call({ ...account, consent }), { status: 400, messageKey: 'errors.auth.consentRequired' });
  }
  assert.equal(f.users.all().length, 0);
  assert.equal(f.sessions(), 0);
});

test('API từ chối phiên bản thiếu hoặc cũ, không cấp session', async t => {
  const f = fixture(t);
  for (const version of [undefined, 'old-policy']) {
    await assert.rejects(f.call({ ...account, consent: { terms: true, privacy: true, version } }), { status: 409, messageKey: 'errors.auth.consentVersion' });
  }
  assert.equal(f.users.all().length, 0);
  assert.equal(f.sessions(), 0);
});

test('Đăng ký lưu consent cùng tài khoản, dùng giờ server, không trả bằng chứng hoặc hash công khai', async t => {
  const f = fixture(t);
  const start = Date.now();
  const consent = { ...registrationConsent(true, true), acceptedAt: '2000-01-01', purpose: 'marketing' };
  const result = await f.call({ ...account, consent, role: 'admin', registrationConsent: { fake: true } }, 'en');
  assert.equal(result.status, 201);
  assert.equal(result.response.user.role, 'sender');
  assert.equal(f.sessions(), 1);
  assert.equal('registrationConsent' in result.response.user, false);
  assert.equal('passwordHash' in result.response.user, false);
  const stored = new JsonRepository(f.file).get(result.response.user.id).registrationConsent;
  assert.deepEqual(stored, { version: registrationPolicyVersion, terms: true, privacy: true, purpose: 'account-creation', source: 'email-registration', locale: 'en', policyDigest: policyDigest(registrationPolicyVersion, 'en'), acceptedAt: stored.acceptedAt });
  assert(Date.parse(stored.acceptedAt) >= start && Date.parse(stored.acceptedAt) <= Date.now());
  await assert.rejects(f.call({ ...account, consent }), { status: 409 });
  assert.equal(f.users.all().length, 1);
  assert.deepEqual(f.users.all()[0].registrationConsent, stored);
});

test('Tài khoản nội bộ hoặc cũ không bị tự gán consent khi đăng nhập', async t => {
  const f = fixture(t);
  const old = await f.credentials.register(account);
  const user = await f.credentials.login(account);
  assert.equal(user.id, old.id);
  assert.equal('registrationConsent' in f.users.get(old.id), false);
});
