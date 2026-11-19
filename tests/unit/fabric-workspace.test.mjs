import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, createElement, validateDocument } from '../../web/js/shared/canvas/index.js';
import { fabricView } from '../../web/js/features/canvas-editor/fabric-adapter.js';
import {
  fabricLayerList,
  canManageFabricLayer,
  moveFabricLayer,
  fabricWorkspaceChanged,
  applyFabricWorkspacePatch,
  snapFabricCenter,
} from '../../web/js/features/canvas-editor/fabric-workspace.js';

function fixture() {
  const document = createDocument({ presetId: 'envelope-basic' });
  for (let n = 1; n <= 3; n++) {
    const element = createElement('shape', {
      id: `extra-${n}`,
      name: `Lớp ${n}`,
      props: { kind: 'rectangle', color: '#AABBCC' },
      layout: { x: 30 + n * 50, y: 60 + n * 45, width: 80, height: 70, rotation: 0 },
    });
    document.elements.push(element);
    document.scenes[0].elementIds.push(element.id);
  }
  return validateDocument(document);
}

function patch(doc, properties = {}) {
  return {
    order: [...doc.scenes[0].elementIds],
    visibility: {},
    layouts: [],
    ...properties,
  };
}

test('Danh sách layer có thứ tự top-first và chứa cả lớp ẩn', () => {
  const doc = fixture();
  doc.elements.find(item => item.id === 'extra-2').visible = false;
  const layers = fabricLayerList(doc, doc.entrySceneId);
  assert.equal(layers[0].id, 'extra-3');
  assert.equal(layers.find(item => item.id === 'extra-2').visible, false);
  const view = fabricView(doc, doc.entrySceneId, null, { includeHidden: true });
  assert.equal(view.elements.find(item => item.id === 'extra-2').hidden, true);
  assert.equal(view.elements.find(item => item.id === 'extra-2').editable, false);
  assert(!fabricView(doc, doc.entrySceneId).elements.some(item => item.id === 'extra-2'));
});

test('Đảo thứ tự hai lớp thường, bảo toàn tương tác và validation', () => {
  const doc = fixture();
  const order = moveFabricLayer(doc.scenes[0].elementIds, 'extra-2', 'up', id => id.startsWith('extra-'));
  assert.deepEqual(order.slice(-3), ['extra-1', 'extra-3', 'extra-2']);
  const result = applyFabricWorkspacePatch(doc, doc.entrySceneId, patch(doc, { order }));
  assert.deepEqual(result.scenes[0].elementIds.slice(-3), ['extra-1', 'extra-3', 'extra-2']);
  assert.deepEqual(validateDocument(result), result);
  assert.deepEqual(doc.scenes[0].elementIds.slice(-3), ['extra-1', 'extra-2', 'extra-3']);
  const originalAction = doc.elements.find(item => item.id === 'open-gift').actions;
  assert.deepEqual(result.elements.find(item => item.id === 'open-gift').actions, originalAction);
});

test('Ẩn, hiện và chỉnh hình vừa mở lại được lưu một lần vào document', () => {
  const doc = fixture();
  const hidden = applyFabricWorkspacePatch(doc, doc.entrySceneId, patch(doc, { visibility: { 'extra-1': false } }));
  assert.equal(hidden.elements.find(item => item.id === 'extra-1').visible, false);
  assert.equal(doc.elements.find(item => item.id === 'extra-1').visible, undefined);
  const shape = hidden.elements.find(item => item.id === 'extra-1');
  const unhidden = applyFabricWorkspacePatch(hidden, hidden.entrySceneId, patch(hidden, {
    visibility: { 'extra-1': true },
    layouts: [{ id: 'extra-1', layout: { ...shape.layout, x: shape.layout.x + 15 } }],
  }));
  assert.equal(unhidden.elements.find(item => item.id === 'extra-1').visible, true);
  assert.equal(unhidden.elements.find(item => item.id === 'extra-1').layout.x, shape.layout.x + 15);
  assert.deepEqual(validateDocument(unhidden), unhidden);
});

test('Không xóa/thêm/trùng layer, không di chuyển lớp khóa qua vị trí khác', () => {
  const doc = fixture();
  const original = doc.scenes[0].elementIds;
  assert.throws(() => applyFabricWorkspacePatch(doc, doc.entrySceneId,
    patch(doc, { order: original.slice(1) })), /thêm, xóa/);
  assert.throws(() => applyFabricWorkspacePatch(doc, doc.entrySceneId,
    patch(doc, { order: [...original.slice(0, -1), original[0]] })), /thêm, xóa/);
  const order = [original[1], original[0], ...original.slice(2)];
  assert.throws(() => applyFabricWorkspacePatch(doc, doc.entrySceneId,
    patch(doc, { order })), /khóa|tương tác/);
  assert.deepEqual(moveFabricLayer(original, 'open-gift', 'up', id => id.startsWith('extra-')), original);
});

test('Quyền Creator không thể bị bypass qua thay đổi visible/order/layout', () => {
  const doc = fixture();
  const policy = { kind: 'creator-template', lockedElements: {} };
  const extra = doc.elements.find(item => item.id === 'extra-1');
  assert.equal(canManageFabricLayer(extra, policy), false);
  assert.throws(() => applyFabricWorkspacePatch(doc, doc.entrySceneId,
    patch(doc, { visibility: { 'extra-1': false } }), policy), /khóa/);
  assert.throws(() => applyFabricWorkspacePatch(doc, doc.entrySceneId,
    patch(doc, { layouts: [{ id: 'extra-1', layout: extra.layout }] }), policy), /khóa/);
  assert.throws(() => applyFabricWorkspacePatch(doc, doc.entrySceneId,
    patch(doc, { visibility: { 'open-gift': false } })), /khóa/);
  assert.deepEqual(doc, fixture());
});

test('Không chấp nhận ID ngoài cảnh, kiểu sai, tampered policy và số không hợp lệ', () => {
  const doc = fixture();
  assert.throws(() => applyFabricWorkspacePatch(doc, doc.entrySceneId,
    patch(doc, { visibility: JSON.parse('{"__proto__":false}') })), /không thuộc cảnh/);
  assert.throws(() => applyFabricWorkspacePatch(doc, doc.entrySceneId,
    patch(doc, { visibility: { 'extra-1': 'false' } })), /không hợp lệ/);
  assert.throws(() => applyFabricWorkspacePatch(doc, 'another-scene', patch(doc)), /Không tìm thấy/);
  assert.throws(() => snapFabricCenter({ x: NaN, y: 0, width: 10, height: 12 }, { width: 390, height: 844 }), /không hợp lệ/);
});

test('Snap tâm và biên chính xác, có dung sai để tránh giật khi kéo', () => {
  const board = { width: 390, height: 844 };
  const center = snapFabricCenter({ x: 191, y: 425, width: 100, height: 50 }, board);
  assert.deepEqual(center, { x: 195, y: 422, snappedX: true, snappedY: true });
  const edge = snapFabricCenter({ x: 51, y: 819, width: 100, height: 50 }, board);
  assert.deepEqual(edge, { x: 50, y: 819, snappedX: true, snappedY: false });
  const noSnap = snapFabricCenter({ x: 100, y: 300, width: 100, height: 50 }, board);
  assert.equal(noSnap.snappedX, false);
});

test('Diff không đổi không tạo bản ghi thừa; chỉ định dạng thuần đi vào autosave', () => {
  const doc = fixture();
  assert.equal(fabricWorkspaceChanged(doc, doc.entrySceneId, patch(doc)), false);
  assert.equal(fabricWorkspaceChanged(doc, doc.entrySceneId, patch(doc, { visibility: { 'extra-1': false } })), true);
  assert.deepEqual(applyFabricWorkspacePatch(doc, doc.entrySceneId, patch(doc)), doc);
});
