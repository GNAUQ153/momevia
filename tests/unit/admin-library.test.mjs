import test from 'node:test';
import assert from 'node:assert/strict';
import { builtinLibraryItems } from '../../src/modules/designs/library.seed.mjs';
import { buildLibraryPreview } from '../../src/modules/designs/library-preview.mjs';
import { installLibrary, librarySnapshot } from '../../web/js/shared/canvas/library-state.js';
import { validateDocument } from '../../web/js/shared/canvas/schema.js';
import { CanvasLibraryService, validateLibrary } from '../../src/modules/designs/library.service.mjs';
import { builtinPreset } from '../../web/js/shared/canvas/effects.js';
import { makeItem, makeInteraction, duplicateItem, getDocument, editFrame, dependencies, removeScene, setPath, layers, normalizeSelection, sameItemContent } from '../../web/js/features/admin-library/model.js';

test('animation preview keeps linked effect targets and resolves ephemeral candle identity', () => {
  const previous = librarySnapshot();
  try {
    const rows = builtinLibraryItems();
    installLibrary({ items: rows });
    const shadow = rows.find(row => row.kind === 'animation' && row.id === 'contact-shadow-v1');
    const result = buildLibraryPreview(shadow, structuredClone(rows), 'vi');
    const subject = result.document.elements.find(element => element.effects?.surface);
    assert.equal(subject.type, 'shape');
    assert.equal(result.document.scenes[0].effects?.surface, undefined);
    const candle = rows.find(row => row.kind === 'animation' && row.id === 'R04');
    const preview = buildLibraryPreview(candle, structuredClone(rows), 'vi');
    const interaction = preview.document.elements.find(element => element.effects?.reaction);
    assert.equal(builtinPreset(interaction.effects.reaction).id, 'R04');
    assert.equal(interaction.props.kind, 'light-a-candle');
  } finally { installLibrary(previous); }
});

test('all 266 editable library items render valid previews without changing their source', () => {
  const original = librarySnapshot(), rows = builtinLibraryItems(), before = JSON.stringify(rows);
  try {
    for (const item of rows.filter(r => ['element','effect','animation','preset','template'].includes(r.kind))) {
      const items = structuredClone(rows); installLibrary({ items });
      validateDocument(buildLibraryPreview(structuredClone(item), items, 'vi').document);
    }
    assert.equal(JSON.stringify(rows), before);
  } finally { installLibrary(original); }
});
test('admin preview never writes and restores the published library snapshot', async () => {
  const rows = builtinLibraryItems(), item = rows.find(r => r.kind === 'animation'), calls = [], before = librarySnapshot();
  const client = { async execute(sql) { calls.push(sql); return [rows.map(row => ({ ...row, sort_order: row.sortOrder }))]; } };
  const service = new CanvasLibraryService(client);
  const preview = await service.preview({ role: 'admin' }, item.kind, 'new-copy', { definition: item.definition }, 'en');
  validateDocument(preview.document); assert.deepEqual(librarySnapshot(), before);
  assert(calls.every(sql => sql.startsWith('SELECT')));
  await assert.rejects(service.preview({ role: 'sender' }, item.kind, item.id, { definition: item.definition }, 'vi'), { status: 403 });
});
test('Admin creates valid reusable defaults and duplicates without retaining the stored revision', () => {
  const rows = builtinLibraryItems(), translate = key => key;
  for (const kind of ['element','animation','effect','preset']) {
    const item = makeItem(kind, rows, translate); assert.equal(item.revision, 0); assert.equal(item.status, 'active');
    const duplicate = duplicateItem({ ...item, revision: 9 }, rows, translate);
    assert.notEqual(duplicate.id, item.id); assert.equal(duplicate.revision, 0); assert.equal(duplicate.status, 'active');
  }
});
test('content languages, keyframe edits and deleted-scene targets remain independent', () => {
  const item = makeItem('preset', builtinLibraryItems(), key => key), vi = getDocument(item, 'vi', true);
  vi.scenes.push({ ...structuredClone(vi.scenes[0]), id: 'second', elementIds: ['button'] });
  vi.elements.push({ id: 'button', actions: [{ type: 'goToScene', targetSceneId: 'second' }] });
  const en = getDocument(item, 'en', true); en.scenes[0].name = 'English'; assert.notEqual(en.scenes[0].name, vi.scenes[0].name);
  removeScene(vi, 1); assert.equal(vi.elements.length, 0); assert.equal(en.elements.length, 1);
  const frame = { opacity: .5, transform: 'translateY(15px) scale(0.9)' };
  editFrame(frame, 'rotate', '12'); assert.match(frame.transform, /rotate\(12deg\)/); assert.match(frame.transform, /translateY\(15px\)/);
  editFrame(frame, 'opacity', '25'); assert.equal(frame.opacity, .25);
  assert.throws(() => setPath({}, '__proto__.polluted', 1)); assert.equal({}.polluted, undefined);
});
test('Admin detects actual animation references and builds every interaction kind', () => {
  const rows = builtinLibraryItems(), animation = rows.find(r => r.kind === 'animation');
  assert(dependencies(animation, rows).some(r => r.kind === 'effect'));
  for (const kind of ['prediction-choice','flip-card','scratch-ticket','foldout-letter','swipe-album','photo-comparison','scene-choices','wish-pick','light-a-candle','heart-puzzle','event-countdown'])
    assert.equal(makeInteraction(kind).props.kind, kind);
});

test('layer selector follows scene stacking order rather than global reading order', () => {
  const item = makeItem('preset', builtinLibraryItems(), key => key), doc = getDocument(item, 'vi', true);
  doc.elements = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]; doc.scenes[0].elementIds = ['c','a','b'];
  assert.deepEqual(layers(item).map(e => e.id), ['c','a','b']);
});
test('editing one transform preserves its position and all other transforms', () => {
  const frame = { transform: 'translateY(20px) scale(0.96) rotate(-8deg)' };
  editFrame(frame, 'y', '35'); assert.equal(frame.transform, 'translateY(35px) scale(0.96) rotate(-8deg)');
});
test('a disabled effect and its disabled animation can be previewed without enabling either in storage', async () => {
  const rows = builtinLibraryItems().filter(r => r.kind === 'element_type' || r.kind === 'element' && r.id === 'heading' || ['effect','animation'].includes(r.kind) && r.id === 'E01');
  for (const row of rows) if (['effect','animation'].includes(row.kind)) row.status = 'disabled';
  const effect = rows.find(r => r.kind === 'effect'), before = JSON.stringify(rows), calls = [];
  const service = new CanvasLibraryService({ async execute(sql) { calls.push(sql); return [rows.map(row => ({ ...row, sort_order: row.sortOrder }))]; } });
  const result = await service.preview({ role: 'admin' }, effect.kind, effect.id, { definition: effect.definition }, 'vi');
  validateDocument(result.document); assert.equal(JSON.stringify(rows), before); assert(calls.every(sql => sql.startsWith('SELECT')));
  const attemptedEnable = structuredClone(rows); attemptedEnable.find(r => r.kind === 'effect').status = 'active';
  assert.throws(() => validateLibrary(attemptedEnable), /Missing animation/);
});

test('switching content languages clamps scene/layer selection to the new document', () => {
  const item = makeItem('preset', builtinLibraryItems(), key => key), vi = getDocument(item, 'vi', true);
  vi.scenes.push({ ...structuredClone(vi.scenes[0]), id: 'vi-only', elementIds: [] });
  const en = getDocument(item, 'en', true); en.scenes.splice(1);
  assert.deepEqual(normalizeSelection(item, 'en', 1, 6), { sceneIndex: 0, layerIndex: 0 });
  assert.equal(vi.scenes.length, 2);
});
test('lost-ACK reconciliation accepts only identical authoritative content', () => {
  const item = makeItem('animation', builtinLibraryItems(), key => key), saved = structuredClone(item); saved.revision = 1;
  saved.definition = Object.fromEntries(Object.entries(saved.definition).reverse());
  assert(sameItemContent(item, saved));
  saved.definition.duration += 100; assert(!sameItemContent(item, saved));
  saved.definition.duration -= 100; saved.status = 'disabled'; assert(!sameItemContent(item, saved));
});
