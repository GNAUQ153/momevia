import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, createElement } from '../../web/js/shared/canvas/index.js';
import { createEditorStore } from '../../web/js/features/canvas-editor/store.js';
import { createKeyboardHandler } from '../../web/js/features/canvas-editor/keyboard-handler.js';
import { createClipboardActions, isClipboardAction } from '../../web/js/features/canvas-editor/clipboard-actions.js';
import { activeSelectionIds, editableSceneIds, toggleSelection, restoredSelectionIds } from '../../web/js/features/canvas-editor/selection.js';

function sample() {
  const doc = createDocument();
  doc.elements = [createElement('text', { id: 'a' }), createElement('text', { id: 'b' }), createElement('text', { id: 'c' })];
  doc.elements[1].locked = true;
  doc.elements[2].visible = false;
  doc.scenes[0].elementIds = ['a', 'b', 'c'];
  return doc;
}
function fixture() {
  const document = sample();
  const store = createEditorStore({ title: 'Test', document });
  const calls = [];
  const state = { store, design: { id: 'design-1', policy: {} }, sceneId: document.entrySceneId,
    selection: 'a', ids: ['a'], quickMode: false, composing: false, disposed: false, sheet: null, dialog: false };
  const context = () => state;
  const selected = () => store.get().document.elements.find(item => item.id === state.selection);
  const currentScene = () => store.get().document.scenes[0];
  const choose = id => { state.selection = id; state.ids = id ? [id] : []; calls.push(['choose', id]); };
  const selectRestored = ids => { state.ids = ids; state.selection = ids.at(-1); calls.push(['restored', ids]); };
  const commit = (mutate, label) => { calls.push(['commit', label]); store.update(mutate, label); };
  const renderInspector = () => calls.push(['render']);
  state.stage = { gestureActive: false, flushText: () => calls.push(['flush']), cancel: () => calls.push(['cancel']) };
  const handle = createKeyboardHandler({ main: { querySelector: () => null },
    document: { querySelector: () => state.dialog ? {} : null }, getContext: context,
    getSelection: () => state.selection, selected, selectedIds: () => state.ids, currentScene,
    choose, selectAll: () => calls.push(['selectAll']), selectRestored,
    action: (name, target) => calls.push(['action', name, target.dataset?.pasteInPlace]),
    closeSheet: () => calls.push(['closeSheet']), flushSave: options => calls.push(['save', options]),
    commit, renderInspector });
  let count = 0;
  const clipboard = createClipboardActions({ getContext: context, selectedIds: () => state.ids, choose,
    selectRestored, commit, renderInspector, clearSelection: () => choose(null), newId: () => `copy-${++count}` });
  return { store, state, calls, handle, clipboard };
}
function key(key, extra = {}) {
  return { key, prevented: false, target: { closest: () => null }, preventDefault() { this.prevented = true; }, ...extra };
}

test('Selection lọc đối tượng theo cảnh, bỏ ID trùng và ID đã xóa', () => {
  const doc = sample();
  assert.deepEqual(activeSelectionIds(doc, doc.entrySceneId, new Set(['b', 'missing']), 'a'), ['b', 'a']);
  assert.deepEqual(activeSelectionIds(undefined, null, new Set(['a']), 'a'), []);
  assert.deepEqual(editableSceneIds(doc, doc.scenes[0], {}), ['a']);
  assert.deepEqual(editableSceneIds(doc, doc.scenes[0], { kind: 'creator-template' }), []);
  assert.deepEqual(restoredSelectionIds(doc, doc.scenes[0], new Set(['a', 'c'])), ['b']);
  const original = new Set(['a']);
  const result = toggleSelection(original, 'b', true);
  assert.deepEqual([...result.selectedSet], ['a', 'b']);
  assert.equal(result.selection, 'b');
  assert.deepEqual([...original], ['a']);
  assert.equal(toggleSelection(result.selectedSet, 'b', true).selection, 'a');
  assert.equal(toggleSelection(original, null).selectedSet.size, 0);
});

test('Phím layer bị khóa không được rơi xuống thao tác xóa', () => {
  const f = fixture();
  f.state.selection = 'b'; f.state.ids = ['a', 'b'];
  for (const bracket of ['[', ']']) {
    const event = key(bracket, { ctrlKey: true });
    f.handle(event);
    assert.equal(event.prevented, true);
  }
  assert.deepEqual(f.calls, []);
  f.state.selection = 'a';
  f.handle(key(']', { metaKey: true }));
  assert.deepEqual(f.calls, [['action', 'layer-up', undefined]]);
});

test('Phím tắt tôn trọng input, IME, dialog, sheet, Quick Mode và vòng đời', () => {
  const f = fixture();
  const scenarios = [{ composing: true }, { disposed: true }, { dialog: true }, { sheet: {} }, { quickMode: true }, { stage: null }];
  for (const override of scenarios) {
    const before = { ...f.state };
    Object.assign(f.state, override);
    const event = key('Delete'); f.handle(event);
    assert.equal(event.prevented, false);
    Object.assign(f.state, before);
  }
  const typing = key('Delete', { target: { closest: selector => selector.startsWith('input') ? {} : null } });
  f.handle(typing); f.handle(key('Delete', { isComposing: true }));
  assert.deepEqual(f.calls, []);
  f.handle(key('Delete'));
  assert.deepEqual(f.calls, [['action', 'element-delete', undefined]]);
});

test('Escape ưu tiên sheet hoặc gesture, không xóa selection sau dialog', () => {
  const f = fixture();
  f.state.dialog = true; f.handle(key('Escape')); assert.deepEqual(f.calls, []);
  f.state.dialog = false; f.state.sheet = {}; f.handle(key('Escape'));
  f.state.sheet = null; f.state.stage.gestureActive = true; f.handle(key('Escape'));
  f.state.stage.gestureActive = false; f.handle(key('Escape'));
  assert.deepEqual(f.calls, [['closeSheet'], ['cancel'], ['choose', null]]);
});

test('Ctrl/Cmd+S flush nội dung, Paste in place và Select All giữ hợp đồng action', () => {
  const f = fixture(); f.state.design.reviewTemplateDefaults = true;
  f.handle(key('s', { ctrlKey: true }));
  f.handle(key('v', { metaKey: true, shiftKey: true }));
  f.handle(key('a', { ctrlKey: true }));
  assert.deepEqual(f.calls, [['flush'], ['save', { force: true }], ['action', 'element-paste', 'true'], ['selectAll']]);
});

test('Phím mũi tên chỉ di chuyển layer hợp lệ và vẫn dùng Undo/Redo của Store', () => {
  const f = fixture(); f.state.ids = ['a', 'b'];
  const before = f.store.get().document.elements.map(e => e.layout.x);
  f.handle(key('ArrowRight', { shiftKey: true }));
  assert.deepEqual(f.store.get().document.elements.map(e => e.layout.x), [before[0] + 10, before[1], before[2]]);
  f.handle(key('z', { ctrlKey: true }));
  assert.deepEqual(f.store.get().document.elements.map(e => e.layout.x), before);
  f.handle(key('z', { metaKey: true, shiftKey: true }));
  assert.equal(f.store.get().document.elements[0].layout.x, before[0] + 10);
});

test('Undo khôi phục selection của đối tượng được phục hồi trong cảnh hiện hành', () => {
  const f = fixture();
  f.store.update(value => { value.document.elements.shift(); value.document.scenes[0].elementIds.shift(); });
  f.state.selection = null;
  f.handle(key('z', { ctrlKey: true }));
  assert.deepEqual(f.state.ids, ['a']);
  assert.deepEqual(f.calls, [['restored', ['a']]]);
});

test('Clipboard giữ scope bản nháp, khóa layer, offset, Undo và không chia sẻ giữa editor', () => {
  const f = fixture(); f.state.ids = ['a', 'b'];
  assert.equal(isClipboardAction('constructor'), false);
  f.clipboard.handle('element-copy', {});
  assert.deepEqual(f.clipboard.getClipboard().models.map(e => e.id), ['a']);
  const x = f.store.get().document.elements[0].layout.x;
  f.clipboard.handle('element-paste', { dataset: { pasteInPlace: 'true' } });
  assert.equal(f.store.get().document.elements.at(-1).layout.x, x);
  f.clipboard.handle('element-paste', {});
  assert.equal(f.store.get().document.elements.at(-1).layout.x, x + 16);
  const size = f.store.get().document.elements.length;
  f.state.design.id = 'other'; f.clipboard.handle('element-paste', {});
  assert.equal(f.store.get().document.elements.length, size);
  f.store.undo(); assert.equal(f.store.get().document.elements.length, size - 1);
  assert.equal(fixture().clipboard.getClipboard(), null);
});

test('Clipboard đọc policy và mode hiện hành, Cut chỉ xóa layer được phép', () => {
  const f = fixture(); f.state.ids = ['a', 'b']; f.state.quickMode = true;
  f.clipboard.handle('element-cut', {}); assert.equal(f.clipboard.getClipboard(), null);
  f.state.quickMode = false; f.state.design.policy = { kind: 'creator-template' };
  f.clipboard.handle('element-cut', {}); assert.equal(f.clipboard.getClipboard(), null);
  f.state.design.policy = {}; f.clipboard.handle('element-cut', {});
  assert.deepEqual(f.store.get().document.elements.map(e => e.id), ['b', 'c']);
  assert.deepEqual(f.clipboard.getClipboard().models.map(e => e.id), ['a']);
  f.store.undo(); assert.deepEqual(f.store.get().document.elements.map(e => e.id), ['a', 'b', 'c']);
});
