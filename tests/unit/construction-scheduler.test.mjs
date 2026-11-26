import test from 'node:test';
import assert from 'node:assert/strict';
import { constructionTargetInViewport, createConstructionScheduler } from '../../web/js/features/marketing/construction-scheduler.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
const rect = (left, top, width = 250, height = 60) => ({ left, top, right: left + width, bottom: top + height, width, height });

test('Viewport bounds include every visible area and adapt to both screen dimensions', () => {
  const rightColumn = rect(900, 200), nextSection = rect(50, 1000);
  assert.equal(constructionTargetInViewport(rightColumn, { width: 1400, height: 1300, top: 80 }), true);
  assert.equal(constructionTargetInViewport(nextSection, { width: 1400, height: 1300, top: 80 }), true);
  assert.equal(constructionTargetInViewport(rightColumn, { width: 700, height: 1300, top: 80 }), false);
  assert.equal(constructionTargetInViewport(nextSection, { width: 1400, height: 800, top: 80 }), false);
});

test('Fifteen distinct cursors share all visible regions instead of filling only the first section', async () => {
  const targets = Array.from({ length: 40 }, (_, id) => ({ id, region: id < 20 ? 'hero' : 'featured' }));
  const assignments = [], releases = new Map();
  let concurrent = 0, maximum = 0, returned = false;
  const scheduler = createConstructionScheduler({
    targets: () => targets, group: target => target.region, running: () => true,
    build: (target, worker) => {
      assignments.push({ target, worker });
      concurrent++; maximum = Math.max(maximum, concurrent);
      const gate = deferred(); releases.set(target.id, gate.resolve);
      return gate.promise.finally(() => { concurrent--; });
    },
    complete: async () => { returned = true; },
  });
  const work = scheduler.run();
  await flush();
  assert.equal(assignments.length, 15);
  assert.equal(new Set(assignments.map(job => job.worker)).size, 15);
  assert.equal(new Set(assignments.map(job => job.target.id)).size, 15);
  const regions = assignments.reduce((counts, job) => ({ ...counts, [job.target.region]: (counts[job.target.region] || 0) + 1 }), {});
  assert.ok(regions.hero >= 7 && regions.featured >= 7);
  const first = assignments[0];
  releases.get(first.target.id)();
  await flush();
  assert.equal(assignments.length, 16);
  assert.equal(assignments.at(-1).worker, first.worker);
  assert.equal(returned, false);
  for (let pass = 0; pass < 5; pass++) {
    for (const release of releases.values()) release();
    await flush();
  }
  assert.equal(await work, true);
  assert.equal(assignments.length, 40);
  assert.equal(maximum, 15);
  assert.equal(returned, true);
});

test('Growing the window immediately supplies newly visible regions while the first region is still building', async () => {
  const targets = [{ id: 'hero', bounds: rect(40, 120) }, { id: 'lower', bounds: rect(40, 1000) }, { id: 'right', bounds: rect(1100, 150) }];
  const assignments = [], gates = new Map(), moving = deferred();
  let viewport = { width: 700, height: 700, top: 80 };
  const scheduler = createConstructionScheduler({
    targets: () => targets, running: () => true,
    available: target => target.bounds.left < viewport.width,
    visible: target => constructionTargetInViewport(target.bounds, viewport),
    build: target => { assignments.push(target.id); const gate = deferred(); gates.set(target.id, gate); return gate.promise; },
    advance: () => moving.promise, complete: async () => {},
  });
  const work = scheduler.run();
  await flush();
  assert.deepEqual(assignments, ['hero']);
  viewport = { width: 1400, height: 1400, top: 80 };
  scheduler.notify();
  await flush();
  assert.deepEqual(assignments, ['hero', 'lower', 'right']);
  for (const gate of gates.values()) gate.resolve();
  moving.resolve();
  assert.equal(await work, true);
});

test('A slow parent blocks its own children but never blocks other visible sections', async () => {
  const child = { id: 'child', region: 'hero' };
  const parent = { id: 'parent', region: 'hero', contains: item => item === child };
  const elsewhere = { id: 'elsewhere', region: 'featured' };
  const log = [], gates = new Map();
  const scheduler = createConstructionScheduler({
    targets: () => [parent, child, elsewhere], group: target => target.region, running: () => true,
    build: target => { log.push(target.id); const gate = deferred(); gates.set(target.id, gate); return gate.promise; },
    complete: async () => {},
  });
  const work = scheduler.run();
  await flush();
  assert.deepEqual(log, ['parent', 'elsewhere']);
  gates.get('elsewhere').resolve();
  await flush();
  assert.equal(log.includes('child'), false);
  gates.get('parent').resolve();
  await flush();
  assert.deepEqual(log, ['parent', 'elsewhere', 'child']);
  gates.get('child').resolve();
  assert.equal(await work, true);
});

test('Auto-scroll can expose new work before the last visible element finishes; return to top waits for all work', async () => {
  const first = { id: 'first' }, next = { id: 'next' };
  const log = [], gates = new Map();
  let revealNext = false;
  const scheduler = createConstructionScheduler({
    targets: () => [first, next], visible: target => target === first || revealNext, running: () => true,
    build: target => { log.push(target.id); const gate = deferred(); gates.set(target.id, gate); return gate.promise; },
    advance: async (target, active) => {
      assert.equal(target, next);
      assert.ok(active.includes(first));
      log.push('scroll'); revealNext = true; scheduler.notify();
    },
    complete: async () => log.push('top'),
  });
  const work = scheduler.run();
  await flush();
  assert.ok(log.includes('next'));
  assert.equal(log.includes('top'), false);
  gates.get('next').resolve();
  await flush();
  assert.equal(log.includes('top'), false);
  gates.get('first').resolve();
  assert.equal(await work, true);
  assert.equal(log.at(-1), 'top');
});

test('Async catalog content joins the same queue without restarting workers or finishing early', async () => {
  let targets = [], loading = true, returned = false;
  const built = [];
  const scheduler = createConstructionScheduler({
    targets: () => targets, running: () => true, pendingContent: () => loading,
    build: async target => built.push(target), complete: async () => { returned = true; },
  });
  const work = scheduler.run();
  await flush();
  assert.equal(returned, false);
  targets = ['loaded-cover', 'loaded-title']; loading = false; scheduler.notify();
  assert.equal(await work, true);
  assert.deepEqual(built, targets);
});

test('Route cancellation stops dispatch and does not perform the final return scroll', async () => {
  let running = true, returned = false;
  const gate = deferred();
  const scheduler = createConstructionScheduler({
    targets: () => ['element'], running: () => running, build: () => gate.promise,
    complete: async () => { returned = true; },
  });
  const work = scheduler.run();
  await flush();
  running = false; scheduler.notify();
  assert.equal(await work, false);
  assert.equal(returned, false);
  gate.resolve();
});

test('A temporarily unscrollable target waits for a viewport change without spinning', async () => {
  let shown = false, scrollAttempts = 0;
  const scheduler = createConstructionScheduler({
    targets: () => ['target'], running: () => true, visible: () => shown,
    advance: async () => { scrollAttempts++; return false; },
    build: async () => {}, complete: async () => {},
  });
  const work = scheduler.run();
  await flush();
  await flush();
  assert.equal(scrollAttempts, 1);
  shown = true; scheduler.notify();
  assert.equal(await work, true);
});
