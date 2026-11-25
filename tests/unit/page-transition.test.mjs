import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionPage, createPageTransition, sameDocument } from '../../web/js/core/page-transition.js';
import { createLayout } from '../../web/js/ui/layout.js';

function fixture(reduce = false) {
  const preference = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: reduce });
  const classes = new Set(), attrs = new Map(), motions = [];
  const root = { classList: {
    toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
    remove(name) { classes.delete(name); },
  } };
  const main = {
    setAttribute: (key, value) => attrs.set(key, value),
    removeAttribute: key => attrs.delete(key),
    animate(frames, options) {
      let resolve, reject;
      const motion = { frames, options, cancelled: false,
        finished: new Promise((done, fail) => { resolve = done; reject = fail; }),
        cancel() { this.cancelled = true; reject(new Error('cancelled')); },
        finish() { resolve(); },
      };
      motions.push(motion);
      return motion;
    },
  };
  return { main, root, attrs, classes, motions, motion: createPageTransition(main, root),
    restore() { globalThis.matchMedia = preference; } };
}

test('public navigation stays light and editor/player/checkout routes keep their own lifecycle', () => {
  for (const path of ['/', '/explore', '/template/sample', '/creator', '/about', '/pricing', '/login', '/register', '/recover', '/verify-email', '/policies/privacy']) assert(canTransitionPage(path), path);
  for (const path of ['/design/new', '/create/sample', '/g/123', '/admin', '/studio', '/payment-result', '/success/123', '/creator/extra', '/about-extra']) assert.equal(canTransitionPage(path), false, path);
  assert(sameDocument('/#one', 'https://momevia.invalid/#two'));
  assert(sameDocument('/explore?q=gift', '/explore?q=gift#results'));
  assert.equal(sameDocument('/explore?q=a', '/explore?q=b'), false);
  assert.equal(sameDocument('/about', '/creator'), false);
});

test('pending navigation leaves content visible and only animates when ready', async () => {
  const f = fixture();
  try {
    const ready = f.motion.begin(true);
    assert(f.classes.has('is-page-pending'));
    assert.equal(f.attrs.get('aria-busy'), 'true');
    assert.equal(f.motions.length, 0);
    ready();
    assert.equal(f.classes.size, 0);
    assert.equal(f.attrs.size, 0);
    assert.equal(f.motions.length, 1);
    assert(f.motions[0].frames[0].opacity > 0);
    assert.equal(f.motions[0].options.duration, 220);
    ready();
    assert.equal(f.motions.length, 1, 'Repeated completion must not replay motion');
    f.motions[0].finish();
    await f.motions[0].finished;
    await Promise.resolve();
    assert(f.motions[0].cancelled, 'Release animation state after completion');
  } finally { f.restore(); }
});

test('a late completion cannot clear the next page loading state or replay stale motion', () => {
  const f = fixture();
  try {
    const old = f.motion.begin(true);
    const latest = f.motion.begin(true);
    old();
    assert(f.classes.has('is-page-pending'));
    assert.equal(f.attrs.get('aria-busy'), 'true');
    assert.equal(f.motions.length, 0);
    latest();
    assert.equal(f.motions.length, 1);
  } finally { f.restore(); }
});

test('rapid navigation cancels entry and a nonanimated route clears pending state', async () => {
  const f = fixture();
  try {
    f.motion.begin(true)();
    f.motion.begin(true);
    assert(f.motions[0].cancelled);
    f.motion.begin(false)();
    assert.equal(f.classes.size, 0);
    assert.equal(f.attrs.size, 0);
    assert.equal(f.motions.length, 1);
    await Promise.allSettled(f.motions.map(item => item.finished));
  } finally { f.restore(); }
});

test('reduced motion and browsers without animation still complete navigation', () => {
  const f = fixture(true);
  try {
    f.motion.begin(true)();
    assert.equal(f.motions.length, 0);
    assert.equal(f.attrs.size, 0);
  } finally { f.restore(); }
  const noAnimation = fixture();
  try {
    delete noAnimation.main.animate;
    noAnimation.motion.begin(true)();
    assert.equal(noAnimation.classes.size, 0);
    assert.equal(noAnimation.attrs.size, 0);
  } finally { noAnimation.restore(); }
});

test('desktop and compact menu omit How it works, including on the home anchor', () => {
  const previous = globalThis.location;
  try {
    globalThis.location = { pathname: '/', hash: '#how-it-works' };
    const header = { innerHTML: '' }, footer = { innerHTML: '' };
    const layout = createLayout({ state: { user: null }, header, footer });
    layout.refreshNav();
    assert.doesNotMatch(header.innerHTML, /href="\/#how-it-works"|Cách hoạt động/);
    assert.equal((header.innerHTML.match(/href="\/explore" data-link/g) || []).length, 2);
    assert.equal((header.innerHTML.match(/href="\/" data-link class="is-active"/g) || []).length, 2);
    assert.match(header.innerHTML, /id="mobile-nav"/);
    assert.match(header.innerHTML, /href="\/creator"/);
  } finally { globalThis.location = previous; }
});
