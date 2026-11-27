import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditCssStyle } from '../../scripts/quality/check-css-style.mjs';

const read = name => readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
const css = read('web/css/auth-pages.css');
const rule = selector => {
  const start = css.indexOf(selector + ' {');
  assert.notEqual(start, -1, selector);
  return css.slice(start, css.indexOf('}', start));
};

test('Artwork xác thực nằm trong luồng bố cục, không che phần giới thiệu', () => {
  assert.match(rule('.auth-showcase__art'), /position: relative;/);
  assert.match(rule('.auth-showcase__art'), /perspective: 800px;/);
  assert.match(rule('.auth-showcase__story'), /margin-top: 0;/);
});

test('Chuyển động chỉ chạy một lần trên thiết bị có chuột và không ép reduced motion', () => {
  assert.doesNotMatch(css, /animation:[^;]*\binfinite\b/);
  assert.match(css, /@media \(min-width: 991px\) and \(hover: hover\) and \(pointer: fine\) and \(prefers-reduced-motion: no-preference\)/);
  assert.match(css, /animation: auth-float 700ms ease-out both;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.auth-showcase__art > img \{\s*animation: none;\s*transform: none;/);
});

test('Nút xác thực giữ vị trí khi hover và dùng gradient thương hiệu', () => {
  assert.match(rule('.auth-panel .auth-submit'), /background: var\(--auth-action\);/);
  assert.match(rule('.auth-page'), /--auth-action: var\(--color-gradient-action\);/);
  assert.doesNotMatch(rule('.auth-panel .auth-submit:hover:not(:disabled)'), /transform:/);
  assert.doesNotMatch(rule('.auth-showcase__explore:hover'), /transform:/);
});

test('Nội dung tự xuống dòng, focus input hiện rõ và CSS không viết dồn', () => {
  assert.doesNotMatch(css, /white-space: nowrap;/);
  assert.match(rule('.auth-page .auth-lead'), /overflow-wrap: anywhere;/);
  assert.match(rule('.auth-panel .auth-input input:focus-visible'), /outline: 2px solid var\(--auth-focus\);/);
  assert.deepEqual(auditCssStyle(css, 'auth-pages.css').errors, []);
});
