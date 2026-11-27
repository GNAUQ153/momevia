import test from 'node:test';
import assert from 'node:assert/strict';
import { createComponents } from '../../web/js/ui/components.js';
import { createCatalogViews } from '../../web/js/pages/catalog.js';
import { loadCoverImage, preserveLoadedCovers } from '../../web/js/core/cover-loading.js';
import { templates } from '../../src/modules/catalog/seed.mjs';

const creator = {
  id: 'creator-cover', versionId: 'v2', creator: 'Studio', title: 'Creator card',
  thumbnail: '/api/designs/example/cover?v=2&locale=vi', price: 59000,
};
const components = createComponents({ state: { favorites: new Set() } });
const imageTag = html => html.match(/<img\b[^>]*>/)?.[0];
const hasSource = tag => /\ssrc=/.test(tag);

function mockImage(values, top = 1000) {
  const attributes = new Map(Object.entries(values));
  return {
    getBoundingClientRect: () => ({ top }),
    hasAttribute: name => attributes.has(name),
    getAttribute: name => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: name => attributes.delete(name),
    set loading(value) { attributes.set('loading', value); },
    set fetchPriority(value) { attributes.set('fetchpriority', value); },
  };
}

test('Ảnh Creator trong lưới danh mục không cấp src trước khi tới viewport', () => {
  const tag = imageTag(components.templateCard(creator));
  assert.match(tag, /\sdata-cover-lazy\b/);
  assert.match(tag, /\sdata-src="\/api\/designs\/example\/cover\?v=2&amp;locale=vi"/);
  assert.equal(hasSource(tag), false);
  assert.match(tag, /width="390" height="844" loading="lazy"/);
  assert.match(tag, /\salt="[^"]+"/);
});

test('Không thay đổi tải ảnh Creator ở trang chi tiết và thẻ compact', () => {
  const detail = imageTag(components.artwork(creator, 'artwork--detail', { eager: true }));
  const compact = imageTag(components.templateCard(creator, { compact: true }));
  assert(hasSource(detail));
  assert.match(detail, /loading="eager"/);
  assert(hasSource(compact));
  assert.match(compact, /loading="lazy"/);
  for (const tag of [detail, compact]) assert.doesNotMatch(tag, /data-cover-lazy/);
});

test('Shelf mùa lễ trì hoãn toàn bộ URL và srcset, giữ kích thước và bản dịch', () => {
  const state = { templates, filter: 'all', search: '', freeOnly: false, photoOnly: false, catalogPage: 1, favorites: new Set() };
  const views = createCatalogViews({ state, ...components });
  const html = views.explore();
  const tags = [...html.matchAll(/class="seasonal-shelf__card"[^>]*>\s*(<img\b[^>]*>)/g)].map(match => match[1]);
  assert.equal(tags.length, 4);
  for (const tag of tags) {
    assert.match(tag, /\sdata-cover-lazy\b/);
    assert.match(tag, /\sdata-src=/);
    assert.match(tag, /\sdata-srcset=/);
    assert.match(tag, /\sdata-i18n-data-srcset=/);
    assert.match(tag, /width="390" height="466" loading="lazy"/);
    assert.doesNotMatch(tag, /\ssrc(?:set)?=/);
  }
});

test('Bộ tải hiện tại chuyển URL Creator đúng một lần và giữ ảnh khi lọc', t => {
  const saved = Object.fromEntries(['innerHeight', 'scrollY'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => {
    for (const key of Object.keys(saved)) {
      if (saved[key]) Object.defineProperty(globalThis, key, saved[key]);
      else delete globalThis[key];
    }
  });
  globalThis.innerHeight = 800;
  globalThis.scrollY = 0;
  const attributes = { 'data-src': creator.thumbnail, 'data-cover-lazy': '', loading: 'lazy' };
  const loaded = mockImage(attributes);
  loadCoverImage(loaded);
  loadCoverImage(loaded);
  assert.equal(loaded.getAttribute('src'), creator.thumbnail);
  assert.equal(loaded.getAttribute('loading'), 'lazy');
  assert.equal(loaded.hasAttribute('data-cover-lazy'), false);
  const candidate = mockImage(attributes);
  preserveLoadedCovers({ querySelectorAll: () => [loaded] }, { querySelectorAll: () => [candidate] });
  assert.equal(candidate.getAttribute('src'), creator.thumbnail);
  assert.equal(candidate.hasAttribute('data-cover-lazy'), false);
  const changed = mockImage({ ...attributes, 'data-src': '/new-cover.webp' });
  preserveLoadedCovers({ querySelectorAll: () => [loaded] }, { querySelectorAll: () => [changed] });
  assert.equal(changed.getAttribute('src'), null);
  assert.equal(changed.hasAttribute('data-cover-lazy'), true);
});
