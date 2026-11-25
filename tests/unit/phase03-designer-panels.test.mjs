import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, createElement } from '../../web/js/shared/canvas/index.js';
import { motionRow } from '../../web/js/shared/canvas/motion-stack.js';
import { createInspectorPanel } from '../../web/js/features/canvas-editor/inspector-panel.js';
import { createAssetPanel } from '../../web/js/features/canvas-editor/asset-panel.js';

// DOM tối giản: kiểm tra control thật do panel tạo, không mô phỏng nghiệp vụ backend.
class MockNode {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.style = { setProperty(key, value) { this[key] = value; } };
    this.className = '';
    this.classList = { add: (...names) => { this.className += ` ${names.join(' ')}`; } };
    this.disabled = false;
    this.renders = 0;
  }
  append(...items) { this.children.push(...items); }
  prepend(...items) { this.children.unshift(...items); }
  replaceChildren(...items) { this.children = items; this.renders++; }
  insertBefore(item, before) { this.children.splice(before ? this.children.indexOf(before) : this.children.length, 0, item); }
  setAttribute(key, value) {
    this.attributes[key] = String(value);
    if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())] = String(value);
    if (key === 'open') this.open = true;
  }
  removeAttribute(key) { delete this.attributes[key]; }
  contains(item) { return item === this || this.children.some(child => child instanceof MockNode && child.contains(item)); }
  querySelectorAll(selector) {
    const matches = item => selector.split(', ').some(part => {
      if (part.startsWith('.')) return item.className.split(' ').includes(part.slice(1));
      const attr = /^\[([^=\]]+)(?:=['"]([^'"]+)['"])?\]$/.exec(part);
      return attr && Object.hasOwn(item.attributes, attr[1]) && (attr[2] === undefined || item.attributes[attr[1]] === attr[2]);
    });
    const children = this.children.filter(item => item instanceof MockNode);
    return children.flatMap(item => [...(matches(item) ? [item] : []), ...item.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  focus() { globalThis.document.activeElement = this; }
}
const previousDocument = globalThis.document;
const previousCss = globalThis.CSS;
globalThis.document = { activeElement: null, createElement: tag => new MockNode(tag), createTextNode: () => new MockNode('#text') };
globalThis.CSS = { escape: value => value };
test.after(() => {
  if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  if (previousCss === undefined) delete globalThis.CSS; else globalThis.CSS = previousCss;
});

function fixture() {
  const host = new MockNode('section');
  const assets = new MockNode('section');
  const main = { querySelector: selector => selector === '.editor-inspector' ? host : selector === '.editor-assets' ? assets : host.querySelector(selector) };
  const state = { doc: createDocument(), policy: null, selected: null, quick: false, composing: false, clipboard: null };
  const panel = createInspectorPanel({
    main, getStore: () => ({ get: () => ({ document: state.doc }) }), getDesign: () => ({ policy: state.policy }),
    getStage: () => null, getClipboard: () => state.clipboard, isQuickMode: () => state.quick, isComposing: () => state.composing,
    selected: () => state.selected, selectedIds: () => state.selected ? [state.selected.id] : [], currentScene: () => state.doc.scenes[0],
    textOptions: () => null, isLegacyFrame: () => false, assetUrl: () => null,
    commit: () => assert.fail('Render không được ghi document'), safe: fn => fn,
  });
  const assetPanel = createAssetPanel({ main, getDocument: () => state.doc, getPolicy: () => state.policy,
    getSelection: () => state.selected?.id, isQuickMode: () => state.quick, assetUrl: () => null });
  return { host, assets, state, ...panel, ...assetPanel };
}
const field = (host, key) => host.querySelector(`[data-editor-field="${key}"]`);
const action = (host, key) => host.querySelector(`[data-editor-action="${key}"]`);

test('Inspector không đọc store khi host chưa có, đang nhập IME hoặc Quick Mode', () => {
  let mode = 'absent';
  const host = new MockNode('section');
  host.append('old');
  const panel = createInspectorPanel({ main: { querySelector: () => mode === 'absent' ? null : host },
    isComposing: () => mode === 'ime', isQuickMode: () => mode === 'quick', getStore: () => assert.fail('Đọc store quá sớm') });
  panel.renderInspector();
  mode = 'ime'; panel.renderInspector(); assert.equal(host.children.length, 1);
  mode = 'quick'; panel.renderInspector(); assert.equal(host.children.length, 0);
});

test('Scene Inspector giữ disclosure và focus khi tải document mới', () => {
  const { state, host, renderInspector } = fixture();
  renderInspector();
  const sceneName = field(host, 'scene.name');
  sceneName.focus(); host.querySelector('.editor-effects-disclosure').open = true;
  state.doc = createDocument(); state.doc.scenes[0].name = 'New scene';
  const original = structuredClone(state.doc);
  renderInspector();
  assert.equal(field(host, 'scene.name').value, 'New scene');
  assert.equal(globalThis.document.activeElement, field(host, 'scene.name'));
  assert.equal(host.querySelector('.editor-effects-disclosure').open, true);
  assert.deepEqual(state.doc, original);
});

test('Inspector đọc selection, clipboard và quyền mới mỗi lần render', () => {
  const { state, host, renderInspector } = fixture();
  state.selected = createElement('text', { id: 'text-a' }); state.doc.elements.push(state.selected);
  renderInspector();
  assert.equal(action(host, 'element-copy').disabled, false);
  assert.equal(action(host, 'element-paste').disabled, true);
  state.clipboard = { models: [state.selected] }; renderInspector();
  assert.equal(action(host, 'element-paste').disabled, false);
  state.policy = { kind: 'creator-template', lockedElements: { 'text-a': { editableProps: ['color'] } } };
  renderInspector();
  assert.equal(field(host, 'props.color').disabled, false);
  assert.equal(field(host, 'props.fontSize').disabled, true);
  assert.equal(action(host, 'close-sheet').disabled, false);
  assert.equal(action(host, 'element-copy'), null);
});

test('Inspector cảnh Creator không mở khóa hiệu ứng hoặc nội dung cảnh', () => {
  const { state, host, renderInspector } = fixture();
  state.policy = { kind: 'creator-template' };
  renderInspector();
  assert.ok(host.querySelectorAll('[data-editor-field]').length > 0);
  assert.ok(host.querySelectorAll('[data-editor-field]').every(control => control.disabled));
  assert.equal(action(host, 'close-sheet').disabled, false);
});

test('Asset Panel giữ cache DOM, cập nhật theo document và xóa cache ở Quick Mode', () => {
  const { assets, state, renderAssets } = fixture();
  renderAssets(); assert.equal(assets.renders, 1);
  renderAssets(); assert.equal(assets.renders, 1);
  state.doc = createDocument(); state.doc.assets = [{ assetId: 'asset-a' }];
  renderAssets(); assert.equal(assets.renders, 2);
  assert.equal(action(assets, 'reuse-asset').dataset.id, 'asset-a');
  assert.equal(action(assets, 'reuse-asset').disabled, false);
  state.policy = { kind: 'creator-template', lockedElements: {} }; renderAssets();
  assert.equal(action(assets, 'reuse-asset').disabled, true);
  state.selected = { id: 'frame-a' }; state.policy.lockedElements['frame-a'] = { editableProps: ['assetId'] };
  renderAssets(); assert.equal(action(assets, 'reuse-asset').disabled, false);
  state.quick = true; renderAssets(); assert.equal(assets.children.length, 0); assert.equal(assets.dataset.assetIds, undefined);
  state.quick = false; renderAssets(); assert.ok(action(assets, 'reuse-asset'));
});

test('Inspector giữ hình học và điều khiển Motion Stack của đối tượng đang chọn', () => {
  const { state, host, renderInspector } = fixture();
  state.selected = createElement('shape', { id: 'shape-a', motions: { version: 1, enabled: true, rows: [motionRow('pulse', 'row-a')] } });
  state.doc.elements.push(state.selected);
  renderInspector();
  assert.ok(field(host, 'motion.row-a.periodMs'));
  assert.ok(action(host, 'motion-add'));
  host.querySelector('.editor-geometry').open = true;
  renderInspector();
  assert.equal(host.querySelector('.editor-geometry').open, true);
  state.selected = createElement('text', { id: 'text-b' }); state.doc.elements.push(state.selected);
  renderInspector();
  assert.equal(Boolean(host.querySelector('.editor-geometry').open), false);
  assert.equal(action(host, 'motion-add'), null);
});
