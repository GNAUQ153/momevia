import test from 'node:test';
import assert from 'node:assert/strict';
import { canStartInlineFabric, assertInlineFabricRevision, inlineCanvasScale } from '../../web/js/features/canvas-editor/fabric-inline.js';

// Kiểm thử quyền, khả năng khôi phục và kích thước mà không phụ thuộc DOM.
test('Cho phép chỉnh bản nháp thông thường ở chế độ bố cục', () => {
  assert.equal(canStartInlineFabric({ kind: 'sender' }, false), true);
});

test('Không cho mở chỉnh trực tiếp khi mẫu Creator đã bị khóa', () => {
  assert.equal(canStartInlineFabric({ kind: 'creator-template' }, false), false);
});

test('Chế độ nhanh không tự ý ghi đè bố cục', () => {
  assert.equal(canStartInlineFabric({ kind: 'sender' }, true), false);
});

test('Chỉ áp dụng khi revision và cảnh không đổi', () => {
  assert.doesNotThrow(() => assertInlineFabricRevision(10, 10, 'scene-a', 'scene-a', false));
});

test('Chặn dữ liệu cũ khi bản nháp đã thay đổi', () => {
  assert.throws(() => assertInlineFabricRevision(10, 11, 'scene-a', 'scene-a', false), /đã thay đổi/);
});

test('Chặn thao tác khi người dùng chuyển cảnh', () => {
  assert.throws(() => assertInlineFabricRevision(10, 10, 'scene-a', 'scene-b', false), /đã thay đổi/);
});

test('Chặn áp dụng sau khi editor đã bị hủy', () => {
  assert.throws(() => assertInlineFabricRevision(10, 10, 'scene-a', 'scene-a', true), /đã thay đổi/);
});

test('Bản vẽ thu nhỏ vừa vùng nhưng không tự phóng to', () => {
  assert.equal(inlineCanvasScale(1000, 500), 0.5);
  assert.equal(inlineCanvasScale(1000, 1200), 1);
});

test('Vùng đo chưa sẵn sàng không tạo kích thước âm', () => {
  assert.equal(inlineCanvasScale(1000, 0), 1);
  assert.throws(() => inlineCanvasScale(0, 300), /không hợp lệ/);
});
