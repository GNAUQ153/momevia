import test from 'node:test';
import assert from 'node:assert/strict';
import {
  zoomLevels, libraryTabs, sceneActions, starterActions,
  toPercent, stopKeys, readableInk,
} from '../../web/js/features/canvas-editor/designer-helpers.js';

test('Designer giữ nguyên bậc zoom, tab thư viện và tác vụ cảnh', () => {
  assert.deepEqual(zoomLevels, [0.25, 0.5, 0.75, 1, 1.5, 2]);
  assert.deepEqual(Object.keys(libraryTabs), ['add', 'content', 'assets', 'layers', 'sounds']);
  assert(sceneActions.some(([label, code]) => label === 'Nhân bản cảnh' && code === 'scene-duplicate'));
  assert.equal(starterActions.blank, 'create-blank');
});

test('Tính phần trăm và tương phản chữ giữ nguyên hành vi', () => {
  assert.equal(toPercent(0.123456), 12.35);
  assert.equal(toPercent(1), 100);
  assert.equal(readableInk('#FFFFFF'), '#000000');
  assert.equal(readableInk('#000000'), '#FFFFFF');
  assert.equal(readableInk('#123456'), '#FFFFFF');
});

test('Phím tắt không chặn thao tác nhập văn bản', () => {
  assert.equal(stopKeys(null), undefined);
  assert.equal(stopKeys({ closest: () => null }), null);
  const input = { tagName: 'INPUT' };
  assert.equal(stopKeys({ closest: selector => selector.includes('input') ? input : null }), input);
});
