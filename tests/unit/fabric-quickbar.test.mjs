import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isQuickbarTypingTarget,
  shortcutFromKey,
  nextQuickbarGeometry,
  applyQuickbarAction,
} from '../../web/js/features/canvas-editor/fabric-quickbar.js';

const base = () => ({ x: 20, y: 30, width: 100, height: 60, rotation: 0 });
const artboard = { width: 400, height: 300 };
const shape = () => ({
  momeviaId: 'a', width: 100, height: 60, scaleX: 1, scaleY: 1,
  left: 70, top: 60, angle: 0, selectable: true, visible: true,
  set(next) { Object.assign(this, next); },
  setCoords() { this.coordsUpdated = true; },
});

test('Mũi tên dịch chuyển 1px và Shift dịch chuyển 10px', () => {
  assert.deepEqual(shortcutFromKey({ key: 'ArrowLeft', shiftKey: false }), { action: 'move-left', step: 1 });
  assert.deepEqual(shortcutFromKey({ key: 'ArrowDown', shiftKey: true }), { action: 'move-down', step: 10 });
  assert.equal(nextQuickbarGeometry(base(), 'move-left', artboard).x, 19);
  assert.equal(nextQuickbarGeometry(base(), 'move-down', artboard, 10).y, 40);
});

test('Không bắt phím tắt khi nhập tiếng Việt hoặc dùng modifier', () => {
  const input = { closest: selector => selector.includes('input') ? {} : null };
  assert.equal(isQuickbarTypingTarget(input), true);
  assert.equal(shortcutFromKey({ key: 'ArrowRight', target: input }), null);
  assert.equal(shortcutFromKey({ key: 'ArrowLeft', isComposing: true }), null);
  assert.equal(shortcutFromKey({ key: 'ArrowLeft', metaKey: true }), null);
  assert.equal(shortcutFromKey({ key: 'ArrowLeft', ctrlKey: true }), null);
  assert.equal(shortcutFromKey({ key: 'Enter' }), null);
});

test('Dịch chuyển không đẩy lớp vượt ra khỏi artboard', () => {
  const original = { ...base(), x: 295, y: 237 };
  assert.equal(nextQuickbarGeometry(original, 'move-right', artboard, 10).x, 300);
  assert.equal(nextQuickbarGeometry(original, 'move-down', artboard, 10).y, 240);
  assert.equal(nextQuickbarGeometry(base(), 'move-left', artboard, 100).x, 0);
});

test('Giới hạn vị trí theo bounding box sau khi xoay', () => {
  const rotated = { ...base(), rotation: 45 };
  const next = nextQuickbarGeometry({ ...rotated, x: 275 }, 'move-right', artboard, 10);
  const rotatedHalfWidth = (Math.abs(Math.cos(Math.PI / 4) * 100) +
    Math.abs(Math.sin(Math.PI / 4) * 60)) / 2;
  assert.ok(next.x + 50 + rotatedHalfWidth <= 400.01);
});

test('Căn giữa ngang và dọc dùng đúng top-left Momevia', () => {
  assert.equal(nextQuickbarGeometry(base(), 'center-x', artboard).x, 150);
  assert.equal(nextQuickbarGeometry(base(), 'center-y', artboard).y, 120);
});

test('Xoay 15 độ và tự chuẩn hóa góc', () => {
  assert.equal(nextQuickbarGeometry(base(), 'rotate-left', artboard).rotation, -15);
  assert.equal(nextQuickbarGeometry({ ...base(), rotation: 175 }, 'rotate-right', artboard).rotation, -170);
});

test('Chỉ cập nhật Fabric tạm, không đụng document gốc', () => {
  const item = shape();
  const snapshot = structuredClone(base());
  assert.equal(applyQuickbarAction(item, 'move-right', { artboard, canEdit: () => true }), true);
  assert.equal(item.left, 71);
  assert.equal(item.coordsUpdated, true);
  assert.deepEqual(base(), snapshot);
});

test('Từ chối layer khóa, ẩn, thiếu ảnh, bị cấm quyền', () => {
  for (const item of [
    { ...shape(), selectable: false },
    { ...shape(), visible: false },
    { ...shape(), momeviaMissingImage: true },
  ]) {
    assert.throws(() => applyQuickbarAction(item, 'move-right', { artboard, canEdit: () => true }), /khóa/);
  }
  assert.throws(() => applyQuickbarAction(shape(), 'move-left', { artboard, canEdit: () => false }), /khóa/);
});

test('Không phát sinh mutation khi đã chạm biên Canvas', () => {
  const item = shape();
  item.left = 50;
  assert.equal(applyQuickbarAction(item, 'move-left', { artboard, canEdit: () => true, step: 100 }), false);
  assert.equal(item.coordsUpdated, undefined);
});

test('Từ chối hành động không hợp lệ và step lỗi', () => {
  assert.throws(() => nextQuickbarGeometry(base(), 'delete-layer', artboard), /không được hỗ trợ/);
  assert.throws(() => nextQuickbarGeometry(base(), 'move-up', artboard, NaN), /không hợp lệ/);
  assert.throws(() => nextQuickbarGeometry(base(), 'move-up', artboard, 1000), /không hợp lệ/);
});

test('Không sửa khi layer bị ràng buộc hoặc shape thiếu dữ liệu', () => {
  assert.throws(() => applyQuickbarAction({ ...shape(), width: NaN }, 'move-left', { artboard, canEdit: () => true }), /kích thước/);
  assert.throws(() => applyQuickbarAction(shape(), 'move-left', { artboard, canEdit: null }), /khóa/);
});
