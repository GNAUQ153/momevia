import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { builtinLibraryItems } from '../../src/modules/designs/library.seed.mjs';
import { buildLibraryPreview } from '../../src/modules/designs/library-preview.mjs';
import { installLibrary } from '../../web/js/shared/canvas/library-state.js';

const evidence = process.env.DROPCAP_EDITOR_EVIDENCE;
const items = builtinLibraryItems();
installLibrary({ items });
const item = items.find(row => row.kind === 'element' && row.id === 'drop-cap');
const document = buildLibraryPreview(item, items.slice(), 'vi').document;
const original = document.elements.find(element => element.type === 'text');
const styles = fs.readFileSync('web/index.html', 'utf8').match(/<link\b[^>]*rel="stylesheet"[^>]*>/gi).join('\n');
const root = path.resolve('web');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1000, height: 1100 } });
const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
await context.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.origin !== 'http://localhost') return route.abort();
  if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="vi">' + styles + '<body><div id="host"></div>' });
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
    fabric.Canvas.prototype.add = function (...objects) {
      globalThis.dropcapCanvas = this;
      return add.apply(this, objects);
    };
    const { openFabricStudio } = await import('/js/features/canvas-editor/fabric-studio.js');
    globalThis.dropcapPatch = null;
    globalThis.dropcapTool = await openFabricStudio({
      snapshot: doc, sceneId: doc.entrySceneId, assetUrl: () => null,
      onApply: patch => { globalThis.dropcapPatch = patch; }, signal: new AbortController().signal,
    });
  }, document);

  const noOp = await page.evaluate(async doc => {
    const { fabricDiff } = await import('/js/features/canvas-editor/fabric-adapter.js');
    return fabricDiff(doc, doc.entrySceneId, globalThis.dropcapCanvas.getObjects());
  }, document);
  assert.deepEqual(noOp, []);

  async function clickLayer(id, doubleClick = false) {
    const point = await page.evaluate(id => {
      const canvas = globalThis.dropcapCanvas;
      const shape = canvas.getObjects().find(object => object.momeviaId === id);
      const box = shape.getBoundingRect();
      const rect = canvas.upperCanvasEl.getBoundingClientRect();
      return {
        x: rect.x + (box.left + box.width / 2) * rect.width / canvas.width,
        y: rect.y + (box.top + box.height / 2) * rect.height / canvas.height,
      };
    }, id);
    if (doubleClick) await page.mouse.dblclick(point.x, point.y, { delay: 80 });
    else await page.mouse.click(point.x, point.y);
  }

  async function model(id) {
    return page.evaluate(id => {
      const shape = globalThis.dropcapCanvas.getObjects().find(object => object.momeviaId === id);
      return { text: shape.text, props: shape.momeviaDropCapModel.props, left: shape.left, top: shape.top,
        width: shape.width, height: shape.height, enterEditing: typeof shape.enterEditing };
    }, id);
  }

  async function history(chord, expectedSize) {
    await page.locator('[data-editor-action="fabric-download"]').focus();
    await page.keyboard.press(chord);
    try {
      await page.waitForFunction(({ id, expectedSize }) => {
        const shape = globalThis.dropcapCanvas.getObjects().find(object => object.momeviaId === id);
        return shape?.momeviaDropCapModel.props.fontSize === expectedSize && typeof shape.enterEditing === 'function';
      }, { id: original.id, expectedSize }, { timeout: 5000 });
    } catch (cause) {
      const state = await page.evaluate(id => ({
        activeElement: document.activeElement?.tagName,
        help: document.querySelector('.fabric-help')?.textContent,
        shapes: globalThis.dropcapCanvas.getObjects().map(shape => ({
          id: shape.momeviaId, text: shape.text, model: shape.momeviaDropCapModel,
          enterEditing: typeof shape.enterEditing, selected: shape === globalThis.dropcapCanvas.getActiveObject(),
        })),
      }), original.id);
      throw new Error('History failed for ' + chord + ': ' + JSON.stringify({ expectedSize, state, errors }), { cause });
    }
  }

  await clickLayer(original.id);
  const toggle = page.locator('.fabric-properties__toggle');
  if (await toggle.isVisible()) await toggle.click();
  const size = page.locator('[data-fabric-style="fontSize"]');
  await size.fill('28');
  await size.dispatchEvent('change');
  await history('Control+z', original.props.fontSize);
  await history('Control+y', 28);
  const restored = await model(original.id);
  assert.equal(restored.enterEditing, 'function');

  const color = page.locator('[data-fabric-style="color"]');
  await color.fill('#8b2755');
  await color.dispatchEvent('change');
  assert.equal((await model(original.id)).props.color.toUpperCase(), '#8B2755');

  await page.locator('[data-editor-action="fabric-download"]').focus();
  await page.keyboard.press('Control+d');
  await page.waitForFunction(id => globalThis.dropcapCanvas.getObjects()
    .filter(object => object.momeviaType === 'text').some(object => object.momeviaId !== id), original.id, { timeout: 5000 });
  const copyId = await page.evaluate(id => globalThis.dropcapCanvas.getObjects()
    .find(object => object.momeviaType === 'text' && object.momeviaId !== id).momeviaId, original.id);
  const copied = await model(copyId);
  assert.equal(copied.enterEditing, 'function');
  assert.equal(copied.props.fontSize, 28);

  await clickLayer(copyId, true);
  assert.equal(await page.evaluate(() => globalThis.dropcapCanvas.getActiveObject()?.isEditing), true);
  const replacement = 'Ỡ ấm áp, bản sao gửi Nguyễn một lời chúc.'.normalize('NFD');
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText(replacement);
  await page.evaluate(() => globalThis.dropcapCanvas.getActiveObject().exitEditing());
  assert.equal((await model(copyId)).text, replacement);
  assert.equal((await model(original.id)).text, original.props.text);
  assert.equal((await model(original.id)).props.fontSize, 28);

  if (evidence) {
    fs.mkdirSync(evidence, { recursive: true });
    await page.screenshot({ path: path.join(evidence, 'dropcap-history-clone.png') });
  }
  await page.locator('[data-editor-action="fabric-apply"]').click();
  const result = await page.evaluate(() => ({ patch: globalThis.dropcapPatch, textareas: document.querySelectorAll('textarea').length }));
  assert.equal(result.textareas, 0);
  assert.equal(result.patch.layouts.find(layout => layout.id === copyId).text, replacement);
  assert(!result.patch.layouts.some(layout => layout.id === original.id && layout.text !== undefined));
  assert(result.patch.commands.some(command => command.type === 'clone' && command.sourceId === original.id && command.id === copyId));
  assert.deepEqual(errors, []);
  if (evidence) fs.writeFileSync(path.join(evidence, 'dropcap-history-clone.json'), JSON.stringify({ noOp, restored, copied, result, errors }, null, 2));
  console.log('PASS drop cap native typing after style undo/redo, independent clone content and Apply cleanup.');
} finally {
  await browser.close();
}
