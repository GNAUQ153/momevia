import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { JsonRepository } from '../../src/shared/storage.mjs';
import { SupportService } from '../../src/modules/support/support.service.mjs';
import { MySqlSupportRepository } from '../../src/modules/support/mysql.repository.mjs';
import { registerRoutes } from '../../src/modules/support/routes.mjs';
import { privacyRequestsView, mountPrivacyRequests } from '../../web/js/features/privacy/privacy-requests.js';
import { privacyPage } from '../../web/js/pages/privacy.js';
import { storedTopicText, topicForRequest } from '../../web/js/features/support/topics.js';
import { withdrawalTopic } from '../../web/js/shared/privacy-requests.js';

const alice = { sub: 'alice', role: 'sender' }, bob = { sub: 'bob', role: 'sender' };
const admin = { sub: 'admin', role: 'admin' };
const input = { name: 'Test', email: 'test@example.test', topic: withdrawalTopic, message: 'Please review withdrawal of consent.', userId: 'bob', status: 'resolved' };
const setup = t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'privacy-requests-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const file = path.join(folder, 'requests.json');
  const repo = new JsonRepository(file);
  return { repo, file, service: new SupportService({ repository: repo, attempts: { consume: () => true } }) };
};

test('Withdrawal intake requires a real session, rejects reports and ignores client identity/status', async t => {
  const { repo, service } = setup(t);
  await assert.rejects(service.create(input, null, 'ip'), { status: 401 });
  await assert.rejects(service.create({ ...input, reportKind: 'gift' }, alice, 'ip'), { status: 400 });
  assert.equal(repo.all().length, 0);
  const ticket = await service.create(input, alice, 'ip');
  assert.match(ticket.code, /^HT-\d{4}-[A-F0-9]{8}$/);
  assert.equal(ticket.status, 'new');
  assert.equal(repo.all()[0].userId, 'alice');
  assert.equal(repo.all()[0].status, 'new');
  await service.create({ ...input, topic: 'Other' }, null, 'ip'); // preserve ordinary support
});

test('Privacy history returns only session-owned withdrawal requests and safe fields, even after JSON reopen', async t => {
  const { service, file } = setup(t);
  const first = await service.create(input, alice, 'ip');
  await service.create(input, bob, 'ip');
  await service.create({ ...input, topic: 'Other' }, alice, 'ip');
  const reopened = new SupportService({ repository: new JsonRepository(file) });
  const history = await reopened.privacyRequests(alice);
  assert.equal(history.length, 1);
  assert.equal(history[0].code, first.code);
  assert.deepEqual(Object.keys(history[0]).sort(), ['code', 'createdAt', 'status']);
  assert.equal((await reopened.privacyRequests(admin)).length, 0);
  await assert.rejects(reopened.privacyRequests(null), { status: 401 });
});

test('Existing admin ticket workflow updates history without asserting that consent was withdrawn', async t => {
  const { repo, service } = setup(t);
  await service.create(input, alice, 'ip');
  const id = repo.all()[0].id;
  await assert.rejects(service.updateRequest(bob, id, { action: 'claim' }), { status: 403 });
  await service.updateRequest(admin, id, { action: 'claim' });
  assert.equal((await service.privacyRequests(alice))[0].status, 'in_progress');
  await service.updateRequest(admin, id, { action: 'resolve', resolution: 'Contacted the account owner.' });
  assert.equal((await service.privacyRequests(alice))[0].status, 'resolved');
  assert.match(privacyRequestsView({ requests: await service.privacyRequests(alice) }), /Ticket đã được xử lý/);
});

test('History is bounded to newest 50, including on JSON', async t => {
  const { repo, service } = setup(t);
  for (let i = 0; i < 55; i++) repo.insert({ id: String(i), userId: 'alice', topic: withdrawalTopic, code: `code-${i}`, status: 'new', createdAt: new Date(i * 1000).toISOString() });
  const history = await service.privacyRequests(alice);
  assert.equal(history.length, 50);
  assert.equal(history[0].code, 'code-54');
  assert.equal(history.at(-1).code, 'code-5');
});

test('MySQL query scopes both FK and legacy IDs, selects minimal fields, and parameterizes limit/topic', async () => {
  let query, params;
  const repo = new MySqlSupportRepository({ execute: async (sql, values) => { query = sql; params = values; return [[{ code: 'HT-2026-ABCD1234', status: 'new', createdAt: '2026-11-28 01:00:00.000', userId: 'alice', topic: withdrawalTopic }]]; } });
  const result = await new SupportService({ repository: repo }).privacyRequests(alice);
  assert.match(query, /WHERE \(user_id = \? OR \(user_id IS NULL AND legacy_user_id = \?\)\) AND topic = \?/);
  assert.doesNotMatch(query, /SELECT \*/);
  assert.deepEqual(params, ['alice', 'alice', withdrawalTopic, 50]);
  assert.equal(result[0].createdAt, '2026-11-28T01:00:00.000Z');
});

test('HTTP routes require session for reading and withdrawal submission, ignore caller IDs, no-store', async t => {
  const { service } = setup(t), handlers = new Map();
  registerRoutes({ on(method, route, handler) { handlers.set(`${method} ${route}`, handler); } }, { config: {}, globalAttempts: { consume: () => true }, service, resolveUser: async req => req.user });
  const call = async (method, route, user, data) => {
    const req = Readable.from(data ? [Buffer.from(JSON.stringify(data))] : []);
    Object.assign(req, { user, headers: { 'content-type': 'application/json' }, socket: { remoteAddress: '127.0.0.1' } });
    let response;
    await handlers.get(`${method} ${route}`)({ req, params: { userId: 'bob' }, res: { writeHead(status, headers) { response = { status, headers }; }, end(body) { response.body = JSON.parse(body); } } });
    return response;
  };
  await assert.rejects(call('POST', '/requests', null, input), { status: 401 });
  await assert.rejects(call('GET', '/privacy-requests', null), { status: 401 });
  assert.equal((await call('POST', '/requests', alice, input)).status, 201);
  const response = await call('GET', '/privacy-requests', alice);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.body.requests.length, 1);
  assert.deepEqual((await call('GET', '/privacy-requests', bob)).body.requests, []);
});

test('UI distinguishes request states, validates data and uses a stable topic in admin and submit', () => {
  assert.match(privacyPage(), /data-privacy-withdrawal="true"/);
  assert.match(privacyRequestsView({ requests: [] }), /Chưa có yêu cầu/);
  assert.equal(topicForRequest(withdrawalTopic), withdrawalTopic);
  assert.match(storedTopicText(withdrawalTopic), /Yêu cầu thu hồi/);
  for (const status of ['new', 'in_progress', 'resolved']) assert.match(privacyRequestsView({ requests: [{ code: 'HT-2026-ABCD1234', status, createdAt: '2026-11-28T01:00:00Z' }] }), /HT-2026-ABCD1234/);
  assert.throws(() => privacyRequestsView({ requests: [{ code: '<script>', status: 'new', createdAt: '2026-11-28T01:00:00Z' }] }));
});

test('History controller suppresses stale/out-of-order results, supports retry and disposal', async () => {
  const host = { innerHTML: '', setAttribute() {}, removeAttribute() {}, addEventListener() {}, replaceChildren() { this.innerHTML = ''; } };
  const calls = [], pending = [];
  let current = true;
  const controller = mountPrivacyRequests(host, { isCurrent: () => current, api: { get(url, options) { calls.push({ url, options }); return new Promise((resolve, reject) => pending.push({ resolve, reject })); } } });
  const refresh = controller.load();
  pending[1].resolve({ requests: [] }); await refresh;
  pending[0].reject(new Error('old')); await controller.ready;
  assert.match(host.innerHTML, /Chưa có yêu cầu/);
  const retry = controller.load(); pending[2].reject(new Error('network')); await retry;
  assert.match(host.innerHTML, /data-privacy-requests-refresh/);
  const switched = controller.load(); current = false; pending[3].resolve({ requests: [{ code: 'HT-2026-ABCD1234', status: 'new', createdAt: '2026-11-28T01:00:00Z' }] }); await switched;
  assert.doesNotMatch(host.innerHTML, /HT-2026-ABCD1234/);
  controller.dispose(); assert.equal(host.innerHTML, '');
  assert(calls.every(c => c.url === '/support/privacy-requests' && c.options.cache === 'no-store' && c.options.signal.aborted));
});
