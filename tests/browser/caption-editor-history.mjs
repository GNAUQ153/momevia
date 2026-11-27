import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { builtinLibraryItems } from '../../src/modules/designs/library.seed.mjs';
import { buildLibraryPreview } from '../../src/modules/designs/library-preview.mjs';
import { installLibrary } from '../../web/js/shared/canvas/library-state.js';

const evidence = process.env.CAPTION_EDITOR_EVIDENCE;
const items = builtinLibraryItems();
installLibrary({ items });
const row = items.find(row => row.kind === 'element' && row.id === 'panorama-caption');
const document = buildLibraryPreview(row, items.slice(), 'vi').document;
const original = document.elements.find(element => element.type === 'image');
original.props.radius = 24;
const snapshot = JSON.stringify(document);
const fixture = await sharp({ create: { width: 256, height: 256, channels: 4, background: '#cc2288' } }).png().toBuffer();
const styles = fs.readFileSync('web/index.html', 'utf8').match(/<link\b[^>]*rel="stylesheet"[^>]*>/gi).join('\n');
const root = path.resolve('web');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1000, height: 1100 }, acceptDownloads: true });
const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
await context.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.origin !== 'http://localhost') return route.abort();
  if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="vi">' + styles + '<body><div id="host"></div>' });
  if (url.pathname.startsWith('/api/designs/designs/')) return route.fulfill({ contentType: 'image/png', body: fixture });
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
  return route.fulfill({ path: file, contentType: mime[path.extname(file)] || 'application/octet-stream' });
});

try {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost/', { waitUntil: 'networkidle' });
  await page.evaluate(async doc => {
    const fabric = await import('/js/vendor/fabric.mjs');
    const add = fabric.Canvas.prototype.add;
    fabric.Canvas.prototype.add = function (...objects) { globalThis.captionCanvas = this; return add.apply(this, objects); };
    const { openFabricStudio } = await import('/js/features/canvas-editor/fabric-studio.js');
    globalThis.captionPatch = null;
    globalThis.captionTool = await openFabricStudio({ snapshot: doc, sceneId: doc.entrySceneId,
      assetUrl: id => '/api/designs/designs/history/assets/' + id,
      onApply: patch => { globalThis.captionPatch = patch; }, signal: new AbortController().signal });
  }, document);

  async function point(id) {
    return page.evaluate(id => {
      const canvas = globalThis.captionCanvas;
      const object = canvas.getObjects().find(object => object.momeviaId === id);
      const box = object.getBoundingRect();
      const rect = canvas.upperCanvasEl.getBoundingClientRect();
      return { x: rect.x + (box.left + box.width / 2) * rect.width / canvas.width,
        y: rect.y + (box.top + box.height / 2) * rect.height / canvas.height };
    }, id);
  }

  async function move(id, dx, dy) {
    const start = await point(id);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + dx, start.y + dy, { steps: 4 });
    await page.mouse.up();
  }

  async function shortcut(chord) {
    await page.locator('[data-editor-action="fabric-download"]').focus();
    await page.keyboard.press(chord);
  }

  async function assertReferences(id) {
    const state = await page.evaluate(id => {
      const group = globalThis.captionCanvas.getObjects().find(object => object.momeviaId === id);
      const children = group.getObjects();
      return { captionChild: children.includes(group.momeviaCaption), photoChild: children.includes(group.momeviaPhoto),
        opacity: group.opacity,
        captionText: group.momeviaCaption?.text, radius: group.momeviaPhoto?.clipPath?.rx,
        effectiveRadius: group.momeviaPhoto?.clipPath?.rx * group.momeviaPhoto?.clipPath?.scaleX * group.momeviaPhoto?.scaleX };
    }, id);
    assert.equal(state.captionChild, true, 'Caption points to the displayed group child after history restore');
    assert.equal(state.photoChild, true, 'Radius controls target the displayed photo after history restore');
    assert.equal(state.captionText, original.props.caption);
    return state;
  }

  async function opacity(id, value) {
    const location = await point(id);
    await page.mouse.click(location.x, location.y);
    const toggle = page.locator('.fabric-properties__toggle');
    if (await toggle.isVisible()) await toggle.click();
    const field = page.locator('[data-fabric-style="opacity"]');
    await field.fill(String(value));
    await field.dispatchEvent('change');
  }

  await move(original.id, 3, 1);
  await shortcut('Control+z');
  await page.waitForFunction(({ id, x, y }) => {
    const group = globalThis.captionCanvas.getObjects().find(object => object.momeviaId === id);
    return group && Math.abs(group.left - x) < .02 && Math.abs(group.top - y) < .02;
  }, { id: original.id, x: original.layout.x + original.layout.width / 2,
    y: original.layout.y + original.layout.height / 2 }, { timeout: 5000 });
  const restored = await assertReferences(original.id);
  await opacity(original.id, 60);
  assert.equal((await assertReferences(original.id)).opacity, .6);
  await shortcut('Control+z');
  await page.waitForFunction(({ id, opacity }) => {
    const group = globalThis.captionCanvas.getObjects().find(object => object.momeviaId === id);
    return group && Math.abs(group.opacity - opacity) < .02;
  }, { id: original.id, opacity: original.opacity ?? 1 }, { timeout: 5000 });
  await shortcut('Control+y');
  await page.waitForFunction(id => {
    const group = globalThis.captionCanvas.getObjects().find(object => object.momeviaId === id);
    return group && Math.abs(group.opacity - .6) < .02;
  }, original.id, { timeout: 5000 });
  await opacity(original.id, 100);

  const location = await point(original.id);
  await page.mouse.click(location.x, location.y);
  await shortcut('Control+d');
  await page.waitForFunction(id => globalThis.captionCanvas.getObjects()
    .some(object => object.momeviaType === 'image' && object.momeviaId !== id), original.id, { timeout: 5000 });
  const copyId = await page.evaluate(id => globalThis.captionCanvas.getObjects()
    .find(object => object.momeviaType === 'image' && object.momeviaId !== id).momeviaId, original.id);
  await move(copyId, 0, 250);
  await opacity(copyId, 70);
  const originalState = await assertReferences(original.id);
  const copyState = await assertReferences(copyId);
  assert.equal(originalState.opacity, 1);
  assert.equal(copyState.opacity, .7);
  assert(Math.abs(originalState.effectiveRadius - 24) < .02);
  assert(Math.abs(copyState.effectiveRadius - 24) < .02);
  const independent = await page.evaluate(({ originalId, copyId }) => {
    const objects = globalThis.captionCanvas.getObjects();
    const original = objects.find(object => object.momeviaId === originalId);
    const copy = objects.find(object => object.momeviaId === copyId);
    return original.momeviaCaption !== copy.momeviaCaption && original.momeviaPhoto !== copy.momeviaPhoto;
  }, { originalId: original.id, copyId });
  assert.equal(independent, true);

  const button = page.locator('[data-editor-action="fabric-download"]');
  assert.equal(await button.isEnabled(), true);
  const pending = page.waitForEvent('download');
  await button.click();
  const download = await pending;
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const png = Buffer.concat(chunks);
  const pixels = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const sample = (x, y) => {
    const offset = (Math.floor(y * 2) * pixels.info.width + Math.floor(x * 2)) * pixels.info.channels;
    return [...pixels.data.subarray(offset, offset + 3)];
  };
  const isPhoto = pixel => pixel[0] > 180 && pixel[1] < 70 && pixel[2] > 100;
  assert(isPhoto(sample(original.layout.x + original.layout.width / 2, original.layout.y + 50)));
  assert(!isPhoto(sample(original.layout.x + 1, original.layout.y + 1)), 'Restored original photo keeps its rounded corner');
  assert.equal(JSON.stringify(document), snapshot);
  assert.deepEqual(errors, []);
  if (evidence) {
    fs.mkdirSync(evidence, { recursive: true });
    fs.writeFileSync(path.join(evidence, 'caption-history-export.png'), png);
    fs.writeFileSync(path.join(evidence, 'caption-history.json'), JSON.stringify({ restored, originalState, copyState, independent, errors }, null, 2));
  }
  await page.locator('[data-editor-action="fabric-apply"]').click();
  const patch = await page.evaluate(() => globalThis.captionPatch);
  assert(!patch.layouts.some(layout => layout.id === original.id), 'Undo restores original authored geometry');
  assert(patch.commands.some(command => command.type === 'clone' && command.id === copyId));
  console.log('PASS caption history Undo/Redo, rounded PNG, independent clone references and unchanged source geometry.');
} finally { await browser.close(); }
