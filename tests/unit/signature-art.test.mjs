import test from 'node:test';
import assert from 'node:assert/strict';
import { createSignatureArtwork, signatureConcept, signatureIds } from '../../web/js/shared/canvas/signature/art.js';
import { createDocument } from '../../web/js/shared/canvas/presets.js';
import { pinDocumentArtwork } from '../../web/js/shared/canvas/library-materialize.js';
import { validateDocument, publicDocument } from '../../web/js/shared/canvas/schema.js';
import { validateVector } from '../../web/js/shared/canvas/library-contract.js';
import { canFabricEdit, fabricView, applyFabricDiff } from '../../web/js/features/canvas-editor/fabric-adapter.js';

function documentFor(id) {
  const doc = createDocument();
  doc.elements = createSignatureArtwork(id);
  doc.scenes[0].background.color = signatureConcept(id).background;
  doc.scenes[0].elementIds = doc.elements.map(element => element.id);
  return validateDocument(pinDocumentArtwork(doc));
}

for (const id of signatureIds) {
  test(`${id}: independent artwork validates and is editable in Fabric model`, () => {
    const doc = documentFor(id);
    const other = documentFor(id);
    assert(doc.elements.length >= 5);
    assert(doc.elements.every(element => canFabricEdit(element)));
    assert(doc.elements.every(element => !other.elements.some(copy => copy.id === element.id)));
    assert.equal(doc.schemaVersion, 2);
    for (const element of doc.elements) {
      if (element.type === 'shape') {
        assert.match(element.props.kind, /^signature-/);
        validateVector(element.artwork);
      } else {
        assert.equal(element.type, 'image');
        assert.equal(element.props.assetId, null);
        assert.equal(element.props.optional, true);
      }
      assert(element.layout.x >= 0 && element.layout.y >= 0);
      assert(element.layout.x + element.layout.width <= 390);
      assert(element.layout.y + element.layout.height <= 844);
    }
    const view = fabricView(doc, doc.entrySceneId);
    assert(view.elements.every(element => element.editable));
    const first = doc.elements[0];
    const next = applyFabricDiff(doc, doc.entrySceneId, [{ id: first.id, layout: { ...first.layout, x: first.layout.x + 2 } }]);
    assert.equal(next.elements[0].layout.x, first.layout.x + 2);
    assert.deepEqual(next.elements.slice(1), doc.elements.slice(1));
    assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(next))), next);
    assert.deepEqual(publicDocument(next).elements[0].artwork, first.artwork);
    const copy = createSignatureArtwork(id);
    copy[0].artwork.paths[0].d = 'M0 0H1';
    assert.notEqual(createSignatureArtwork(id)[0].artwork.paths[0].d, 'M0 0H1');
  });
}

test('all six concepts use distinct identifiers and reject unknown identifiers', () => {
  assert.equal(signatureIds.length, 6);
  assert.equal(new Set(signatureIds).size, 6);
  assert.throws(() => createSignatureArtwork('__proto__'));
  assert.throws(() => signatureConcept('unknown'));
});

test('Signature contains no embedded photo, external URL, HTML or executable document fields', () => {
  for (const id of signatureIds) {
    const json = JSON.stringify(documentFor(id));
    assert.doesNotMatch(json, /data:image|base64|https?:\/\/|<script|<svg|localStorage|emhabeu/i);
  }
});
