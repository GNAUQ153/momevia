import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { JsonRepository } from '../../src/shared/storage.mjs';
import { MySqlUsersRepository } from '../../src/modules/identity/mysql.repositories.mjs';
import { registerRoutes } from '../../src/modules/identity/routes.mjs';
import { consentHistory, confirmationEvidence, confirmPolicy } from '../../src/modules/identity/consent-history.mjs';
import { registrationEvidence } from '../../src/modules/identity/consent.mjs';
import { registrationConsent, registrationPolicyVersion as version } from '../../web/js/shared/registration-consent.js';
import { policyDigest } from '../../src/modules/identity/policy-archive.mjs';
import { historyView, mountConsentHistory } from '../../web/js/features/privacy/consent-history.js';
import { privacyPage } from '../../web/js/pages/privacy.js';

const input = (locale = 'vi') => ({ ...registrationConsent(true, true), locale, digest: policyDigest(version, locale) });
const original = () => registrationEvidence(registrationConsent(true, true), 'vi');
function setup(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'consent-history-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'users.json');
  const users = new JsonRepository(file);
  users.insert({ id: 'alice', email: 'alice@example.test', passwordHash: 'secret' });
  users.insert({ id: 'bob', registrationConsent: original() });
  return { users, file };
}

test('Legacy user has no fabricated receipt, current snapshot carries exact language and digest', () => {
  const model = consentHistory({ id: 'old' }, 'en');
  assert.equal(model.confirmed, false);
  assert.deepEqual(model.history, []);
  assert.equal(model.current.locale, 'en');
  assert.equal(model.current.digest, policyDigest(version, 'en'));
  assert.equal(model.current.status, 'draft');
  assert.match(historyView(model), /data-policy-confirm/);
  assert.match(historyView(model), /lang="en"/);
  assert.match(privacyPage(), /data-consent-history/);
});

test('Confirmation rejects missing checkbox, fake digest, wrong locale and stale version', () => {
  for (const bad of [{ ...input(), terms: false }, { ...input(), privacy: 'true' }, {}]) assert.throws(() => confirmationEvidence(bad), { status: 400 });
  for (const bad of [{ ...input(), version: 'old' }, { ...input(), digest: 'fake' }, { ...input(), locale: 'en' }, { ...input(), locale: 'ja' }]) assert.throws(() => confirmationEvidence(bad), { status: 409 });
  const evidence = confirmationEvidence({ ...input(), acceptedAt: '2000-01-01', source: 'fake', purpose: 'fake' });
  assert.equal(evidence.source, 'policy-confirmation');
  assert.equal(evidence.purpose, 'policy-confirmation');
  assert.notEqual(evidence.acceptedAt, '2000-01-01');
});

test('Repeat and concurrent requests preserve registration evidence, including after reopening JSON', async t => {
  const { users, file } = setup(t);
  const legacy = { ...original(), policyDigest: undefined };
  users.update('alice', { registrationConsent: legacy });
  await Promise.all([confirmPolicy(users, 'alice', input()), confirmPolicy(users, 'alice', input('en'))]);
  const reopened = new JsonRepository(file);
  const account = reopened.get('alice');
  assert.equal(account.policyConfirmations.length, 1);
  assert.deepEqual(account.registrationConsent, JSON.parse(JSON.stringify(legacy)));
  assert.equal(consentHistory(account, 'vi').history.length, 2);
  assert.equal(consentHistory(account, 'vi').confirmed, true);
  assert.equal(consentHistory(account, 'vi').history.filter(h => h.status === 'version-only').length, 1);
  await confirmPolicy(reopened, 'bob', input());
  assert.equal(reopened.get('bob').policyConfirmations, undefined);
});

test('Old-version evidence is retained; damaged history is not overwritten', async t => {
  const { users } = setup(t);
  users.update('alice', { registrationConsent: { ...original(), version: '2025-01-01.1' } });
  const state = consentHistory(users.get('alice'), 'vi');
  assert.equal(state.confirmed, false);
  assert.equal(state.history[0].status, 'archive-unavailable');
  await confirmPolicy(users, 'alice', input());
  assert.equal(consentHistory(users.get('alice'), 'vi').history.length, 2);
  users.update('alice', { policyConfirmations: [null] });
  await assert.rejects(confirmPolicy(users, 'alice', input()), { status: 409 });
  assert.deepEqual(users.get('alice').policyConfirmations, [null]);
  assert.doesNotMatch(historyView(consentHistory(users.get('alice'), 'vi')), /data-policy-confirm/);
});

test('MySQL mutation uses row lock and retains all other account data in legacy_payload', async () => {
  const row = { id: 'alice', provider: 'email', provider_id: 'a', name: 'Alice', email: 'a@test.invalid', password_hash: 'hash', role: 'sender', created_at: '2026-11-28 00:00:00.000', legacy_payload: JSON.stringify({ marker: 'retain' }) };
  const calls = [];
  const client = { withTransaction: fn => fn({ execute: async (sql, args) => {
    calls.push({ sql, args });
    if (sql.startsWith('SELECT')) return [[row]];
    row.legacy_payload = args[7];
    return [{ affectedRows: 1 }];
  } }) };
  const repo = new MySqlUsersRepository(client);
  await confirmPolicy(repo, 'alice', input());
  await confirmPolicy(repo, 'alice', input());
  assert.match(calls[0].sql, /FOR UPDATE/);
  assert.deepEqual(calls[0].args, ['alice']);
  assert.equal(calls.filter(c => c.sql.startsWith('UPDATE')).length, 1);
  assert.equal(JSON.parse(row.legacy_payload).marker, 'retain');
  assert.equal(JSON.parse(row.legacy_payload).policyConfirmations.length, 1);
});

test('History routes require session, ignore forged IDs, rate limit writes and expose no account secrets', async t => {
  const { users } = setup(t);
  const handlers = new Map(), limits = [];
  registerRoutes({ on(method, route, fn) { handlers.set(`${method} ${route}`, fn); } }, {
    config: {}, service: { users, findCurrent: req => users.get(req.actor) }, authLimits: { consume: kind => limits.push(kind) },
  });
  async function call(method, route, actor, data) {
    const req = Readable.from(data ? [Buffer.from(JSON.stringify(data))] : []);
    Object.assign(req, { actor, headers: { 'content-type': 'application/json', 'x-momevia-locale': 'en' } });
    let response;
    await handlers.get(`${method} ${route}`)({ req, params: { userId: 'bob' }, res: { writeHead(status, headers) { response = { status, headers }; }, end(body) { response.body = JSON.parse(body); } } });
    return response;
  }
  await assert.rejects(call('GET', '/consent/history'), { status: 401 });
  await assert.rejects(call('POST', '/consent/confirm', null, input()), { status: 401 });
  const result = await call('POST', '/consent/confirm', 'alice', { ...input(), userId: 'bob' });
  assert.equal(result.body.confirmed, true);
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.deepEqual(limits, ['register']);
  assert.equal(users.get('bob').policyConfirmations, undefined);
  const history = await call('GET', '/consent/history', 'alice');
  assert.equal(history.body.current.locale, 'en');
  assert.doesNotMatch(JSON.stringify(history.body.history), /alice|example\.test|passwordHash|secret/);
});

test('History view escapes version and policy text, hides form when already confirmed', () => {
  const model = consentHistory({ registrationConsent: original() }, 'vi');
  assert.doesNotMatch(historyView(model), /data-policy-confirm/);
  const old = consentHistory({ registrationConsent: { ...original(), version: '<img src=x>' } }, 'vi');
  assert.doesNotMatch(historyView(old), /<img src=x>/);
  old.current.snapshot.translations.vi['auth.register.acceptTerms'] = '<script>alert(1)</script>';
  assert.doesNotMatch(historyView(old), /<script>/);
});

test('Controller does not send unchecked confirmation or render response after dispose', async () => {
  const events = new Map(), calls = [];
  const host = { innerHTML: '', addEventListener: (name, fn) => events.set(name, fn), setAttribute() {}, removeAttribute() {}, replaceChildren() { this.innerHTML = ''; } };
  let complete;
  const model = consentHistory({}, 'vi');
  const c = mountConsentHistory(host, { api: { get: async () => model, post: async (...args) => { calls.push(args); return new Promise(resolve => { complete = resolve; }); } } });
  await c.ready;
  const button = {}, status = {};
  const form = { elements: { terms: { checked: true }, privacy: { checked: false } }, querySelector: selector => selector.startsWith('button') ? button : status };
  const submit = () => events.get('submit')({ target: { closest: () => form }, preventDefault() {} });
  submit(); assert.equal(calls.length, 0);
  form.elements.privacy.checked = true;
  submit(); submit();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][1], input());
  c.dispose(); complete(model);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(host.innerHTML, '');
});
