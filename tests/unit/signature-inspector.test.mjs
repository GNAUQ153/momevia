import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSignatureArtwork, signatureIds } from '../../web/js/shared/canvas/signature/art.js';
import { createDocument, validateDocument } from '../../web/js/shared/canvas/index.js';
import { pinDocumentArtwork } from '../../web/js/shared/canvas/library-materialize.js';
import { vectorParts } from '../../web/js/shared/canvas/artwork.js';
import { buildInspectorPropertyFields } from '../../web/js/features/canvas-editor/inspector-fields.js';
import { styleFieldsFor, applyFabricStylePatch } from '../../web/js/features/canvas-editor/fabric-style-patch.js';
import { propertyToFabric } from '../../web/js/features/canvas-editor/fabric-properties.js';
import { fabricView, isOptionalEmptyPhoto } from '../../web/js/features/canvas-editor/fabric-adapter.js';
import { applyFabricWorkspacePatch } from '../../web/js/features/canvas-editor/fabric-workspace.js';

function fixture(id) {
  const document = createDocument();
  document.elements = createSignatureArtwork(id);
  document.scenes[0].elementIds = document.elements.map(element => element.id);
  return validateDocument(pinDocumentArtwork(document));
}

// Kiểm tra hợp đồng control DOM mà không cần trình duyệt hoặc API.
function fieldsFor(element) {
  const previous = globalThis.document;
  const make = () => ({ children: [], dataset: {},
    append(...items) { this.children.push(...items); },
    removeAttribute() {},
    setAttribute(name, value) {
      if (name === 'data-editor-field') this.dataset.editorField = value;
    },
  });
  const descendants = items => items.flatMap(item => item && typeof item === 'object'
    ? [item, ...descendants(item.children || [])] : []);
  try {
    globalThis.document = { createElement: make, createTextNode: make };
    return descendants(buildInspectorPropertyFields(element))
      .map(item => item.dataset?.editorField).filter(Boolean);
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

for (const id of signatureIds) {
  test(`${id}: chỉnh từng vector và giữ màu cố định, hình học và dữ liệu gốc`, () => {
    const document = fixture(id);
    const before = structuredClone(document);
    const vectors = document.elements.filter(element => element.artwork);
    for (const element of vectors) {
      assert.deepEqual(fieldsFor(element), ['props.color']);
      assert.deepEqual(styleFieldsFor(element), ['color', 'opacity']);
      const next = applyFabricStylePatch(document, document.entrySceneId, [
        { id: element.id, fields: { color: '#123ABC', opacity: 0.65 } },
      ]);
      const updated = next.elements.find(item => item.id === element.id);
      assert.deepEqual(updated.artwork, element.artwork);
      assert.deepEqual(updated.layout, element.layout);
      assert.equal(updated.opacity, 0.65);
      const paths = vectorParts(updated);
      for (const [i, path] of element.artwork.paths.entries()) {
        if (path.fill === 'color') assert.equal(paths[i].fill, '#123ABC');
        else assert.equal(paths[i].fill, vectorParts(element)[i].fill);
        if (path.stroke === 'color') assert.equal(paths[i].stroke, '#123ABC');
        else assert.equal(paths[i].stroke, vectorParts(element)[i].stroke);
      }
      assert.deepEqual(next.elements.filter(item => item.id !== element.id),
        before.elements.filter(item => item.id !== element.id));
      assert.deepEqual(validateDocument(next), next);
    }
    assert.deepEqual(document, before);
  });
}

test('Fabric đổi nét viền theo binding, không tô nền hoặc màu cố định', () => {
  const model = fixture('graduation-countdown').elements.find(element => element.props.kind === 'signature-grid');
  const child = (bindings) => ({ ...bindings, set(key, value) { this[key] = value; } });
  const frame = child({ fill: 'transparent' });
  const stroke = child({ momeviaStrokeBinding: true, stroke: '#222222', fill: null });
  const fixed = child({ fill: '#FFFFFF', stroke: '#888888' });
  const shape = { getObjects: () => [frame, stroke, fixed], set(delta) { Object.assign(this, delta); } };
  propertyToFabric(shape, model, 'color', '#FF00AA');
  assert.equal(stroke.stroke, '#FF00AA');
  assert.equal(stroke.fill, null);
  assert.equal(frame.fill, 'transparent');
  assert.equal(fixed.fill, '#FFFFFF');
  assert.equal(fixed.stroke, '#888888');
  assert.equal(shape.dirty, true);
  assert.equal(shape.fill, undefined);
});

test('Ô ảnh tùy chọn có thể đổi bố cục mà không thêm asset giả', () => {
  for (const id of ['last-chapter', 'graduation-mixtape']) {
    const document = fixture(id);
    const view = fabricView(document, document.entrySceneId);
    for (const photo of view.elements.filter(isOptionalEmptyPhoto)) {
      assert.equal(photo.editable, true);
      const next = applyFabricWorkspacePatch(document, document.entrySceneId, {
        order: [...document.scenes[0].elementIds], visibility: {}, styles: [],
        layouts: [{ id: photo.id, layout: { ...photo.layout, x: photo.layout.x + 5 } }],
      });
      const updated = next.elements.find(item => item.id === photo.id);
      assert.equal(updated.layout.x, photo.layout.x + 5);
      assert.equal(updated.props.assetId, null);
      assert.equal(updated.props.optional, true);
      assert.deepEqual(next.assets, document.assets);
      assert.equal(isOptionalEmptyPhoto({ ...photo, props: { ...photo.props, assetId: 'missing' } }), false);
      assert.equal(isOptionalEmptyPhoto({ ...photo, props: { ...photo.props, optional: false } }), false);
    }
  }
  const studio = readFileSync('web/js/features/canvas-editor/fabric-studio.js', 'utf8');
  assert.match(studio, /if \(isOptionalEmptyPhoto\(model\)\)/);
  assert.match(studio, /item\.momeviaMissingImage \|\| item\.momeviaEmptyPhoto/);
});

test('Không mở quyền thay màu vector đã khóa hoặc thuộc Creator', () => {
  const document = fixture('secret-santa');
  const element = document.elements[0];
  const update = [{ id: element.id, fields: { color: '#123ABC' } }];
  assert.throws(() => applyFabricStylePatch(document, document.entrySceneId, update, { kind: 'creator-template' }));
  element.locked = true;
  assert.throws(() => applyFabricStylePatch(document, document.entrySceneId, update));
});
