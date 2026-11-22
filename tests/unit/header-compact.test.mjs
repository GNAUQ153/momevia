import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = file => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const html = source('web/index.html');
const css = source('web/css/header-compact.css');
const shell = source('web/js/ui/layout.js');
const app = source('web/js/app/main.js');
const browserTest = source('tests/browser/home.mjs');

test('CSS menu laptop được nạp cuối, tránh đè quy tắc hiện tại', () => {
  const brand = html.indexOf('/css/brand-system.css');
  const compact = html.indexOf('/css/header-compact.css');
  assert(brand > 0 && compact > brand);
  assert.match(css, /min-width: 901px\) and \(max-width: 1150px/);
  assert.match(css, /\.site-header \.nav-links,/);
  assert.match(css, /\.site-header \.nav-toggle/);
  assert.match(css, /display: inline-flex !important;/);
  assert.doesNotMatch(css, /overflow-x:\s*hidden/);
});

test('Menu có nhãn navigation và hỗ trợ focus, giảm chuyển động', () => {
  assert.match(shell, /<nav class="mobile-nav" id="mobile-nav" hidden \$\{attr\("aria-label", "shell.nav.main"\)\}>/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(css, /min-height: 48px;/);
  assert.match(css, /font-size: 15px;/);
});

test('Khi trở lại desktop, menu được đóng và aria-expanded đồng bộ', () => {
  assert.match(app, /matchMedia\("\(min-width: 1151px\)"\)/);
  assert.match(app, /setMobileMenu\(trigger, menu, false\)/);
  assert.match(app, /menu\.contains\(document\.activeElement\)/);
});

test('Browser regression vẫn chống tràn ngang và xác nhận menu hoạt động', () => {
  assert.match(browserTest, /documentElement\.scrollWidth\), width/);
  assert.match(browserTest, /width === 1024/);
  assert.match(browserTest, /await toggle\.press\('Escape'\)/);
  assert.match(browserTest, /compactFontSize >= 14/);
});
