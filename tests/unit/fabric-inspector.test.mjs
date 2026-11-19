import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readInspectorGeometry,
  validateInspectorGeometry,
  updateInspectorField,
  centerInspectorGeometry,
  applyInspectorGeometry,
  canInspectFabricShape,
} from '../../web/js/features/canvas-editor/fabric-inspector.js';

const shape = () => ({
  momeviaId: 'text-a',
  width: 200,
  height: 50,
  momeviaBaseHeight: 60,
  scaleX: 1,
  scaleY: 1,
  left: 140,
  top: 100,
  angle: 15,
  selectable: true,
  visible: true,
  set(data) { Object.assign(this, data); },
  setCoords() { this.coordsUpdated = true; },
});

test('đọc đúng tọa độ top-left từ Fabric tâm, sử dụng chiều cao text gốc', () => {
  assert.deepEqual(readInspectorGeometry(shape()), {
    x: 40, y: 70, width: 200, height: 60, rotation: 15,
  });
});

test('thay đổi X/Y không làm thay đổi chiều rộng và chiều cao', () => {
  const original = shape();
  applyInspectorGeometry(original, { ...readInspectorGeometry(original), x: 20, y: 30 });
  assert.equal(original.left, 120);
  assert.equal(original.top, 60);
  assert.equal(original.width * original.scaleX, 200);
  assert.equal(original.momeviaBaseHeight * original.scaleY, 60);
  assert.equal(original.coordsUpdated, true);
});

test('đổi kích thước qua scale, không thay đổi dữ liệu vật lý của Textbox', () => {
  const original = shape();
  applyInspectorGeometry(original, { ...readInspectorGeometry(original), width: 250, height: 80 });
  assert.equal(original.width, 200);
  assert.equal(original.momeviaBaseHeight, 60);
  assert.equal(original.scaleX, 1.25);
  assert.equal(original.scaleY, 80 / 60);
  assert.deepEqual(readInspectorGeometry(original), {
    x: 40, y: 70, width: 250, height: 80, rotation: 15,
  });
});

test('căn giữa theo chiều ngang/dọc đúng artboard, không sửa input gốc', () => {
  const geometry = readInspectorGeometry(shape());
  assert.equal(centerInspectorGeometry(geometry, 'horizontal', { width: 400, height: 500 }).x, 100);
  assert.equal(centerInspectorGeometry(geometry, 'vertical', { width: 400, height: 500 }).y, 220);
  assert.equal(geometry.x, 40);
  assert.equal(geometry.y, 70);
});

test('chặn NaN, Infinity, chuỗi trống, kích thước âm và góc vượt giới hạn', () => {
  const geometry = readInspectorGeometry(shape());
  for (const value of ['', 'NaN', 'Infinity', '-30']) {
    assert.throws(() => updateInspectorField(geometry, 'width', value));
  }
  assert.throws(() => validateInspectorGeometry({ ...geometry, rotation: 500 }));
  assert.throws(() => updateInspectorField(geometry, '__proto__', 1));
});

test('khóa đối tượng và ảnh thiếu: inspector chỉ đọc, không chỉnh', () => {
  const original = shape();
  assert.equal(canInspectFabricShape(original, () => true), true);
  assert.equal(canInspectFabricShape(original, () => false), false);
  assert.equal(canInspectFabricShape({ ...original, selectable: false }, () => true), false);
  assert.equal(canInspectFabricShape({ ...original, visible: false }, () => true), false);
  assert.equal(canInspectFabricShape({ ...original, momeviaMissingImage: true }, () => true), false);
});

test('không đụng đến source document trước Áp dụng', () => {
  const design = { elements: [{ id: 'text-a', layout: { x: 40, y: 70, width: 200, height: 60, rotation: 15 } }] };
  const before = structuredClone(design);
  const temp = shape();
  applyInspectorGeometry(temp, { ...readInspectorGeometry(temp), x: 87 });
  assert.deepEqual(design, before);
});

test('giữ nguyên các trường geometry sau thay đổi xoay', () => {
  const original = shape();
  const next = updateInspectorField(readInspectorGeometry(original), 'rotation', '-45');
  applyInspectorGeometry(original, next);
  assert.equal(readInspectorGeometry(original).rotation, -45);
  assert.equal(readInspectorGeometry(original).x, 40);
  assert.equal(readInspectorGeometry(original).y, 70);
});
