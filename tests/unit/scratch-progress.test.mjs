import test from 'node:test';
import assert from 'node:assert/strict';
import { scratchPercent, finishScratchOnRelease } from '../../web/js/shared/canvas/scratch-progress.js';

function rgba(alphas) {
  return Uint8ClampedArray.from(alphas.flatMap(alpha => [170, 130, 80, alpha]));
}
test('coverage measures erased alpha area rather than pointer events or repeated grid hits', () => {
  assert.equal(scratchPercent(rgba([255, 255, 255, 255])), 0);
  assert.equal(scratchPercent(rgba([0, 255, 255, 255])), 25);
  assert.equal(scratchPercent(rgba([0, 0, 255, 255])), 50);
  assert.equal(scratchPercent(rgba([0, 0, 0, 0])), 100);
  assert(Math.abs(scratchPercent(rgba([128, 128, 128, 128])) - 49.80392156862745) < 1e-8);
  assert.equal(scratchPercent(rgba([0, 255, 255, 255])), 25, 'a retraced stroke leaves the same erased pixels');
  assert.equal(scratchPercent(new Uint8ClampedArray()), 0);
});
test('exactly 90% stays partially scratched; only over 90% qualifies at release', () => {
  assert.equal(finishScratchOnRelease(0), false);
  assert.equal(finishScratchOnRelease(89), false);
  assert.equal(finishScratchOnRelease(90), false);
  assert.equal(finishScratchOnRelease(90.1), true);
  assert.equal(finishScratchOnRelease(91), true);
  assert.equal(finishScratchOnRelease(100), true);
});
