import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { trapDialog } from '../../web/js/features/canvas-editor/dom.js';
import { openCanvasPreview } from '../../web/js/features/canvas-editor/preview-dialog.js';
import { openGiftAccessDialog } from '../../web/js/features/canvas-editor/gift-access-dialog.js';
import { openSoundEditor } from '../../web/js/features/canvas-editor/sound-editor.js';
import { createStage } from '../../web/js/features/canvas-editor/stage.js';
import { createDocument, createElement } from '../../web/js/shared/canvas/index.js';

// DOM fixture nhỏ: kiểm tra listener, đóng dialog và quyền sở hữu Stage thật.
class Element extends EventTarget {
  constructor(tag) {
    super();
    this.tag = tag;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.style = {};
    this.open = false;
    this.isConnected = true;
    this.focusCount = 0;
    this.capture = null;
    this.content = { firstElementChild: {} };
  }
  append(...items) {
    for (const item of items) if (item instanceof Element) item.parent = this;
    this.children.push(...items);
  }
  prepend(item) { this.children.unshift(item); }
  replaceChildren(...items) { for (const item of [...this.children]) item.remove?.(); this.children = []; this.append(...items); }
  remove() { this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(item => item !== this); }
  setAttribute(key, value) { this.attributes[key] = String(value); if (key === 'data-editor-field') this.dataset.editorField = value; }
  removeAttribute(key) { delete this.attributes[key]; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  focus() { this.focusCount++; }
  querySelectorAll(selector) {
    const matches = item => selector === 'select' ? item.tag === 'select' : selector === 'button[type="button"]' && item.tag === 'button' && item.attributes.type === 'button';
    return this.children.filter(item => item instanceof Element).flatMap(item => [...(matches(item) ? [item] : []), ...item.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 300, height: 400 }; }
  setPointerCapture(id) { this.capture = id; }
  hasPointerCapture(id) { return this.capture === id; }
  releasePointerCapture() { this.capture = null; }
}
function fixture(t) {
  const old = new Map();
  const set = (key, value) => { if (!old.has(key)) old.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); };
  const document = new EventTarget();
  document.createElement = tag => new Element(tag);
  document.createTextNode = () => new Element('#text');
  document.body = new Element('body');
  document.activeElement = new Element('button');
  document.hidden = false;
  const preference = new EventTarget();
  preference.matches = true;
  set('document', document); set('window', new EventTarget()); set('matchMedia', () => preference);
  set('CSS', { escape: value => value });
  t.after(() => { for (const [key, descriptor] of old) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
  return { document, set };
}

test('Dialog đóng nhiều lần không giữ listener hoặc gọi callback trùng', t => {
  const { document } = fixture(t);
  const parent = new AbortController();
  let calls = 0;
  for (let i = 0; i < 20; i++) {
    const lifetime = new AbortController(), dialog = new Element('dialog');
    document.body.append(dialog);
    const close = trapDialog(dialog, () => calls++, { signal: parent.signal, lifetime });
    assert.equal(getEventListeners(parent.signal, 'abort').length, 1);
    close(); close(); dialog.dispatchEvent(new Event('close'));
    assert.equal(lifetime.signal.aborted, true);
    assert.equal(getEventListeners(parent.signal, 'abort').length, 0);
    assert.equal(getEventListeners(dialog, 'cancel').length, 0);
    assert.equal(dialog.isConnected, false);
  }
  assert.equal(calls, 20);
  assert.equal(document.body.children.length, 0);
  assert.equal(document.activeElement.focusCount, 20);
});

test('Đóng native và cancel đều giải phóng vòng đời riêng', t => {
  const { document } = fixture(t);
  for (const event of ['close', 'cancel']) {
    const parent = new AbortController(), lifetime = new AbortController(), dialog = new Element('dialog');
    let calls = 0;
    document.body.append(dialog);
    trapDialog(dialog, () => calls++, { signal: parent.signal, lifetime });
    if (event === 'close') dialog.close();
    dialog.dispatchEvent(new Event(event, { cancelable: true }));
    assert.equal(calls, 1);
    assert.equal(dialog.isConnected, false);
    assert.equal(lifetime.signal.aborted, true);
    assert.equal(getEventListeners(parent.signal, 'abort').length, 0);
  }
});

test('Hủy route đóng dialog mà không focus vào trang cũ', t => {
  const { document } = fixture(t);
  const parent = new AbortController(), lifetime = new AbortController(), dialog = new Element('dialog');
  let calls = 0;
  trapDialog(dialog, () => calls++, { signal: parent.signal, lifetime });
  parent.abort();
  assert.equal(calls, 1);
  assert.equal(document.activeElement.focusCount, 0);
  assert.equal(lifetime.signal.aborted, true);
  assert.equal(dialog.open, false);
});

test('Route đã đóng không tạo Preview, Gift Access hoặc Sound Editor', async () => {
  const parent = new AbortController(); parent.abort();
  assert.doesNotThrow(() => openCanvasPreview({ signal: parent.signal })());
  assert.equal(await openGiftAccessDialog({ signal: parent.signal }), null);
  assert.equal(await openSoundEditor({ signal: parent.signal }), undefined);
});

test('Gift Access resolve null khi rời route và không giữ dialog cũ', async t => {
  const { document } = fixture(t);
  const parent = new AbortController(), dialogs = new Set();
  const pending = openGiftAccessDialog({ message: key => key, signal: parent.signal, dialogs });
  assert.equal(dialogs.size, 1);
  parent.abort();
  assert.equal(await pending, null);
  assert.equal(dialogs.size, 0);
  assert.equal(document.body.children.length, 0);
});

test('Sound Editor hủy fetch danh mục khi route đóng', async t => {
  const { document, set } = fixture(t);
  const parent = new AbortController();
  let fetchSignal, calls = 0;
  set('fetch', (_url, options) => {
    fetchSignal = options.signal;
    return new Promise((resolve, reject) => fetchSignal.addEventListener('abort', () => reject(fetchSignal.reason), { once: true }));
  });
  const pending = openSoundEditor({ signal: parent.signal, onClose: () => calls++ });
  assert.equal(fetchSignal.aborted, false);
  parent.abort();
  assert.equal(await pending, undefined);
  assert.equal(fetchSignal.aborted, true);
  assert.equal(document.body.children.length, 0);
  assert.equal(calls, 1);
});

test('Stage hủy frame và pointer capture, không xóa Stage mới trong host', t => {
  const { set } = fixture(t);
  const parent = new AbortController(), host = new Element('div');
  const document = createDocument(), model = createElement('text', { id: 'a' });
  document.elements = [model]; document.scenes[0].elementIds = ['a'];
  const calls = [], cancelled = [];
  set('requestAnimationFrame', () => 42); set('cancelAnimationFrame', id => cancelled.push(id));
  const options = { store: { get: () => ({ document }) }, getSceneId: () => document.entrySceneId,
    getSelection: () => 'a', select: () => {}, signal: parent.signal, onGesture: value => calls.push(value) };
  const stage = createStage(host, options);
  const surround = host.children[0], artboard = surround.children[0];
  const target = new Element('div'); target.dataset.elementId = 'a';
  target.closest = selector => selector === '[data-element-id]' ? target : null;
  target.getAnimations = () => [];
  artboard.querySelector = () => target;
  const pointer = type => {
    const event = new Event(type, { cancelable: true });
    Object.defineProperties(event, { target: { value: target }, button: { value: 0 }, pointerId: { value: 1 }, clientX: { value: 10 }, clientY: { value: 10 } });
    return event;
  };
  artboard.dispatchEvent(pointer('pointerdown'));
  artboard.dispatchEvent(pointer('pointermove'));
  assert.equal(stage.gestureActive, true);
  assert.equal(artboard.capture, 1);
  const next = createStage(host, { ...options, onGesture: () => {} });
  const nextRoot = host.children[0];
  stage.dispose(); stage.dispose();
  assert.deepEqual(cancelled, [42]);
  assert.deepEqual(calls, [true, false]);
  assert.equal(artboard.capture, null);
  assert.deepEqual(host.children, [nextRoot]);
  next.dispose();
  assert.equal(host.children.length, 0);
});
