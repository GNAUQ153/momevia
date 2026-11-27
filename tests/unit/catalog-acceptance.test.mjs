import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogViews } from '../../web/js/pages/catalog.js';
import { createComponents } from '../../web/js/ui/components.js';
import { createCatalogActions } from '../../web/js/app/catalog-actions.js';
import { templatePreviewDialog } from '../../web/js/features/catalog/template-preview.js';

const sample = (id, price, extra = {}) => ({
  id, price, title: `Thiệp ${id}`, creator: 'QA Studio', style: 'Lãng mạn',
  cardType: 'greeting', category: 'Sinh nhật', scenes: 1, ...extra,
});
const fixture = () => ({
  templates: [sample('free', 0), sample('paid', 59000, { versionId: 'v2' }),
    sample('unknown', null), ...Array.from({ length: 10 }, (_, index) => sample(`free-${index}`, 0))],
  favorites: new Set(), search: '', filter: 'all', cardType: 'all',
  occasion: 'all', palette: 'all', catalogPage: 1, freeOnly: false, photoOnly: false,
});
const views = state => createCatalogViews({ state, buttonLink: () => "", ...createComponents({ state }) });
const actionFor = (context, name) => createCatalogActions(context).find(([names]) => names.includes(name))[1];

// Kiểm tra kết quả render thật, không chỉ kiểm tra hàm lọc riêng lẻ.
test('Catalog giữ đúng giá và phân trang sau khi kết hợp bộ lọc', () => {
  const state = fixture();
  const catalog = views(state);
  const first = catalog.catalogResultMarkup();
  assert.equal(first.result.total, 13);
  assert.equal(first.result.items.length, 9);
  for (const [id, tier] of [['free', 'free'], ['paid', 'paid'], ['unknown', 'unknown']]) {
    const card = createComponents({ state }).templateCard(state.templates.find(item => item.id === id));
    assert(card.includes(`data-price-tier="${tier}"`));
    assert(first.cards.includes(card));
  }
  state.freeOnly = true;
  state.search = 'thiep';
  state.catalogPage = 2;
  const filtered = catalog.catalogResultMarkup();
  assert.equal(filtered.result.total, 11);
  assert.equal(filtered.result.items.length, 2);
  assert(filtered.result.items.every(item => item.price === 0));
  assert.doesNotMatch(filtered.cards, /data-price-tier="(?:paid|unknown)"/);
  state.search = 'khong co ket qua';
  const empty = catalog.catalogResultMarkup();
  assert.equal(empty.result.total, 0);
  assert.equal(state.catalogPage, 1);
  assert.match(empty.cards, /data-clear-search/);
});

test('Creator đã có version dùng cùng giá và tuyến tạo thiệp trong chi tiết và Preview', () => {
  const state = fixture();
  const creator = state.templates[1];
  for (const html of [views(state).templateDetail(creator), templatePreviewDialog(creator)]) {
    assert.match(html, /data-price-tier="paid"/);
    assert.match(html, /\/create\/paid\?mode=quick(?:&amp;|&)version=v2/);
    assert.doesNotMatch(html, /data-price-tier="free"/);
  }
});

test('Guest yêu thích yêu cầu đăng nhập và không gọi lưu dữ liệu', async t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'location');
  t.after(() => original ? Object.defineProperty(globalThis, 'location', original) : delete globalThis.location);
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { pathname: '/explore', search: '?free=1', hash: '' } });
  const state = fixture();
  const intents = [];
  const action = actionFor({ state, requireLogin: (...args) => intents.push(args),
    saveFavorite: () => assert.fail('Guest must not save a favorite') }, 'toggle-favorite');
  await action('toggle-favorite', { dataset: { id: 'free' } });
  assert.deepEqual(intents, [['/explore?free=1', 'free']]);
  assert.equal(state.favorites.size, 0);
});

test('Customer yêu thích và bỏ yêu thích qua dependency lưu hiện có', async t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'location');
  t.after(() => original ? Object.defineProperty(globalThis, 'location', original) : delete globalThis.location);
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { pathname: '/explore' } });
  const state = { ...fixture(), user: { id: 'qa-customer' } };
  const calls = [];
  const action = actionFor({ state, toast: () => {}, requireLogin: () => assert.fail('Already signed in'),
    saveFavorite: async (id, saved) => {
      calls.push([id, saved]);
      if (saved) state.favorites.add(id);
      else state.favorites.delete(id);
    } }, 'toggle-favorite');
  const control = { dataset: { id: 'paid' }, disabled: false };
  await action('toggle-favorite', control);
  assert.match(createComponents({ state }).templateCard(state.templates[1]), /aria-pressed="true"/);
  await action('toggle-favorite', control);
  assert.deepEqual(calls, [['paid', true], ['paid', false]]);
  assert.equal(control.disabled, false);
  assert.equal(state.favorites.size, 0);
});
