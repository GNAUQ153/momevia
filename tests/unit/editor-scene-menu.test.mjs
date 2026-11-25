import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneMenuPlacement } from '../../web/js/features/canvas-editor/scene-menu.js';
import { createEditorSceneMotion } from '../../web/js/features/canvas-editor/scene-motion.js';

test('scene popup opens above a bottom-row card and stays in the viewport at either edge', () => {
  const menu = { width: 204, height: 220 }, viewport = { width: 1129, height: 900 };
  assert.deepEqual(sceneMenuPlacement({ right: 180, top: 800, bottom: 832 }, menu, viewport), { left: 12, top: 572, maxHeight: 876 });
  const right = sceneMenuPlacement({ right: 1130, top: 800, bottom: 832 }, menu, viewport);
  assert(right.left + menu.width <= viewport.width - 12);
});

test('scene popup can open below a card and remains usable in short/narrow viewports', () => {
  const menu = { width: 204, height: 220 };
  assert.equal(sceneMenuPlacement({ right: 300, top: 30, bottom: 62 }, menu, { width: 390, height: 844 }).top, 70);
  for (const viewport of [{ width: 320, height: 640 }, { width: 844, height: 390 }, { width: 240, height: 200 }]) {
    const p = sceneMenuPlacement({ right: viewport.width - 2, top: viewport.height - 30, bottom: viewport.height }, menu, viewport);
    assert(p.left >= 12 && p.top >= 12);
    assert(p.left + Math.min(menu.width, viewport.width - 24) <= viewport.width - 12);
    assert(p.top + Math.min(menu.height, p.maxHeight) <= viewport.height - 12);
  }
});

function motionFixture(reduce = false) {
  const lifecycle = new AbortController(), handlers = new Map(), animations = [];
  const preference = { matches: reduce, addEventListener: (event, handler) => handlers.set(event, handler) };
  const board = { animate(frames, options) {
    let resolve, reject;
    const animation = { frames, options, cancelled: false,
      finished: new Promise((yes, no) => { resolve = yes; reject = no; }),
      cancel() { this.cancelled = true; reject(new Error('cancelled')); },
      finish() { resolve(); },
    };
    animations.push(animation);
    return animation;
  } };
  return { lifecycle, preference, handlers, animations, motion: createEditorSceneMotion(board, { signal: lifecycle.signal, preference }) };
}

test('editor scene feedback only runs for a scene change, without touching canvas zoom', async () => {
  const f = motionFixture();
  f.motion.sync('a'); f.motion.sync('a');
  assert.equal(f.animations.length, 0);
  f.motion.sync('b'); f.motion.sync('b');
  assert.equal(f.animations.length, 1);
  assert.equal(f.animations[0].options.duration, 180);
  assert(f.animations[0].frames[0].opacity > 0);
  assert(f.animations[0].frames.every(frame => !('transform' in frame)));
  f.animations[0].finish(); await f.animations[0].finished; await Promise.resolve();
  assert(f.animations[0].cancelled);
});

test('rapid scene changes, reduced motion and disposal cancel stale animations', async () => {
  const f = motionFixture();
  f.motion.sync('a'); f.motion.sync('b'); f.motion.sync('c');
  assert(f.animations[0].cancelled);
  f.preference.matches = true; f.handlers.get('change')();
  assert(f.animations[1].cancelled);
  f.motion.sync('d'); assert.equal(f.animations.length, 2);
  f.preference.matches = false; f.motion.sync('e');
  f.lifecycle.abort(); assert(f.animations[2].cancelled);
  f.motion.sync('f'); assert.equal(f.animations.length, 3);
  await Promise.allSettled(f.animations.map(animation => animation.finished));
});

test('editor scene changes work with reduced motion or without the animation API', () => {
  const f = motionFixture(true);
  f.motion.sync('a'); f.motion.sync('b');
  assert.equal(f.animations.length, 0);
  const preference = { matches: false, addEventListener() {} };
  const motion = createEditorSceneMotion({}, { signal: new AbortController().signal, preference });
  assert.doesNotThrow(() => { motion.sync('a'); motion.sync('b'); });
});
