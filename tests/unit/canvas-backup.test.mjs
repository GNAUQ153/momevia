import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { exportCanvas, verifyCanvas, restoreCanvas } from '../../scripts/dev/canvas-backup.mjs';
import { JsonDesignRepository } from '../../src/modules/designs/json.repository.mjs';
import { DesignsService } from '../../src/modules/designs/designs.service.mjs';
import { AssetsService } from '../../src/modules/designs/assets.service.mjs';
import { createElement } from '../../web/js/shared/canvas/index.js';
import { templates } from '../../src/modules/catalog/seed.mjs';
import { readGiftsCheckoutSnapshot, prepareGiftsCheckout, applyGiftsCheckout } from '../../database/scripts/import-gifts-checkout.mjs';
import { collectSnapshot, validateSnapshot, generateImportSql } from '../../database/scripts/prepare-import.mjs';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
function temp(t) { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'momevia-canvas-backup-')); t.after(() => fs.rmSync(root, { recursive: true, force: true })); return root; }
async function fixture(t, extended = false) {
  const root = temp(t), source = path.join(root, 'services/designs/data'), mediaRoot = path.join(source, 'assets');
  const repository = new JsonDesignRepository(path.join(source, 'canvas.json')), user = { sub: randomUUID() }, orderId = randomUUID();
  const service = new DesignsService({ repository, publication: repository, catalog: { getTemplate: async id => structuredClone(templates.find(t => t.id === id)) }, checkout: { hasLicense: async () => true }, orders: async () => [{ id: orderId, templateId: 'midnight-bloom' }], config: { giftTtlDays: 365 }, flags: { read: true, edit: true, publish: true }, mediaRoot, profile: { supported: true, mode: 'json' } });
  const first = await service.create(user, { source: { kind: 'template', templateId: 'midnight-bloom' }, mutationId: randomUUID(), title: 'Sinh nhật Nguyễn Mai' });
  const image = await sharp({ create: { width: 12, height: 9, channels: 3, background: '#FFC0FF' } }).png().toBuffer();
  const asset = await new AssetsService(service).upload(user, first.design.id, randomUUID(), { mime: 'image/png', bytes: image });
  const document = structuredClone(first.design.document); document.bindings.recipientName.value = 'Nguyễn Mai'; document.bindings.senderName.value = 'Trần An'; document.bindings.message.value = 'Chúc bạn bình an! Tiếng Việt ♥';
  const photo = extended ? createElement('interaction', {id:'photo',props:{kind:'swipe-album',
    photos:Array.from({length:3},(_,i)=>({id:`slot-${i}`,assetId:i ? null : asset.id,alt:'Ảnh QA',caption:'Kỷ niệm',focalPoint:{x:.2,y:.7}}))},
    effects:{entrance:{id:'E01'}}}) : createElement('image', { id: 'photo', props: { assetId: asset.id } });
  if (extended) document.schemaVersion = document.registryVersion = 2;
  document.elements.push(photo); document.scenes[2].elementIds.push(photo.id); document.assets.push({ assetId: asset.id, kind: 'image' });
  await service.save(user, first.design.id, { expectedRevision: 1, mutationId: randomUUID(), title: first.design.title, document });
  const saved = await service.get(user, first.design.id), published = await service.publish(user, { designId: saved.id, expectedRevision: saved.revision, expectedDocumentHash: saved.documentHash, idempotencyKey: randomUUID() });
  await repository.addReply(published.gift.id, { id: randomUUID(), giftId: published.gift.id, name: 'Nguyễn Mai', message: 'Cảm ơn bạn!', createdAt: new Date().toISOString() });
  await service.attachContext(user, orderId, { designId: saved.id, expectedRevision: saved.revision, expectedDocumentHash: saved.documentHash, mutationId: randomUUID() });
  await service.duplicate(user, saved.id, { mutationId: randomUUID() });
  const newer = structuredClone(document); newer.bindings.message.value = 'Bản nháp mới, không đổi quà đã phát hành.';
  await service.save(user, saved.id, { expectedRevision: 2, mutationId: randomUUID(), title: saved.title, document: newer });
  const metadata = await repository.getAsset(user.sub, asset.id), assetFile = path.join(mediaRoot, metadata.storageKey);
  const orphanFile = `${randomUUID()}.png`; fs.writeFileSync(path.join(mediaRoot, orphanFile), image);
  return { root, source, repository, user, assetFile, orphanFile, gift: published.gift, backup: path.join(root, 'backup'), restored: path.join(root, 'restored') };
}

test('versioned canvas JSON backup restores exact authoritative bytes, IDs, snapshots, refs and media', async t => {
  const f = await fixture(t), before = fs.readFileSync(path.join(f.source, 'canvas.json'));
  fs.writeFileSync(path.join(f.source, '.env'), 'SECRET=must-not-copy'); fs.writeFileSync(path.join(f.source, 'sessions.json'), '[{"token":"not-a-canvas-file"}]');
  const manifest = exportCanvas({ source: f.source, target: f.backup, offline: true });
  assert.equal(manifest.formatVersion, 1); assert.deepEqual(manifest.counts, { designs: 2, creates: 2, mutations: 2, assets: 1, contexts: 1, publications: 1, versions: 1, replies: 1 });
  assert.equal(manifest.files.length, 3); assert.equal(fs.existsSync(path.join(f.backup, '.env')), false); assert.equal(fs.existsSync(path.join(f.backup, 'sessions.json')), false);
  assert.deepEqual(fs.readFileSync(path.join(f.source, 'canvas.json')), before, 'export never modifies source');
  assert.deepEqual(verifyCanvas({ source: f.backup }).manifest.counts, manifest.counts);
  const restored = restoreCanvas({ source: f.backup, target: f.restored }); assert.deepEqual(restored.counts, manifest.counts);
  assert.deepEqual(fs.readFileSync(path.join(f.restored, 'canvas.json')), before);
  const reader = new JsonDesignRepository(path.join(f.restored, 'canvas.json'));
  const gift = await reader.findBySlug(f.gift.slug); assert.equal(gift.documentSnapshot.bindings.message.value, 'Chúc bạn bình an! Tiếng Việt ♥'); assert.equal(gift.replyCount, 1);
  assert.deepEqual(gift.assetIds, f.gift.assetIds); assert.deepEqual(fs.readFileSync(path.join(f.restored, 'assets', path.basename(f.assetFile))), fs.readFileSync(f.assetFile));
  assert.deepEqual(fs.readFileSync(path.join(f.restored, 'assets', f.orphanFile)), fs.readFileSync(path.join(f.source, 'assets', f.orphanFile)));
  const reexport = path.join(f.root, 'second-backup'); assert.deepEqual(exportCanvas({ source: f.restored, target: reexport, offline: true }).counts, manifest.counts);
});

test('backup restores a V2 snapshot and the private bytes pinned by a nested album slot', async t => {
  const f = await fixture(t, true);
  exportCanvas({ source:f.source,target:f.backup,offline:true });
  restoreCanvas({ source:f.backup,target:f.restored });
  const gift = await new JsonDesignRepository(path.join(f.restored,'canvas.json')).findBySlug(f.gift.slug);
  assert.equal(gift.runtimeVersion,2);
  assert.deepEqual(gift.documentSnapshot,f.gift.documentSnapshot);
  assert.deepEqual(gift.assetIds,f.gift.assetIds);
  assert.deepEqual(fs.readFileSync(path.join(f.restored,'assets',path.basename(f.assetFile))),fs.readFileSync(f.assetFile));
});

test('canvas backup fails missing/corrupt media, invalid refs and corrupted backup before creating restore target', async t => {
  const f = await fixture(t), bytes = fs.readFileSync(f.assetFile);
  fs.unlinkSync(f.assetFile); assert.throws(() => exportCanvas({ source: f.source, target: f.backup, offline: true }), /missing asset/); assert.equal(fs.existsSync(f.backup), false);
  fs.writeFileSync(f.assetFile, 'corrupt'); assert.throws(() => exportCanvas({ source: f.source, target: f.backup, offline: true }), /checksum/); fs.writeFileSync(f.assetFile, bytes);
  exportCanvas({ source: f.source, target: f.backup, offline: true }); fs.appendFileSync(path.join(f.backup, 'canvas.json'), ' ');
  assert.throws(() => restoreCanvas({ source: f.backup, target: f.restored }), /checksum/); assert.equal(fs.existsSync(f.restored), false);
});

test('canvas backup requires offline explicit paths, never merges and rejects links/traversal members', async t => {
  const f = await fixture(t);
  assert.throws(() => exportCanvas({ source: f.source, target: f.backup }), /offline/);
  assert.throws(() => exportCanvas({ target: f.backup, offline: true }), /explicit/);
  exportCanvas({ source: f.source, target: f.backup, offline: true });
  fs.mkdirSync(f.restored); fs.writeFileSync(path.join(f.restored, 'keep.txt'), 'keep');
  assert.throws(() => restoreCanvas({ source: f.backup, target: f.restored }), /must not exist/); assert.equal(fs.readFileSync(path.join(f.restored, 'keep.txt'), 'utf8'), 'keep');
  assert.throws(() => exportCanvas({ source: f.source, target: f.backup, offline: true }), /must not exist/);
  const manifestPath = path.join(f.backup, 'manifest.json'), manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.files[0].file = '../canvas.json'; fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  assert.throws(() => verifyCanvas({ source: f.backup }), /member path/);
  // Directory junctions are available without Windows symlink privileges.
  const linked = path.join(f.root, 'linked-source'); fs.symlinkSync(f.source, linked, 'junction'); assert.throws(() => exportCanvas({ source: linked, target: path.join(f.root, 'linked-backup'), offline: true }), /links/);
});

test('canvas backup rejects foreign asset pins and extra aggregate collections instead of dropping data', async t => {
  const f = await fixture(t), aggregatePath = path.join(f.source, 'canvas.json'), original = fs.readFileSync(aggregatePath, 'utf8'), state = JSON.parse(original);
  Object.values(state.publications)[0].assetIds = []; fs.writeFileSync(aggregatePath, JSON.stringify(state));
  assert.throws(() => exportCanvas({ source: f.source, target: f.backup, offline: true }), /pins/);
  fs.writeFileSync(aggregatePath, JSON.stringify({ ...JSON.parse(original), sessions: { token: 'never export sessions' } }));
  assert.throws(() => exportCanvas({ source: f.source, target: f.backup, offline: true }), /extra top-level/);
});

test('canvas export detects an aggregate changed during copy and leaves no completed manifest', async t => {
  const f = await fixture(t), aggregateFile = path.join(f.source, 'canvas.json'), originalBytes = fs.readFileSync(aggregateFile), write = fs.writeFileSync;
  let injected = false;
  fs.writeFileSync = function (destination, bytes, ...options) {
    const result = write.call(this, destination, bytes, ...options);
    if (!injected && typeof destination === 'number' && Buffer.isBuffer(bytes) && bytes.equals(originalBytes)) { injected = true; fs.appendFileSync(aggregateFile, ' '); }
    return result;
  };
  try { assert.throws(() => exportCanvas({ source: f.source, target: f.backup, offline: true }), /source changed/); }
  finally { fs.writeFileSync = write; }
  assert.equal(injected, true); assert.equal(fs.existsSync(path.join(f.backup, 'manifest.json')), false);
});

test('canvas backup CLI requires explicit offline export and verifies/restores the isolated fixture', async t => {
  const f = await fixture(t), command = path.join(workspace, 'scripts/dev/canvas-backup.mjs');
  const run = args => spawnSync(process.execPath, [command, ...args], { encoding: 'utf8', timeout: 15000 });
  const rejected = run(['export', '--source', f.source, '--target', f.backup]); assert.equal(rejected.status, 1); assert.match(rejected.stderr, /offline/);
  for (const args of [ ['export', '--source', f.source, '--target', f.backup, '--offline'], ['verify', '--source', f.backup], ['restore', '--source', f.backup, '--target', f.restored] ]) { const result = run(args); assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).counts.publications, 1); }
  const refusal = run(['restore', '--source', f.backup, '--target', f.restored]); assert.equal(refusal.status, 1); assert.match(refusal.stderr, /must not exist/);
});

test('C26 legacy collectors and pure import plans explicitly reject canvas publications/aggregate', async t => {
  const f = await fixture(t), message = /Canvas snapshot\/asset refs requires versioned canvas backup/;
  assert.throws(() => readGiftsCheckoutSnapshot(f.root), message); assert.throws(() => collectSnapshot(f.root), message);
  for (const gift of [f.gift, { sourceKind: 'blank' }, { sourceKind: 'template' }, { designVersionId: randomUUID() }, { documentSnapshot: null }]) {
    const input = { gifts: [gift], replies: [], orders: [] };
    assert.throws(() => prepareGiftsCheckout(input, { users: [], templates: [] }, { root: f.root }), message);
    assert.throws(() => validateSnapshot(input), message); assert.throws(() => generateImportSql(input), message);
    let called = false; await assert.rejects(applyGiftsCheckout(input, { withTransaction: () => { called = true; } }), message); assert.equal(called, false);
  }
});

test('C26 actual legacy CLI on a copied code-only fixture fails before SQL/provider/data writes', async t => {
  const f = await fixture(t), codeRoot = path.join(f.root, 'cli-project'); fs.mkdirSync(codeRoot);
  // Copy only these source trees; no workspace .env, node_modules or services data.
  fs.cpSync(path.join(workspace, 'database/scripts'), path.join(codeRoot, 'database/scripts'), { recursive: true });
  fs.cpSync(path.join(workspace, 'src'), path.join(codeRoot, 'src'), { recursive: true });
  const aggregateDirectory = path.join(codeRoot, 'services/designs/data'); fs.mkdirSync(aggregateDirectory, { recursive: true }); fs.copyFileSync(path.join(f.source, 'canvas.json'), path.join(aggregateDirectory, 'canvas.json'));
  for (const name of ['import-gifts-checkout.mjs', 'prepare-import.mjs']) {
    const result = spawnSync(process.execPath, [path.join(codeRoot, 'database/scripts', name)], { cwd: codeRoot, encoding: 'utf8', timeout: 15000, env: { ...process.env, PAYMENT_ENABLED: 'false', PAYMENT_LIVE_ENABLED: 'false' } });
    assert.equal(result.status, 1, result.stderr); assert.match(result.stderr, /Canvas snapshot\/asset refs requires versioned canvas backup/);
  }
  assert.equal(fs.existsSync(path.join(codeRoot, 'database/private/import.sql')), false);
});

test('empty canvas initialization does not block legacy collectors, while unsupported aggregate data does', t => {
  const root = temp(t), file = path.join(root, 'services/designs/data/canvas.json');
  new JsonDesignRepository(file);
  assert.deepEqual(readGiftsCheckoutSnapshot(root), { gifts: [], replies: [], orders: [] });
  assert.equal(collectSnapshot(root).templates.length, templates.length);
  const state = JSON.parse(fs.readFileSync(file, 'utf8')); state.unknownFutureField = 'must not drop'; fs.writeFileSync(file, JSON.stringify(state));
  assert.throws(() => readGiftsCheckoutSnapshot(root), /versioned canvas backup/);
  assert.throws(() => collectSnapshot(root), /versioned canvas backup/);
});
