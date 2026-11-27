import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const css = read('web/css/catalog-card-motion.css');
const scope = '.catalog-section.catalog-compact .catalog-grid';

test('Hiệu ứng thẻ chỉ áp dụng trong Catalog, không có chuyển động lặp', () => {
  const selectors = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)].map(match => match[1].trim());
  assert(selectors.filter(selector => !selector.startsWith('@media')).every(selector => selector.startsWith(scope)));
  assert.doesNotMatch(css, /@keyframes|will-change:/);
  assert([...css.matchAll(/animation:\s*([^;]+);/g)].every(match => match[1].trim() === 'none'));
});

test('Nghiêng artwork chỉ khi có chuột và không yêu cầu giảm chuyển động', () => {
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\) and \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\.template-card__visual:hover \.artwork \{\s*transform: perspective\(900px\) rotateX\(3deg\) rotateY\(-5deg\) scale\(\.94\);/);
  assert.match(css, /\.template-card:hover \{\s*transform: none;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.template-card__visual \.artwork \{\s*transform: none;\s*transition: none;/);
});

test('Nhãn xem mẫu luôn hiện, favorite giữ vùng chạm và focus', () => {
  assert.match(css, /\.template-card__view \{[^}]*opacity: 1;[^}]*transform: none;/);
  assert.match(css, /\.template-card \.favorite-button \{[^}]*min-width: var\(--ui-control-min-height\);[^}]*min-height: var\(--ui-control-min-height\);[^}]*transform: none;/);
  assert.match(css, /\.template-card__visual:focus-visible \{[^}]*outline: var\(--control-focus-width\) solid var\(--color-focus\)/);
  assert.doesNotMatch(css, /:lang\(|\[lang\s*=/);
});

test('CSS được tải sau lớp giao diện chung và có trong bundle Catalog', () => {
  const html = read('web/index.html');
  const link = '/css/catalog-card-motion.css?v=20261127-card-depth';
  assert.equal(html.split(link).length, 2);
  assert(html.indexOf(link) > html.indexOf('/css/open-me-system.css'));
  assert.match(read('scripts/build/client-bundles.mjs'), /const catalogSheets=new Set\(\[[^\]]*'catalog-card-motion'/);
});
