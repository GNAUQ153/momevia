import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHomeViews } from '../../web/js/pages/home.js';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const css = read('web/css/open-me-website.css');
const render = () => createHomeViews({
  state: { templates: [] },
  buttonLink: (url, label) => `<a href="${url}">${label}</a>`,
  templateCard: () => '',
}).home();

test('Phong bì nằm trong lớp trang trí aria-hidden, không thêm điều khiển', () => {
  const html = render();
  const atmosphere = html.match(/<div class="mkt-stage__atmosphere" aria-hidden="true">(.*?)<\/div>/)?.[1];
  assert(atmosphere);
  assert.match(atmosphere, /<span class="mkt-stage__envelope"><\/span>/);
  assert.doesNotMatch(atmosphere, /tabindex|<button|<a\s/);
  assert.match(css, /\.mkt-stage__envelope \{[^}]*pointer-events: none;/);
});

test('Một thiệp thật ở trước phong bì và giữ nguyên đường dẫn tạo thiệp', () => {
  const html = render();
  assert.equal((html.match(/data-template-preview/g) || []).length, 1);
  assert.equal((html.match(/data-hero-image=/g) || []).length, 5);
  assert.equal((html.match(/data-active="true"/g) || []).length, 1);
  for (const route of ['/explore?cardType=invitation', '/explore?cardType=greeting', '/design/new']) assert(html.includes(route));
  assert.match(html, /data-home-create aria-haspopup="dialog"/);
});

test('Chiều sâu được tạo bằng CSS cục bộ, không thêm tài nguyên bên ngoài', () => {
  assert.match(css, /\.mkt-stage__envelope \{[^}]*perspective\(900px\) rotateX\(14deg\)/);
  assert.match(css, /\.mkt-stage__envelope::before \{[^}]*clip-path: polygon/);
  assert.match(css, /\.mkt-stage__envelope::after \{[^}]*clip-path: polygon/);
  assert.doesNotMatch(css, /@import|url\(https?:/);
  assert.match(read('web/index.html'), /open-me-website\.css\?v=20261127-hero-mesh/);
});

test('Ẩn nhãn trang trí tại cột hẹp, bỏ transform và transition trong reduced motion', () => {
  assert.match(css, /@media \(max-width: 520px\), \(min-width: 768px\) and \(max-width: 1100px\) \{[^}]*\.mkt-stage__reply \{\s*display: none;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^}]*\.mkt-hero__cover:hover \{\s*transform: none;\s*transition: none;/);
  assert.match(css, /\.mkt-hero__cover \[data-exiting\] \{\s*transform: none;\s*transition: none;/);
});
