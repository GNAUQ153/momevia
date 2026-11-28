import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { privacyPage, receiptModel, receiptView, archiveView, privacyFailure } from '../../web/js/pages/privacy.js';
import { mountPrivacyCenter } from '../../web/js/features/privacy/privacy-center.js';
import { policySnapshot, consentReceipt } from '../../src/modules/identity/policy-archive.mjs';
import { registrationEvidence } from '../../src/modules/identity/consent.mjs';
import { registrationConsent, registrationPolicyVersion } from '../../web/js/shared/registration-consent.js';
import { authDestination } from '../../web/js/core/auth-return.js';
import { createLayout } from '../../web/js/ui/layout.js';

const version = registrationPolicyVersion;
const evidence = () => registrationEvidence(registrationConsent(true, true), 'vi');
const payload = () => consentReceipt({ registrationConsent: evidence() });
const turn = () => new Promise(resolve => setImmediate(resolve));

function fixture() {
  const target = { innerHTML: '', setAttribute() {}, removeAttribute() {} };
  const host = { innerHTML: '', attributes: new Map(),
    querySelector: () => target,
    setAttribute(name, value) { this.attributes.set(name, value); },
    removeAttribute(name) { this.attributes.delete(name); },
    replaceChildren() { this.innerHTML = ''; target.innerHTML = ''; },
    addEventListener(name, listener, { signal }) { this.click = key => { if (!signal.aborted) listener({ target: { closest: selector => selector === key ? button : null } }); }; },
  };
  const button = { disabled: false };
  return { host, target, button, root: { querySelector: selector => selector === '[data-privacy-receipt]' ? host : null } };
}

test('Privacy page exposes only implemented reading and support actions', () => {
  const html = privacyPage();
  assert.match(html, /data-privacy-receipt/);
  assert.match(html, /data-action="support"/);
  assert.match(html, /href="\/policies\/privacy"/);
  assert.doesNotMatch(html, /data-action="(?:withdraw|delete-account|export-data)"/);
});

test('Receipt model handles all six server statuses without inventing consent', () => {
  const valid = evidence();
  for (const [input, status] of [[undefined, 'not-recorded'], [{ ...valid, terms: false }, 'unrecognized'], [valid, 'digest-matched'], [{ ...valid, policyDigest: undefined }, 'version-only'], [{ ...valid, version: 'unknown' }, 'archive-unavailable'], [{ ...valid, policyDigest: 'bad' }, 'digest-mismatch']]) {
    const model = receiptModel(consentReceipt({ registrationConsent: input }));
    assert.equal(model.status, status);
    const html = receiptView(model);
    assert(html.includes(`data-status="${status}"`));
    if (['not-recorded', 'unrecognized', 'archive-unavailable'].includes(status)) assert.doesNotMatch(html, /data-privacy-archive/);
    else assert.match(html, /data-privacy-archive/);
  }
  assert.throws(() => receiptModel({ status: 'ok', receipt: null }));
  assert.throws(() => receiptModel({ ...payload(), receipt: { ...payload().receipt, privacy: false } }));
});

test('Archive uses recorded language and original policy text, with escaped markup', () => {
  const snapshot = policySnapshot(version);
  const model = receiptModel(payload());
  assert.match(archiveView(snapshot, model.receipt), /lang="vi"/);
  assert.match(archiveView(snapshot, { ...model.receipt, locale: 'en' }), /lang="en"/);
  snapshot.translations.vi['policies.privacy.sections.1.text'] = '<img src=x onerror=alert(1)>';
  const html = archiveView(snapshot, model.receipt);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img/);
  assert.throws(() => archiveView({ ...snapshot, version: 'wrong' }, model.receipt));
});

test('Receipt and archive use session endpoints and no-store, with retry on network error', async () => {
  const f = fixture(), calls = [];
  const api = { async get(path, options) {
    calls.push({ path, options });
    if (calls.length === 1 || calls.length === 3) throw new Error('network');
    return path === '/auth/consent' ? payload() : policySnapshot(version);
  } };
  const controller = mountPrivacyCenter(f.root, { api });
  await controller.ready;
  assert.match(f.host.innerHTML, /data-privacy-retry/);
  f.host.click('[data-privacy-retry]'); await turn();
  assert.match(f.host.innerHTML, /digest-matched/);
  f.host.click('[data-privacy-archive]'); await turn();
  assert.match(f.target.innerHTML, /role="alert"/);
  f.host.click('[data-privacy-archive]'); await turn();
  assert.match(f.target.innerHTML, /privacy-archive-policy/);
  assert.deepEqual(calls.map(c => c.path), ['/auth/consent', '/auth/consent', `/auth/policies/${version}`, `/auth/policies/${version}`]);
  assert(calls.every(c => c.options.cache === 'no-store'));
  controller.dispose();
  assert(calls.every(c => c.options.signal.aborted));
  assert.equal(f.host.innerHTML, '');
});

test('Late response after disposal or account switch cannot render previous account evidence', async () => {
  for (const dispose of [true, false]) {
    const f = fixture(); let resolve, current = true;
    const controller = mountPrivacyCenter(f.root, { api: { get: () => new Promise(r => { resolve = r; }) }, isCurrent: () => current });
    if (dispose) controller.dispose(); else current = false;
    resolve(payload()); await controller.ready;
    assert.doesNotMatch(f.host.innerHTML, /digest-matched/);
    controller.dispose();
  }
});

test('Session failure does not misrepresent missing consent and provides a login link', async () => {
  const f = fixture();
  const controller = mountPrivacyCenter(f.root, { api: { async get() { throw Object.assign(new Error('expired'), { status: 401 }); } } });
  await controller.ready;
  assert.match(f.host.innerHTML, /href="\/login"/);
  assert.doesNotMatch(f.host.innerHTML, /not-recorded/);
  assert.match(privacyFailure(403), /href="\/login"/);
  controller.dispose();
});

test('Privacy return path stays local and account menu is signed-in only', () => {
  const previous = globalThis.location;
  globalThis.location = new URL('https://momevia.example/privacy-center');
  try {
    assert.equal(authDestination('/privacy-center'), '/privacy-center');
    for (const path of ['/privacy-center?userId=x', '//evil.example/privacy-center', '/privacy-center#foo']) assert.equal(authDestination(path), null);
    for (const user of [null, { name: 'Test', role: 'sender' }, { name: 'Test', role: 'creator' }, { name: 'Test', role: 'admin' }]) {
      const header = {}, footer = {};
      createLayout({ state: { user }, header, footer }).refreshNav();
      assert.equal((header.innerHTML.match(/href="\/privacy-center"/g) || []).length, user ? 2 : 0);
    }
    const source = readFileSync('web/js/app/main.js', 'utf8');
    assert.match(source, /if \(!requireLogin\('\/privacy-center'\)\) return;/);
  } finally { globalThis.location = previous; }
});
