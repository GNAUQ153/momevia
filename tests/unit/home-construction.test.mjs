import test from 'node:test';
import assert from 'node:assert/strict';
import { constructionTravelFrames, createConstructionIdleLoop, mountHomeConstruction, wanderConstructionCursor } from '../../web/js/features/marketing/home-construction.js';

const flush = () => new Promise(resolve => setImmediate(resolve));

test('Task handoff follows a continuous curve from the displayed position without fading the cursor', () => {
  const frames = constructionTravelFrames({ x: 100, y: 150 }, { x: 600, y: 350 });
  assert.equal(frames[0].transform, 'translate3d(100px, 150px, 0)');
  assert.equal(frames.at(-1).transform, 'translate3d(600px, 350px, 0)');
  assert.ok(frames.every(frame => frame.opacity === 1));
  const points = frames.map(frame => frame.transform.match(/translate3d\(([-\d.]+)px, ([-\d.]+)px/).slice(1).map(Number));
  const velocities = points.slice(1).map((point, index) => point.map((value, axis) => value - points[index][axis]));
  for (let index = 1; index < velocities.length; index++) {
    assert.ok(Math.hypot(...velocities[index].map((value, axis) => value - velocities[index - 1][axis])) < 2);
  }
});

test('Idle flight preserves its final position for an immediate task handoff', async () => {
  const worker = { x: 200, y: 300, cursor: { style: {} } };
  let release, frames;
  const work = wanderConstructionCursor(worker, {
    width: 400, height: 600, top: 80, random: () => 0.5,
    animate: (cursor, nextFrames) => {
      assert.equal(cursor, worker.cursor);
      frames = nextFrames;
      return new Promise(resolve => { release = resolve; });
    },
  });
  assert.equal(worker.x, 200);
  release();
  await work;
  assert.ok(worker.x >= 12 && worker.x <= 376);
  assert.ok(worker.y >= 92 && worker.y <= 576);
  assert.notEqual(worker.x, 200);
  assert.equal(worker.cursor.style.transform, frames.at(-1).transform);
});

test('Idle cursors keep flying across waits, and a task claims only its own cursor', async () => {
  const worker = {}, other = {}, flights = new Map(), counts = new Map(), interruptions = [];
  const idle = createConstructionIdleLoop({
    running: () => true,
    fly: cursor => {
      counts.set(cursor, (counts.get(cursor) || 0) + 1);
      return new Promise((resolve, reject) => flights.set(cursor, { resolve, reject }));
    },
    interrupt: cursor => { interruptions.push(cursor); flights.get(cursor)?.reject(new Error('claimed')); },
  });
  idle.start(worker);
  idle.start(other);
  idle.start(worker);
  await flush();
  assert.equal(counts.get(worker), 1);
  flights.get(worker).resolve();
  await flush();
  assert.equal(counts.get(worker), 2);
  idle.claim(worker);
  await flush();
  assert.deepEqual(interruptions, [worker]);
  flights.get(other).resolve();
  await flush();
  assert.equal(counts.get(other), 2);
  assert.equal(counts.get(worker), 2);
  idle.start(worker);
  await flush();
  assert.equal(counts.get(worker), 3);
  idle.stop();
  await flush();
  assert.equal(counts.get(worker), 3);
  assert.equal(counts.get(other), 2);
});

test('Unsupported environments and aborted route lifetimes leave content untouched', () => {
  const controller = new AbortController();
  controller.abort();
  assert.doesNotThrow(() => mountHomeConstruction(null).dispose());
  assert.doesNotThrow(() => mountHomeConstruction({ ownerDocument: {} }, { signal: controller.signal }).refresh());
});
