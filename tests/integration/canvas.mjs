import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import sharp from 'sharp';
import { runReplyIntents } from './reply-intents.mjs';
import { runRsvpApi } from './rsvp.mjs';
import { runExpandedApi } from './canvas-expanded.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { runRecovery } = await import('./recovery-journey.mjs');
const fixture = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'momevia-canvas-'));
let child, base, logs = ''; const cases = [];
async function launch(extra = {}) {
  const env = { ...process.env, NODE_ENV: 'test', PORT: '0', PUBLIC_BASE_URL: 'http://127.0.0.1',
    JWT_SECRET: randomBytes(32).toString('hex'), INTERNAL_SERVICE_KEY: randomBytes(32).toString('hex'), DEMO_AUTH_ENABLED: 'true', DEMO_TEMPLATE_CHECKOUT_ENABLED: 'true', DEMO_ADMIN_CODE: 'synthetic-admin',
    IDENTITY_STORAGE: 'json', CATALOG_STORAGE: 'json', CHECKOUT_STORAGE: 'json', GIFTS_STORAGE: 'json', SUPPORT_STORAGE: 'json', DESIGNS_STORAGE: 'json',
    PAYMENT_ENABLED: 'false', PAYMENT_LIVE_ENABLED: 'false', CANVAS_READ_ENABLED: 'true', CANVAS_EDIT_ENABLED: 'true', CANVAS_PUBLISH_ENABLED: 'true',
    TEST_ACCOUNT_ENABLED: 'false', GIFT_RENEWAL_DAYS: '0', ...extra };
  env.ALLOWED_ORIGINS = 'https://canvas-qa.example.test';
  // Session keys stay fixed across restart so the replay caller is the same owner.
  if (launch.secrets) Object.assign(env, launch.secrets); else launch.secrets = { JWT_SECRET: env.JWT_SECRET, INTERNAL_SERVICE_KEY: env.INTERNAL_SERVICE_KEY };
  child = spawn(process.execPath, ['fixture.mjs'], { cwd: fixture, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', bytes => { logs += bytes; const match = logs.match(/CANVAS_BASE=(http:\/\/127\.0\.0\.1:\d+)/g)?.at(-1); if (match) base = match.slice('CANVAS_BASE='.length); });
  child.stderr.on('data', bytes => { logs += bytes; });
  for (let i = 0; i < 100; i++) { if (child.exitCode !== null) throw new Error(logs); if (base) return; await delay(50); }
  throw new Error(`Fixture startup timeout: ${logs}`);
}
async function stop() { if (child && child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; } child = null; base = null; logs = ''; }
async function request(url, { cookie, body, method, headers = {}, bytes } = {}) {
  const response = await fetch(base + '/api' + url, { method: method || (body || bytes ? 'POST' : 'GET'), headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : bytes });
  const data = await response.json().catch(() => null); return { status: response.status, data, headers: response.headers };
}
async function register(name) {
  const result = await request('/auth/register', { body: { name, email: `${randomUUID()}@example.test`, password: 'SyntheticOnly123', confirmPassword: 'SyntheticOnly123' } });
  assert.equal(result.status, 201, JSON.stringify(result.data)); return { user: result.data.user, cookie: result.headers.get('set-cookie').split(';')[0] };
}
async function post(owner, url, body, status = 200) { const r = await request(url, { cookie: owner.cookie, body }); assert.equal(r.status, status, JSON.stringify(r.data)); return r.data; }
const check = (name, fn) => Promise.resolve().then(fn).then(() => { cases.push(name); console.log(`PASS ${name}`); });
try {
  for (const dir of ['src', 'services', 'web']) fs.cpSync(path.join(root, dir), path.join(fixture, dir), { recursive: true, filter: p => path.basename(p) !== 'data' });
  fs.copyFileSync(path.join(root, 'package.json'), path.join(fixture, 'package.json'));
  const modules = path.join(root, 'node_modules');
  const fixtureModules = path.join(fixture, 'node_modules');
  // A Windows fixture must own its dependencies when its temp tree is removed.
  if (process.platform === 'win32') fs.cpSync(fs.realpathSync(modules), fixtureModules, {recursive:true});
  else fs.symlinkSync(modules, fixtureModules, 'dir');
  fs.copyFileSync(path.join(root, 'tests/integration/recovery-journey.mjs'), path.join(fixture, 'recovery-journey.mjs'));
  fs.writeFileSync(path.join(fixture, 'fixture.mjs'), `
    import fs from 'node:fs';
    import { createHttpApp } from './src/server/app.mjs';
    import { environment } from './src/shared/config.mjs';
    import { simulatedGoogle } from './recovery-journey.mjs';
    const nativeFetch = globalThis.fetch;
    globalThis.fetch = (input, options) => simulatedGoogle(input, options) || nativeFetch(input, options);
    const config = { ...environment(), googleId: 'synthetic', googleSecret: 'synthetic' };
    const app = await createHttpApp(config, {
      sendRecoveryMail: async mail => fs.appendFileSync('mailbox.ndjson', JSON.stringify(mail) + '\\n'),
      recoveryNow: () => fs.existsSync('recovery-now.txt') ? Number(fs.readFileSync('recovery-now.txt','utf8')) : Date.now(),
    });
    app.server.listen(0,'127.0.0.1',() => { const url = new URL(config.baseUrl); url.port = app.server.address().port; config.baseUrl = url.origin; console.log('CANVAS_BASE=' + config.baseUrl); });
  `);
  await launch();
  const owner = await register('Người gửi thử nghiệm'), other = await register('Người gửi khác');
  await check('Empty canvas saves but cannot publish, even with all bindings filled', async () => {
    const { createElement } = await import('../../web/js/shared/canvas/index.js');
    const { design: draft } = await post(owner, '/designs/designs', { source: { kind: 'blank' }, mutationId: randomUUID() }, 201);
    for (const [key, value] of Object.entries({ recipientName: 'Mai', senderName: 'An', message: 'Chúc mừng!' })) {
      draft.document.bindings[key].value = value;
    }
    let revision = draft.revision;
    for (const element of [
      null,
      createElement('text', { visible: false, props: { textBinding: 'message' } }),
      createElement('text', { opacity: 0, props: { textBinding: 'message' } }),
      createElement('text', { props: { text: '  ' } }),
    ]) {
      draft.document.elements = element ? [element] : [];
      draft.document.scenes[0].elementIds = element ? [element.id] : [];
      const savedDraft = await post(owner, `/designs/designs/${draft.id}/save`, { expectedRevision: revision, mutationId: randomUUID(), title: draft.title, document: draft.document });
      revision = savedDraft.savedRevision;
      const preflight = await post(owner, `/designs/designs/${draft.id}/preflight`, { expectedRevision: revision });
      assert.equal(preflight.canPublish, false);
      assert.deepEqual(preflight.blockers.map(({ code }) => code), ['EMPTY_DESIGN']);
      const rejected = await post(owner, '/gifts/gifts/from-design', { designId: draft.id, expectedRevision: revision, expectedDocumentHash: preflight.documentHash, idempotencyKey: randomUUID() }, 422);
      assert.deepEqual(rejected.details, preflight.blockers);
    }
    assert.deepEqual((await request('/gifts/gifts/mine', { cookie: owner.cookie })).data.gifts, []);
  });
  await check('RSVP JSON HTTP: private receipt, replay, update, owner ACL and revoke', () => runRsvpApi(request, owner.cookie, other.cookie));
  await check('Image only in a later scene can publish', async () => {
    const { createElement } = await import('../../web/js/shared/canvas/index.js');
    const { design: draft } = await post(owner, '/designs/designs', { source: { kind: 'blank' }, mutationId: randomUUID() }, 201);
    for (const binding of Object.values(draft.document.bindings)) binding.value = 'Ảnh kỷ niệm';
    const bytes = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#b98adc' } }).png().toBuffer();
    const upload = await request(`/designs/designs/${draft.id}/assets`, { cookie: owner.cookie, bytes, headers: { 'content-type': 'image/png', 'x-mutation-id': randomUUID() } });
    assert.equal(upload.status, 201);
    const assetId = upload.data.asset.id;
    const image = createElement('image', { props: { assetId } });
    draft.document.elements.push(image);
    draft.document.assets.push({ assetId, kind: 'image' });
    draft.document.scenes.push({ ...draft.document.scenes[0], id: 'scene-photo', name: 'Ảnh', elementIds: [image.id] });
    const savedDraft = await post(owner, `/designs/designs/${draft.id}/save`, { expectedRevision: draft.revision, mutationId: randomUUID(), title: draft.title, document: draft.document });
    const preflight = await post(owner, `/designs/designs/${draft.id}/preflight`, { expectedRevision: savedDraft.savedRevision });
    assert.equal(preflight.canPublish, true, JSON.stringify(preflight.blockers));
    const { gift } = await post(owner, '/gifts/gifts/from-design', { designId: draft.id, expectedRevision: preflight.revision, expectedDocumentHash: preflight.documentHash, idempotencyKey: randomUUID() }, 201);
    const publicGift = (await request(`/gifts/gifts/${gift.slug}`)).data.gift;
    assert.deepEqual(publicGift.documentSnapshot.scenes.map(scene => scene.elementIds), [[], [image.id]]);
    assert.equal((await fetch(`${base}/api/gifts/gifts/${gift.slug}/assets/${assetId}`)).status, 200);
  });
  let design, saved, publishBody, published, asset;
  await check('C01/C06 create idempotency and persisted Unicode blank', async () => {
    const input = { source: { kind: 'blank' }, presetId: 'envelope-basic', mutationId: randomUUID() };
    design = (await post(owner, '/designs/designs', input, 201)).design;
    const replay = await post(owner, '/designs/designs', input, 201); assert.equal(replay.design.id, design.id); assert.equal(replay.replayed, true);
    await post(owner, '/designs/designs', { ...input, presetId: 'blank' }, 409);
    design.document.bindings.recipientName.value = 'Trần Ánh Mai'; design.document.bindings.senderName.value = 'Đặng An'; design.document.bindings.message.value = 'Chúc mừng sinh nhật! <script> không phải HTML';
    const inputSave = { expectedRevision: design.revision, mutationId: randomUUID(), title: 'Quà tiếng Việt', document: design.document };
    saved = await post(owner, `/designs/designs/${design.id}/save`, inputSave);
    assert.equal(saved.savedRevision, 2); assert.equal((await post(owner, `/designs/designs/${design.id}/save`, inputSave)).replayed, true);
    const loaded = await request(`/designs/designs/${design.id}`, { cookie: owner.cookie }); assert.deepEqual(loaded.data.design.document, design.document);
  });
  await check('C05/C08 CAS conflict and owner/provenance boundary', async () => {
    await post(owner, `/designs/designs/${design.id}/save`, { expectedRevision: 1, mutationId: randomUUID(), title: 'stale', document: design.document }, 409);
    assert.equal((await request(`/designs/designs/${design.id}`, { cookie: other.cookie })).status, 404);
    await post(other, `/designs/designs/${design.id}/save`, { expectedRevision: 2, mutationId: randomUUID(), title: 'steal', document: design.document }, 404);
    await post(owner, `/designs/designs/${design.id}/save`, { expectedRevision: 2, mutationId: randomUUID(), title: 'bypass', document: design.document, source: { kind: 'blank' } }, 422);
    assert.equal((await request(`/designs/designs/${design.id}`)).status, 401);
  });
  await check('C09 private binary image validation/replay and ready refs', async () => {
    const bytes = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#b98adc' } }).png().toBuffer();
    const mutation = randomUUID();
    const upload = () => request(`/designs/designs/${design.id}/assets`, { cookie: owner.cookie, bytes, headers: { 'content-type': 'image/png', 'x-mutation-id': mutation } });
    const result = await upload(); assert.equal(result.status, 201, JSON.stringify(result.data)); asset = result.data.asset; assert.equal(asset.status, 'ready'); assert.equal((await upload()).data.asset.id, asset.id);
    assert.equal((await request(`/designs/designs/${design.id}/assets/${asset.id}`, { cookie: other.cookie })).status, 404);
    assert.equal((await request(`/designs/designs/${design.id}/assets/${asset.id}`)).status, 401);
    const bad = await request(`/designs/designs/${design.id}/assets`, { cookie: owner.cookie, bytes: Buffer.from('not a png image'), headers: { 'content-type': 'image/png', 'x-mutation-id': randomUUID() } }); assert.equal(bad.status, 413);
    const { createElement } = await import('../../web/js/shared/canvas/index.js');
    const image = createElement('image', { id: 'photo-test', props: { assetId: asset.id }, accessibility: { alt: 'Ảnh thử nghiệm' } });
    design.document.assets.push({ assetId: asset.id, kind: 'image' }); design.document.elements.push(image); design.document.scenes[1].elementIds.push(image.id);
    saved = await post(owner, `/designs/designs/${design.id}/save`, { expectedRevision: saved.savedRevision, mutationId: randomUUID(), title: 'Quà tiếng Việt', document: design.document });
  });
  await check('C11/C17/C19 immutable publication/idempotency/allowlist', async () => {
    const preflight = await post(owner, `/designs/designs/${design.id}/preflight`, { expectedRevision: saved.savedRevision }); assert.equal(preflight.authorization.status, 'allowed'); assert.equal(preflight.canPublish, true, JSON.stringify(preflight));
    publishBody = { designId: design.id, expectedRevision: saved.savedRevision, expectedDocumentHash: preflight.documentHash, idempotencyKey: randomUUID(), access: { open: 'link', send: 'link', read: 'link' } };
    const result = await Promise.all([request('/gifts/gifts/from-design', { cookie: owner.cookie, body: publishBody }), request('/gifts/gifts/from-design', { cookie: owner.cookie, body: publishBody })]);
    assert.deepEqual(result.map(r => r.status).sort(), [200, 201]); assert.equal(result[0].data.gift.slug, result[1].data.gift.slug); published = result[0].data.gift;
    await post(owner, '/gifts/gifts/from-design', { ...publishBody, expectedDocumentHash: 'sha256:' + '0'.repeat(64) }, 409);
    const view = (await request(`/gifts/gifts/${published.slug}`)).data.gift; assert.equal(view.documentSnapshot.bindings.recipientName.value, 'Trần Ánh Mai');
    for (const privateKey of ['ownerId', 'userId', 'source', 'policy', 'provenance', 'designId', 'assetIds', 'storageKey', 'idempotencyKey']) assert.equal(Object.hasOwn(view, privateKey), false);
    const media = await fetch(`${base}/api/gifts/gifts/${published.slug}/assets/${asset.id}`); assert.equal(media.status, 200); assert.equal(media.headers.get('content-type'), 'image/png');
    design.document.bindings.recipientName.value = 'Bản nháp mới';
    saved = await post(owner, `/designs/designs/${design.id}/save`, { expectedRevision: saved.savedRevision, mutationId: randomUUID(), title: 'Đã đổi', document: design.document });
    assert.equal((await request(`/gifts/gifts/${published.slug}`)).data.gift.recipientName, 'Trần Ánh Mai');
    const list = (await request('/gifts/gifts/mine', { cookie: owner.cookie })).data.gifts; assert.equal(Object.hasOwn(list[0], 'documentSnapshot'), false);
    await post(owner, `/designs/designs/${design.id}/archive`, {});
    assert.equal((await request(`/gifts/gifts/${published.slug}`)).status, 200);
    assert.equal((await request(`/gifts/gifts/${published.slug}/assets/${asset.id}`)).status, 200);
  });
  await check('Canvas and legacy gift projections use the configured share URL and retain origin checks', async () => {
    const alias = base.replace('127.0.0.1', 'localhost');
    const template = (await request('/catalog/templates')).data.templates.find(item => item.price === 0);
    const body = { templateId: template.id, recipientName: 'Mai legacy', senderName: 'An', message: 'Quà cũ vẫn mở được.' };
    const before = (await request('/gifts/gifts/mine', { cookie: owner.cookie })).data.gifts.length;
    const port = new URL(base).port;
    for (const origin of ['https://evil.example', `http://localhost:${port === '4100' ? '4101' : '4100'}`,
      `https://localhost:${port}`, `http://localhost.evil.example:${port}`, 'https://other-qa.example.test', 'null']) {
      const blocked = await request('/gifts/gifts', { cookie: owner.cookie, body, headers: { origin,
        'x-forwarded-host': new URL(base).host, 'x-forwarded-proto': 'http', forwarded: `host=${new URL(base).host};proto=http` } });
      assert.equal(blocked.status, 403, origin);
      assert.match(blocked.headers.get('content-type'), /application\/json/);
      assert.equal(blocked.headers.get('set-cookie'), null);
    }
    assert.equal((await request('/gifts/gifts/mine', { cookie: owner.cookie })).data.gifts.length, before, 'rejected writes create no gifts');
    for (const origin of [alias, 'https://canvas-qa.example.test']) {
      const allowed = await request('/gifts/gifts', { cookie: owner.cookie, body, headers: { origin } });
      assert.equal(allowed.status, 201, origin);
      assert.equal(allowed.data.gift.url, `${base}/g/${allowed.data.gift.slug}`);
    }
    const created = await request('/gifts/gifts', { cookie: owner.cookie, body, headers: { origin: base } });
    assert.equal(created.status, 201);
    const { gifts } = (await request('/gifts/gifts/mine', { cookie: owner.cookie })).data;
    for (const gift of [published, created.data.gift]) {
      assert.equal(gift.url, `${base}/g/${gift.slug}`);
      assert.equal(gifts.find(item => item.slug === gift.slug).url, gift.url);
      const loaded = await fetch(`${alias}/api/gifts/gifts/${gift.slug}`);
      assert.equal((await loaded.json()).gift.url, gift.url);
    }
    // Exercise the real production configuration with the same persisted owner
    // and session keys. Loopback aliases stay equivalent in production too.
    await stop(); await launch({ NODE_ENV: 'production' });
    const productionAlias = base.replace('127.0.0.1', 'localhost');
    assert.equal((await request('/gifts/gifts', { cookie: owner.cookie, body, headers: { origin: productionAlias } })).status, 201);
    assert.equal((await request('/gifts/gifts', { cookie: owner.cookie, body, headers: { origin: 'https://evil.example' } })).status, 403);
    assert.equal((await request('/gifts/gifts', { cookie: owner.cookie, body, headers: { origin: productionAlias.replace('http:', 'https:') } })).status, 403);
    assert.equal((await request('/gifts/gifts', { cookie: owner.cookie, body, headers: { origin: base } })).status, 201);
    assert.equal((await request('/gifts/gifts', { cookie: owner.cookie, body, headers: { origin: 'https://canvas-qa.example.test' } })).status, 201);
    await stop(); await launch();
  });
  await check('C21 anonymous reply contract and count', async () => {
    const replies = await Promise.all([request(`/gifts/gifts/${published.slug}/replies`, { body: { name: 'Mai', message: 'Cảm ơn bạn!' } }), request(`/gifts/gifts/${published.slug}/replies`, { body: { message: 'Rất vui!' } })]);
    assert(replies.every(r => r.status === 201)); assert.equal((await request(`/gifts/gifts/${published.slug}/replies`)).data.replies.length, 2); assert.equal((await request(`/gifts/gifts/${published.slug}`)).data.gift.replyCount, 2);
  });
  await check('JSON legacy and canvas: reply replay, distinct identical replies, owner-only read IDs and late arrivals', async () => {
    const { design: draft } = await post(owner, '/designs/designs', { source: { kind: 'blank' }, presetId: 'envelope-basic', mutationId: randomUUID() }, 201);
    for (const binding of Object.values(draft.document.bindings)) binding.value = 'Quà hộp thư QA';
    const ack = await post(owner, `/designs/designs/${draft.id}/save`, {
      expectedRevision: draft.revision, mutationId: randomUUID(), title: draft.title, document: draft.document,
    });
    const { gift } = await post(owner, '/gifts/gifts/from-design', {
      designId: draft.id, expectedRevision: ack.savedRevision, expectedDocumentHash: ack.documentHash, idempotencyKey: randomUUID(), access: { open: 'link', send: 'link', read: 'link' },
    }, 201);
    const { gift: legacy } = await post(owner, '/gifts/gifts', { templateId: 'sunny-wishes', recipientName: 'Mai', senderName: 'An', message: 'Lời chúc', access: { open: 'link', send: 'link', read: 'link' } }, 201);
    for (const item of [gift, legacy]) await runReplyIntents(base, item.slug, owner.cookie, other.cookie);
  });
  await check('C18/C27 restart replay and writer-off reader preserved', async () => {
    await stop(); await launch({ CANVAS_EDIT_ENABLED: 'false', CANVAS_PUBLISH_ENABLED: 'false' });
    assert.equal((await request(`/gifts/gifts/${published.slug}`)).status, 200); assert.equal((await fetch(`${base}/api/gifts/gifts/${published.slug}/assets/${asset.id}`)).status, 200);
    await post(owner, '/designs/designs', { source: { kind: 'blank' }, mutationId: randomUUID() }, 503);
    await post(owner, '/gifts/gifts/from-design', publishBody, 503);
    await stop(); await launch();
    const replay = await post(owner, '/gifts/gifts/from-design', publishBody); assert.equal(replay.replayed, true); assert.equal(replay.gift.slug, published.slug);
  });
  await check('Account recovery fake inbox: verified email code expires, consumes once and restores owner; Google provider ID stays linked', async () => {
    const mailbox = path.join(fixture, 'mailbox.ndjson'), clock = path.join(fixture, 'recovery-now.txt');
    let now = Date.now();
    fs.writeFileSync(clock, String(now));
    const mailFor = email => fs.existsSync(mailbox) ? fs.readFileSync(mailbox, 'utf8').trim().split('\n').map(line => JSON.parse(line)).findLast(item => item.to === email) : undefined;
    await runRecovery(base, {
      mailFor,
      messageFor: email => mailFor(email)?.text,
      advance: ms => { now += ms; fs.writeFileSync(clock, String(now)); },
    });
  });
  let expanded;
  const expandedArtifacts = process.env.BROWSER_ARTIFACT_DIR && path.join(process.env.BROWSER_ARTIFACT_DIR, 'qa-gifts');
  await check('293 Canvas cards survive actual JSON save/read; three V2 gifts publish, enforce media ACL and revoke', async () => {
    expanded = await runExpandedApi(base, owner.cookie, other.cookie, {
      artifacts:expandedArtifacts,allCards:true,browser:process.argv.includes('--browser'),
    });
  });
  if (process.argv.includes('--browser')) {
    // Start the UI workload with fresh in-memory quotas after the bulk API workload.
    // Keep the isolated fixture's JSON and owner identity; production limits stay intact.
    await stop(); await launch();
    const { runExpandedBrowser } = await import('../browser/canvas-expanded.mjs');
    await check('293 UI cards, 33 effects, touch/keyboard, and three public V2 QA cards', () =>
      runExpandedBrowser(base, owner.cookie, expanded, expandedArtifacts));
    const { runSenderIdentity } = await import('../browser/sender-identity.mjs');
    await check('Creator template identity is isolated from preview data', () => runSenderIdentity(base));
    const template = (await request('/catalog/templates')).data.templates.find(item => item.price === 0);
    const { gift: expired } = await post(owner, '/gifts/gifts', { templateId: template.id, recipientName: 'Mai', senderName: 'An', message: 'Quà hết hạn tổng hợp.' }, 201);
    const legacyFile = path.join(fixture, 'services/gifts/data/gifts.json');
    const legacyGifts = JSON.parse(fs.readFileSync(legacyFile, 'utf8'));
    legacyGifts.find(gift => gift.slug === expired.slug).expiresAt = '2000-01-01T00:00:00.000Z';
    fs.writeFileSync(legacyFile, JSON.stringify(legacyGifts));
    assert.equal((await request(`/gifts/gifts/${expired.slug}`)).status, 410);
    const { runCanvasBrowser } = await import('../browser/canvas.mjs'); await runCanvasBrowser(base, expired.slug);
    const { runCanvasResilience } = await import('../browser/canvas-resilience.mjs'); await runCanvasResilience(base);
    // Browser suites share one localhost IP; preceding scenarios can exhaust auth quotas.
    // Restart only the isolated fixture process, retaining its JSON data and JWT secrets.
    // Do not change production rate limits or spoof X-Forwarded-For headers.
    await stop(); await launch();
    assert.equal((await request(`/gifts/gifts/${published.slug}`)).status, 200, 'Fixture JSON must survive an isolated server restart');
    const { runCreatorJourney } = await import('../browser/creator-journey.mjs'); await runCreatorJourney(base);
    const { runNewTemplates } = await import('../browser/new-templates.mjs');
    await check('Mobile memory template, optional photo and two-envelope keyboard branching', () => runNewTemplates(base));
    const {runCardPageFit}=await import('../browser/card-page-fit.mjs');
    await check('Shared screen fit: every built-in scene and future portrait/landscape prose pages',()=>runCardPageFit(base));
  }
  console.log(JSON.stringify({ gate: 'JSON API', cases, fixture: 'synthetic isolated single process', result: 'PASS' }));
} catch (error) { console.error(logs); throw error; }
finally {
  await stop();
  const modules = path.join(fixture, 'node_modules');
  if (fs.lstatSync(modules, {throwIfNoEntry:false})?.isSymbolicLink()) fs.unlinkSync(modules);
  fs.rmSync(fixture, { recursive: true, force: true });
}
