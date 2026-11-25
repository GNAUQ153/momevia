import test from 'node:test';
import assert from 'node:assert/strict';
import { mountCoverLoading, preserveLoadedCovers } from '../../web/js/core/cover-loading.js';

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
    const dispose = mountCoverLoading({ querySelectorAll: () => [first, later] });
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
