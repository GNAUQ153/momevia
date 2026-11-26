import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCoverImage, mountCoverLoading, preserveLoadedCovers } from '../../web/js/core/cover-loading.js';

function image(values, top = 0) {
  const attrs = new Map(Object.entries(values));
  const img = { isConnected: true, getBoundingClientRect: () => ({ top }),
    hasAttribute: name => attrs.has(name), getAttribute: name => attrs.get(name) ?? null,
    setAttribute: (name, value) => attrs.set(name, value), removeAttribute: name => attrs.delete(name),
  };
  for (const [property, attribute] of [['loading', 'loading'], ['fetchPriority', 'fetchpriority']])
    Object.defineProperty(img, property, { get: () => attrs.get(attribute), set: value => attrs.set(attribute, value) });
  return img;
}

test('deferred cover promotion keeps later rows lazy and transfers responsive locale bindings', () => {
  const saved = Object.fromEntries(['IntersectionObserver', 'MutationObserver', 'innerHeight', 'scrollY'].map(key => [key, globalThis[key]]));
  const first = image({ 'data-src': 'first.webp', 'data-cover-lazy': '', loading: 'lazy' }, 100);
  const later = image({ 'data-src': 'later.webp', 'data-srcset': 'later.webp 192w, later-large.webp 640w',
    'data-i18n-data-src': 'locale-src', 'data-i18n-data-srcset': 'locale-srcset', 'data-cover-lazy': '', loading: 'lazy' }, 200);
  let promote;
  try {
    globalThis.innerHeight = 800; globalThis.scrollY = 0;
    globalThis.IntersectionObserver = class { constructor(callback) { promote = callback; } observe() {} unobserve() {} disconnect() {} };
    globalThis.MutationObserver = class { observe() {} disconnect() {} };
    const dispose = mountCoverLoading({ querySelectorAll: () => [first, later], contains: img => [first, later].includes(img) });
    promote([{ target: first, isIntersecting: true }]);
    assert.equal(first.loading, 'eager');
    globalThis.scrollY = 1000;
    promote([{ target: later, isIntersecting: true }]);
    assert.equal(later.loading, 'lazy');
    assert.equal(later.getAttribute('srcset'), 'later.webp 192w, later-large.webp 640w');
    assert.equal(later.getAttribute('data-i18n-srcset'), 'locale-srcset');
    assert.equal(later.getAttribute('data-i18n-src'), 'locale-src');
    assert.equal(later.hasAttribute('data-srcset'), false);
    dispose();
  } finally { Object.assign(globalThis, saved); }
});

test('filtering reuses loaded responsive covers but rejects stale revisions and sizes', () => {
  const loaded = image({ src: 'r1.webp', srcset: 'r1.webp 192w', sizes: '172px', loading: 'lazy',
    'data-i18n-src': 'binding', 'data-i18n-srcset': 'binding-set' });
  const candidate = () => image({ 'data-src': 'r1.webp', 'data-srcset': 'r1.webp 192w', sizes: '172px',
    'data-cover-lazy': '', 'data-i18n-data-src': 'binding', 'data-i18n-data-srcset': 'binding-set' });
  const current = { querySelectorAll: () => [loaded] }, retained = candidate();
  preserveLoadedCovers(current, { querySelectorAll: () => [retained] });
  assert.equal(retained.getAttribute('srcset'), loaded.getAttribute('srcset'));
  assert.equal(retained.hasAttribute('data-cover-lazy'), false);
  const changed = candidate(); changed.setAttribute('data-src', 'r2.webp');
  preserveLoadedCovers(current, { querySelectorAll: () => [changed] });
  assert.equal(changed.hasAttribute('data-cover-lazy'), true);
  const resized = candidate(); resized.setAttribute('sizes', '380px');
  preserveLoadedCovers(current, { querySelectorAll: () => [resized] });
  assert.equal(resized.hasAttribute('data-cover-lazy'), true);
});

function observerFixture(t, initial, { native = true } = {}) {
  const keys = ['IntersectionObserver', 'MutationObserver', 'innerHeight', 'scrollY'];
  const saved = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => {
    for (const key of keys) {
      if (saved[key]) Object.defineProperty(globalThis, key, saved[key]);
      else delete globalThis[key];
    }
  });
  const members = new Set(initial), watched = new Set();
  let intersect, mutate, disconnected = 0;
  globalThis.innerHeight = 800;
  globalThis.scrollY = 0;
  globalThis.IntersectionObserver = native ? class {
    constructor(callback) { intersect = callback; }
    observe(img) { watched.add(img); }
    unobserve(img) { watched.delete(img); }
    disconnect() { disconnected++; watched.clear(); }
  } : undefined;
  globalThis.MutationObserver = class {
    constructor(callback) { mutate = callback; }
    observe() {}
    disconnect() { disconnected++; }
  };
  const root = { contains: img => members.has(img), querySelectorAll: () => [...members] };
  const dispose = mountCoverLoading(root);
  t.after(dispose);
  return { members, watched, dispose, disconnected: () => disconnected,
    intersect: (...imgs) => intersect(imgs.map(target => ({ target, isIntersecting: true }))),
    mutate: (...imgs) => mutate([{ addedNodes: imgs.map(img => ({ querySelectorAll: () => [img] })) }]),
  };
}

const deferred = name => image({ 'data-src': `${name}.webp`, 'data-cover-lazy': '', loading: 'lazy' }, 100);

test('Observer không tải ảnh đã rời root, kể cả khi ảnh vẫn nối với DOM', t => {
  const old = deferred('old'), moved = deferred('moved'), fresh = deferred('fresh');
  const f = observerFixture(t, [old, moved]);
  old.isConnected = false;
  f.members.delete(old);
  f.members.delete(moved);
  f.members.add(fresh);
  // Callback cũ đến trước MutationObserver của route mới.
  f.intersect(old, moved);
  f.mutate(old, moved, fresh);
  assert.equal(old.getAttribute('src'), null);
  assert.equal(moved.getAttribute('src'), null);
  assert.deepEqual([...f.watched], [fresh]);
  f.intersect(fresh);
  assert.equal(fresh.getAttribute('src'), 'fresh.webp');
});

test('Không ghi đè ưu tiên ảnh Carousel đã tải, kể cả callback lặp', t => {
  const img = deferred('carousel');
  const f = observerFixture(t, [img]);
  loadCoverImage(img);
  img.fetchPriority = 'low';
  f.intersect(img, img);
  loadCoverImage(img);
  assert.equal(img.fetchPriority, 'low');
  assert.equal(img.getAttribute('src'), 'carousel.webp');
  assert.equal(f.watched.size, 0);
});

test('Dispose chặn callback IntersectionObserver và MutationObserver đến muộn', t => {
  const img = deferred('old'), next = deferred('next');
  const f = observerFixture(t, [img]);
  f.dispose();
  f.dispose();
  f.members.add(next);
  f.intersect(img);
  f.mutate(next);
  assert.equal(img.getAttribute('src'), null);
  assert.equal(next.getAttribute('src'), null);
  assert.equal(f.watched.size, 0);
  assert.equal(f.disconnected(), 2);
});

test('Mutation bỏ ảnh đã được tải chủ động và vẫn theo dõi ảnh mới', t => {
  const img = deferred('active'), next = deferred('next');
  const f = observerFixture(t, [img]);
  loadCoverImage(img);
  f.members.add(next);
  f.mutate(img, next);
  assert.deepEqual([...f.watched], [next]);
});

test('Không có IntersectionObserver vẫn tải ảnh mới trong root', t => {
  const img = deferred('first'), next = deferred('next'), old = deferred('old');
  const f = observerFixture(t, [img], { native: false });
  assert.equal(img.getAttribute('src'), 'first.webp');
  f.members.add(next);
  f.mutate(next, old);
  assert.equal(next.getAttribute('src'), 'next.webp');
  assert.equal(old.getAttribute('src'), null);
});
