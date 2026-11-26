import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nextSheetFocus, sheetFocusables } from '../../web/js/features/canvas-editor/mobile-sheet.js';
import { auditCssStyle } from '../../scripts/quality/check-css-style.mjs';

const source = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

function control({ disabled = false, hidden = false, inert = false, ignored = false, rect = true, tabIndex = 0 } = {}) {
  return {
    disabled,
    tabIndex,
    closest: () => hidden || inert || ignored ? {} : null,
    getClientRects: () => rect ? [{}] : [],
  };
}

function panel(children = []) {
  return {
    querySelectorAll: selector => {
      assert.match(selector, /button/);
      assert.match(selector, /a\[href\]/);
      return children;
    },
    contains: value => children.includes(value),
  };
}

test('Chỉ control có thể thao tác và thấy được nằm trong vòng focus', () => {
  const first = control();
  const last = control();
  const target = panel([
    control({ disabled: true }),
    control({ hidden: true }),
    control({ ignored: true }),
    control({ inert: true }),
    control({ rect: false }),
    control({ tabIndex: -1 }),
    first,
    last,
  ]);
  assert.deepEqual(sheetFocusables(target), [first, last]);
});

test('Tab tại control cuối quay lại control đầu, Shift+Tab thực hiện chiều ngược lại', () => {
  const first = control();
  const middle = control();
  const last = control();
  const target = panel([first, middle, last]);
  assert.equal(nextSheetFocus(target, last), first);
  assert.equal(nextSheetFocus(target, first, true), last);
  assert.equal(nextSheetFocus(target, middle), null);
  assert.equal(nextSheetFocus(target, middle, true), null);
});

test('Focus đang ở container hoặc bên ngoài được đưa về control hợp lệ trong sheet', () => {
  const first = control();
  const last = control();
  const target = panel([first, last]);
  assert.equal(nextSheetFocus(target, target), first);
  assert.equal(nextSheetFocus(target, target, true), last);
  assert.equal(nextSheetFocus(target, control()), first);
  assert.equal(nextSheetFocus(target, control(), true), last);
});

test('Nếu không có nút focusable thì giữ focus ở panel; chấp nhận panel rỗng', () => {
  const empty = panel([control({ disabled: true })]);
  assert.equal(nextSheetFocus(empty, empty), empty);
  assert.deepEqual(sheetFocusables(null), []);
  assert.equal(nextSheetFocus(null, null), null);
});

test('Designer có backdrop click-close nhưng không cho vào tab order hoặc aria tree', () => {
  const designer = source('web/js/pages/designer.js');
  assert.match(designer, /button\("", "close-sheet", \{\s*class: "editor-sheet-backdrop",\s*hidden: true,\s*tabindex: -1,\s*"aria-hidden": "true"/s);
  assert.match(designer, /if \(backdrop\) backdrop\.hidden = false/);
  assert.match(designer, /if \(backdrop\) backdrop\.hidden = true/);
  assert.match(designer, /peer !== panel && peer !== backdrop && !peer\.inert/);
  assert.match(designer, /if \(name === "close-sheet"\) \{\s*closeSheet\(\)/);
});

test('Mở sheet tập trung nút đóng và trả focus về trigger sau Escape/close', () => {
  const designer = source('web/js/pages/designer.js');
  assert.match(designer, /const closeControl = target\.querySelector\('\[data-editor-action="close-sheet"\]'\)/);
  assert.match(designer, /closeControl\?\.getClientRects\(\)\.length \? closeControl : target\)\.focus\(\{ preventScroll: true \}\)/);
  assert.match(designer, /if \(restoreFocus\) \{\s*const candidate = previous/);
  assert.match(designer, /candidate\.focus\(\{ preventScroll: true \}\)/);
  const keyboard = source('web/js/features/canvas-editor/keyboard-handler.js');
  assert.match(keyboard, /if \(sheet\) \{\s*event\.preventDefault\(\);\s*closeSheet\(\);\s*return;/);
});

test('Sheet chặn shortcut thao tác với Canvas phía sau, đồng thời khóa Tab', () => {
  const designer = source('web/js/pages/designer.js');
  const keyboard = source('web/js/features/canvas-editor/keyboard-handler.js');
  assert.match(keyboard, /nextSheetFocus\(sheet\.target, document\.activeElement, event\.shiftKey\)/);
  const gate=keyboard.indexOf('if (sheet) return;'),typing=keyboard.indexOf('if (stopKeys(event.target)',gate),commands=keyboard.indexOf('const chord = event.ctrlKey',gate);
  assert(gate>=0&&typing>gate&&commands>typing,'object shortcuts must remain behind both sheet and typing guards');
  assert.match(designer, /closeSheet\(false\);/);
  assert.match(designer, /if \(!mobile\.matches\) closeSheet\(\);/);
});

test('Backdrop đúng z-index và mobile-only, CSS một thuộc tính mỗi dòng', () => {
  const css = source('web/css/editor-experience.css');
  assert.match(css, /@media \(max-width: 800px\)/);
  const block = css.match(/\.editor-workspace button\.editor-sheet-backdrop \{([^}]+)\}/)?.[1] ?? '';
  assert.match(block, /position: fixed;/);
  assert.match(block, /z-index: 35;/);
  assert.match(block, /background: rgb\(25 14 44 \/ 48%\);/);
  assert.match(css, /\.editor-workspace button\.editor-sheet-backdrop\[hidden\] \{\s*display: none;/);
  assert.match(css, /\.editor-workspace \.editor-sheet-open \{\s*overscroll-behavior: contain;/);
  assert.deepEqual(auditCssStyle(css, 'editor-experience.css').errors, []);
});

test('Thay đổi không thêm API hay động chạm JSON, chỉ bảo vệ trải nghiệm Canvas', () => {
  const module = source('web/js/features/canvas-editor/mobile-sheet.js');
  assert.doesNotMatch(module, /fetch\(|localStorage|sessionStorage|JSON\.stringify|\.request\(/);
  assert.doesNotMatch(module, /window|document/);
});


test('Browser regression kiểm tra backdrop, focus và nhấn nền để đóng sheet', () => {
  const browser = source('tests/browser/canvas.mjs');
  assert.match(browser, /const backdrop = page\.locator\('\.editor-sheet-backdrop'\)/);
  assert.match(browser, /opened\.evaluate\(node => node\.contains\(node\.ownerDocument\.activeElement\)\)/);
  assert.match(browser, /page\.keyboard\.press\('Shift\+Tab'\)/);
  assert.match(browser, /backdrop\.click\(\{ position: \{ x: 15, y: 15 \} \}\)/);
  assert.match(browser, /backdrop\.isHidden\(\)/);
});
