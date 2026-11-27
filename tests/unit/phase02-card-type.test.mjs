import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_TYPES, systemCardType, templateCardType, normalizeCardTypeFilter } from '../../web/js/shared/card-type.js';
import { filterTemplates, paginateTemplates } from '../../web/js/features/catalog/filter.js';
import { CatalogService, publicTemplate } from '../../src/modules/catalog/catalog.service.mjs';
import { registerRoutes } from '../../src/modules/catalog/routes.mjs';
import { templates } from '../../src/modules/catalog/seed.mjs';
import vi from '../../web/assets/locales/vi.json' with { type: 'json' };
import en from '../../web/assets/locales/en.json' with { type: 'json' };

const invitation = templates.find(t => t.id === 'loi-moi-ben-hien');
const greeting = templates.find(t => t.id === 'hai-phong-bi');

test('Phân biệt loại thiệp và dịp; toàn bộ mẫu hệ thống hiện tại có loại rõ ràng', () => {
  assert.equal(templates.length, 29);
  assert.equal(systemCardType(invitation.id), 'invitation');
  assert.equal(systemCardType(greeting.id), 'greeting');
  assert.equal(systemCardType('ban-do-ngay-ra-truong'), 'greeting');
  assert.equal(systemCardType('future-template'), 'unspecified');
  assert.equal(templates.filter(t => systemCardType(t.id) === 'invitation').length, 2);
  assert.equal(templates.filter(t => systemCardType(t.id) === 'greeting').length, 27);
});

test('API chỉ gán loại cho mẫu hệ thống, không sửa bản ghi nguồn', () => {
  const before = structuredClone(invitation);
  const view = publicTemplate(invitation);
  assert.equal(view.cardType, 'invitation');
  assert.equal(view.price, invitation.price);
  assert.deepEqual(invitation, before);
  assert.equal(publicTemplate(greeting).cardType, 'greeting');
  assert.equal(publicTemplate({ ...invitation, creatorId: 'creator', creator: 'Designer' }).cardType, 'unspecified');
});

test('Frontend mới tương thích API cũ và không suy đoán loại của Creator', () => {
  assert.equal(templateCardType({ id: invitation.id, systemOwned: true }), 'invitation');
  assert.equal(templateCardType({ id: invitation.id }), 'unspecified');
  assert.equal(templateCardType({ id: invitation.id, systemOwned: true, cardType: 'unspecified' }), 'unspecified');
  assert.equal(normalizeCardTypeFilter('invalid'), 'all');
  assert.equal(normalizeCardTypeFilter(null), 'all');
});

test('Bộ lọc kết hợp loại, dịp, giá, ảnh và phân trang', () => {
  const rows = [
    { id: 'a', cardType: 'invitation', category: 'Sinh nhật', price: 0, personalization: { photoFrames: 1 } },
    { id: 'b', cardType: 'greeting', category: 'Sinh nhật', price: 0, personalization: { photoFrames: 1 } },
    { id: 'c', cardType: 'invitation', category: 'Sinh nhật', price: 39000, personalization: { photoFrames: 1 } },
    { id: 'd', cardType: 'invitation', category: 'Tốt nghiệp', price: 0, personalization: { photoFrames: 0 } },
    { id: 'e', price: 0 },
  ];
  const result = filterTemplates(rows, { cardType: 'invitation', category: 'Sinh nhật', freeOnly: true, photoOnly: true });
  assert.deepEqual(paginateTemplates(result, 2).items.map(t => t.id), ['a']);
  assert.deepEqual(filterTemplates(rows, { cardType: 'unspecified' }).map(t => t.id), ['e']);
  assert.equal(filterTemplates(rows, { cardType: 'invalid' }).length, 5);
});

test('CatalogService áp dụng bộ lọc loại thiệp trên cùng dữ liệu public', async () => {
  const service = new CatalogService(null, null);
  service.publicList = async () => [publicTemplate(invitation), publicTemplate(greeting), { id: 'creator', cardType: 'unspecified' }];
  assert.deepEqual((await service.search({ cardType: 'invitation' })).map(t => t.id), [invitation.id]);
  assert.deepEqual((await service.search({ cardType: 'greeting' })).map(t => t.id), [greeting.id]);
  assert.deepEqual((await service.search({ cardType: 'unspecified' })).map(t => t.id), ['creator']);
  assert.equal((await service.search({ cardType: 'invalid' })).length, 3);
});

test('Route catalog chuyển tham số cardType sang service', async () => {
  let handler, options;
  registerRoutes({ on(method, path, fn) { if (method === 'GET' && path === '/templates') handler = fn; } }, {
    config: {}, service: { async search(input) { options = input; return []; } },
  });
  const res = { writeHead() {}, end() {} };
  await handler({ req: { headers: {} }, res, url: new URL('http://localhost/templates?cardType=invitation&occasion=Sinh%20nh%E1%BA%ADt') });
  assert.equal(options.cardType, 'invitation');
  assert.equal(options.category, 'Sinh nhật');
});

test('Nhãn loại thiệp dùng cùng khóa VI/EN và placeholder', () => {
  for (const key of ['label', 'all', ...CARD_TYPES, 'detail']) {
    assert.ok(vi[`catalog.cardType.${key}`]);
    assert.ok(en[`catalog.cardType.${key}`]);
  }
  assert.match(vi['catalog.cardType.detail'], /\{type\}/);
  assert.match(en['catalog.cardType.detail'], /\{type\}/);
});

test('Danh mục render bộ lọc đã chọn và chỉ hiển thị mẫu mời', async () => {
  const { createCatalogViews } = await import('../../web/js/pages/catalog.js');
  const state = { templates: [publicTemplate(invitation), publicTemplate(greeting)], filter: 'all', cardType: 'invitation', search: '', catalogPage: 1 };
  const catalog = createCatalogViews({ state, templateCard: t => `<article data-template-id="${t.id}"></article>`, paginationMarkup: () => '', buttonLink: () => '', artwork: () => '', favoriteButton: () => '' });
  const html = catalog.explore();
  assert.match(html, /id="card-type-filter"/);
  assert.match(html, /value="invitation" selected/);
  assert.match(html, /data-template-id="loi-moi-ben-hien"/);
  assert.doesNotMatch(html, /data-template-id="hai-phong-bi"/);
});
