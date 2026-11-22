import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDocument, publicDocument } from '../../web/js/shared/canvas/index.js';
import { sampleBindings } from '../../web/js/features/canvas-editor/library.js';
import { hash } from '../../src/modules/designs/designs.service.mjs';
import { planCanvasImport, applyCanvasImport } from '../../database/scripts/import-canvas-json.mjs';

function fixture() {
  const ownerId = randomUUID(), id = randomUUID(), versionId = randomUUID(), now = '2026-11-21T01:00:00.000Z';
  const document = sampleBindings(createDocument({ presetId: 'envelope-basic' }));
  document.elements[0].layout.y = 52.382775119617236;
  const design = { id, ownerId, title: 'Kiểm tra JSON', source: { kind: 'blank' }, provenance: { adapter: 'blank' },
    policy: { kind: 'sender-basic', lockedElements: {} }, revision: 1, schemaVersion: document.schemaVersion,
    document, documentHash: hash(document), createdAt: now, updatedAt: now, archivedAt: null };
  const version = { id: versionId, designId: id, revision: 1, schemaVersion: 1, runtimeVersion: 1,
    documentHash: design.documentHash, document: publicDocument(document), createdAt: now };
  const gift = { id: randomUUID(), slug: randomUUID().replaceAll('-', ''), userId: ownerId, sourceKind: 'blank', templateId: null,
    designVersionId: versionId, documentSnapshot: version.document, runtimeVersion: 1, assetIds: [], replyCount: 0,
    createdAt: now, expiresAt: '2027-11-21T01:00:00.000Z' };
  return { users: [{ id: ownerId }], sessions: [{ id: 'expired-but-preserved', userId: ownerId, exp: 1 }], templates: [],
    favorites: [], orders: [], gifts: [], replies: [], requests: [], canvas: { formatVersion: 1, designs: { [id]: design },
      creates: {}, mutations: {}, assets: {}, contexts: {}, replies: {}, versions: { [versionId]: version },
      publications: { [`${ownerId}:${randomUUID()}`]: { ownerId, requestHash: 'request', assetIds: [], result: { gift, publishedRevision: 1 } } } } };
}

test('canvas import preserves exact decimals, expired sessions and every source object', () => {
  const source = fixture(), before = structuredClone(source), plan = planCanvasImport(source);
  assert.deepEqual(source, before); assert.deepEqual(plan.snapshot, source);
  assert.equal(plan.snapshot.canvas.designs[Object.keys(source.canvas.designs)[0]].document.elements[0].layout.y, 52.382775119617236);
  assert.equal(plan.counts.sessions, 1); assert.equal(plan.sourceHash, hash(source));
});

test('only identical versions share a canonical revision; original IDs stay in the source archive', () => {
  const source = fixture(), first = Object.values(source.canvas.versions)[0], alias = { ...structuredClone(first), id: randomUUID() };
  source.canvas.versions[alias.id] = alias;
  const p = structuredClone(Object.values(source.canvas.publications)[0]);
  p.result.gift.id = randomUUID(); p.result.gift.slug = randomUUID().replaceAll('-', ''); p.result.gift.designVersionId = alias.id;
  source.canvas.publications[`${p.ownerId}:${randomUUID()}`] = p;
  const plan = planCanvasImport(source);
  assert.equal(plan.versions.length, 1); assert.equal(plan.aliases[alias.id], first.id);
  assert.equal(plan.gifts[1].designVersionId, first.id); assert.equal(plan.snapshot.canvas.versions[alias.id].id, alias.id);
  source.canvas.versions[alias.id].document.elements[0].layout.x += 1;
  assert.throws(() => planCanvasImport(source), /conflicting snapshots/);
});

test('canvas import refuses any occupied target before issuing a write', async () => {
  const calls = [], client = { withTransaction: work => work({ execute: async sql => {
    calls.push(sql); return sql.includes('information_schema') ? [[{ name: 'users' }]] : [[{ n: 1 }]];
  } }) };
  await assert.rejects(applyCanvasImport(planCanvasImport(fixture()), client, { label: 'fixture' }), /not empty/);
  assert(calls.every(sql => sql.startsWith('SELECT')));
});
