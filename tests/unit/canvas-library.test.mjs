import test from 'node:test';
import assert from 'node:assert/strict';
import { builtinLibraryItems } from '../../src/modules/designs/library.seed.mjs';
import { validateLibrary } from '../../src/modules/designs/library.service.mjs';
import { installLibrary, librarySnapshot } from '../../web/js/shared/canvas/library-state.js';
import { effectPreset } from '../../web/js/shared/canvas/effects.js';
import { materializeModels, refreshElementArtwork } from '../../web/js/shared/canvas/library-materialize.js';
import { createDocument } from '../../web/js/shared/canvas/presets.js';
import { publicDocument, validateDocument, duplicateDocument } from '../../web/js/shared/canvas/schema.js';
import { sampleBindings } from '../../web/js/features/canvas-editor/library.js';

const recipe = { engine: 'keyframes', duration: 700, keyframes: [{ opacity: .1, transform: 'rotate(-11deg)' }, { opacity: 1, transform: 'rotate(0deg)' }] };
function customItems() {
  return [...builtinLibraryItems(),
    { kind: 'animation', id: 'db-motion', revision: 1, status: 'active', sortOrder: 10000, definition: structuredClone(recipe) },
    { kind: 'effect', id: 'db-entrance', revision: 1, status: 'active', sortOrder: 10001,
      definition: { family: 'entrance', title: { vi: 'Nghiêng nhẹ', en: 'Gentle tilt' }, animationId: 'db-motion', targets: { types: ['text'] }, defaults: { speed: 'slow', delay: 150 } } },
  ];
}
test('552 complete builtin definitions validate and contain no executable factories', () => {
  const rows = builtinLibraryItems(); validateLibrary(rows);
  assert.equal(rows.length, 552); assert.equal(rows.filter(r => r.kind === 'element').length, 299);
  assert.equal(rows.filter(r => r.kind === 'animation').length, 42);
  assert.deepEqual(JSON.parse(JSON.stringify(rows)), rows);
});
test('DB-only artwork and animation are frozen in the saved and public document', () => {
  const before = librarySnapshot();
  try {
    const items = customItems(); validateLibrary(items); installLibrary({ items });
    const doc = sampleBindings(createDocument({ presetId: 'envelope-basic' }));
    const text = doc.elements.find(e => e.type === 'text'); text.effects = { entrance: effectPreset('db-entrance', 'entrance') };
    doc.schemaVersion = doc.registryVersion = 2;
    assert.deepEqual(validateDocument(doc), doc);
    const frozen = structuredClone(doc); installLibrary(null);
    assert.deepEqual(validateDocument(doc), frozen); assert.deepEqual(publicDocument(doc).elements.find(e => e.id === text.id).effects, text.effects);
    assert.deepEqual(duplicateDocument(doc).elements.find(e => e.type === 'text').effects, text.effects);
    const updated = customItems(); updated.find(r => r.kind === 'animation' && r.id === 'db-motion').definition.duration = 900;
    installLibrary({ items: updated });
    assert.equal(materializeModels([text])[0].effects.entrance.definition.animation.duration, 900);
    assert.equal(text.effects.entrance.definition.animation.duration, 700);
  } finally { installLibrary(before); }
});
test('materialized elements get independent IDs and pinned vector path data', () => {
  const before = librarySnapshot();
  try {
    const items = builtinLibraryItems(); installLibrary({ items });
    const source = items.find(r => r.kind === 'element' && r.id === 'wax-seal').definition.elements;
    const a = materializeModels(source), b = materializeModels(source);
    assert.notEqual(a[0].id, b[0].id); assert(a[0].artwork.paths[0].d); assert.deepEqual(a[0].artwork, b[0].artwork);
    const oldPath = a[0].artwork.paths[0].d; a[0].props.stickerId = 'butterfly'; refreshElementArtwork(a[0]);
    assert.notEqual(a[0].artwork.paths[0].d, oldPath);
    const photo = { type: 'image', props: { mask: 'arch' } }; refreshElementArtwork(photo); const arch = photo.props.maskPath;
    photo.props.mask = 'heart'; refreshElementArtwork(photo); assert.notEqual(photo.props.maskPath, arch);
  } finally { installLibrary(before); }
});
test('library rejects code, URLs, unsupported transforms, malicious paths and broken dependencies', () => {
  for (const bad of [
    { ...recipe, keyframes: [{ transform: 'url(https://example.test)' }, {}] },
    { ...recipe, keyframes: [{ transform: 'rotate(1deg);color:red' }, {}] },
    { ...recipe, duration: 1e8 }, { ...recipe, code: 'alert(1)' },
  ]) {
    const rows = customItems(); rows.find(r => r.id === 'db-motion').definition = bad;
    assert.throws(() => validateLibrary(rows));
  }
  const rows = customItems(); rows.find(r => r.id === 'db-motion').status = 'disabled'; assert.throws(() => validateLibrary(rows), /Missing animation/);
  const incompatible = builtinLibraryItems(); incompatible.find(r => r.kind === 'effect' && r.id === 'E03').definition.targets.types.push('image');
  assert.throws(() => validateLibrary(incompatible), /incompatibility/);
  const paths = builtinLibraryItems(); paths.find(r => r.kind === 'artwork').definition.vector.paths[0].d = '<script>alert(1)</script>';
  assert.throws(() => validateLibrary(paths), /SVG path/);
});
