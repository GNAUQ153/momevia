import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, createElement, validateDocument } from '../../web/js/shared/canvas/index.js';
import { applyFabricWorkspacePatch, fabricWorkspaceChanged } from '../../web/js/features/canvas-editor/fabric-workspace.js';
import {
  applyFabricStylePatch, styleDiffFromDraft,
  styleFieldsFor, validateFabricStyleField,
} from '../../web/js/features/canvas-editor/fabric-style-patch.js';
import { propertyToFabric } from '../../web/js/features/canvas-editor/fabric-properties.js';

function fixture() {
  const document = createDocument();
  for (const [id, type, props] of [
    ['b-text', 'text', { text: 'Chào bạn', fontToken: 'body', fontSize: 24, color: '#112233' }],
    ['b-shape', 'shape', { kind: 'rectangle', color: '#DCCDFC' }],
    ['b-image', 'image', { assetId: null }],
  ]) {
    const item = createElement(type, { id, props, layout: { x: 20, y: 40, width: 200, height: 100, rotation: 0 } });
    document.elements.push(item);
    document.scenes[0].elementIds.push(id);
  }
  return validateDocument(document);
}

function workspace(document, styles = []) {
  return {
    order: [...document.scenes[0].elementIds], visibility: {}, layouts: [], styles,
  };
}

const get = (doc, id) => doc.elements.find(item => item.id === id);

test('Bảng trường đúng loại: text, shape, image; không sửa action', () => {
  const doc = fixture();
  assert.deepEqual(styleFieldsFor(get(doc, 'b-text')), ['color', 'fontToken', 'fontSize', 'align', 'lineHeight', 'opacity']);
  assert.deepEqual(styleFieldsFor(get(doc, 'b-shape')), ['color', 'strokeColor', 'strokeWidth', 'radius', 'opacity']);
  assert.deepEqual(styleFieldsFor(get(doc, 'b-image')), ['opacity']);
  assert.deepEqual(styleFieldsFor(get(doc, 'open-gift')), []);
});

test('Text style lưu qua Canvas Document và giữ source không đổi', () => {
  const doc = fixture();
  const original = structuredClone(doc);
  const styles = [{ id: 'b-text', fields: { color: '#AABBCC', fontSize: 32, fontToken: 'serif', align: 'center', lineHeight: 1.6 } }];
  assert.equal(fabricWorkspaceChanged(doc, doc.entrySceneId, workspace(doc, styles)), true);
  const result = applyFabricWorkspacePatch(doc, doc.entrySceneId, workspace(doc, styles));
  assert.equal(get(result, 'b-text').props.fontSize, 32);
  assert.equal(get(result, 'b-text').props.fontToken, 'serif');
  assert.equal(get(result, 'b-text').props.align, 'center');
  assert.equal(get(result, 'b-text').props.lineHeight, 1.6);
  assert.equal(get(result, 'b-text').props.color, '#AABBCC');
  assert.equal(get(result, 'b-text').props.text, 'Chào bạn');
  assert.deepEqual(doc, original);
  assert.deepEqual(validateDocument(result), result);
});

test('Shape style và image opacity lưu riêng, không sửa asset ID', () => {
  const doc = fixture();
  const updated = applyFabricWorkspacePatch(doc, doc.entrySceneId, workspace(doc, [
    { id: 'b-shape', fields: { color: '#FF0000', strokeColor: '#00FF00', strokeWidth: 5, radius: 16, opacity: 0.65 } },
    { id: 'b-image', fields: { opacity: 0.4 } },
  ]));
  assert.equal(get(updated, 'b-shape').props.radius, 16);
  assert.equal(get(updated, 'b-shape').props.strokeWidth, 5);
  assert.equal(get(updated, 'b-shape').opacity, 0.65);
  assert.equal(get(updated, 'b-image').opacity, 0.4);
  assert.equal(get(updated, 'b-image').props.assetId, null);
});

test('Không được chỉnh lớp bị khóa, ẩn, không cùng cảnh hoặc Creator protected', () => {
  const doc = fixture();
  const patch = workspace(doc, [{ id: 'b-text', fields: { color: '#123456' } }]);
  for (const policy of [
    { kind: 'creator-template' },
    { kind: 'sender-basic', lockedElements: { 'b-text': true } },
  ]) {
    assert.throws(() => applyFabricWorkspacePatch(doc, doc.entrySceneId, patch, policy), /khóa/);
  }
  const locked = structuredClone(doc);
  get(locked, 'b-text').locked = true;
  assert.throws(() => applyFabricWorkspacePatch(locked, locked.entrySceneId, workspace(locked, patch.styles)), /khóa/);
  const hidden = structuredClone(doc);
  get(hidden, 'b-text').visible = false;
  // Lớp ẩn không phải lớp khóa: giữ được màu đã chỉnh trước khi ẩn.
  assert.equal(get(applyFabricWorkspacePatch(hidden, hidden.entrySceneId, workspace(hidden, patch.styles)), 'b-text').props.color, '#123456');
  assert.throws(() => applyFabricStylePatch(doc, doc.entrySceneId, [{ id: 'not-a-layer', fields: { color: '#123456' } }]), /ID/);
});

test('Không cho phép field vượt schema, prototype pollution, CSS injection hoặc giá trị NaN', () => {
  const doc = fixture();
  const element = get(doc, 'b-text');
  for (const [field, value] of [
    ['html', '<script>'], ['textBinding', 'message'], ['actions', []], ['assetId', 'x'],
    ['opacity', 2], ['fontSize', Infinity], ['fontSize', 9], ['fontToken', 'Comic Sans'],
    ['color', 'url(https://evil.test)'], ['color', '#fff'], ['align', 'justify'],
    ['__proto__', {}],
  ]) {
    assert.throws(() => validateFabricStyleField(element, field, value));
  }
  assert.throws(() => applyFabricStylePatch(doc, doc.entrySceneId,
    [{ id: 'b-text', fields: JSON.parse('{"__proto__":{"hacked":true}}') }]), /thuộc tính|hỗ trợ/);
  assert.equal(({}).hacked, undefined);
  assert.throws(() => applyFabricStylePatch(doc, doc.entrySceneId,
    [{ id: 'b-text', fields: { opacity: 0.5 } }, { id: 'b-text', fields: { opacity: 0.8 } }]), /trùng/);
  assert.throws(() => applyFabricStylePatch(doc, doc.entrySceneId, [
    { id: 'b-image', fields: { color: '#FFFFFF' } },
  ]), /hỗ trợ/);
});

test('Lớp ellipse không nhận bo góc; thuộc tính chỉ được hỗ trợ với rectangle', () => {
  const doc = fixture();
  get(doc, 'b-shape').props.kind = 'ellipse';
  assert.equal(styleFieldsFor(get(doc, 'b-shape')).includes('radius'), false);
  assert.throws(() => applyFabricStylePatch(doc, doc.entrySceneId,
    [{ id: 'b-shape', fields: { radius: 12 } }]), /hỗ trợ/);
});

test('Thay đổi không khác bản gốc không sinh patch; Hủy không sửa document', () => {
  const doc = fixture();
  const map = new Map([['b-text', new Map([['fontSize', 24], ['color', '#112233']])]]);
  assert.deepEqual(styleDiffFromDraft(new Map(doc.elements.map(item => [item.id, item])), map), []);
  assert.equal(fabricWorkspaceChanged(doc, doc.entrySceneId, workspace(doc)), false);
  assert.deepEqual(doc, fixture());
});

test('Preview Fabric chỉ cập nhật object tạm, không sửa snapshot', () => {
  const doc = fixture();
  const model = get(doc, 'b-text');
  const shape = { set(delta) { Object.assign(this, delta); }, setCoords() { this.coords = true; } };
  propertyToFabric(shape, model, 'fontSize', 44);
  propertyToFabric(shape, model, 'color', '#1122AA');
  propertyToFabric(shape, model, 'fontToken', 'serif');
  assert.equal(shape.fontSize, 44);
  assert.equal(shape.fill, '#1122AA');
  assert.equal(shape.fontFamily, 'Georgia');
  assert.equal(shape.coords, true);
  assert.equal(model.props.fontSize, 24);
});

test('Đổi màu bộ phận vector lồng nhau giữ màu chi tiết cố định', () => {
  const model = get(fixture(), 'b-text');
  const part = (binding, color) => ({
    ...binding, fill: color,
    set(field, value) { this[field] = value; },
  });
  const bound = part({ momeviaFillBinding: true }, '#112233');
  const fixed = part({}, '#AABBCC');
  const shape = {
    getObjects: () => [{ getObjects: () => [bound, fixed] }],
    set(values) { Object.assign(this, values); },
  };
  propertyToFabric(shape, model, 'color', '#445566');
  assert.equal(bound.fill, '#445566');
  assert.equal(fixed.fill, '#AABBCC');
});

test('Thao tác thay đổi style vẫn bảo vệ độ dài JSON và schema V1/V2', () => {
  const doc = fixture();
  const update = workspace(doc, [{ id: 'b-text', fields: { fontSize: 160, opacity: 0 } }]);
  const result = applyFabricWorkspacePatch(doc, doc.entrySceneId, update);
  assert.equal(result.schemaVersion, doc.schemaVersion);
  assert.equal(result.elements.length, doc.elements.length);
  assert.equal(result.scenes[0].elementIds.length, doc.scenes[0].elementIds.length);
  assert.deepEqual(result.elements.map(item => item.actions),
    doc.elements.map(item => item.actions));
});
