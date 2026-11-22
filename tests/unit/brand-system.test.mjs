import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const file = path => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const html = file('web/index.html');
const tokens = file('web/css/tokens.css');
const css = file('web/css/brand-system.css');
const staticServer = file('src/gateway/static.mjs');

test('Ba font đúng tên và đồng nhất trên giao diện VI/EN', () => {
  assert.match(tokens, /--font-display: "Plus Jakarta Sans", "Inter", system-ui, -apple-system, sans-serif;/);
  assert.match(tokens, /--font-body: "Inter", system-ui, -apple-system, sans-serif;/);
  assert.match(tokens, /--font-serif: "Lora", Georgia, serif;/);
  assert.match(tokens, /--font-shell: "Inter", system-ui, -apple-system, sans-serif;/);
  assert.match(tokens, /font-family: "Lora";/);
  assert.match(html, /<link id="app-fonts" rel="stylesheet"/);
  assert.match(html, /href="\/css\/app-fonts\.css"/);
  const fonts=file('web/css/app-fonts.css');
  assert.match(fonts,/font-family: 'Inter'/);assert.match(fonts,/font-family: 'Plus Jakarta Sans'/);
  assert.match(fonts,/font-weight: 400 800/);assert.match(fonts,/font-display: swap/);
  assert.match(staticServer, /style-src 'self' https:\/\/fonts\.googleapis\.com/);
  assert.match(staticServer, /font-src 'self' https:\/\/fonts\.gstatic\.com/);
});

test('Font dùng ở trang chủ lẫn các vai trò khác và không phụ thuộc tải JS', () => {
  const meta = html.indexOf('<meta name="description"');
  const font = html.indexOf('id="app-fonts"');
  const script = html.indexOf('<script type="module" src="/js/app.js"');
  assert(meta >= 0 && font > meta && script > font);
  assert.match(css, /\.site-header,\s*\.site-footer\s*\{\s*font-family: var\(--font-body\);/);
  assert.match(html, /href="\/css\/brand-system\.css\?v=20261121"/);
});

test('CSS hoàn thiện được tách thành từng thuộc tính rõ ràng', () => {
  const lines = css.split(/\r?\n/);
  assert(lines.length > 125);
  for (const [index, line] of lines.entries()) {
    // Mỗi dòng khai báo tối đa một dấu chấm phẩy; không minify nhiều thuộc tính.
    assert((line.match(/;/g) || []).length <= 1, `CSS line ${index + 1} contains multiple declarations`);
  }
  assert.match(css, /--brand-text-muted: #594e68;/);
  assert.match(css, /--ui-text-lead/);
});

test('Chuyển động 3D theo progressive enhancement, có focus và reduced motion', () => {
  assert.match(css, /perspective: 1200px/);
  assert.match(css, /translate3d\(0, -5px, 10px\) rotateX\(1deg\)/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\) and \(prefers-reduced-motion: no-preference\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.role-workspace__link:focus-visible/);
  assert.doesNotMatch(css, /\.gift-runtime-stage\s*\{/);
});
