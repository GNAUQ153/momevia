import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  canOpenAdvancedEditor,
  scenePositionLabel,
  selectionDescription,
} from '../../web/js/features/canvas-editor/editor-experience.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const fixture = {
  scenes: [{ id: 'one', elementIds: ['text-1', 'image-1'] }, { id: 'two', elementIds: [] }],
  elements: [
    { id: 'text-1', name: 'Lời chúc', type: 'text' },
    { id: 'image-1', type: 'image' },
  ],
};

test('Chỉ tài khoản có quyền chỉnh bố cục được mở Fabric Studio', () => {
  assert.equal(canOpenAdvancedEditor(), true);
  assert.equal(canOpenAdvancedEditor({ kind: 'sender' }), true);
  assert.equal(canOpenAdvancedEditor({ kind: 'creator-template' }), false);
});

test('Trạng thái cảnh phản ánh đúng thứ tự và tổng số cảnh', () => {
  assert.equal(scenePositionLabel(fixture, 'one'), 'Cảnh 1/2');
  assert.equal(scenePositionLabel(fixture, 'two'), 'Cảnh 2/2');
  assert.equal(scenePositionLabel(fixture, 'missing'), 'Có 2 cảnh');
  assert.equal(scenePositionLabel({ scenes: [] }, 'one'), 'Chưa có cảnh');
});

test('Nhãn lớp được chọn rõ ràng; không cho thấy tên lớp của cảnh khác', () => {
  assert.match(selectionDescription(fixture, 'one', null), /Chọn hình hoặc chữ/);
  assert.equal(selectionDescription(fixture, 'one', 'text-1'), 'Đang chọn: Lời chúc · Chỉnh trong bảng thuộc tính');
  assert.match(selectionDescription(fixture, 'one', 'image-1'), /Ảnh/);
  assert.match(selectionDescription(fixture, 'two', 'text-1'), /trong cảnh hiện tại/);
});

test('Lớp khóa và quyền policy được thông báo chính xác mà không sửa document', () => {
  const before = structuredClone(fixture);
  assert.match(selectionDescription(fixture, 'one', 'text-1', { lockedElements: { 'text-1': {} } }), /bảo vệ/);
  assert.deepEqual(fixture, before);
});

test('Trình chỉnh Canvas gắn nút thao tác vào handler bảo vệ và giữ nguyên Fabric patch', () => {
  const designer = read('web/js/pages/designer.js');
  assert.match(designer, /button\(message\("editor\.actions\.advanced"\), "advanced-design"/);
  assert.match(designer, /if \(name === "advanced-design" \|\| name === "fabric-studio"\)/);
  assert.match(designer, /if \(quickMode && name === "advanced-design"\) switchMode\(\)/);
  assert.match(designer, /if \(!canOpenAdvancedEditor\(design\.policy\)\)/);
  assert.match(designer, /applyFabricWorkspacePatch\(value\.document, editingScene, patch, design\.policy\)/);
  assert.match(designer, /editingScene !== sceneId/);
  assert.match(designer, /store\.sequence !== initialSequence/);
  assert.doesNotMatch(designer, /saveFabricJSON|document\.fabricState\s*=/);
});

test('CSS Canvas tách module và giữ hiển thị công cụ trên mobile', () => {
  const index = read('web/index.html');
  const style = read('web/css/editor-experience.css');
  assert.match(index, /\/css\/editor-experience\.css/);
  assert.match(style, /\.editor-advanced-cta/);
  assert.match(style, /@media \(max-width: 800px\)/);
  assert.match(style, /\.editor-workspace\.is-quick \.editor-library \{\s*display: block/);
  assert.match(style, /prefers-reduced-motion/);
});
