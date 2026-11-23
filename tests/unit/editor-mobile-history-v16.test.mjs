import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { syncHistoryControls } from '../../web/js/features/canvas-editor/history-controls.js';
import { auditCssStyle } from '../../scripts/quality/check-css-style.mjs';

const source = relative => readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');
const controls = count => Array.from({ length: count }, () => ({ disabled: false }));

function host(undo, redo) {
  return {
    querySelectorAll: selector => {
      assert.match(selector, /data-editor-action/);
      return selector.includes('undo') ? undo : redo;
    },
  };
}

test('Hai bộ nút Desktop và Mobile cùng tắt khi không còn lịch sử', () => {
  const undo = controls(2);
  const redo = controls(2);
  syncHistoryControls(host(undo, redo));
  assert.deepEqual(undo.map(control => control.disabled), [true, true]);
  assert.deepEqual(redo.map(control => control.disabled), [true, true]);
});

test('Undo bật, Redo tắt trong trạng thái đang có thay đổi', () => {
  const undo = controls(2);
  const redo = controls(2);
  syncHistoryControls(host(undo, redo), { canUndo: true, canRedo: false });
  assert.deepEqual(undo.map(control => control.disabled), [false, false]);
  assert.deepEqual(redo.map(control => control.disabled), [true, true]);
});

test('Undo/Redo độc lập, trở lại trạng thái mới sau hoàn tác/làm lại', () => {
  const undo = controls(2);
  const redo = controls(2);
  const root = host(undo, redo);
  syncHistoryControls(root, { canUndo: false, canRedo: true });
  assert(undo.every(control => control.disabled));
  assert(redo.every(control => !control.disabled));
  syncHistoryControls(root, { canUndo: true, canRedo: false });
  assert(undo.every(control => !control.disabled));
  assert(redo.every(control => control.disabled));
});

test('Không làm lỗi khi không có DOM hoặc control và không sửa dữ liệu thiệp', () => {
  assert.doesNotThrow(() => syncHistoryControls(null, { canUndo: true }));
  assert.doesNotThrow(() => syncHistoryControls(host([], [])));
  assert.doesNotMatch(source('web/js/features/canvas-editor/history-controls.js'), /fetch\(|localStorage|sessionStorage|\.replace\(|\.save\(/);
});

test('Designer render cả hai control bên cạnh Canvas và dùng helper trong render', () => {
  const designer = source('web/js/pages/designer.js');
  assert.match(designer, /class: "editor-mobile-history editor-layout-only", role: "group"/);
  assert.match(designer, /button\(message\("editor.mobileHistory.undo"\), "mobile-undo", \{ class: "editor-history-control", disabled: true \}\)/);
  assert.match(designer, /button\(message\("editor.mobileHistory.redo"\), "mobile-redo", \{ class: "editor-history-control", disabled: true \}\)/);
  assert.match(designer, /if \(name === "undo" \|\| name === "mobile-undo"\)/);
  assert.match(designer, /if \(name === "redo" \|\| name === "mobile-redo"\)/);
  assert.match(designer, /syncHistoryControls\(main, \{ canUndo: store.canUndo, canRedo: store.canRedo \}\)/);
  assert.ok(designer.indexOf('class: "editor-mobile-history') < designer.indexOf('class: "editor-stage-scroll"'));
  assert.equal((designer.match(/"undo", "undo"/g) || []).length, 1);
  assert.equal((designer.match(/"redo", "redo"/g) || []).length, 1);
});

test('Mobile 320–800px hiện hai nút >=44px; desktop/quick không trùng controls', () => {
  const css = source('web/css/editor-experience.css');
  assert.match(css, /\.editor-workspace \.editor-mobile-history \{\s*display: none;/);
  assert.match(css, /@media \(max-width: 800px\)/);
  assert.match(css, /\.editor-workspace:not\(\.is-quick\) \.editor-mobile-history \{[^}]*display: grid;/s);
  assert.match(css, /\.editor-workspace:not\(\.is-quick\) \.editor-top-actions \[data-editor-action="undo"\]/);
  assert.match(css, /\.editor-workspace \.editor-mobile-history \.editor-history-control \{[^}]*min-height: 48px;/s);
  assert.match(css, /\.editor-workspace \.editor-mobile-history \.editor-history-control:focus-visible/);
  assert.deepEqual(auditCssStyle(css, 'editor-experience.css').errors, []);
});

test('Browser regression bao gồm trạng thái và bố cục thanh lịch sử mobile', () => {
  const browser = source('tests/browser/canvas.mjs');
  assert.match(browser, /\.editor-mobile-history/);
  assert.match(browser, /historyControls/);
  assert.match(browser, /mobile Undo\/Redo/);
});

test('Mobile sử dụng nhãn đơn giản VI/EN, desktop vẫn giữ nhãn phím tắt', () => {
  const vi = JSON.parse(source('web/assets/locales/vi.json'));
  const en = JSON.parse(source('web/assets/locales/en.json'));
  assert.deepEqual(Object.keys(vi), Object.keys(en));
  for (const key of ['editor.mobileHistory.title', 'editor.mobileHistory.undo', 'editor.mobileHistory.redo']) {
    assert(vi[key] && en[key] && vi[key] !== en[key]);
  }
  assert.doesNotMatch(vi['editor.mobileHistory.undo'], /Ctrl/);
  assert.match(source('web/js/pages/designer.js'), /message\("editor.actions.undo"\), "undo", "undo"/);
});
