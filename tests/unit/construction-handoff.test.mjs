import test from 'node:test';
import assert from 'node:assert/strict';
import { handoffConstructionCursors, trackConstructionPointer } from '../../web/js/features/marketing/construction-handoff.js';

function clock() {
  const frames = new Map();
  let id = 0;
  const view = Object.assign(new EventTarget(), {
    innerWidth: 1000, innerHeight: 800,
    requestAnimationFrame: callback => { frames.set(++id, callback); return id; },
    cancelAnimationFrame: handle => frames.delete(handle),
  });
  return { view, frames, step(now) {
    const next = [...frames.values()];
    frames.clear();
    next.forEach(callback => callback(now));
  } };
}
const workers = count => Array.from({ length: count }, () => ({ x: 900, y: 700, cursor: { style: {} } }));

test('all workers split from one pointer position before spreading into distinct visible positions', async () => {
  const time = clock(), cursors = workers(15), controller = new AbortController();
  const work = handoffConstructionCursors({ view: time.view, workers: cursors, pointer: () => ({ x: 90, y: 120 }),
    signal: controller.signal, running: () => true, mode: 'split', duration: 500 });
  assert(cursors.every(cursor => cursor.x === 90 && cursor.y === 120 && cursor.cursor.style.opacity === '0'));
  time.step(0);
  time.step(250);
  assert(new Set(cursors.map(cursor => cursor.cursor.style.transform)).size === 15);
  time.step(500);
  assert.equal(await work, true);
  assert(cursors.every(cursor => cursor.x >= 12 && cursor.x <= 976 && cursor.y >= 12 && cursor.y <= 776));
  assert(cursors.every(cursor => cursor.cursor.style.opacity === '1'));
  assert.equal(time.frames.size, 0);
});

test('reunion follows a moving pointer and hides every worker at its current position', async () => {
  const time = clock(), cursors = workers(15), controller = new AbortController();
  let pointer = { x: 200, y: 100 };
  const work = handoffConstructionCursors({ view: time.view, workers: cursors, pointer: () => pointer,
    signal: controller.signal, running: () => true, mode: 'merge' });
  time.step(0);
  time.step(275);
  assert(cursors.every(cursor => cursor.x < 900 && cursor.cursor.style.opacity === '1'));
  pointer = { x: 520, y: 330 };
  time.step(550);
  assert.equal(await work, true);
  assert(cursors.every(cursor => Math.abs(cursor.x - 520) < 0.001 && Math.abs(cursor.y - 330) < 0.001));
  assert(cursors.every(cursor => Number(cursor.cursor.style.opacity) < 0.001));
  assert.equal(time.frames.size, 0);
});

for (const mode of ['split', 'merge']) test(`route cancellation interrupts ${mode} without leaving an animation frame`, async () => {
  const time = clock(), cursors = workers(3), controller = new AbortController();
  const work = handoffConstructionCursors({ view: time.view, workers: cursors, pointer: () => ({ x: 200, y: 100 }),
    signal: controller.signal, running: () => true, mode });
  time.step(0);
  time.step(150);
  const interrupted = structuredClone(cursors);
  controller.abort();
  assert.equal(await work, false);
  assert.equal(time.frames.size, 0);
  time.step(1000);
  assert.deepEqual(cursors, interrupted);
});

test('stopping construction resolves the handoff without continuing to move cursors', async () => {
  const time = clock(), cursors = workers(2), controller = new AbortController();
  let running = true;
  const work = handoffConstructionCursors({ view: time.view, workers: cursors, pointer: () => ({ x: 10, y: 20 }),
    signal: controller.signal, running: () => running, mode: 'merge' });
  time.step(0);
  running = false;
  time.step(100);
  assert.equal(await work, false);
  assert.equal(time.frames.size, 0);
});

test('pointer tracking ignores touch, survives viewport changes and stops with the route lifetime', () => {
  const { view } = clock(), controller = new AbortController();
  const pointer = trackConstructionPointer(view, controller.signal);
  const move = (type, x, y) => view.dispatchEvent(Object.assign(new Event('pointermove'), { pointerType: type, clientX: x, clientY: y }));
  assert.deepEqual(pointer(), { x: 500, y: 240 });
  move('mouse', 700, 650);
  move('touch', 10, 20);
  assert.deepEqual(pointer(), { x: 700, y: 650 });
  view.innerWidth = 390; view.innerHeight = 600;
  assert.deepEqual(pointer(), { x: 389, y: 599 });
  controller.abort();
  move('pen', 30, 40);
  assert.deepEqual(pointer(), { x: 389, y: 599 });
});
