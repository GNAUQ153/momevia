import test from 'node:test';
import assert from 'node:assert/strict';
import { templates } from '../../src/modules/catalog/seed.mjs';
import { CatalogService } from '../../src/modules/catalog/catalog.service.mjs';
import { PRIORITY_TEMPLATE_IDS, prioritizeTemplates } from '../../web/js/shared/template-order.js';
import { createHomeViews } from '../../web/js/pages/home.js';
import { createCatalogViews } from '../../web/js/pages/catalog.js';
import { filterTemplates, paginateTemplates } from '../../web/js/features/catalog/filter.js';

test('bộ 16 mẫu đứng trước mà không sửa bản ghi, mẫu Creator hay phiên bản được duyệt', () => {
  const input = structuredClone(templates).reverse();
  const before = structuredClone(input);
  const sorted = prioritizeTemplates(input);
  assert.equal(PRIORITY_TEMPLATE_IDS.length, 16);
  assert.deepEqual(sorted.slice(0, 16).map(t => t.id), PRIORITY_TEMPLATE_IDS);
  assert.deepEqual(input, before);
  assert.equal(new Set(sorted.map(t => t.id)).size, input.length);
  const creator = { id: PRIORITY_TEMPLATE_IDS[0], creator: 'Another creator', creatorId: 'person' };
  const version = { id: PRIORITY_TEMPLATE_IDS[1], systemOwned: true, versionId: 'creator-version' };
  assert.deepEqual(prioritizeTemplates([{ id: 'first' }, creator, version]), [{ id: 'first' }, creator, version]);
});

test('API giữ nguyên giá đã cấu hình và không làm hiện mẫu bị ẩn', async () => {
  const records = structuredClone(templates).reverse();
  records.find(t => t.id === PRIORITY_TEMPLATE_IDS[0]).price = 12345;
  const before = structuredClone(records);
  const service = new CatalogService({ all: async () => records }, {});
  const publicList = await service.publicList();
  assert.deepEqual(publicList.slice(0, 16).map(t => t.id), PRIORITY_TEMPLATE_IDS);
  assert.equal(publicList[0].price, 12345);
  assert.deepEqual(records, before);
  records.find(t => t.id === PRIORITY_TEMPLATE_IDS[1]).status = 'pending';
  const visible = await service.publicList();
  assert(!visible.some(t => t.id === PRIORITY_TEMPLATE_IDS[1]));
  assert.deepEqual(visible.slice(0, 15).map(t => t.id), PRIORITY_TEMPLATE_IDS.filter((_, i) => i !== 1));
});

test('thứ tự áp dụng sau lọc và trước phân trang', () => {
  const rows = templates.map(t => ({
    ...t, systemOwned: true, personalization: { photoFrames: PRIORITY_TEMPLATE_IDS.includes(t.id) ? 3 : 0 },
  }));
  const ordered = prioritizeTemplates(filterTemplates(rows, { freeOnly: true, photoOnly: true }));
  const page = paginateTemplates(ordered, 1);
  assert.deepEqual(page.items.map(t => t.id), PRIORITY_TEMPLATE_IDS.slice(0, page.items.length));
  const wedding = prioritizeTemplates(filterTemplates(rows, { search: 'đám cưới' }));
  assert.deepEqual(wedding.slice(0, 4).map(t => t.id), ['sealed-garden', 'polaroid-love', 'moonlit-promise', 'golden-blossom']);
  assert.deepEqual(prioritizeTemplates(filterTemplates(rows, { search: 'no matching template' })), []);
});

test('trang chủ giới thiệu đủ 16 mẫu thật và Catalog bắt đầu từ bộ mới', () => {
  const state = {
    templates: templates.map(t => ({ ...t, systemOwned: true })),
    filter: 'all', search: '', freeOnly: false, photoOnly: false, catalogPage: 1, favorites: new Set(),
  };
  const chosen = [];
  const home = createHomeViews({ state, templateCard: t => { chosen.push(t.id); return '<article>' + t.id + '</article>'; } });
  home.featuredGifts('ready');
  assert.deepEqual(chosen, PRIORITY_TEMPLATE_IDS);
  const catalog = createCatalogViews({
    state, templateCard: t => '<article data-template-id="' + t.id + '"></article>',
    paginationMarkup: () => '', buttonLink: () => '', artwork: () => '', favoriteButton: () => '',
  });
  const html = catalog.explore();
  assert.deepEqual([...html.matchAll(/data-template-id="([^"]+)"/g)].slice(0, 3).map(m => m[1]), PRIORITY_TEMPLATE_IDS.slice(0, 3));
});
