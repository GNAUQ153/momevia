import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCatalogActions } from '../../web/js/app/catalog-actions.js';
import { createCatalogViews } from '../../web/js/pages/catalog.js';

const read = name => fs.readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
const stateFixture = () => ({ templates: [], search: '', filter: 'all', cardType: 'all', occasion: 'all', palette: 'all', catalogPage: 1, freeOnly: false, photoOnly: false });
const markup = state => createCatalogViews({ state, templateCard: () => '', paginationMarkup: () => '' }).explore();

test('Search có label, nút xóa riêng, không đặt button trong label và escape từ khóa', () => {
  const state = stateFixture();
  const empty = markup(state);
  assert.match(empty, /<button type="button" id="template-search-clear"[^>]*disabled>/);
  state.search = '"<script>';
  const full = markup(state);
  assert.match(full, /id="template-search"[^>]*value="&quot;&lt;script&gt;"/);
  assert.match(full, /<\/label><button type="button" id="template-search-clear"[^>]*aria-label="[^"]+"/);
  assert.doesNotMatch(full, /id="template-search-clear"[^>]*disabled>/);
});

test('Xóa riêng từ khóa giữ nguyên filter, về trang 1 và trả focus trước khi commit', async t => {
  const state = { ...stateFixture(), search: 'hello', catalogPage: 4, cardType: 'invitation', freeOnly: true, photoOnly: true, occasion: 'birthday', palette: 'pink', filter: 'Lãng mạn' };
  const events = [];
  const input = { value: 'hello', focus: () => events.push('focus') };
  const original = globalThis.document;
  t.after(() => { if (original === undefined) delete globalThis.document; else globalThis.document = original; });
  globalThis.document = { getElementById: id => id === 'template-search' ? input : null };
  const action = createCatalogActions({ state, commitCatalogFilters: () => events.push('commit') }).find(([names]) => names.includes('clear-catalog-search'))[1];
  await action();
  assert.deepEqual(state, { ...stateFixture(), cardType: 'invitation', freeOnly: true, photoOnly: true, occasion: 'birthday', palette: 'pink', filter: 'Lãng mạn' });
  assert.equal(input.value, '');
  assert.deepEqual(events, ['focus', 'commit']);
  globalThis.document = { getElementById: () => null };
  await action();
  assert.deepEqual(events, ['focus', 'commit']);
});

test('Đồng bộ trạng thái disabled khi tìm kiếm thay đổi hoặc reset bộ lọc', t => {
  const state = stateFixture();
  const clear = { disabled: false };
  const original = globalThis.document;
  t.after(() => { if (original === undefined) delete globalThis.document; else globalThis.document = original; });
  globalThis.document = { getElementById: id => id === 'template-search-clear' ? clear : null };
  const views = createCatalogViews({ state });
  views.syncCatalogResults();
  assert.equal(clear.disabled, true);
  state.search = 'a';
  views.syncCatalogResults();
  assert.equal(clear.disabled, false);
  state.search = '';
  views.syncCatalogResults();
  assert.equal(clear.disabled, true);
});

test('Điều khiển dùng token chung, focus rõ và hỗ trợ giảm chuyển động', () => {
  const tokens = read('web/css/tokens.css');
  const css = read('web/css/open-me-system.css');
  assert.match(tokens, /--control-height: 48px;/);
  assert.match(tokens, /--control-font-size: max\(16px, 1rem\);/);
  assert.match(css, /\.catalog-compact \.search-field input \{[^}]*font-size: var\(--control-font-size\)/);
  assert.match(css, /\.catalog-compact \.search-field__clear \{[^}]*width: var\(--ui-control-min-height\);[^}]*height: var\(--ui-control-min-height\)/);
  assert.match(css, /\.catalog-compact \.search-field:focus-within,[^{}]*\{[^}]*outline: var\(--control-focus-width\) solid var\(--color-focus\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^{}]*\.search-field__clear \{[^}]*transition: none;/);
  const section = css.split('/* Điều khiển marketing và danh mục;')[1];
  assert.doesNotMatch(section, /:lang\(|\[lang|\.auth-panel|\.editor-artboard|\.gift-runtime-stage/);
});

test('Nhãn tìm kiếm VI/EN và cache CSS đồng bộ', () => {
  for (const locale of ['vi', 'en']) {
    const dict = JSON.parse(read(`web/assets/locales/${locale}.json`));
    assert.equal(typeof dict['catalog.search.clear'], 'string');
    assert(dict['catalog.search.clear'].length > 0);
  }
  const html = read('web/index.html');
  assert(html.includes('/css/tokens.css?v=20261127-controls'));
  assert(html.includes('/css/open-me-system.css?v=20261127-controls'));
});
