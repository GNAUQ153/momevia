import test from 'node:test';
import assert from 'node:assert/strict';
import vi from '../../web/assets/locales/vi.json' with { type: 'json' };
import en from '../../web/assets/locales/en.json' with { type: 'json' };
import { policyDigest, policySnapshot, consentReceipt } from '../../src/modules/identity/policy-archive.mjs';
import { registrationEvidence } from '../../src/modules/identity/consent.mjs';
import { registrationConsent, registrationPolicyVersion } from '../../web/js/shared/registration-consent.js';
import { registerRoutes } from '../../src/modules/identity/routes.mjs';
import { legalPage } from '../../web/js/pages/policies.js';

const version = '2026-11-28.1';
const originalDigests = {
  vi: '80cbc61bedd8ae648b7ad5d21d79aca5efd35c28d73bc4125750fe8f9d4300ae',
  en: '10dc8d269f8b9a411d93f3d0c742619cda53ed98f1b90bfb7c6d3e2575e3a510',
};
const validEvidence = () => registrationEvidence(registrationConsent(true, true), 'vi');

test('Bản chụp chính sách cũ có digest cố định; nội dung hiện hành phải khớp bản chụp', () => {
  for (const [locale, dictionary] of Object.entries({ vi, en })) {
    assert.equal(policyDigest(version, locale), originalDigests[locale]);
    const snapshot = policySnapshot(registrationPolicyVersion);
    assert.equal(snapshot.version, registrationPolicyVersion);
    const expectedKeys = Object.keys(dictionary).filter(key =>
      /^policies\.(general|privacy)\./.test(key) ||
      ['auth.register.acceptTerms', 'auth.register.terms', 'auth.register.acceptPrivacy', 'shell.footer.privacy', 'policies.note', 'policies.draft'].includes(key));
    assert.deepEqual(Object.keys(snapshot.translations[locale]).sort(), expectedKeys.sort());
    for (const [key, value] of Object.entries(snapshot.translations[locale])) assert.equal(value, dictionary[key], key);
  }
  assert.equal(policySnapshot(version).status, 'draft');
  const copy = policySnapshot(version);
  copy.translations.vi['policies.draft'] = 'edited';
  assert.equal(policyDigest(version, 'vi'), originalDigests.vi);
  for (const unknown of ['__proto__', 'constructor', '../consent.mjs', 'old']) {
    assert.equal(policySnapshot(unknown), null);
    assert.equal(policyDigest(unknown, 'vi'), null);
  }
});

test('Bằng chứng mới dùng digest do server tính, không nhận hash do client tự khai', () => {
  const evidence = registrationEvidence({ ...registrationConsent(true, true), policyDigest: 'fake' }, 'en');
  assert.equal(evidence.policyDigest, policyDigest(registrationPolicyVersion, 'en'));
  assert.equal(consentReceipt({ registrationConsent: evidence }).status, 'digest-matched');
});

test('Không tự gán bằng chứng cho tài khoản cũ và phân biệt dữ liệu chưa có digest', () => {
  const old = { id: 'old', passwordHash: 'secret' };
  assert.deepEqual(consentReceipt(old), { currentVersion: registrationPolicyVersion, status: 'not-recorded', receipt: null });
  const evidence = validEvidence();
  delete evidence.policyDigest;
  assert.equal(consentReceipt({ registrationConsent: evidence }).status, 'version-only');
  assert.equal(consentReceipt({ registrationConsent: { ...evidence, version: 'unknown' } }).status, 'archive-unavailable');
  assert.equal(consentReceipt({ registrationConsent: { ...evidence, policyDigest: 'wrong' } }).status, 'digest-mismatch');
  assert.equal(consentReceipt({ registrationConsent: { ...evidence, terms: false } }).status, 'unrecognized');
  assert.equal(Object.hasOwn(old, 'registrationConsent'), false);
});

function fixture() {
  const handlers = new Map();
  const user = { id: 'a', email: 'a@example.test', passwordHash: 'private', registrationConsent: { ...validEvidence(), extra: 'private' } };
  registerRoutes({ on(method, path, fn) { handlers.set(`${method} ${path}`, fn); } }, {
    config: {}, service: { findCurrent: req => req.session === 'a' ? user : null },
  });
  const call = async (path, req = {}, params = {}) => {
    let status, headers, body;
    await handlers.get(`GET ${path}`)({ req, params, res: {
      writeHead(code, values) { status = code; headers = values; }, end(data) { body = JSON.parse(data); },
    } });
    return { status, headers, body };
  };
  return { call };
}

test('API consent yêu cầu session, bỏ qua userId client và không trả dữ liệu ngoài allowlist', async () => {
  const f = fixture();
  await assert.rejects(f.call('/consent', { userId: 'a' }), { status: 401 });
  const result = await f.call('/consent', { session: 'a', userId: 'b' }, { id: 'b' });
  assert.equal(result.status, 200);
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.equal(result.body.status, 'digest-matched');
  assert.deepEqual(Object.keys(result.body.receipt).sort(), ['acceptedAt', 'locale', 'policyDigest', 'privacy', 'purpose', 'source', 'terms', 'version'].sort());
  assert.doesNotMatch(JSON.stringify(result.body), /private|example\.test|passwordHash/);
});

test('API chính sách chỉ đọc phiên bản đã đăng ký, không nhận đường dẫn file', async () => {
  const f = fixture();
  const result = await f.call('/policies/:version', {}, { version });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, policySnapshot(version));
  for (const unknown of ['../consent.mjs', '__proto__', 'missing']) {
    await assert.rejects(f.call('/policies/:version', {}, { version: unknown }), { status: 404, messageKey: 'errors.notFound' });
  }
});

test('Trang chính sách đăng ký hiển thị phiên bản và vẫn báo dự thảo', () => {
  for (const page of ['general', 'privacy']) {
    const html = legalPage(page);
    assert(html.includes(registrationPolicyVersion));
    assert(html.includes(vi['policies.draft']));
  }
  assert(!legalPage('payment').includes(registrationPolicyVersion));
});
