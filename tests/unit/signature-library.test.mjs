import test from 'node:test';
import assert from 'node:assert/strict';
import { builtinLibraryItems } from '../../src/modules/designs/library.seed.mjs';
import { CanvasLibraryService, validateLibrary } from '../../src/modules/designs/library.service.mjs';
import { signatureElementIds } from '../../web/js/shared/canvas/signature/registry.js';
import { catalog, matchesBlock, replaceCatalog, placeBlock, bounds } from '../../web/js/features/canvas-editor/library.js';
import { configureLibrary } from '../../web/js/features/canvas-editor/library-client.js';
import { filteredIds } from '../../web/js/features/canvas-editor/library-discovery.js';
import { installLibrary, librarySnapshot } from '../../web/js/shared/canvas/library-state.js';
import { createDocument } from '../../web/js/shared/canvas/presets.js';
import { pinDocumentArtwork } from '../../web/js/shared/canvas/library-materialize.js';
import { validateDocument, publicDocument } from '../../web/js/shared/canvas/schema.js';
import { canFabricEdit } from '../../web/js/features/canvas-editor/fabric-adapter.js';

const isSignature = row => row.kind === 'element' && signatureElementIds.includes(row.id);
const signatureCards = () => catalog.flatMap(group => group.items).filter(card => signatureElementIds.includes(card.id));

test('Six distinct Signature cards keep 34 independently editable layers', () => {
  const cards = signatureCards();
  assert.deepEqual(cards.map(card => card.id), signatureElementIds);
  assert.equal(cards.reduce((count, card) => count + card.create().length, 0), 34);
  assert.equal(new Set(catalog.flatMap(group => group.items.map(card => card.id))).size, 312);
  for (const card of cards) {
    const first = card.create(), second = card.create();
    assert(first.every(canFabricEdit));
    assert(first.every(layer => !second.some(other => other.id === layer.id)));
    assert(first.every(layer => layer.type === 'image' ? layer.props.assetId === null : layer.props.kind.startsWith('signature-') && layer.artwork.paths.length));
    assert(first.every(layer => layer.type !== 'image' || layer.props.optional));
  }
});

test('Signature cards support bilingual search and recent additions', () => {
  const group = catalog.findIndex(g => g.items.some(card => signatureElementIds.includes(card.id)));
  assert.equal(filteredIds(catalog, { group: String(group) }).size, 6);
  assert.equal(filteredIds(catalog, { group: String(group), mode: 'new' }).size, 6);
  assert(matchesBlock(signatureCards()[0], 'giang sinh'));
  assert(matchesBlock(signatureCards()[0], 'christmas'));
  assert(matchesBlock(signatureCards()[3], 'camera focus'));
});

test('Signature rows have stable seed IDs, metadata and valid vector data', () => {
  const rows = builtinLibraryItems();
  const signature = rows.filter(isSignature);
  assert.equal(signature.length, 6);
  assert.deepEqual(validateLibrary(rows).items, rows);
  for (const row of signature) {
    assert.equal(row.definition.visualKind, 'graphics');
    assert(row.definition.title.vi && row.definition.title.en);
    assert(row.definition.group.vi && row.definition.group.en);
    assert(row.definition.elements.every((layer, index) => layer.id === `${row.id}-subject${index ? `-${index}` : ''}`));
    assert.doesNotMatch(JSON.stringify(row.definition), /<script|data:image|https?:\/\//i);
  }
});

test('API library hydration retains both languages and fresh editable instances', () => {
  const previous = librarySnapshot(), groups = [...catalog];
  try {
    const items = builtinLibraryItems();
    for (const locale of ['vi', 'en']) {
      configureLibrary({ items }, locale);
      const cards = signatureCards();
      assert.equal(cards.length, 6);
      for (const card of cards) {
        const row = items.find(item => item.id === card.id && item.kind === 'element');
        assert.equal(card.title, row.definition.title[locale]);
        const first = card.create(), second = card.create();
        assert(first.every(layer => !second.some(other => other.id === layer.id)));
        const doc = createDocument();
        doc.elements = placeBlock(first, { left: 0, top: 0, right: 390, bottom: 844 }, []);
        doc.scenes[0].elementIds = doc.elements.map(layer => layer.id);
        const valid = validateDocument(pinDocumentArtwork(doc));
        assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(valid))), valid);
        assert.deepEqual(publicDocument(valid).elements[0].artwork, valid.elements[0].artwork);
        assert(bounds(valid.elements).right <= 390);
      }
    }
    const disabled = items.find(isSignature);
    disabled.status = 'disabled';
    configureLibrary({ items }, 'en');
    assert.equal(signatureCards().length, 5);
  } finally {
    installLibrary(previous);
    replaceCatalog(groups);
  }
});

test('Seeding a populated library adds only missing Signature rows, never overwrites Admin changes', async () => {
  const rows = builtinLibraryItems();
  const current = rows.filter(row => !isSignature(row) || row.id === signatureElementIds[0]);
  const edited = current.find(isSignature);
  edited.status = 'disabled';
  edited.revision = 8;
  edited.definition.title.vi = 'Admin custom title';
  const before = structuredClone(edited), calls = [];
  const tx = { async execute(sql, params) {
    calls.push(sql);
    if (sql.includes('FOR UPDATE')) return [[{ version: '013_canvas_library' }]];
    if (sql.startsWith('SELECT kind')) return [current.map(row => ({ ...row, sort_order: row.sortOrder }))];
    assert(sql.startsWith('INSERT INTO canvas_library_items'));
    const [kind, id, revision, status, sortOrder, definition] = params;
    assert(!current.some(row => row.kind === kind && row.id === id));
    current.push({ kind, id, revision, status, sortOrder, definition: JSON.parse(definition) });
    return [{ affectedRows: 1 }];
  } };
  const service = new CanvasLibraryService({ withTransaction: operation => operation(tx) });
  await service.seedCollections();
  assert.equal(current.filter(isSignature).length, 6);
  assert.deepEqual(current.find(row => row.id === before.id && isSignature(row)), before);
  assert.equal(calls.filter(sql => sql.startsWith('INSERT')).length, 5);
  await service.seedCollections();
  assert.equal(calls.filter(sql => sql.startsWith('INSERT')).length, 5);
});
