// Explicit, isolated MySQL schema only. No writes to application databases.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID, randomBytes } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createConnection } from 'mysql2/promise';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { MySqlClient } from '../../src/infrastructure/mysql/client.mjs';
import { createDocument, createElement, publicDocument } from '../../web/js/shared/canvas/index.js';
import { requiresCanvasV2 } from '../../web/js/shared/canvas/schema.js';
import { hash } from '../../src/modules/designs/designs.service.mjs';
import { catalog, sampleBindings } from '../../web/js/features/canvas-editor/library.js';
import { effectFamilies, effectsFor, defaultCelebrations } from '../../web/js/shared/canvas/effects.js';
import { createEditorStore } from '../../web/js/features/canvas-editor/store.js';
import { createSaveSession } from '../../web/js/features/canvas-editor/session.js';
import { configureLibrary } from '../../web/js/features/canvas-editor/library-client.js';
import { effectPreset } from '../../web/js/shared/canvas/effects.js';
import { runLibraryManagement } from './canvas-library-management.mjs';
import { runExpandedApi } from './canvas-expanded.mjs';

assert.equal(process.env.CANVAS_QA_MYSQL_ISOLATED, 'true', 'Explicit isolated QA opt-in required');
const database = process.env.CANVAS_QA_MYSQL_DATABASE;
assert.match(database || '', /^momevia_canvas_qa_[a-z0-9_]+$/);
const port = Number(process.env.CANVAS_QA_MYSQL_PORT);
assert(Number.isSafeInteger(port) && port >= 1024 && port <= 65535);
assert(process.env.CANVAS_QA_MYSQL_PASSWORD);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const admin = await createConnection({ host: '127.0.0.1', port, user: process.env.CANVAS_QA_MYSQL_USER || 'root',
  password: process.env.CANVAS_QA_MYSQL_PASSWORD, multipleStatements: true, timezone: 'Z', dateStrings: true });
const [[exists]] = await admin.execute('SELECT COUNT(*) n FROM information_schema.schemata WHERE schema_name=?', [database]);
assert.equal(exists.n, 0, 'QA requires a new schema');
await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
await admin.query(`USE \`${database}\``);
for (const f of fs.readdirSync(path.join(root, 'database/migrations')).filter(n => n.endsWith('.sql')).sort())
  await admin.query(fs.readFileSync(path.join(root, 'database/migrations', f), 'utf8'));
const fixture = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'momevia-storage-roundtrip-'));
for (const n of ['src', 'web']) fs.cpSync(path.join(root, n), path.join(fixture, n), { recursive: true });
fs.copyFileSync(path.join(root, 'package.json'), path.join(fixture, 'package.json'));
fs.symlinkSync(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'junction');
const previousEnv = { ...process.env }, previousCwd = process.cwd();
Object.assign(process.env, { NODE_ENV: 'test', IDENTITY_STORAGE: 'mysql', CATALOG_STORAGE: 'mysql', GIFTS_STORAGE: 'mysql',
  CHECKOUT_STORAGE: 'mysql', DESIGNS_STORAGE: 'mysql', SUPPORT_STORAGE: 'mysql', MYSQL_HOST: '127.0.0.1', MYSQL_PORT: String(port),
  MYSQL_DATABASE: database, MYSQL_USER: process.env.CANVAS_QA_MYSQL_USER || 'root', MYSQL_PASSWORD: process.env.CANVAS_QA_MYSQL_PASSWORD,
  JWT_SECRET: randomBytes(32).toString('hex'), INTERNAL_SERVICE_KEY: randomBytes(32).toString('hex'),
  TEST_ACCOUNT_ENABLED: 'false', DEMO_AUTH_ENABLED: 'false', PAYMENT_ENABLED: 'false', PAYMENT_LIVE_ENABLED: 'false',
  PUBLIC_BASE_URL: 'http://127.0.0.1', ALLOWED_ORIGINS: '', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '',
  HTTPS_CERT_FILE: '', HTTPS_KEY_FILE: '',
  RECOVERY_MAIL_URL: '', RECOVERY_MAIL_TOKEN: '', CANVAS_READ_ENABLED: 'true', CANVAS_EDIT_ENABLED: 'true', CANVAS_PUBLISH_ENABLED: 'true' });
process.chdir(fixture);
let app, browser, base, cookie, design;
const counts = { libraryFactories: 0, effectPresets: 0, celebrationCombinations: 0, browserReload: 0, immutablePublication: 0 };
async function request(url, body) {
  const response = await fetch(base + url, { method: body ? 'POST' : 'GET',
    headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const value = await response.json();
  assert(response.ok, `${url}: ${response.status} ${JSON.stringify(value)}`);
  return { value, response };
}
async function launch() {
  const { createHttpApp } = await import(pathToFileURL(path.join(fixture, 'src/server/app.mjs')).href);
  const { environment } = await import(pathToFileURL(path.join(fixture, 'src/shared/config.mjs')).href);
  const config = environment();
  app = await createHttpApp(config);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  config.baseUrl = base;
}
async function stop() { if (app) { await new Promise(resolve => app.server.close(resolve)); await app.close(); app = null; } }
async function check(doc) {
  if (requiresCanvasV2(doc)) doc.schemaVersion = doc.registryVersion = 2;
  const store = createEditorStore(design), memory = new Map();
  const storage = { getItem: k => memory.get(k) || null, setItem: (k, v) => memory.set(k, v), removeItem: k => memory.delete(k) };
  const session = createSaveSession({ design, store, userId: design.ownerId || 'qa', storage, recoveryStorage: storage,
    tabEventTarget: null, debounceMs: 60000, request: async (url, body) => (await request('/api' + url, body)).value });
  try {
    store.update(next => { next.document = doc; }); await session.save(); assert.equal(session.status, 'clean');
  } finally { session.dispose(); }
  const client = new MySqlClient();
  try {
    const [[row]] = await client.execute('SELECT document,document_hash FROM designs WHERE id=?', [design.id]);
    const actual = typeof row.document === 'string' ? JSON.parse(row.document) : row.document;
    assert.deepEqual(actual, doc); assert.equal(row.document_hash, hash(doc));
  } finally { await client.close(); }
  design = (await request(`/api/designs/designs/${design.id}`)).value.design;
  assert.deepEqual(design.document, doc); assert.equal(design.documentHash, hash(doc));
}
try {
  await launch();
  const register = await request('/api/auth/register', { name: 'Kiểm tra lưu MySQL', email: `${randomUUID()}@example.test`,
    password: 'SyntheticOnly123', confirmPassword: 'SyntheticOnly123' });
  cookie = register.response.headers.get('set-cookie').split(';')[0];
  const { library } = (await request('/api/designs/library')).value;
  assert.equal(library.items.length, 387); configureLibrary(library);
  design = (await request('/api/designs/designs', { source: { kind: 'blank' }, presetId: 'envelope-basic', mutationId: randomUUID() })).value.design;
  const cards = catalog.flatMap(g => g.items);
  for (const card of cards) {
    const doc = sampleBindings(createDocument({ presetId: 'envelope-basic' })), elements = card.create();
    doc.elements.push(...elements); doc.scenes[0].elementIds.push(...elements.map(e => e.id));
    await check(doc); counts.libraryFactories++;
  }
  console.log('PASS 172 library factories: editor save session -> HTTP -> MySQL -> fresh connection -> HTTP read');
  for (const [family, { presets }] of Object.entries(effectFamilies)) for (const id of Object.keys(presets)) {
    const doc = sampleBindings(createDocument({ presetId: 'envelope-basic' })); let model = doc.scenes[0];
    if (!['transition', 'ambience'].includes(family)) {
      let found;
      for (const card of cards) { const elements = card.create(), e = elements.find(e => effectsFor(family, e).some(([v]) => v === id));
        if (e) { found = { elements, e }; break; } }
      assert(found, id); doc.elements.push(...found.elements); doc.scenes[0].elementIds.push(...found.elements.map(e => e.id)); model = found.e;
    }
    model.effects = { [family]: { ...effectPreset(id, family), ...(family === 'surface' ? { color: '#A1B2C3' } : { speed: 'slow' }),
      ...(family === 'entrance' ? { delay: 300 } : {}), ...(family === 'ambience' ? { density: 'sparse' } : {}) } };
    await check(doc); counts.effectPresets++;
  }
  console.log('PASS all 33 effect presets and their configurable options');
  for (const speed of ['slow', 'normal', 'fast']) for (const density of ['sparse', 'normal', 'dense']) for (const loop of [true, false]) {
    const doc = sampleBindings(createDocument({ presetId: 'envelope-basic' }));
    doc.scenes[0].effects = { celebrations: Object.fromEntries(Object.keys(defaultCelebrations()).map(id => [id, { enabled: true, speed, density, loop }])) };
    await check(doc); counts.celebrationCombinations++;
  }
  // Regression for MySQL binary JSON decimal serialization changing hashes.
  const doc = sampleBindings(createDocument({ presetId: 'envelope-basic' }));
  const text = doc.elements.find(e => e.type === 'text'); text.layout.y = 52.382775119617236;
  text.effects = { entrance: { id: 'E03', speed: 'slow', delay: 300 }, emphasis: { id: 'A04', speed: 'fast' } };
  doc.scenes[0].effects = { transition: { id: 'T03', speed: 'slow' }, celebrations: {
    B05: { enabled: true, speed: 'fast', density: 'dense', loop: false }, B07: { enabled: true, speed: 'slow', density: 'sparse', loop: true } } };
  await check(doc);
  const bytes = await sharp({ create: { width: 24, height: 18, channels: 3, background: '#C8AEF2' } }).png().toBuffer();
  const upload = await fetch(`${base}/api/designs/designs/${design.id}/assets`, { method: 'POST',
    headers: { cookie, 'content-type': 'image/png', 'x-mutation-id': randomUUID() }, body: bytes });
  assert.equal(upload.status, 201); const { asset } = await upload.json();
  const picture = createElement('image', { props: { assetId: asset.id, focalPoint: { x: .12345678901234568, y: .7 } }, effects: { entrance: { id: 'E05', speed: 'fast' } } });
  doc.elements.push(picture); doc.scenes[0].elementIds.push(picture.id); doc.assets.push({ assetId: asset.id, kind: 'image' }); await check(doc);
  const frozen = publicDocument(doc);
  const publicationInput = { designId: design.id, expectedRevision: design.revision, expectedDocumentHash: design.documentHash, idempotencyKey: randomUUID() };
  const publication = (await request('/api/gifts/gifts/from-design', publicationInput)).value;
  assert.equal((await request('/api/gifts/gifts/from-design', publicationInput)).value.gift.id, publication.gift.id);
  await stop(); await launch(); // Persisted session and design survive the server restart.
  design = (await request(`/api/designs/designs/${design.id}`)).value.design; assert.deepEqual(design.document, doc);
  const publicGift = (await request(`/api/gifts/gifts/${publication.gift.slug}`)).value.gift;
  assert.deepEqual(publicGift.documentSnapshot, frozen); counts.immutablePublication++;
  const changed = structuredClone(doc); changed.bindings.message.value = 'Nháp sau khi gửi'; await check(changed);
  assert.deepEqual((await request(`/api/gifts/gifts/${publication.gift.slug}`)).value.gift.documentSnapshot, frozen);
  await assert.rejects(admin.execute('UPDATE designs SET document=? WHERE id=?', ['not JSON', design.id]), e => e.code === 'ER_CHECK_CONSTRAINT_VIOLATED');
  const conflict = await fetch(`${base}/api/designs/designs/${design.id}/save`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ expectedRevision: 1, mutationId: randomUUID(), title: design.title, document: doc }) });
  assert.equal(conflict.status, 409);
  browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined) });
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const [name, value] = cookie.split('='); await context.addCookies([{ name, value, url: base }]);
  const page = await context.newPage();
  await page.goto(`${base}/design/${design.id}`); await page.locator('[data-editor-field="title"]').waitFor({ timeout: 20000 });
  await page.reload(); await page.locator('[data-editor-field="title"]').waitFor({ timeout: 20000 });
  const loaded = await page.evaluate(async id => (await (await fetch(`/api/designs/designs/${id}`)).json()).design.document, design.id);
  assert.deepEqual(loaded, changed);
  const selectText = async () => {
    await page.locator('[data-editor-action="library-tab"][data-tab="layers"]').click();
    await page.locator(`.editor-layers [data-editor-action="select"][data-id="${text.id}"]`).click();
  };
  const field = key => page.locator(`.editor-inspector [data-editor-field="${key}"]`);
  await selectText();
  assert.equal(await field('effect.entrance.id').inputValue(), 'E03');
  assert.equal(await field('effect.entrance.speed').inputValue(), 'slow');
  assert.equal(await field('effect.entrance.delay').inputValue(), '300');
  await field('effect.entrance.id').selectOption('E02');
  await field('effect.entrance.speed').selectOption('fast');
  await field('effect.entrance.delay').selectOption('150');
  await page.locator('[data-editor-action="save"]').click();
  await page.locator('.editor-save-status[data-tone="saved"]').waitFor();
  await page.reload(); await page.locator('[data-editor-field="title"]').waitFor(); await selectText();
  assert.equal(await field('effect.entrance.id').inputValue(), 'E02');
  assert.equal(await field('effect.entrance.speed').inputValue(), 'fast');
  assert.equal(await field('effect.entrance.delay').inputValue(), '150');
  const afterUi = (await request(`/api/designs/designs/${design.id}`)).value.design.document;
  assert.deepEqual(afterUi.elements.find(e => e.id === text.id).effects.entrance, { ...effectPreset('E02', 'entrance'), speed: 'fast', delay: 150 });
  assert.equal(afterUi.elements.find(e => e.id === text.id).layout.y, 52.382775119617236);
  assert.deepEqual(afterUi.scenes[0].effects, changed.scenes[0].effects);
  if (process.env.BROWSER_ARTIFACT_DIR) {
    fs.mkdirSync(process.env.BROWSER_ARTIFACT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(process.env.BROWSER_ARTIFACT_DIR, 'mysql-effect-after-reload.png'), fullPage: true });
  }
  counts.browserReload++;
  if (process.env.CANVAS_LIBRARY_EXPANDED_BROWSER === 'true') {
    const otherCookie = cookie;
    const expandedUser = await request('/api/auth/register', { name: 'Hồi quy thư viện QA', email: `${randomUUID()}@example.test`,
      password: 'SyntheticOnly123', confirmPassword: 'SyntheticOnly123' });
    cookie = expandedUser.response.headers.get('set-cookie').split(';')[0];
    const expanded = await runExpandedApi(base, cookie, otherCookie, { browser: true, artifacts: process.env.BROWSER_ARTIFACT_DIR });
    const { runExpandedBrowser } = await import('../browser/canvas-expanded.mjs');
    await runExpandedBrowser(base, cookie, expanded, process.env.BROWSER_ARTIFACT_DIR);
    counts.expandedBrowser = true;
  }
  const libraryUser = await request('/api/auth/register', { name: 'Quản lý thư viện QA', email: `${randomUUID()}@example.test`,
    password: 'SyntheticOnly123', confirmPassword: 'SyntheticOnly123' });
  cookie = libraryUser.response.headers.get('set-cookie').split(';')[0];
  counts.libraryManagement = await runLibraryManagement({ base, cookie, admin, userId: libraryUser.value.user.id, request, browser });
  await browser.close(); browser = null;
  console.log('PASS precise decimal/hash, image crop, pinned publication, idempotency, server restart, browser reload, invalid JSON and revision conflict');
  console.log(JSON.stringify({ status: 'PASS', database, ...counts }));
} finally {
  await browser?.close(); await stop(); await admin.end(); process.chdir(previousCwd);
  for (const key of Object.keys(process.env)) if (!(key in previousEnv)) delete process.env[key];
  Object.assign(process.env, previousEnv);
  const resolved = path.resolve(fixture); assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
  fs.unlinkSync(path.join(resolved, 'node_modules')); fs.rmSync(resolved, { recursive: true, force: true });
}
