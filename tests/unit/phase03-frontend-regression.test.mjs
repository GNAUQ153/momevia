import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { mountFeaturedCarousel } from '../../web/js/features/marketing/featured-carousel.js';

// Fixture vòng đời thực của carousel, không dùng thời gian chờ hoặc mạng thật.
function fixture(t, { saveData = false } = {}) {
  const globals = new Map();
  function set(name, value) {
    globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  const document = new EventTarget();
  document.hidden = false;
  document.querySelector = () => null;
  document.getElementById = () => null;
  const reduce = new EventTarget(), data = new EventTarget(), connection = new EventTarget();
  reduce.matches = data.matches = false;
  connection.saveData = saveData;
  const timers = new Map(), observers = [], motions = [];
  let nextTimer = 0, decodeCalls = 0, focus = false;
  let decode = () => Promise.resolve();
  const image = { hasAttribute: () => false, decode: () => { decodeCalls++; return decode(); } };
  const cards = Array.from({ length: 5 }, (_, i) => ({
    dataset: { templateId: `card-${i}` }, inert: false, attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    querySelectorAll: () => [image],
  }));
  const track = {
    children: cards,
    get firstElementChild() { return cards[0]; },
    append(card) { cards.splice(cards.indexOf(card), 1); cards.push(card); },
    animate() {
      let resolve, reject;
      const finished = new Promise((yes, no) => { resolve = yes; reject = no; });
      const motion = { finished, playState: 'running', canceled: 0,
        pause() { this.playState = 'paused'; }, play() { this.playState = 'running'; },
        cancel() { this.canceled++; this.playState = 'idle'; reject(new Error('canceled')); },
        finish() { this.playState = 'finished'; resolve(); },
      };
      motions.push(motion); return motion;
    },
  };
  for (const card of cards) Object.defineProperty(card, 'offsetLeft', { get: () => cards.indexOf(card) * 100 });
  const viewport = { clientWidth: 300 };
  const root = new EventTarget();
  root.dataset = {};
  root.closest = () => null;
  root.querySelector = selector => selector === '[data-featured-viewport]' ? viewport : selector === '[data-featured-track]' ? track : selector === ':focus-visible' && focus ? cards[0] : null;
  class Observer {
    constructor(callback) { this.callback = callback; this.disconnects = 0; observers.push(this); }
    observe() {}
    disconnect() { this.disconnects++; }
  }
  set('document', document); set('navigator', { connection });
  set('matchMedia', query => query.includes('motion') ? reduce : data);
  set('getComputedStyle', () => ({ getPropertyValue: () => '3' }));
  set('ResizeObserver', Observer); set('IntersectionObserver', Observer); set('MutationObserver', Observer);
  set('setInterval', callback => { timers.set(++nextTimer, callback); return nextTimer; });
  set('clearInterval', id => timers.delete(id));
  const component = mountFeaturedCarousel({ querySelector: () => root });
  t.after(() => {
    component.dispose();
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  });
  return { root, track, document, reduce, data, connection, timers, observers, motions, component,
    visible(value = true) { observers[1].callback([{ isIntersecting: value, intersectionRatio: value ? 1 : 0 }]); },
    tick() { assert.equal(timers.size, 1); [...timers.values()][0](); },
    setFocus(value) { focus = value; root.dispatchEvent(new Event(value ? 'focusin' : 'focusout')); },
    setDecode(fn) { decode = fn; }, get decodeCalls() { return decodeCalls; },
  };
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test('Carousel không tải trước ảnh khi bật Save-Data hoặc Reduced Motion', async t => {
  const f = fixture(t, { saveData: true });
  f.visible(); await flush();
  assert.equal(f.decodeCalls, 0); assert.equal(f.timers.size, 0);
  f.connection.saveData = false; f.reduce.matches = true;
  f.reduce.dispatchEvent(new Event('change')); f.visible(); await flush();
  assert.equal(f.decodeCalls, 0); assert.equal(f.timers.size, 0);
  f.reduce.matches = false; f.reduce.dispatchEvent(new Event('change'));
  assert.equal(f.timers.size, 1);
});

test('Carousel trượt đúng một thẻ, giữ DOM và chỉ mở ba thẻ cho bàn phím', async t => {
  const f = fixture(t); const second = f.track.children[1];
  f.visible(); f.tick(); await flush();
  assert.equal(f.motions.length, 1);
  f.motions[0].finish(); await flush();
  assert.equal(f.track.firstElementChild, second);
  assert.equal(f.root.dataset.featuredWindow, 'card-1,card-2,card-3');
  assert.deepEqual(f.track.children.map(card => card.inert), [false, false, false, true, true]);
  assert.deepEqual(f.track.children.map(card => card.attributes['aria-hidden']), ['false', 'false', 'false', 'true', 'true']);
});

test('Carousel hủy chuyển động khi focus bàn phím, tiếp tục sau khi bỏ focus', async t => {
  const f = fixture(t); f.visible(); f.tick(); await flush();
  f.setFocus(true); await flush();
  assert.equal(f.motions[0].canceled, 1); assert.equal(f.timers.size, 0);
  assert.equal(f.root.dataset.featuredStart, '0');
  f.setFocus(false); await flush(); assert.equal(f.timers.size, 1);
  f.visible(false); assert.equal(f.timers.size, 0);
});

test('Dispose khi đang decode không tạo animation và chặn callback observer trễ', async t => {
  const f = fixture(t); const pending = [];
  f.setDecode(() => new Promise(resolve => { pending.push(resolve); }));
  // Khởi tạo timer trước rồi bắt đầu tải ảnh từ advance.
  f.visible(); f.tick(); await flush();
  const calls = f.decodeCalls, oldTick = [...f.timers.values()][0];
  f.component.dispose(); f.component.dispose();
  f.visible(); oldTick(); pending.forEach(resolve => resolve()); await flush();
  assert.equal(f.decodeCalls, calls); assert.equal(f.motions.length, 0);
  assert.equal(f.root.dataset.featuredRunning, 'false'); assert.equal(f.timers.size, 0);
  assert.deepEqual(f.observers.map(o => o.disconnects), [1, 1, 1]);
  assert.equal(getEventListeners(f.root, 'focusin').length, 0);
  assert.equal(getEventListeners(f.document, 'visibilitychange').length, 0);
});

test('Dispose giữa animation không đổi thứ tự thẻ và không tạo timer mới', async t => {
  const f = fixture(t); f.visible(); f.tick(); await flush();
  f.component.dispose(); await flush();
  assert.equal(f.motions[0].canceled, 1);
  assert.equal(f.root.dataset.featuredStart, '0'); assert.equal(f.timers.size, 0);
  assert.equal(f.root.dataset.featuredPhase, 'idle');
});

test('Ẩn tab dừng timer và tạm dừng animation, mở lại chỉ có một timer', async t => {
  const f = fixture(t); f.visible(); f.tick(); await flush();
  const motion = f.motions[0];
  f.document.hidden = true; f.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(motion.playState, 'paused'); assert.equal(f.timers.size, 0);
  f.document.hidden = false; f.document.dispatchEvent(new Event('visibilitychange'));
  f.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(motion.playState, 'running'); assert.equal(f.timers.size, 1);
  motion.finish(); await flush(); assert.equal(f.root.dataset.featuredStart, '1');
});

test('Mount lại trên cùng host không để callback carousel cũ tác động carousel mới', async t => {
  const f = fixture(t); f.visible(); f.tick(); await flush();
  const oldTick = [...f.timers.values()][0], oldMotion = f.motions[0];
  f.component.dispose();
  const next = mountFeaturedCarousel({ querySelector: () => f.root });
  try {
    f.observers[4].callback([{ isIntersecting: true, intersectionRatio: 1 }]);
    const calls = f.decodeCalls;
    f.visible(); oldTick(); oldMotion.finish(); await flush();
    assert.equal(f.decodeCalls, calls); assert.equal(f.timers.size, 1);
    assert.equal(f.root.dataset.featuredStart, '0'); assert.equal(f.root.dataset.featuredRunning, 'true');
    assert.equal(getEventListeners(f.document, 'visibilitychange').length, 1);
  } finally { next.dispose(); }
  assert.equal(f.timers.size, 0);
});
