import test from 'node:test';
import assert from 'node:assert/strict';
import { createHeroCtaMotion } from '../../web/js/ui/hero-cta-motion.js';

function fixture(reduce = false) {
  const old = globalThis.matchMedia;
  const preference = { matches: reduce, addEventListener() {} };
  globalThis.matchMedia = () => preference;
  let top = 400;
  const flights = [], classes = new Set();
  const rect = (left, y) => ({ left, top: y, bottom: y + 48, width: 160, height: 48 });
  const source = { getBoundingClientRect: () => ({ ...rect(50, top), width: 340 }),
    querySelectorAll: () => [0, 1].map(i => ({ getBoundingClientRect: () => rect(50 + i * 180, top) })) };
  const panel = { inert: false, classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
    querySelectorAll: () => [0, 1].map(i => ({ getBoundingClientRect: () => rect(1000, 600 + i * 56),
      animate(frames, options) {
        let resolve;
        const finished = new Promise(done => { resolve = done; });
        const flight = { frames, options, resolve, finished, cancelled: false, cancel() { this.cancelled = true; resolve(); } };
        flights.push(flight); return flight;
      },
    })) };
  const motion = createHeroCtaMotion(panel);
  return { motion, source, panel, flights, classes, preference,
    scrollTo: value => { top = value; }, restore: () => { globalThis.matchMedia = old; } };
}

test('the two dock actions fly once after the banner leaves and become clickable on arrival', async () => {
  const f = fixture();
  try {
    assert.equal(f.motion.prepare(f.source, 84), false);
    f.motion.sync(false); assert.equal(f.flights.length, 0);
    f.scrollTo(-60); assert.equal(f.motion.prepare(f.source, 84), true);
    f.motion.sync(true); assert.equal(f.flights.length, 2); assert.equal(f.panel.inert, true);
    assert(f.classes.has('floating-cta--travelling'));
    for (const [index, flight] of f.flights.entries()) {
      assert(flight.frames[0].transform.includes(`translate(${-950 + index * 180}px,`));
      assert.equal(flight.frames.at(-1).transform, 'translate(0, 0) scale(1, 1)');
      assert(flight.options.duration > 0 && flight.options.duration < 1000);
      flight.resolve();
    }
    await Promise.allSettled(f.flights.map(flight => flight.finished)); await Promise.resolve();
    assert.equal(f.panel.inert, false); assert.equal(f.classes.size, 0);
    f.motion.sync(true); assert.equal(f.flights.length, 2);
    f.scrollTo(300); assert.equal(f.motion.prepare(f.source, 84), false);
    f.scrollTo(-60); f.motion.prepare(f.source, 84); f.motion.sync(true);
    assert.equal(f.flights.length, 4, 'Returning to the banner arms the next downward transition');
    f.motion.sync(false);
  } finally { f.restore(); }
});

test('reduced motion shows the dock without flying or temporarily disabling its actions', () => {
  const f = fixture(true);
  try {
    f.motion.prepare(f.source, 84); f.scrollTo(-60); f.motion.prepare(f.source, 84); f.motion.sync(true);
    assert.equal(f.flights.length, 0); assert.equal(f.panel.inert, false); assert.equal(f.classes.size, 0);
  } finally { f.restore(); }
});

test('footer hiding and navigation cancel travel without leaving controls inert', async () => {
  const f = fixture();
  try {
    f.motion.prepare(f.source, 84); f.scrollTo(-60); f.motion.prepare(f.source, 84); f.motion.sync(true);
    f.motion.sync(false); assert(f.flights.every(flight => flight.cancelled));
    assert.equal(f.panel.inert, false); assert.equal(f.classes.size, 0);
    assert.equal(f.motion.prepare(null, 84), false); f.motion.sync(true);
    await Promise.allSettled(f.flights.map(flight => flight.finished));
    assert.equal(f.flights.length, 2); assert.equal(f.panel.inert, false);
  } finally { f.restore(); }
});

test('restored scroll positions start below the header while retaining the hero alignment', () => {
  const f = fixture();
  try {
    f.scrollTo(-600); assert.equal(f.motion.prepare(f.source, 84), true); f.motion.sync(true);
    assert.equal(f.flights.length, 2);
    assert.match(f.flights[0].frames[0].transform, /translate\(-950px, -504px\)/);
    f.motion.sync(false);
  } finally { f.restore(); }
});
