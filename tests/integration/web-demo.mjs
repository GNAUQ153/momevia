import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'momevia-web-demo-'));
const reserved = net.createServer().listen(0, '127.0.0.1');
await once(reserved, 'listening');
const port = reserved.address().port;
await new Promise(resolve => reserved.close(resolve));
const base = `http://127.0.0.1:${port}`;
for (const entry of ['src', 'web', 'scripts/dev', 'package.json', 'dev.mjs']) {
  fs.cpSync(path.join(root, entry), path.join(fixture, entry), { recursive: true });
}
fs.symlinkSync(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'junction');
let child, ended, browser, logs = '';
async function waitUntil(check, description) {
  for (let i = 0; i < 100; i++) {
    if (await check()) return;
    await delay(100);
  }
  throw new Error(`Timed out: ${description}\n${logs.slice(-2500)}`);
}
function launch(args = []) {
  logs = '';
  child = spawn(process.execPath, ['scripts/dev/web-demo.mjs', '--port', String(port), ...args], {
    cwd: fixture, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true,
  });
  ended = once(child, 'exit');
  for (const stream of [child.stdout, child.stderr]) stream.on('data', bytes => { logs = (logs + bytes).slice(-12000); });
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  child.send('demo-stop', () => {});
  const force = setTimeout(() => child.kill(), 15000);
  try { await ended; } finally { clearTimeout(force); }
}
try {
  launch();
  await waitUntil(() => logs.includes('Tự cập nhật khi lưu file.'), 'first demo seed and watcher');
  const profile = path.join(fixture, 'local', `web-demo-${port}`);
  const stateFile = path.join(profile, 'trang-thai-demo.json');
  const stateBytes = fs.readFileSync(stateFile);
  const state = JSON.parse(stateBytes);
  const accountBytes = fs.readFileSync(path.join(profile, 'tai-khoan-demo.json'));
  const runtimeBytes = fs.readFileSync(path.join(profile, 'runtime.json'));
  const sender = JSON.parse(accountBytes).sender;
  const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: JSON.stringify(sender) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  async function api(url, body) {
    const response = await fetch(base + '/api' + url, { method: body ? 'POST' : 'GET', headers: { cookie, origin: base, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
    assert(response.ok, `${url}: ${response.status}`);
    return response.json();
  }
  const draftUrl = '/designs/designs/' + new URL(state.senderDraft).pathname.split('/').at(-1);
  const draft = (await api(draftUrl)).design;
  draft.document.bindings.message.value = 'Edited draft must survive live file updates.';
  await api(draftUrl + '/save', { expectedRevision: draft.revision, mutationId: randomUUID(), title: draft.title, document: draft.document });
  const saved = (await api(draftUrl)).design;
  const giftUrl = '/gifts/gifts/' + new URL(state.gift).pathname.split('/').at(-1);
  const gift = (await api(giftUrl)).gift;

  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined });
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  await page.goto(base);
  await page.locator('.mkt-hero').waitFor();
  const homeFile = path.join(fixture, 'web/js/pages/home.js');
  const original = fs.readFileSync(homeFile, 'utf8');
  fs.writeFileSync(homeFile, original.replace('class="mkt-hero__intro"', 'class="mkt-hero__intro" data-demo-update="one"'));
  await page.locator('[data-demo-update="one"]').waitFor();
  assert.equal((await fetch(base + '/js/pages/home.js')).headers.get('cache-control'), 'no-store');

  // Open previews and editing routes keep their live state until safe refresh.
  await page.locator('.mkt-actions [data-template-preview]').click();
  await page.getByRole('dialog').locator('[data-runtime-element="open-memory"]').waitFor();
  fs.writeFileSync(homeFile, original.replace('class="mkt-hero__intro"', 'class="mkt-hero__intro" data-demo-update="two"'));
  await waitUntil(async () => (await (await fetch(base + '/js/pages/home.js')).text()).includes('data-demo-update="two"'), 'changed source served while preview open');
  await delay(1500);
  assert.equal(await page.locator('[data-demo-update="one"]').count(), 1);
  assert.equal(await page.getByRole('dialog').isVisible(), true);
  await page.keyboard.press('Escape');
  await page.locator('[data-demo-update="two"]').waitFor();

  const separator = cookie.indexOf('=');
  await page.context().addCookies([{ name: cookie.slice(0, separator), value: cookie.slice(separator + 1), url: base, httpOnly: true, sameSite: 'Lax' }]);
  await page.goto(state.senderDraft);
  const unsavedField = page.locator('[data-editor-field="binding.message"]');
  await unsavedField.waitFor();
  // Model an edit whose save has not reached the server yet.
  await page.route('**/api/designs/designs/*/save', route => route.abort());
  await unsavedField.fill('Unsaved Canvas edit must not disappear on source refresh.');
  await unsavedField.press('Tab');
  const backendFile = path.join(fixture, 'src/server/app.mjs');
  const backend = fs.readFileSync(backendFile, 'utf8');
  fs.writeFileSync(backendFile, backend.replace('staticFile(req, res, url, staticOptions);', "res.setHeader('x-demo-test', 'restarted'); staticFile(req, res, url, staticOptions);"));
  await waitUntil(async () => {
    try { return (await fetch(base)).headers.get('x-demo-test') === 'restarted'; } catch { return false; }
  }, 'backend source restarted');
  await delay(1500);
  assert.equal(await unsavedField.inputValue(), 'Unsaved Canvas edit must not disappear on source refresh.');
  assert.deepEqual((await api(draftUrl)).design, saved, 'Edited draft, revision, rights and session survive restart');
  assert.deepEqual((await api(giftUrl)).gift, gift, 'Published snapshot survives restart');
  assert(fs.readFileSync(stateFile).equals(stateBytes));
  assert(fs.readFileSync(path.join(profile, 'tai-khoan-demo.json')).equals(accountBytes));
  assert(fs.readFileSync(path.join(profile, 'runtime.json')).equals(runtimeBytes));

  await browser.close(); browser = null;
  await stop();
  // Reuse the same profile: startup refreshes code even without watch mode.
  fs.writeFileSync(homeFile, original + '\n// latest-on-restart\n');
  launch(['--prepare']);
  const [code] = await ended;
  assert.equal(code, 0, logs);
  assert(fs.readFileSync(path.join(profile, 'app/web/js/pages/home.js'), 'utf8').includes('latest-on-restart'));
  assert(fs.readFileSync(stateFile).equals(stateBytes));
  console.log('PASS Demo: latest code on restart; live browser refresh; preview/editor protection; backend restart; preserved edited draft, published gift, session, credentials and profile links.');
} finally {
  await browser?.close();
  await stop();
  // Only this mkdtemp fixture is removed; never touch the real demo profiles.
  assert(path.dirname(fixture) === fs.realpathSync(os.tmpdir()) && path.basename(fixture).startsWith('momevia-web-demo-'));
  fs.rmSync(fixture, { recursive: true, force: true });
}
