import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { marketingPointerGeometry, mountMarketingMotion } from '../../web/js/features/marketing/scene-motion.js';

function mockBrowser({ reduce = false, fine = true, observerSupported = true } = {}) {
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const styleValues = new Map();
  const attrs = new Set();
  const stage = Object.assign(new EventTarget(), {
    ownerDocument: doc,
    style: {
      setProperty: (key, value) => styleValues.set(key, value),
      removeProperty: key => styleValues.delete(key),
    },
    getBoundingClientRect: () => ({ left: 100, top: 50, width: 400, height: 200 }),
    setAttribute: name => attrs.add(name),
    removeAttribute: name => attrs.delete(name),
  });
  const revealed = new Set();
  const item = { classList: { add: name => revealed.add(name), contains: name => revealed.has(name) } };
  const rootAttrs = new Set();
  const root = {
    querySelector: selector => selector === '[data-mkt-tilt]' ? stage : null,
    querySelectorAll: selector => selector === '[data-mkt-reveal]' ? [item] : [],
    setAttribute: name => rootAttrs.add(name),
    removeAttribute: name => rootAttrs.delete(name),
  };
  const reducedMedia = Object.assign(new EventTarget(), { matches: reduce });
  const pointerMedia = Object.assign(new EventTarget(), { matches: fine });
  const frames = new Map();
  let nextFrame = 0;
  const observers = [];
  class FakeObserver {
    constructor(callback) {
      this.callback = callback;
      this.active = new Set();
      this.disconnected = false;
      observers.push(this);
    }
    observe(target) { this.active.add(target); }
    unobserve(target) { this.active.delete(target); }
    disconnect() { this.disconnected = true; this.active.clear(); }
    intersect(target) { this.callback([{ target, isIntersecting: true }]); }
  }
  const browser = {
    document: doc,
    matchMedia: query => query.includes('reduced-motion') ? reducedMedia : pointerMedia,
    requestAnimationFrame: callback => { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    flush: () => { for (const [id, callback] of [...frames]) { frames.delete(id); callback(); } },
    ...(observerSupported ? { IntersectionObserver: FakeObserver } : {}),
  };
  const move = (x, y, pointerType = 'mouse') => {
    const event = new Event('pointermove');
    Object.assign(event, { clientX: x, clientY: y, pointerType });
    stage.dispatchEvent(event);
  };
  return { browser, doc, stage, move, styleValues, attrs, root, rootAttrs, item, revealed, observers, frames, reducedMedia, pointerMedia };
}

function withBrowser(options, callback) {
  const original = globalThis.window;
  const setup = mockBrowser(options);
  globalThis.window = setup.browser;
  try { callback(setup); }
  finally {
    if (original === undefined) delete globalThis.window;
    else globalThis.window = original;
  }
}

test('Con trỏ bị giới hạn trong khung, không tạo NaN hoặc Infinity', () => {
  const bounds = { left: 100, top: 50, width: 400, height: 200 };
  assert.deepEqual(marketingPointerGeometry({ clientX: 300, clientY: 150 }, bounds), {
    tiltX: '0.00deg', tiltY: '0.00deg', glowX: '50.0%', glowY: '50.0%',
  });
  assert.deepEqual(marketingPointerGeometry({ clientX: -200, clientY: 999 }, bounds), {
    tiltX: '-3.00deg', tiltY: '-4.00deg', glowX: '0.0%', glowY: '100.0%',
  });
  assert.equal(marketingPointerGeometry({ clientX: NaN, clientY: 1 }, bounds), null);
  assert.equal(marketingPointerGeometry({ clientX: 1, clientY: 1 }, { ...bounds, width: 0 }), null);
});

test('3D cùng ánh sáng dùng một animation frame và hủy đúng khi rời vùng', () => {
  withBrowser({}, ({ root, move, frames, browser, attrs, styleValues, stage }) => {
    const dispose = mountMarketingMotion(root);
    move(200, 100);
    move(400, 180);
    assert.equal(frames.size, 1);
    browser.flush();
    assert.equal(styleValues.get('--mkt-glow-x'), '75.0%');
    assert.equal(styleValues.get('--mkt-glow-y'), '65.0%');
    assert.equal(attrs.has('data-mkt-pointer-active'), true);
    stage.dispatchEvent(new Event('pointerleave'));
    assert.equal(attrs.has('data-mkt-pointer-active'), false);
    assert.equal(styleValues.size, 0);
    move(300, 100);
    assert.equal(frames.size, 1);
    dispose();
    assert.equal(frames.size, 0);
    browser.flush();
    move(300, 100);
    assert.equal(styleValues.size, 0);
    assert.equal(frames.size, 0);
  });
});

test('Reduced motion, con trỏ cảm ứng và tab bị ẩn đều dừng 3D', () => {
  withBrowser({}, ({ root, move, frames, reducedMedia, pointerMedia, doc, attrs, browser }) => {
    const dispose = mountMarketingMotion(root);
    move(300, 100);
    reducedMedia.matches = true;
    reducedMedia.dispatchEvent(new Event('change'));
    assert.equal(frames.size, 0);
    move(300, 100);
    assert.equal(frames.size, 0);
    reducedMedia.matches = false;
    reducedMedia.dispatchEvent(new Event('change'));
    pointerMedia.matches = false;
    move(300, 100);
    assert.equal(frames.size, 0);
    pointerMedia.matches = true;
    move(300, 100);
    browser.flush();
    assert.equal(attrs.has('data-mkt-pointer-active'), true);
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    assert.equal(attrs.has('data-mkt-pointer-active'), false);
    dispose();
  });
});

test('Giảm chuyển động giữa chừng không khiến nội dung reveal bị ẩn', () => {
  withBrowser({}, ({ root, rootAttrs, revealed, item, observers, reducedMedia }) => {
    const dispose = mountMarketingMotion(root);
    assert.equal(rootAttrs.has('data-mkt-motion-ready'), true);
    observers[0].intersect(item);
    assert.equal(revealed.has('mkt-is-visible'), true);
    reducedMedia.matches = true;
    reducedMedia.dispatchEvent(new Event('change'));
    assert.equal(rootAttrs.has('data-mkt-motion-ready'), false);
    assert.equal(observers[0].disconnected, true);
    dispose();
  });
  withBrowser({ observerSupported: false }, ({ root, revealed, rootAttrs }) => {
    mountMarketingMotion(root)();
    assert.equal(revealed.has('mkt-is-visible'), true);
    assert.equal(rootAttrs.has('data-mkt-motion-ready'), false);
  });
});

test('AbortSignal gỡ listener, không để RAF cũ thay đổi trang mới', () => {
  withBrowser({}, ({ root, move, frames, styleValues, rootAttrs, browser }) => {
    const lifetime = new AbortController();
    mountMarketingMotion(root, { signal: lifetime.signal });
    move(300, 100);
    lifetime.abort();
    assert.equal(frames.size, 0);
    assert.equal(rootAttrs.has('data-mkt-motion-ready'), false);
    browser.flush();
    assert.equal(styleValues.size, 0);
  });
});

test('CSS không nhúng tài nguyên ngoài, không emoji và không viết dồn thuộc tính', () => {
  const css = readFileSync(new URL('../../web/css/marketing-immersive.css', import.meta.url), 'utf8');
  assert.match(css, /mkt-stage\[data-mkt-pointer-active\]::after/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /mkt-hero__cover:focus-visible/);
  assert.doesNotMatch(css, /@import|fonts\.googleapis|cdn\./);
  assert.doesNotMatch(css, /[\p{Extended_Pictographic}]/u);
  assert.deepEqual(css.split('\n').filter(line => /;\s*[\w-]+\s*:/.test(line)), []);
});
