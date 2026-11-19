import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, createElement, validateDocument } from '../../web/js/shared/canvas/index.js';
import { CROP_ANCHORS, getCropAnchor, normalizeFocalPoint, activeCropAnchor } from '../../web/js/features/canvas-editor/crop-presets.js';

test('Có đúng 9 vị trí crop và không trùng mã', () => {
  assert.equal(CROP_ANCHORS.length, 9);
  assert.equal(new Set(CROP_ANCHORS.map(item => item.id)).size, 9);
  assert.deepEqual(CROP_ANCHORS.map(item => [item.x, item.y]), [
    [0, 0], [0.5, 0], [1, 0], [0, 0.5], [0.5, 0.5],
    [1, 0.5], [0, 1], [0.5, 1], [1, 1],
  ]);
  assert(CROP_ANCHORS.every(Object.isFrozen));
});

test('Preset tạo tọa độ độc lập; không làm thay đổi cấu hình chung', () => {
  const point = getCropAnchor('tl');
  point.x = 0.75;
  assert.deepEqual(getCropAnchor('tl'), { x: 0, y: 0 });
  assert.deepEqual(getCropAnchor('mc'), { x: 0.5, y: 0.5 });
  assert.throws(() => getCropAnchor('unknown'), /không hợp lệ/);
});

test('Ảnh cũ thiếu focalPoint mặc định vào giữa, tọa độ lạ được giới hạn', () => {
  assert.deepEqual(normalizeFocalPoint(), { x: 0.5, y: 0.5 });
  assert.deepEqual(normalizeFocalPoint({ x: NaN, y: Infinity }), { x: 0.5, y: 0.5 });
  assert.deepEqual(normalizeFocalPoint({ x: -1, y: 2 }), { x: 0, y: 1 });
});

test('Chỉ đánh dấu nút khi khớp tọa độ, không làm tròn crop chính xác', () => {
  assert.equal(activeCropAnchor({ x: 0.5, y: 0.5 }), 'mc');
  assert.equal(activeCropAnchor({ x: 0.17, y: 0.83 }), null);
  assert.equal(activeCropAnchor({ x: 0, y: 1 }), 'bl');
});

test('Điểm lấy nét theo preset hợp lệ cho schema Canvas V1 và V2, không đổi asset/action', () => {
  const origin = createDocument({ presetId: 'envelope-basic' });
  const image = createElement('image', {
    id: 'crop-photo',
    layout: { x: 10, y: 10, width: 120, height: 120 },
    props: { assetId: null, focalPoint: { x: 0.3, y: 0.7 } },
  });
  origin.elements.push(image);
  origin.scenes[0].elementIds.push(image.id);
  const before = structuredClone(origin);
  for (const anchor of CROP_ANCHORS) {
    const draft = structuredClone(origin);
    draft.elements.find(item => item.id === image.id).props.focalPoint = getCropAnchor(anchor.id);
    assert.deepEqual(validateDocument(draft), draft);
    draft.schemaVersion = 2;
    draft.registryVersion = 2;
    assert.deepEqual(validateDocument(draft), draft);
    assert.equal(draft.elements.find(item => item.id === image.id).props.assetId, null);
    assert.deepEqual(draft.scenes[0].elementIds, origin.scenes[0].elementIds);
  }
  assert.deepEqual(origin, before);
});

test('Bảng crop được gắn vào phiên chỉnh sửa; không ép khóa cứng quyền Creator', async () => {
  const source = await import('node:fs/promises');
  const file = new URL('../../web/js/features/canvas-editor/crop.js', import.meta.url);
  const code = await source.readFile(file, 'utf8');
  assert.match(code, /if \(!editable\) return viewport;/);
  assert.match(code, /onChange\(point\)/);
  assert.match(code, /onPreview\(point\)/);
  assert.match(code, /aria-pressed/);
});
