import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { templatePriceTier, templatePriceText } from '../../web/js/features/catalog/price.js';
import { priceText } from '../../web/js/core/i18n.js';
import { filterTemplates } from '../../web/js/features/catalog/filter.js';
import { createComponents } from '../../web/js/ui/components.js';
import { createCatalogViews } from '../../web/js/pages/catalog.js';
import { templatePreviewDialog } from '../../web/js/features/catalog/template-preview.js';

const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const invalid = [null, undefined, '', ' ', '0', '59000', false, true, [], {}, NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1];
const base = { id: 'sample-price', title: 'Sample', creator: 'Creator', scenes: 1, style: 'classic' };

test('Giá mẫu hợp lệ dùng đúng số nguyên VND, không ép kiểu giá thiếu', () => {
  assert.equal(templatePriceTier(0), 'free');
  assert.equal(templatePriceTier(59000), 'paid');
  for (const value of invalid) {
    assert.equal(templatePriceTier(value), 'unknown');
    assert.match(templatePriceText(value), /Chưa có giá/);
    assert.doesNotMatch(templatePriceText(value), /Miễn phí/);
  }
  assert.equal(templatePriceText(0), priceText(0));
  assert.equal(templatePriceText(59000), priceText(59000));
});

test('Lọc miễn phí không nhận giá thiếu, rỗng hoặc sai kiểu', () => {
  const rows = [0, 59000, ...invalid].map((price, id) => ({ ...base, id, price }));
  assert.deepEqual(filterTemplates(rows, { freeOnly: true }), [rows[0]]);
  assert.deepEqual(filterTemplates(rows), rows);
});

test('Thẻ mẫu hiển thị giá, nhãn trả phí và không giả trạng thái miễn phí', () => {
  const { templateCard } = createComponents({ state: { favorites: new Set() } });
  assert.match(templateCard({ ...base, price: 0 }), /data-price-tier="free"/);
  const paid = templateCard({ ...base, price: 59000 });
  assert.match(paid, /data-price-tier="paid"/);
  assert.match(paid, /Trả phí/);
  assert(paid.includes(priceText(59000)));
  const unknown = templateCard({ ...base, price: null });
  assert.match(unknown, /data-price-tier="unknown"/);
  assert.doesNotMatch(unknown, /template-card__price--free|Miễn phí/);
  assert.doesNotMatch(templateCard({ ...base, price: 59000 }, { compact: true }), /template-card__price-kind/);
});

test('Chi tiết và Preview giữ giá, phạm vi quyền và tuyến tạo thiệp', () => {
  const template = { ...base, price: 59000, versionId: 'v2' };
  const views = createCatalogViews({ state: { favorites: new Set() }, buttonLink: () => '', artwork: () => '', favoriteButton: () => '' });
  for (const html of [views.templateDetail(template), templatePreviewDialog(template)]) {
    assert.match(html, /Giá mẫu/);
    assert(html.includes(priceText(59000)));
    assert.match(html, /không phải xác nhận quyền sử dụng hoặc hạn mức xuất bản/);
    assert.match(html, /\/create\/sample-price\?mode=quick(?:&amp;|&)version=v2/);
  }
  assert.match(templatePreviewDialog({ ...template, price: null }), /data-price-tier="unknown"/);
});

test('Marker giá Preview không trùng marker mở hộp thoại', () => {
  const html = templatePreviewDialog({ ...base, price: 59000 });
  assert.match(html, /data-preview-price(?:\s|>)/);
  assert.doesNotMatch(html, /data-template-preview/g);
  assert.match(read('web/js/features/catalog/template-preview.js'), /querySelector\('\[data-preview-price\]'\)/);
});

test('Preview cập nhật giá và loại giá theo activeTemplate, không sửa tuyến tạo mẫu', () => {
  const source = read('web/js/features/catalog/template-preview.js');
  assert.match(source, /activeTemplate = getTemplate\(\);[\s\S]*?useTemplate\.setAttribute\('href', templateCreateUrl\(activeTemplate\)\);[\s\S]*?previewPrice\.dataset\.priceTier = templatePriceTier\(activeTemplate\.price\);[\s\S]*?templatePriceText\(activeTemplate\.price\)/);
});

test('Giao diện giá dùng chung token và bản dịch VI/EN, được nạp vào Catalog bundle', () => {
  assert.match(read('web/index.html'), /catalog-price\.css\?v=20261127-price-scope/);
  assert.match(read('scripts/build/client-bundles.mjs'), /catalogSheets[^\n]*'catalog-price'/);
  assert.match(read('web/css/catalog-price.css'), /var\(--color-success\)/);
  for (const lang of ['vi', 'en']) {
    const locale = JSON.parse(read('web/assets/locales/' + lang + '.json'));
    for (const key of ['label', 'paid', 'freeOnly', 'unknown', 'scope']) assert(locale['catalog.price.' + key].trim());
  }
});
