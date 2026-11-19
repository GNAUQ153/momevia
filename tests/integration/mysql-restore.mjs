import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

export async function runMysqlRestore({ root, sourceFixture, database, container, config, gift, stopSource, extended, artifacts }) {
  const evidence = artifacts || path.join(root, 'local', 'sender-creator-20261118');
  fs.mkdirSync(evidence, { recursive: true });
  const run = fs.mkdtempSync(path.join(evidence, 'restore-'));
  const media = path.join(run, 'source-media');
  const legacyMedia = path.join(run, 'source-legacy-media');
  const output = path.join(run, 'backup');
  const destination = `${database}_restored`;
  await stopSource();
  fs.cpSync(path.join(sourceFixture, 'services/designs/data/assets'), media, { recursive: true });
  fs.cpSync(path.join(sourceFixture, 'services/gifts/data/images'), legacyMedia, { recursive: true });
  console.log(execFileSync(process.execPath, [path.join(root, 'database/scripts/canvas-backup.mjs'),
    '--container', container, '--schema', database, '--restore-test', destination, '--media-root', media, '--legacy-media-root', legacyMedia, '--output', output],
  { cwd: root, encoding: 'utf8', windowsHide: true }).trim());
  const restored = fs.mkdtempSync(path.join(os.tmpdir(), 'momevia-restored-app-'));
  const environmentDatabase = process.env.MYSQL_DATABASE;
  let app, browser;
  try {
    for (const dir of ['src', 'web']) fs.cpSync(path.join(sourceFixture, dir), path.join(restored, dir), { recursive: true });
    fs.copyFileSync(path.join(root, 'package.json'), path.join(restored, 'package.json'));
    fs.symlinkSync(fs.realpathSync(path.join(sourceFixture, 'node_modules')), path.join(restored, 'node_modules'), 'junction');
    fs.cpSync(path.join(output, 'restore-media'), path.join(restored, 'services/designs/data/assets'), { recursive: true });
    fs.cpSync(path.join(output, 'restore-legacy-media'), path.join(restored, 'services/gifts/data/images'), { recursive: true });
    process.env.MYSQL_DATABASE = destination;
    const { createHttpApp } = await import(pathToFileURL(path.join(restored, 'src/server/app.mjs')).href);
    app = await createHttpApp(config);
    app.server.listen(Number(new URL(config.baseUrl).port), '127.0.0.1');
    await once(app.server, 'listening');
    const endpoint = `${config.baseUrl}/api/gifts/gifts/${gift.slug}`;
    assert.equal((await fetch(endpoint)).status, 403);
    assert.equal((await fetch(`${endpoint}/assets/${gift.assetId}`)).status, 403);
    const response = await fetch(endpoint + gift.query);
    assert.equal(response.status, 200);
    const { gift: read } = await response.json();
    assert.equal(read.documentSnapshot.bindings.message.value, gift.greeting);
    const [row] = await app.modules.gifts.service.giftsRepo.client.execute('SELECT payload FROM gifts WHERE slug=?', [gift.slug]);
    const stored = typeof row[0].payload === 'string' ? JSON.parse(row[0].payload) : row[0].payload;
    assert.equal(stored.templateVersionId, gift.templateVersionId);
    assert.equal(stored.templateId, gift.templateId);
    const mediaResponse = await fetch(`${endpoint}/assets/${gift.assetId}${gift.query}`);
    assert.deepEqual(Buffer.from(await mediaResponse.arrayBuffer()), gift.originalPhoto);
    const legacy = await fetch(`${config.baseUrl}/api/gifts/gifts/${gift.legacy.slug}/photo`);
    assert.equal(legacy.status, 200);
    assert.deepEqual(Buffer.from(await legacy.arrayBuffer()), gift.legacy.photo);
    const channel = process.env.BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined);
    browser = await chromium.launch({ headless: true, channel });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route('**/*', route => new URL(route.request().url()).origin === config.baseUrl ? route.continue() : route.abort());
    await page.goto(`${config.baseUrl}/g/${gift.slug}${gift.query}`);
    await page.locator('.gift-runtime-stage img').first().waitFor();
    await page.getByRole('button', { name: /Lời chúc/ }).click();
    await page.locator('.gift-runtime-stage').getByText(gift.greeting, { exact: true }).waitFor();
    await page.getByText('Người gửi đã tắt hồi đáp.').waitFor();
    console.log('PASS restored application: same link and port, original image bytes, version V1 and invite-only access in a clean MySQL schema and fresh app.');
    if (extended) {
      const endpoint = `${config.baseUrl}/api/gifts/gifts/${extended.slug}`;
      const response = await fetch(endpoint);
      assert.equal(response.status,200);
      const {gift} = await response.json();
      assert.equal(gift.runtimeVersion,2);
      assert.deepEqual(gift.documentSnapshot,extended.snapshot);
      for (const {assetId} of gift.documentSnapshot.assets) {
        const photo = await fetch(`${endpoint}/assets/${assetId}`);
        assert.equal(photo.status,200);
        assert(Buffer.from(await photo.arrayBuffer()).length > 0);
      }
      await page.goto(`${config.baseUrl}/g/${extended.slug}`);
      await page.getByRole('button',{name:'Mở album',exact:true}).click();
      await page.getByAltText('Phong cảnh minh hoạ 1').waitFor();
      await page.getByRole('button',{name:'Sau',exact:true}).click();
      await page.getByAltText('Phong cảnh minh hoạ 2').waitFor();
      console.log('PASS restored V2 public runtime and nested album assets on MySQL.');
    }
    console.log(`Restore manifest: ${path.join(output, 'manifest.json')}`);
  } finally {
    await browser?.close();
    if (app) { await new Promise(resolve => app.server.close(resolve)); await app.close(); }
    process.env.MYSQL_DATABASE = environmentDatabase;
    const modules = path.join(restored,'node_modules');
    if (fs.lstatSync(modules,{throwIfNoEntry:false})?.isSymbolicLink()) fs.unlinkSync(modules);
    fs.rmSync(restored, { recursive: true, force: true });
  }
}
