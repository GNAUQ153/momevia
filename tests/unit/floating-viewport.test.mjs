import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldHideForEditing } from '../../web/js/ui/floating-cta.js';

const baseline = {
  editable: true,
  coarse: false,
  layoutHeight: 844,
  visualHeight: 844,
  scale: 1
};

const cases = [
  ['mobile focus', { coarse: true }, true],
  ['mobile blur', { editable: false, coarse: true }, false],
  ['desktop focus', {}, false],
  ['keyboard viewport', { visualHeight: 500 }, true],
  ['pinch zoom', { visualHeight: 500, scale: 2 }, false],
  ['missing viewport', { visualHeight: undefined }, false],
  ['threshold 120px', { visualHeight: 724 }, true],
  ['below threshold', { visualHeight: 725 }, false]
];

for (const [name, overrides, expected] of cases) {
  test(name, () => {
    assert.equal(
      shouldHideForEditing({ ...baseline, ...overrides }),
      expected
    );
  });
}
