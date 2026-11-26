import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createModalIsolation, skipToMain } from '../../web/js/ui/accessibility.js';
import { createInertLock } from '../../web/js/ui/inert-lock.js';

const read = file => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
function fixture() {
  const calls = [];
  const main = { isConnected: true, inert: false, focus: options => calls.push(['focus', options]), scrollIntoView: options => calls.push(['scroll', options]) };
  const event = { button: 0, preventDefault: () => calls.push(['prevent']) };
  return { main, event, calls };
}

test('Skip link chuyển focus và cuộn tức thời, không điều hướng router', () => {
  const { event, main, calls } = fixture();
  assert.equal(skipToMain(event, main), true);
  assert.deepEqual(calls, [['prevent'], ['focus', { preventScroll: true }], ['scroll', { block: 'start', behavior: 'instant' }]]);
});

test('Skip link giữ hành vi gốc với phím bổ trợ hoặc đích không khả dụng', () => {
  const { event, main, calls } = fixture();
  for (const key of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey', 'defaultPrevented']) assert.equal(skipToMain({ ...event, [key]: true }, main), false);
  assert.equal(skipToMain({ ...event, button: 1 }, main), false);
  assert.equal(skipToMain(event, { ...main, inert: true }), false);
  assert.equal(skipToMain(event, { ...main, isConnected: false }), false);
  assert.equal(skipToMain(event, null), false);
  assert.deepEqual(calls, []);
});

test('Modal cô lập mọi vùng được cung cấp và khôi phục trạng thái inert ban đầu', () => {
  const regions = [{ inert: false }, { inert: true }, { inert: false }, null, { inert: false }];
  const modal = createModalIsolation(() => regions);
  modal.restore();
  modal.activate();
  assert(regions.filter(Boolean).every(node => node.inert));
  modal.activate();
  modal.restore();
  assert.deepEqual(regions.filter(Boolean).map(node => node.inert), [false, true, false, false]);
  modal.restore();
  modal.activate();
  modal.restore();
  assert.equal(regions[0].inert, false);
});

test('App shell tích hợp cô lập công cụ nổi, giữ live region và bỏ qua router cho skip link', () => {
  const js = read('web/js/app/main.js');
  assert.match(js, /createModalIsolation\(\(\) => \[main, header, footer,\s*document.querySelector\('\.site-tools'\), document.querySelector\('\[data-floating-cta\]'\)\]\)/);
  assert.match(js, /modalIsolation\.activate\(\);\s*focusDialog/);
  assert.match(js, /modalIsolation\.restore\(\);/);
  assert.match(js, /closest\('a\.skip-link\[href="#main"\]'\) && skipToMain\(event, main\)/);
  const html = read('web/index.html');
  assert.match(html, /<main id="main" tabindex="-1">/);
  assert.match(html, /id="toast-host" role="status" aria-live="polite"/);
  assert.match(html, /base\.css\?v=20261127-accessibility/);
});

test('Skip link ẩn khi không focus, giữ focus rõ và tắt cuộn mượt khi giảm chuyển động', () => {
  const css = read('web/css/base.css');
  assert.match(css, /\.skip-link:not\(:focus\) \{[^}]*clip-path: inset\(50%\);[^}]*pointer-events: none;/);
  assert.match(css, /\.skip-link:focus \{[^}]*outline: 2px solid var\(--color-focus\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*html \{\s*scroll-behavior: auto;/);
});


test('Ba chủ sở hữu độc lập giữ khóa đến lần nhả cuối và bảo toàn inert ban đầu', () => {
  for (const initial of [true, false]) {
    const node = { inert: initial };
    const a = createInertLock(node), b = createInertLock(node), c = createInertLock(node);
    a(false); a(true); a(true); b(true); c(true);
    b(false); b(false); a(false);
    assert.equal(node.inert, true);
    c(false);
    assert.equal(node.inert, initial);
  }
});
