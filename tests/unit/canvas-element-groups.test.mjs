import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog, fillPolaroid } from '../../web/js/features/canvas-editor/library.js';
import { applyGroupLayout, dragGroupCorner, groupLayout, moveBlockInStack } from '../../web/js/features/canvas-editor/group-layout.js';
import { copyElements, pasteElements, removeElements } from '../../web/js/features/canvas-editor/clipboard.js';
import { fabricView } from '../../web/js/features/canvas-editor/fabric-adapter.js';
import { applyFabricCommands, applyFabricWorkspacePatch } from '../../web/js/features/canvas-editor/fabric-workspace.js';
import { cleanGiftLayout } from '../../web/js/shared/canvas/clean-layout.js';
import { groupElements, groupMembers } from '../../web/js/shared/canvas/element-groups.js';
import { materializeModels, pinDocumentArtwork } from '../../web/js/shared/canvas/library-materialize.js';
import { createDocument, duplicateDocument, publicDocument, validateDocument } from '../../web/js/shared/canvas/index.js';
import { photoSlots } from '../../web/js/shared/canvas/interactions.js';

const cards = catalog.flatMap(group => group.items);
const card = id => cards.find(item => item.id === id);
function documentFor(elements) {
  const document = createDocument({ presetId: 'blank' });
  document.elements = elements;
  document.scenes[0].elementIds = elements.map(e => e.id);
  const media = new Set(elements.flatMap(photoSlots).map(slot => slot.assetId).filter(Boolean));
  document.assets = [...media].map(assetId => ({ kind: 'image', assetId }));
  return pinDocumentArtwork(document);
}
const near = (a, b) => assert.ok(Math.abs(a-b) < 1e-8, `${a} != ${b}`);

test('every catalog insertion keeps all its layers as one independent instance, including DB materialization', () => {
  for (const item of cards) {
    const source = item.create();
    const first = groupElements(item.create());
    const second = groupElements(materializeModels(source));
    const doc = validateDocument(documentFor([...first, ...second]));
    for (const members of [first, second]) {
      assert.equal(Boolean(members[0].groupId), members.length > 1, item.id);
      for (const member of members) assert.deepEqual(groupMembers(doc.elements, member).map(e => e.id), members.map(e => e.id), item.id);
    }
    if (first.length > 1) assert.notEqual(first[0].groupId, second[0].groupId, item.id);
    assert(source.every(e => !e.groupId), item.id);
  }
});

test('editing a rotated block preserves internal geometry, the resize anchor and its other copy', () => {
  const members = groupElements(card('washi-corners').create());
  const original = structuredClone(members);
  const box = groupLayout(members);
  applyGroupLayout(members, box, { ...box, x: box.x + 20, y: box.y - 14, rotation: box.rotation + 90 });
  const rotated = groupLayout(members);
  for (const key of ['width', 'height']) near(rotated[key], box[key]);
  near(rotated.x, box.x + 20);
  near(rotated.y, box.y - 14);
  members.forEach((m, i) => near(m.layout.rotation, original[i].layout.rotation + 90));
  const bigger = dragGroupCorner(members, rotated, -85, 115);
  assert(bigger.width > rotated.width);
  applyGroupLayout(members, rotated, bigger);
  for (const key of ['x','y','width','height','rotation']) near(groupLayout(members)[key], bigger[key]);
  for (const [i, member] of members.entries()) near(member.layout.width / original[i].layout.width, bigger.width / box.width);
});

test('saving, publishing, scene-safe copies and clipboard keep whole blocks and their stacking order', () => {
  const members = groupElements(card('photo-diptych').create()), single = card('rectangle').create()[0];
  const doc = documentFor([...members, single]), scene = doc.scenes[0];
  moveBlockInStack(doc, scene, members[2], 1);
  assert.deepEqual(scene.elementIds, [single.id, ...members.map(e => e.id)]);
  const snapshot = publicDocument(JSON.parse(JSON.stringify(doc)));
  const duplicate = duplicateDocument(snapshot);
  assert.equal(groupMembers(duplicate.elements, duplicate.elements[1]).length, 3);
  assert.notEqual(duplicate.elements[1].groupId, members[0].groupId);
  const clean = cleanGiftLayout(snapshot);
  assert(clean.elements.every(e => !e.groupId), 'Removing both personal photos leaves an independent backing');
  const clip = copyElements(doc, [members[1].id, single.id], 'draft', {});
  const pasted = pasteElements(doc, scene.id, clip, 'draft', () => crypto.randomUUID());
  const additions = pasted.document.elements.slice(doc.elements.length);
  assert.equal(groupMembers(additions, additions[1]).length, 3);
  assert.notEqual(additions[1].groupId, members[1].groupId);
  assert.equal(pasted.document.scenes[0].elementIds.at(-4), additions[3].id);
  assert.deepEqual(removeElements(pasted.document, [additions[2].id], {}).elements, [...doc.elements, additions[3]]);
  const locked = { lockedElements: { [members[2].id]: {} } };
  assert.deepEqual(copyElements(doc, [members[1].id, single.id], 'draft', locked).models, [single]);
  assert.deepEqual(removeElements(doc, [members[1].id], locked), doc);
  const split = structuredClone(doc);
  split.scenes[0].elementIds = split.scenes[0].elementIds.filter(id => id !== members[1].id);
  split.scenes.push({ ...scene, id: 'another-scene', elementIds: [members[1].id] });
  assert.throws(() => validateDocument(split), /groupId|cùng một cảnh/);
  const orphan = structuredClone(doc);
  delete orphan.elements[0].groupId;
  assert.throws(() => validateDocument(orphan), /groupId|cùng một cảnh/);
});

test('replacing a Polaroid photo retains membership and Fabric cannot transform or delete a single member', () => {
  const members = groupElements(card('polaroid').create());
  members[2] = fillPolaroid(members[2], 'test-photo');
  const doc = validateDocument(documentFor(members)), scene = doc.scenes[0];
  assert.equal(groupMembers(doc.elements, members[2]).length, 3);
  assert(fabricView(doc, scene.id).elements.every(e => e.groupId === members[0].groupId && e.editable));
  const styled = applyFabricWorkspacePatch(doc, scene.id, { order: scene.elementIds, visibility: {},
    layouts: [{ id: members[1].id, layout: members[1].layout, text: 'New caption' }] });
  assert.equal(styled.elements[1].props.text, 'New caption');
  assert.deepEqual(styled.elements[1].layout, members[1].layout);
  assert.throws(() => applyFabricCommands(doc, scene.id, [{ type: 'remove', id: members[1].id }]));
  assert.throws(() => applyFabricWorkspacePatch(doc, scene.id, {
    order: scene.elementIds, visibility: {}, layouts: [{ id: members[1].id, layout: { ...members[1].layout, x: 0 } }],
  }));
});
