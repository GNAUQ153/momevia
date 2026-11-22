import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  auditCssStyle,
  auditMonitoredCss,
  monitoredStylesheets,
} from '../../scripts/quality/check-css-style.mjs';

const project = fileURLToPath(new URL('../../', import.meta.url));

test('Chín stylesheet trọng điểm không còn khai báo dồn dòng hoặc duplicate property', () => {
  const results = auditMonitoredCss(project);
  assert.equal(results.length, monitoredStylesheets.length);
  assert.ok(results.length >= 9);
  assert.deepEqual(results.flatMap(result => result.errors), []);
  assert.ok(results.reduce((count, result) => count + result.declarationCount, 0) > 2200);
  assert.ok(monitoredStylesheets.includes('gift-runtime.css'));
  assert.ok(monitoredStylesheets.includes('auth-pages.css'));
  assert.ok(monitoredStylesheets.includes('ui-polish.css'));
});

test('Bộ kiểm tra phát hiện CSS viết dồn dòng và trùng thuộc tính cùng rule', () => {
  const css = '.sample { color: red; color: blue; padding: 10px; }';
  const { errors } = auditCssStyle(css, 'fixture.css');
  assert.ok(errors.some(error => error.includes('trùng trong cùng rule')));
  assert.ok(errors.some(error => error.includes('khai báo CSS trên một dòng')));
  assert.ok(errors.some(error => error.includes('chung một dòng')));
});

test('Không báo trùng selector có chủ ý tại các breakpoint khác nhau', () => {
  const css = [
    '.sample {',
    '  color: red;',
    '}',
    '@media (max-width: 600px) {',
    '  .sample {',
    '    color: blue;',
    '  }',
    '}',
  ].join('\n');
  assert.deepEqual(auditCssStyle(css).errors, []);
});

test('Không đọc dấu chấm phẩy trong chuỗi, URL hoặc comment như khai báo mới', () => {
  const css = [
    '/* content: red; background: green; */',
    '.icon {',
    '  content: "hello; { world }";',
    '  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E");',
    '}',
  ].join('\n');
  assert.deepEqual(auditCssStyle(css).errors, []);
});

test('Không bỏ qua dấu ngoặc CSS không cân bằng', () => {
  const { errors } = auditCssStyle('.sample {\n  display: flex;\n');
  assert.ok(errors.some(error => error.includes('chưa đóng')));
});

test('Thiết kế mobile tăng độ đọc của nút, trạng thái và dành khoảng an toàn khi cuộn', () => {
  const styles = name => readFileSync(new URL(`../../web/css/${name}`, import.meta.url), 'utf8');
  assert.match(styles('template-library.css'), /\.template-preview-toolbar \.btn\s*\{[^}]*min-height: 44px;/);
  assert.match(styles('template-library.css'), /\.template-preview-toolbar \.btn\s*\{\s*flex: 1 1 104px;\s*font-size: 0\.875rem;/);
  assert.match(styles('admin-library.css'), /\.library-admin__badge\s*\{[^}]*font-size: 0\.8125rem;/);
  assert.match(styles('admin-library.css'), /\.library-admin__save-bar\s*\{\s*bottom: 5px;\s*padding-bottom: max\(8px, env\(safe-area-inset-bottom\)\);/);
  assert.match(styles('editor-recovery-center.css'), /\.recovery-center__button\s*\{\s*min-height: 44px;/);
  assert.match(styles('editor-conflict-review.css'), /\.conflict-review__row-status\s*\{[^}]*font-size: 0\.875rem;/);
});

test('Quality check chạy cùng npm run check để ngăn hồi quy CSS', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.match(pkg.scripts.check, /check-css-style\.mjs/);
});
