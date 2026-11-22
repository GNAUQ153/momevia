import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { vi } from '../../web/js/shared/locale.js';
import { createHomeViews } from '../../web/js/pages/home.js';
import { filterTemplates } from '../../web/js/features/catalog/filter.js';
import { occasionExploreUrl, occasionShortcuts } from '../../web/js/features/marketing/occasion-shortcuts.js';

const sample = (...categories) => categories.map((category, index) => ({
  id: `occasion-${index}`, category, title: `Mẫu ${index}`, featured: true,
  price: 0, style: 'Tươi vui', personalization: { photoFrames: 0 },
}));
const birthday = vi['templates.meta.category.birthday'];
const wedding = vi['templates.meta.category.wedding'];
const christmas = vi['templates.meta.category.christmas'];
const tet = vi['templates.meta.category.tet'];
function render(templates) {
  const views = createHomeViews({
    state: { templates },
    templateCard: item => `<article class="template-card">${item.id}</article>`,
    buttonLink: (url, label) => `<a href="${url}" data-link>${label}</a>`,
  });
  return views.featuredGifts('ready');
}
const read = file => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

test('Chỉ hiện dịp có mẫu thật, đếm đúng và không lặp link', () => {
  const options = occasionShortcuts(sample(birthday, birthday, wedding, wedding, wedding, 'Danh mục chưa dịch'));
  assert.equal(options.length, 2);
  assert.equal(options.find(o => o.value === birthday)?.count, 2);
  assert.equal(options.find(o => o.value === wedding)?.count, 3);
  assert.ok(options.every(o => o.labelKey.startsWith('templates.meta.category.')));
});

test('Dịp đang trong mùa được ưu tiên, không ẩn các dịp khác', () => {
  const templates = [
    ...sample(wedding, wedding, birthday, birthday),
    { ...sample(christmas)[0], isSeasonal: true, availableFrom: '2026-11-01', availableTo: '2026-12-26' },
    { ...sample(tet)[0], isSeasonal: true, availableFrom: '2027-01-20', availableTo: '2027-02-25' },
  ];
  const options = occasionShortcuts(templates, { day: '2026-11-23' });
  assert.equal(options[0].value, christmas);
  assert.ok(options.some(o => o.value === tet));
  assert.equal(occasionShortcuts(templates, { day: '2027-02-05' })[0].value, tet);
});

test('Giới hạn 6 dịp và bỏ dữ liệu API sai dạng an toàn', () => {
  const choices = Object.keys(vi).filter(k => k.startsWith('templates.meta.category.')).map(k => vi[k]);
  const result = occasionShortcuts([...sample(...choices), null, { category: {} }]);
  assert.equal(result.length, 6);
  assert.deepEqual(occasionShortcuts(null), []);
  assert.deepEqual(occasionShortcuts(sample(birthday), { limit: -1 }), []);
});

test('Đường dẫn dùng đúng tham số occasion hiện được /explore hỗ trợ', () => {
  const templates = sample(birthday, birthday, wedding);
  const link = occasionExploreUrl(birthday);
  assert.equal(link, `/explore?occasion=${encodeURIComponent(birthday)}`);
  const parsed = new URL(link, 'https://momevia.example');
  assert.equal(parsed.searchParams.get('occasion'), birthday);
  assert.equal(filterTemplates(templates, { category: parsed.searchParams.get('occasion') }).length, 2);
  assert.match(read('web/js/app/main.js'), /state\.occasion\s*=\s*query\.get\('occasion'\)/);
});

test('Trên trang chủ có link dịp thực và nhãn trợ năng song ngữ', () => {
  const html = render(sample(birthday, birthday, wedding));
  assert.match(html, /<nav class="mkt-occasion"/);
  assert.match(html, /data-i18n-aria-label/);
  assert.ok(html.includes(`href="${occasionExploreUrl(birthday)}"`));
  assert.match(html, /mkt-occasion__count/);
  assert.match(html, /mkt-gift-grid/);
  const viFile = JSON.parse(read('web/assets/locales/vi.json'));
  const enFile = JSON.parse(read('web/assets/locales/en.json'));
  assert.deepEqual(Object.keys(viFile), Object.keys(enFile));
  for (const key of ['home.featured.occasionBrowse','home.featured.occasionAction']) {
    assert.ok(viFile[key] && enFile[key], key);
  }
});

test('Danh mục trống/loading/error không hiển thị số liệu giả', () => {
  assert.doesNotMatch(render([]), /mkt-occasion__link/);
  const views = createHomeViews({
    state: { templates: [] }, templateCard: () => '', buttonLink: (url, name) => `<a href="${url}">${name}</a>`,
  });
  for (const state of ['loading', 'error']) assert.doesNotMatch(views.featuredGifts(state), /mkt-occasion__link/);
});

test('Mobile dùng cuộn ngang nội bộ; desktop không làm thay đổi Hero/Canvas', () => {
  const styles = read('web/css/marketing-mobile.css');
  assert.match(styles, /\.mkt-occasion__links\s*\{[^}]*overflow-x: auto/s);
  assert.match(styles, /\.mkt-occasion__links\s*\{[^}]*flex-wrap: nowrap/s);
  assert.match(read('web/css/marketing.css'), /\.mkt-occasion__link:focus-visible/);
  const source = read('web/js/features/marketing/occasion-shortcuts.js');
  assert.doesNotMatch(source, /fetch\(|localStorage|document\.|window\.|innerHTML/);
});
