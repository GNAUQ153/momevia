import test from 'node:test';
import assert from 'node:assert/strict';
import { createModalIsolation } from '../../web/js/ui/accessibility.js';
import { createCtaExitMotion } from '../../web/js/ui/cta-exit-motion.js';

function fixture(reduce = false) {
  const previous = globalThis.matchMedia;
  const preference = { matches: reduce, addEventListener() {} };
  globalThis.matchMedia = () => preference;
  const classes = new Set(), attrs = new Map(), motions = [];
  const nav = { animate(frames, options) {
    let resolve, reject;
    const finished = new Promise((done, fail) => { resolve = done; reject = fail; });
    const motion = { frames, options, finished, resolve, cancelled: false, cancel() { this.cancelled = true; reject(new Error('cancelled')); } };
    motions.push(motion); return motion;
  } };
  const panel = { hidden: false, inert: false, querySelector: () => nav,
    classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
    setAttribute: (name, value) => attrs.set(name, value), removeAttribute: name => attrs.delete(name) };
  return { panel, motions, classes, attrs, controller: createCtaExitMotion(panel), restore: () => { globalThis.matchMedia = previous; } };
}

test('hide slides right while disabling interaction, then removes the panel from layout', async () => {
  const f = fixture();
  try {
    f.controller.sync(false);
    assert.equal(f.panel.hidden, false); assert.equal(f.panel.inert, true);
    assert.equal(f.attrs.get('aria-hidden'), 'true');
    assert(f.classes.has('floating-cta--leaving'));
    assert.equal(f.motions.length, 1);
    assert.match(f.motions[0].frames.at(-1).transform, /translateX\(calc\(100% \+ 48px\)\)/);
    assert(f.motions[0].options.duration > 0 && f.motions[0].options.duration < 400);
    f.controller.sync(false); assert.equal(f.motions.length, 1, 'Scroll events do not restart the exit');
    f.motions[0].resolve(); await f.motions[0].finished; await Promise.resolve();
    assert.equal(f.panel.hidden, true); assert.equal(f.panel.inert, false); assert.equal(f.classes.size, 0);
  } finally { f.restore(); }
});

test('show cancels an unfinished exit and stale completion cannot hide the buttons again', async () => {
  const f = fixture();
  try {
    f.controller.sync(false); f.controller.sync(true);
    assert.equal(f.motions[0].cancelled, true);
    await Promise.allSettled([f.motions[0].finished]);
    assert.equal(f.panel.hidden, false); assert.equal(f.panel.inert, true);
    assert(f.classes.has('floating-cta--entering'));
    f.motions[1].resolve(); await f.motions[1].finished;
    assert.equal(f.attrs.has('aria-hidden'), false); assert.equal(f.classes.size, 0);
    assert.equal(f.panel.inert, false);
    f.controller.sync(false); assert.equal(f.motions.length, 3);
    f.motions[2].resolve(); await f.motions[2].finished;
    assert.equal(f.panel.hidden, true);
  } finally { f.restore(); }
});

test('a hidden dock slides in from the right, while hero arrival can skip that second motion', async () => {
  const f = fixture();
  try {
    f.panel.hidden = true; f.controller.sync(true);
    assert.equal(f.panel.hidden, false); assert.equal(f.panel.inert, true);
    assert.match(f.motions[0].frames[0].transform, /translateX\(calc\(100% \+ 48px\)\)/);
    assert.equal(f.motions[0].frames.at(-1).transform, 'translateX(0)');
    f.motions[0].resolve(); await f.motions[0].finished;
    assert.equal(f.panel.inert, false);
    f.panel.hidden = true; f.controller.sync(true, { animate: false });
    assert.equal(f.motions.length, 1); assert.equal(f.panel.inert, false); assert.equal(f.panel.hidden, false);
    f.panel.hidden = true; f.controller.sync(true);
    f.controller.sync(true, { animate: false });
    assert.equal(f.motions[1].cancelled, true, 'Hero flight replaces an in-progress generic entrance');
    assert.equal(f.panel.hidden, false); assert.equal(f.panel.inert, false);
    await Promise.allSettled([f.motions[1].finished]);
  } finally { f.restore(); }
});

test('reduced motion hides immediately without a slide', () => {
  const f = fixture(true);
  try {
    f.controller.sync(false);
    assert.equal(f.panel.hidden, true); assert.equal(f.panel.inert, false); assert.equal(f.motions.length, 0);
    f.controller.sync(true); assert.equal(f.panel.hidden, false);
  } finally { f.restore(); }
});

test('showing an already visible panel preserves the hero arrival interaction lock', () => {
  const f = fixture();
  try {
    f.panel.inert = true; f.controller.sync(true);
    assert.equal(f.panel.inert, true); assert.equal(f.motions.length, 0);
  } finally { f.restore(); }
});


test('Modal giữ khóa khi animation CTA hoàn tất hoặc bị thay thế', async () => {
  const f = fixture();
  try {
    const modal = createModalIsolation(() => [f.panel]);
    f.controller.sync(false);
    modal.activate();
    f.controller.sync(true);
    await Promise.allSettled([f.motions[0].finished]);
    assert.equal(f.panel.inert, true);
    f.motions[1].resolve(); await f.motions[1].finished;
    assert.equal(f.panel.inert, true);
    modal.restore();
    assert.equal(f.panel.inert, false);
    modal.activate();
    f.controller.sync(false);
    modal.restore();
    assert.equal(f.panel.inert, true);
    f.motions[2].resolve(); await f.motions[2].finished;
    assert.equal(f.panel.inert, false);
  } finally { f.restore(); }
});
