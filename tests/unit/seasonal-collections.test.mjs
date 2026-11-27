import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { featuredSeasons, seasonStatus, isInSeason, vietnamDay } from '../../web/js/features/catalog/seasonal.js';
import { createCatalogViews } from '../../web/js/pages/catalog.js';
import { priceText } from '../../web/js/core/i18n.js';
import { templates } from '../../src/modules/catalog/seed.mjs';

const season = (id, availableFrom, availableTo) => ({ id, isSeasonal: true, availableFrom, availableTo });
const winter = season('winter', '2026-11-10', '2026-12-26');
const next = season('next', '2026-12-20', '2027-01-07');
const spring = season('spring', '2027-01-15', '2027-02-22');

test('Ưu tiên mùa hiện tại, sau đó mùa sắp tới, không thay đổi dữ liệu gốc', () => {
  const input = [winter, spring, next];
  const original = structuredClone(input);
  assert.deepEqual(featuredSeasons(input, '2026-11-27').map(item => item.id), ['winter', 'next', 'spring']);
  assert.deepEqual(featuredSeasons(input, '2026-12-28').map(item => item.id), ['next', 'spring', 'winter']);
  assert.deepEqual(featuredSeasons(input, '2027-04-01').map(item => item.id), ['spring', 'next', 'winter']);
  assert.deepEqual(input, original);
});

test('Ngày bắt đầu và kết thúc đều được tính theo ngày Việt Nam', () => {
  assert.equal(vietnamDay(new Date('2026-12-31T17:00:00Z')), '2027-01-01');
  assert.equal(seasonStatus(winter, '2026-11-09'), 'upcoming');
  assert(isInSeason(winter, '2026-11-10'));
  assert(isInSeason(winter, '2026-12-26'));
  assert.equal(seasonStatus(winter, '2026-12-27'), 'collection');
});

test('Lịch thiếu, sai hoặc đảo ngược không làm lỗi và không đánh dấu đang vào mùa', () => {
  const invalid = [season('missing'), season('invalid', '2027-02-30', '2027-03-01'), season('reverse', '2027-01-02', '2027-01-01')];
  for (const item of invalid) assert.equal(seasonStatus(item, '2027-01-01'), 'collection');
  assert.deepEqual(featuredSeasons([null, ...invalid, next, { id: 'ordinary' }], '2027-01-01').map(item => item.id), ['next', 'missing', 'invalid', 'reverse']);
});

test('Các chiến dịch chồng lấn giữ cả hai mẫu và thứ tự ổn định', () => {
  assert.deepEqual(featuredSeasons([next, winter, spring], '2026-12-24').map(item => item.id), ['winter', 'next', 'spring']);
  assert(isInSeason(next, '2026-12-24'));
});

test('Catalog giữ đường dẫn, thứ tự shelf và giá thật, không ẩn mẫu theo lịch', () => {
  const priced = templates.map(item => item.id === 'winter-wishes-2026' ? { ...item, price: 59000 } : item);
  const state = { templates: priced, filter: 'all', search: '', freeOnly: false, photoOnly: false, catalogPage: 1, favorites: new Set() };
  const views = createCatalogViews({ state, templateCard: () => '<article></article>', paginationMarkup: () => '', buttonLink: () => '', artwork: () => '', favoriteButton: () => '' });
  const html = views.explore();
  assert(html.indexOf('id="catalog-grid"') < html.indexOf('class="seasonal-shelf"'));
  assert.equal((html.match(/class="seasonal-shelf__card"/g) || []).length, 4);
  assert.equal((html.match(/class="seasonal-shelf__price"/g) || []).length, 4);
  assert.match(html, /href="\/template\/winter-wishes-2026"/);
  assert(html.includes(priceText(59000)));
  assert.equal(priced.find(item => item.id === 'winter-wishes-2026').price, 59000);
  assert.match(html, /data-season-status="(?:inSeason|upcoming|collection)"/);
  state.search = 'test';
  assert.match(views.explore(), /<details class="seasonal-shelf"[^>]* hidden/);
});

test('CSS theo token, hỗ trợ reduced motion và được nạp trong Catalog bundle', () => {
  const read = path => fs.readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
  const css = read('web/css/seasonal-catalog.css');
  assert.match(css, /aspect-ratio: 390 \/ 466/);
  assert.match(css, /var\(--layout-radius-card\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(read('web/index.html'), /seasonal-catalog\.css\?v=20261127-seasonal/);
  assert.match(read('scripts/build/client-bundles.mjs'), /'seasonal-catalog'/);
  for (const lang of ['vi', 'en']) {
    const locale = JSON.parse(read('web/assets/locales/' + lang + '.json'));
    assert.match(locale['catalog.seasonal.count'], /\{count\}/);
    assert(locale['catalog.seasonal.upcoming'].trim());
  }
});
