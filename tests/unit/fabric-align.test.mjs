import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangeFabricBoxes, FABRIC_ARRANGE_ACTIONS } from '../../web/js/features/canvas-editor/fabric-align.js';
import { createDocument, createElement, validateDocument } from '../../web/js/shared/canvas/index.js';
import { applyFabricWorkspacePatch } from '../../web/js/features/canvas-editor/fabric-workspace.js';

const boxes = [
  { id: 'a', x: 10, y: 20, width: 40, height: 30 },
  { id: 'b', x: 110, y: 90, width: 20, height: 50 },
  { id: 'c', x: 250, y: 220, width: 60, height: 20 },
];
const shifts = (action, ids = ['a', 'b', 'c'], source = boxes) =>
  arrangeFabricBoxes(source, ids, action);
const resultPosition = (box, result) => {
  const shift = result.find(item => item.id === box.id) || { dx: 0, dy: 0 };
  return { x: box.x + shift.dx, y: box.y + shift.dy };
};

test('Các chế độ căn chỉnh hỗ trợ đầy đủ và không đụng dữ liệu gốc', () => {
  assert.deepEqual(FABRIC_ARRANGE_ACTIONS,
    ['left', 'center-x', 'right', 'top', 'middle', 'bottom', 'space-x', 'space-y']);
  const original = structuredClone(boxes);
  for (const action of FABRIC_ARRANGE_ACTIONS) shifts(action);
  assert.deepEqual(boxes, original);
});

test('Căn trái và phải không sửa kích thước hoặc trục Y', () => {
  const left = shifts('left');
  assert.deepEqual(left.map(({ id, dx, dy }) => [id, dx, dy]), [['b', -100, 0], ['c', -240, 0]]);
  const right = shifts('right');
  assert.deepEqual(right, [{ id: 'a', dx: 260, dy: 0 }, { id: 'b', dx: 180, dy: 0 }]);
});

test('Căn giữa theo bounding box hỗ trợ phần tử kích thước khác nhau', () => {
  const h = shifts('center-x');
  for (const box of boxes) {
    const center = resultPosition(box, h).x + box.width / 2;
    assert.equal(center, 160);
  }
  const v = shifts('middle');
  for (const box of boxes) {
    const center = resultPosition(box, v).y + box.height / 2;
    assert.equal(center, 130);
  }
});

test('Căn trên và dưới không di chuyển trục X', () => {
  const top = shifts('top');
  assert(top.every(item => item.dx === 0));
  assert.deepEqual(boxes.map(box => resultPosition(box, top).y), [20, 20, 20]);
  const bottom = shifts('bottom');
  assert.deepEqual(boxes.map(box => resultPosition(box, bottom).y + box.height), [240, 240, 240]);
});

test('Chia đều ngang giữ hai đầu mút và tạo khoảng cách bằng nhau', () => {
  const horizontal = shifts('space-x');
  assert.deepEqual(horizontal, [{ id: 'b', dx: 30, dy: 0 }]);
  const sorted = boxes.map(box => ({ ...box, x: resultPosition(box, horizontal).x }));
  assert.equal(sorted[1].x - (sorted[0].x + sorted[0].width),
    sorted[2].x - (sorted[1].x + sorted[1].width));
});

test('Chia đều dọc giữ hai đầu và không thay đổi thứ tự layer', () => {
  const vertical = shifts('space-y');
  assert.deepEqual(vertical, [{ id: 'b', dx: 0, dy: 20 }]);
  assert.equal(resultPosition(boxes[0], vertical).y, 20);
  assert.equal(resultPosition(boxes[2], vertical).y, 220);
});

test('Hình xoay vẫn dùng bounding box do Fabric trả về để tính dịch chuyển', () => {
  // Bounding box này đã bao gồm phép xoay; dịch chuyển tâm đúng bằng dx/dy.
  const rects = [{ id: 'a', x: 50, y: 40, width: 120, height: 80 },
    { id: 'b', x: 220, y: 60, width: 90, height: 130 }];
  const changes = arrangeFabricBoxes(rects, ['a', 'b'], 'top');
  assert.deepEqual(changes, [{ id: 'b', dx: 0, dy: -20 }]);
});

test('Từ chối lớp bị khóa hoặc không thuộc cảnh, ID trùng và phương thức lạ', () => {
  assert.throws(() => arrangeFabricBoxes(boxes, ['a', 'b'], 'left', {
    canMove: id => id !== 'b',
  }), /khóa/);
  assert.throws(() => shifts('left', ['a', 'a']), /khóa/);
  assert.throws(() => shifts('left', ['a', 'untrusted']), /khóa/);
  assert.throws(() => shifts('hack'), /không hợp lệ/);
  assert.throws(() => shifts('left', ['a']), /hai lớp/);
  assert.throws(() => shifts('space-y', ['a', 'b']), /ba lớp/);
});

test('Từ chối hình học NaN, Infinity, diện tích âm và ID lặp', () => {
  for (const bad of [
    { id: 'b', x: NaN, y: 0, width: 20, height: 20 },
    { id: 'b', x: 0, y: Infinity, width: 20, height: 20 },
    { id: 'b', x: 0, y: 0, width: -2, height: 20 },
  ]) {
    assert.throws(() => shifts('left', ['a', 'b'], [boxes[0], bad]), /không hợp lệ/);
  }
  assert.throws(() => shifts('left', ['a', 'b'], [boxes[0], boxes[0], boxes[1]]), /trùng/);
});

test('Không chia đều những lớp quá chồng lấn, tránh tạo tọa độ sai', () => {
  const overlapping = [{ id: 'a', x: 0, y: 0, width: 100, height: 100 },
    { id: 'b', x: 20, y: 20, width: 100, height: 100 },
    { id: 'c', x: 40, y: 40, width: 100, height: 100 }];
  assert.throws(() => shifts('space-x', ['a', 'b', 'c'], overlapping), /không đủ/);
  assert.throws(() => shifts('space-y', ['a', 'b', 'c'], overlapping), /không đủ/);
});

test('Áp dụng dịch chuyển vào document mà không sửa action/metadata hoặc document gốc', () => {
  const doc = createDocument({ presetId: 'envelope-basic' });
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const id = `align-shape-${i}`;
    doc.elements.push(createElement('shape', {
      id, name: `Hình ${i}`,
      layout: { x: 20 + i * 120, y: 40, width: 40, height: 60, rotation: 0 },
      props: { kind: 'rectangle', color: '#AABBCC' },
    }));
    doc.scenes[0].elementIds.push(id);
    ids.push(id);
  }
  const valid = validateDocument(doc);
  const original = structuredClone(valid);
  const source = ids.map(id => {
    const el = valid.elements.find(e => e.id === id);
    return { id, ...el.layout };
  });
  const changes = arrangeFabricBoxes(source, ids, 'left');
  const layouts = changes.map(({ id, dx, dy }) => {
    const el = valid.elements.find(e => e.id === id);
    return { id, layout: { ...el.layout, x: el.layout.x + dx, y: el.layout.y + dy } };
  });
  const output = applyFabricWorkspacePatch(valid, valid.entrySceneId, {
    order: [...valid.scenes[0].elementIds], visibility: {}, layouts,
  });
  assert.deepEqual(validateDocument(output), output);
  assert.deepEqual(valid, original);
  assert.deepEqual(output.scenes, original.scenes);
  assert.deepEqual(output.elements.find(e => e.id === 'open-gift').actions,
    original.elements.find(e => e.id === 'open-gift').actions);
  assert(ids.every(id => output.elements.find(e => e.id === id).layout.x === 20));
});
