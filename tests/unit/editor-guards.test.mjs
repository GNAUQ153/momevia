import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hasPendingEditorWork, historyShortcut } from '../../web/js/features/canvas-editor/editor-guards.js';

test('cảnh báo rời trang bao gồm cả Fabric, lưu/đăng, nhập IME và media', () => {
  assert.equal(hasPendingEditorWork(), false);
  for (const flag of ['sessionDirty', 'inlineFabricOpening', 'inlineFabricActive', 'assetPending',
    'gestureActive', 'textDirty', 'publishing', 'composing']) {
    assert.equal(hasPendingEditorWork({ [flag]: true }), true, flag);
  }
});

test('Ctrl/Cmd+Z, Shift+Z và Ctrl+Y xử lý thống nhất, không chặn Alt/composition', () => {
  const event = (key, extra = {}) => ({ key, ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, ...extra });
  assert.equal(historyShortcut(event('z')), 'undo');
  assert.equal(historyShortcut(event('Z', { shiftKey: true })), 'redo');
  assert.equal(historyShortcut(event('y')), 'redo');
  assert.equal(historyShortcut(event('z', { ctrlKey: false, metaKey: true })), 'undo');
  assert.equal(historyShortcut(event('z', { ctrlKey: false, metaKey: true, shiftKey: true })), 'redo');
  assert.equal(historyShortcut(event('z', { altKey: true })), null);
  assert.equal(historyShortcut(event('z', { isComposing: true })), null);
  assert.equal(historyShortcut(event('y', { shiftKey: true })), null);
  assert.equal(historyShortcut(event('z', { ctrlKey: false })), null);
  assert.equal(historyShortcut(event('s')), null);
});

test('Designer sử dụng cùng guard cho trước khi đóng tab và rời route', () => {
  const source = fs.readFileSync(new URL('../../web/js/pages/designer.js', import.meta.url), 'utf8');
  assert.match(source, /const beforeUnload = \(event\) => \{[\s\S]*?if \(hasUnsaved\(\)\)/);
  assert.match(source, /function beforeLeave\(\) \{[\s\S]*?!hasUnsaved\(\)/);
  assert.match(source, /function hasUnsaved\(\) \{[\s\S]*?hasPendingEditorWork/);
  const keyboard = fs.readFileSync(new URL('../../web/js/features/canvas-editor/keyboard-handler.js', import.meta.url), 'utf8');
  assert.match(source, /safe\(handleKey\), \{ signal \}/);
  assert.match(keyboard, /const historyAction = historyShortcut\(event\)/);
  assert.match(keyboard, /if \(stopKeys\(event.target\) \|\| document.querySelector\("dialog\[open\]"\)\)/);
});
