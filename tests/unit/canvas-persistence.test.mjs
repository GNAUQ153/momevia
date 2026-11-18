import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { JsonDesignRepository } from '../../src/modules/designs/json.repository.mjs';
import { DesignsService, designView, hash, publicGiftView, giftSummary } from '../../src/modules/designs/designs.service.mjs';
import { AssetsService } from '../../src/modules/designs/assets.service.mjs';
import { GiftService } from '../../src/modules/gifts/gifts.service.mjs';
import { createElement } from '../../web/js/shared/canvas/index.js';
import { templates } from '../../src/modules/catalog/seed.mjs';

const status = expected => error => error.status === expected;
const user = { sub: '93008d06-73eb-40c2-9c5a-26c19a4de0f5', role: 'sender' };
const other = { sub: '625a72f2-b4bf-44d4-9cb2-51a17433c68f', role: 'sender' };
function fixture(t, { fault } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'momevia-canvas-unit-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'canvas.json'), mediaRoot = path.join(root, 'assets');
  const control = { licensed: false, unavailable: false, licenseCalls: 0 };
  const catalog = { getTemplate: async id => { if (control.unavailable) throw new Error('Injected catalog unavailable'); const result = templates.find(t => t.id === id); if (!result) throw Object.assign(new Error('Missing'), { status: 404 }); return structuredClone(result); } };
  const checkout = { hasLicense: async () => { control.licenseCalls++; if (control.unavailable) throw new Error('Injected checkout unavailable'); return control.licensed; } };
  const flags = { read: true, edit: true, publish: true }, profile = { mode: 'json', supported: true }, config = { giftTtlDays: 365, baseUrl: 'http://fixture.test' };
  const construct = repository => new DesignsService({ repository, publication: repository, catalog, checkout, orders: async () => [], config, flags, mediaRoot, profile });
  const repository = new JsonDesignRepository(file, { fault });
  const service = construct(repository);
  return { root, file, mediaRoot, repository, service, assets: new AssetsService(service), control, flags, profile, config, restart: () => construct(new JsonDesignRepository(file)) };
}
async function create(f, source = { kind: 'blank' }, extra = {}) { return (await f.service.create(user, { source, presetId: 'envelope-basic', mutationId: randomUUID(), ...extra })).design; }
function saveInput(d, message = 'Chúc mừng sinh nhật, bình an và hạnh phúc!') {
  const document = structuredClone(d.document);
  for (const [name, value] of Object.entries({ recipientName: 'Nguyễn Mai', senderName: 'Trần An', message })) document.bindings[name].value = value;
  return { expectedRevision: d.revision, mutationId: randomUUID(), title: 'Sinh nhật Mai QA', document };
}
async function complete(f, source) { const d = await create(f, source); await f.service.save(user, d.id, saveInput(d)); return designView(await f.service.get(user, d.id)); }
function publicationInput(d, extra = {}) { return { designId: d.id, expectedRevision: d.revision, expectedDocumentHash: d.documentHash, idempotencyKey: randomUUID(), ...extra }; }
async function image(color = '#DAA0FF') { return { mime: 'image/png', bytes: await sharp({ create: { width: 16, height: 12, channels: 3, background: color } }).png().toBuffer() }; }

test('canvas JSON create is owner-scoped and replay survives repository restart; key reuse conflicts', async t => {
  const f = fixture(t), input = { source: { kind: 'blank' }, presetId: 'blank', mutationId: randomUUID(), title: 'Nháp riêng' };
  const first = await f.service.create(user, input), replay = await f.restart().create(user, input);
  assert.equal(replay.design.id, first.design.id); assert.equal(replay.replayed, true);
  assert.deepEqual(replay.design.document, first.design.document); assert.equal((await f.service.list(user)).length, 1);
  await assert.rejects(f.service.create(user, { ...input, title: 'Khác nội dung' }), status(409));
  const otherCreated = await f.service.create(other, input); assert.notEqual(otherCreated.design.id, first.design.id);
  await assert.rejects(f.service.get(other, first.design.id), status(404));
});

test('old Creator draft provenance clears locked demo values while keeping Sender names and already-sent snapshots', async t => {
  const f = fixture(t);
  const draft = await create(f);
  const state = f.repository.read();
  const saved = state.designs[draft.id];
  saved.source = { kind: 'template', templateId: 'origin-old', templateVersionId: randomUUID() };
  saved.provenance = { adapter: 'creator-v1', price: 0 };
  saved.policy = { kind: 'creator-template', editableBindings: ['senderName', 'message'], photoId: null, lockedElements: {} };
  saved.document.bindings.recipientName.value = 'Tên minh họa bất kỳ';
  saved.document.bindings.senderName.value = 'An';
  saved.document.bindings.message.value = 'Lời chúc đã viết.';
  saved.documentHash = hash(saved.document);
  const old = publicGiftView({ title: 'Quà đã gửi', recipientName: 'Tên minh họa bất kỳ', senderName: 'An',
    documentSnapshot: saved.document, runtimeVersion: 1, expiresAt: '2100-01-01' });
  f.repository.write(state);
  const loaded = designView(await f.service.get(user, draft.id));
  assert.equal(loaded.reviewTemplateDefaults, true);
  assert.equal(loaded.document.bindings.recipientName.value, '');
  assert.equal(loaded.document.bindings.senderName.value, 'An');
  await assert.rejects(f.service.publish(user, publicationInput(loaded)), error => error.details.some(item => item.code === 'REVIEW_TEMPLATE_DEFAULTS'));
  await f.service.save(user, draft.id, { expectedRevision: loaded.revision, mutationId: randomUUID(), title: loaded.title, document: loaded.document });
  const clean = designView(await f.service.get(user, draft.id));
  const { gift } = await f.service.publish(user, publicationInput(clean));
  assert.equal(gift.recipientName, '');
  assert.equal(gift.senderName, 'An');
  assert.equal(old.documentSnapshot.bindings.recipientName.value, 'Tên minh họa bất kỳ');
});

test('create replay recovers committed result while source catalog is unavailable; duplicate replay after source archive', async t => {
  const f = fixture(t), input = { source: { kind: 'template', templateId: templates[0].id }, mutationId: randomUUID() };
  const first = await f.service.create(user, input); f.control.unavailable = true;
  const replay = await f.restart().create(user, input); assert.equal(replay.replayed, true); assert.equal(replay.design.id, first.design.id);
  const mutationId = randomUUID(), duplicate = await f.service.duplicate(user, first.design.id, { mutationId });
  await f.repository.archive(user.sub, first.design.id);
  assert.equal((await f.service.duplicate(user, first.design.id, { mutationId })).design.id, duplicate.design.id);
});

test('canvas JSON create lost ACK recovers its original design after restart', async t => {
  let armed = false;
  const f = fixture(t, { fault: phase => { if (armed && phase === 'afterCommit') { armed = false; throw new Error('Lost create ACK'); } } });
  const input = { source: { kind: 'blank' }, presetId: 'blank', mutationId: randomUUID() }; armed = true;
  await assert.rejects(f.service.create(user, input), /Lost create ACK/);
  const persisted = await f.repository.list(user.sub); assert.equal(persisted.length, 1);
  const replay = await f.restart().create(user, input); assert.equal(replay.replayed, true); assert.equal(replay.design.id, persisted[0].id);
});

test('canvas JSON Unicode/layout/crop/IDs round-trip and concurrent same-revision saves have one winner', async t => {
  const f = fixture(t), d = await create(f), a = saveInput(d, 'Nội dung A: Tiếng Việt ♥'), b = saveInput(d, 'Nội dung B');
  a.document.scenes.reverse(); const photo = createElement('image', { id: 'photo-crop', props: { assetId: null, fit: 'cover', focalPoint: { x: 0.2, y: 0.8 } }, layout: { x: 42, y: 84, width: 250, height: 180 } });
  a.document.elements.push(photo); a.document.scenes[0].elementIds.push(photo.id);
  const outcomes = await Promise.allSettled([f.service.save(user, d.id, a), f.service.save(user, d.id, b)]);
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1); assert.equal(outcomes.find(x => x.status === 'rejected').reason.status, 409);
  const loaded = await f.restart().get(user, d.id); assert.equal(loaded.revision, 2); assert.deepEqual(loaded.document, a.document); assert.equal(loaded.documentHash, hash(a.document));
  assert.equal(b.document.bindings.message.value, 'Nội dung B');
});

test('canvas JSON lost save ACK replays old revision and never overwrites a later revision', async t => {
  let armed = false;
  const f = fixture(t, { fault: phase => { if (armed && phase === 'afterCommit') { armed = false; throw new Error('Lost ACK'); } } });
  const d = await create(f), input = saveInput(d); armed = true;
  await assert.rejects(f.service.save(user, d.id, input), /Lost ACK/);
  const restarted = f.restart(), replay = await restarted.save(user, d.id, input); assert.equal(replay.savedRevision, 2); assert.equal(replay.replayed, true);
  const later = await restarted.get(user, d.id); await restarted.save(user, d.id, saveInput(later, 'Bản sau ACK thất lạc'));
  const old = await restarted.save(user, d.id, input); assert.equal(old.savedRevision, 2); assert.equal((await restarted.get(user, d.id)).revision, 3);
  assert.equal((await restarted.get(user, d.id)).document.bindings.message.value, 'Bản sau ACK thất lạc');
  await assert.rejects(restarted.save(user, d.id, { ...input, title: 'Thay payload cùng key' }), status(409));
});

test('canvas JSON save refuses owner/source/policy injection and preserves server policy on duplicate', async t => {
  const f = fixture(t), d = await create(f, { kind: 'template', templateId: 'midnight-bloom' });
  for (const forbidden of ['ownerId', 'source', 'provenance', 'policy']) await assert.rejects(f.service.save(user, d.id, { ...saveInput(d), [forbidden]: { kind: 'blank' } }), status(422));
  await assert.rejects(f.service.save(other, d.id, saveInput(d)), status(404));
  const lockedId = d.document.elements[0].id;
  await f.repository.change(state => { state.designs[d.id].policy.lockedElements[lockedId] = { editableProps: ['color'] }; return true; });
  const forbidden = saveInput(d); forbidden.document.elements[0].layout.x += 10; await assert.rejects(f.service.save(user, d.id, forbidden), status(403));
  const permitted = saveInput(d); permitted.document.elements[0].props.color = '#123456'; await f.service.save(user, d.id, permitted);
  const duplicate = await f.service.duplicate(user, d.id, { mutationId: randomUUID() });
  assert.deepEqual(duplicate.design.source, d.source); assert.notEqual(duplicate.design.document.elements[0].id, lockedId);
  assert.deepEqual(duplicate.design.policy.lockedElements[duplicate.design.document.elements[0].id], { editableProps: ['color'] });
  const opening = duplicate.design.document.elements.find(element => element.type === 'envelope');
  assert(opening, 'copied composition retains its opening envelope');
  assert.equal(opening.actions[0].targetSceneId, duplicate.design.document.scenes[1].id);
  assert.deepEqual((await f.service.get(user, duplicate.design.id)).provenance, (await f.service.get(user, d.id)).provenance);
});

test('canvas assets validate/reencode real bytes, retry idempotently and remain owner-only', async t => {
  const f = fixture(t), d = await create(f), otherDesign = (await f.service.create(other, { source: { kind: 'blank' }, mutationId: randomUUID() })).design;
  const mutationId = randomUUID(), bytes = await image(); const asset = await f.assets.upload(user, d.id, mutationId, bytes);
  assert.equal(asset.status, 'ready'); assert.equal(asset.width, 16); assert.equal(asset.height, 12); assert.equal(asset.storageKey, undefined);
  assert.equal((await f.assets.upload(user, d.id, mutationId, bytes)).id, asset.id);
  await assert.rejects(f.assets.upload(user, d.id, mutationId, await image('#123456')), status(409));
  await assert.rejects(f.assets.upload(user, d.id, randomUUID(), { mime: 'image/png', bytes: Buffer.from('not-an-image-content') }), status(400));
  await assert.rejects(f.assets.upload(user, d.id, randomUUID(), { ...bytes, mime: 'image/webp' }), status(400));
  await assert.rejects(f.assets.owner(other, otherDesign.id, asset.id), status(404));
  const input = saveInput(otherDesign), foreignImage = createElement('image', { id: 'stolen-image', props: { assetId: asset.id } });
  input.document.elements.push(foreignImage); input.document.scenes[0].elementIds.push(foreignImage.id); input.document.assets.push({ assetId: asset.id, kind: 'image' });
  await assert.rejects(f.service.save(other, otherDesign.id, input), status(422));
  assert.equal((await f.service.get(other, otherDesign.id)).revision, 1);
});

test('canvas upload replay repairs absent ready bytes before returning ready', async t => {
  const f = fixture(t), d = await create(f), mutationId = randomUUID(), input = await image();
  const first = await f.assets.upload(user, d.id, mutationId, input), metadata = await f.repository.getAsset(user.sub, first.id);
  fs.unlinkSync(f.service.assetPath(metadata));
  const replay = await f.assets.upload(user, d.id, mutationId, input);
  assert.equal(replay.id, first.id); assert.equal(replay.status, 'ready'); assert.equal(fs.existsSync(f.service.assetPath(metadata)), true);
});

test('canvas preflight separates missing license, source unavailable, invalid draft and free blank', async t => {
  const f = fixture(t), paid = await complete(f, { kind: 'template', templateId: 'midnight-bloom' });
  const denied = await f.service.preflight(user, paid.id, { expectedRevision: paid.revision }); assert.equal(denied.authorization.status, 'needs_template_license'); assert.equal(denied.canPublish, false);
  await assert.rejects(f.service.publish(user, publicationInput(paid)), status(402));
  f.control.licensed = true; assert.equal((await f.service.preflight(user, paid.id, { expectedRevision: paid.revision })).canPublish, true);
  f.control.unavailable = true; await assert.rejects(f.service.preflight(user, paid.id, { expectedRevision: paid.revision }), error => error.status === 503 && error.code === 'AUTHORIZATION_UNAVAILABLE');
  f.control.unavailable = false; f.control.licensed = false;
  const blank = await complete(f); const before = f.control.licenseCalls; assert.equal((await f.service.preflight(user, blank.id, { expectedRevision: blank.revision })).canPublish, true); assert.equal(f.control.licenseCalls, before);
  const draft = await create(f); const missing = await f.service.preflight(user, draft.id, { expectedRevision: 1 }); assert.equal(missing.authorization.status, 'allowed'); assert.equal(missing.canPublish, false); assert.ok(missing.blockers.some(b => b.code === 'BINDING_REQUIRED'));
});

test('canvas publication rechecks server hash/license and same-key concurrent retries produce one immutable gift', async t => {
  const f = fixture(t), d = await complete(f), input = publicationInput(d);
  await assert.rejects(f.service.publish(user, { ...input, expectedDocumentHash: `sha256:${'0'.repeat(64)}` }), status(409));
  const results = await Promise.all([f.service.publish(user, input), f.service.publish(user, input)]);
  assert.equal(results[0].gift.id, results[1].gift.id); assert.equal(results.filter(r => r.replayed).length, 1);
  const original = structuredClone(results[0].gift.documentSnapshot);
  const replay = await f.restart().publish(user, input); assert.equal(replay.gift.id, results[0].gift.id); assert.equal(replay.replayed, true);
  await f.service.save(user, d.id, saveInput(d, 'Bản mới không được đổi quà đã gửi'));
  await assert.rejects(f.service.publish(user, { ...input, expectedRevision: d.revision + 1 }), status(409));
  assert.deepEqual((await f.repository.findBySlug(results[0].gift.slug)).documentSnapshot, original);
  assert.equal((await f.repository.listForUser(user.sub)).length, 1);
  f.control.licensed = true; const paid = await complete(f, { kind: 'template', templateId: 'midnight-bloom' });
  assert.equal((await f.service.preflight(user, paid.id, { expectedRevision: paid.revision })).canPublish, true); f.control.licensed = false;
  await assert.rejects(f.service.publish(user, publicationInput(paid)), status(402));
});

test('canvas JSON before-commit failure leaves no publication; after-commit lost ACK recovers same gift after restart', async t => {
  let failAt = '';
  const f = fixture(t, { fault: phase => { if (phase === failAt) { failAt = ''; throw new Error(`Injected ${phase}`); } } });
  const d = await complete(f), request = publicationInput(d); failAt = 'beforeCommit';
  await assert.rejects(f.service.publish(user, request), /beforeCommit/); assert.equal((await f.restart().repository.listForUser(user.sub)).length, 0);
  failAt = 'afterCommit'; await assert.rejects(f.service.publish(user, request), /afterCommit/);
  const restarted = f.restart(), retry = await restarted.publish(user, request); assert.equal(retry.replayed, true); assert.equal((await restarted.repository.listForUser(user.sub)).length, 1);
  const replayAgain = await restarted.publish(user, request); assert.equal(replayAgain.gift.slug, retry.gift.slug);
  assert.equal(Object.values(restarted.repository.read().versions).length, 1);
});

test('canvas public/list DTOs omit private envelope, idempotency, storage and policy metadata', async t => {
  const f = fixture(t), d = await complete(f), result = await f.service.publish(user, publicationInput(d));
  const polluted = { ...result.gift, ownerId: 'private-owner', policy: { secret: 'secret-policy' }, provenance: { internal: true }, mutationId: randomUUID(), storageKey: 'private-file', draftMetadata: { private: true } };
  const publicView = publicGiftView(polluted), summary = giftSummary(polluted), list = await f.service.list(user);
  for (const object of [publicView, summary, ...list]) for (const key of ['userId', 'ownerId', 'policy', 'provenance', 'mutationId', 'storageKey', 'draftMetadata', 'assetIds', 'designVersionId']) assert.equal(object[key], undefined, key);
  assert.equal(summary.documentSnapshot, undefined); assert.equal(list[0].document, undefined); assert.equal(publicView.documentSnapshot.bindings.message.value, d.document.bindings.message.value);
});

test('canvas publication authoritative binding summaries match the immutable document exactly', async t => {
  const f = fixture(t), d = await create(f), input = saveInput(d, '  Một lời chúc\ncó khoảng trắng được giữ lại.  ');
  input.document.bindings.recipientName.value = ' Mai '; input.document.bindings.senderName.value = ' An ';
  await f.service.save(user, d.id, input);
  const latest = await f.service.get(user, d.id), result = await f.service.publish(user, publicationInput(latest));
  for (const name of ['recipientName', 'senderName', 'message']) assert.equal(result.gift[name], result.gift.documentSnapshot.bindings[name].value, name);
});

test('canvas reader still projects empty gift snapshots published before the content check', async t => {
  const f = fixture(t);
  const draft = await create(f, { kind: 'blank' }, { presetId: 'blank' });
  const { document: documentSnapshot } = saveInput(draft);
  const gift = { slug: 'historic-empty-canvas-gift', runtimeVersion: 1, documentSnapshot, expiresAt: '2099-01-01T00:00:00Z' };
  const reader = new GiftService({ giftsRepo: { all: () => [gift] }, config: f.config });
  assert.deepEqual((await reader.publicGift(gift.slug)).documentSnapshot, documentSnapshot);
});

test('canvas edit/publish off keeps immutable publication reader and pinned asset bytes available after draft archive', async t => {
  const f = fixture(t), d = await complete(f), asset = await f.assets.upload(user, d.id, randomUUID(), await image());
  const input = saveInput(d); const photo = createElement('image', { id: 'pinned-photo', props: { assetId: asset.id } }); input.document.elements.push(photo); input.document.scenes[0].elementIds.push(photo.id); input.document.assets.push({ assetId: asset.id, kind: 'image' });
  await f.service.save(user, d.id, input); const latest = await f.service.get(user, d.id), result = await f.service.publish(user, publicationInput(latest));
  await f.repository.archive(user.sub, d.id); f.flags.edit = false; f.flags.publish = false;
  await assert.rejects(f.service.create(user, { source: { kind: 'blank' }, mutationId: randomUUID() }), status(503)); await assert.rejects(f.service.publish(user, publicationInput(latest)), status(503));
  const canvas = { repository: f.repository, profile: f.profile, flags: f.flags };
  const reader = new GiftService({ giftsRepo: { all: () => [] }, repliesRepo: {}, media: {}, config: f.config, repliesLimit: { consume: () => true }, canvas });
  const view = await reader.publicGift(result.gift.slug); assert.deepEqual(view.documentSnapshot, result.gift.documentSnapshot);
  const metadata = await f.repository.getAsset(user.sub, asset.id); assert.equal(fs.existsSync(f.service.assetPath(metadata)), true); assert.deepEqual(result.gift.assetIds, [asset.id]);
});

test('archived draft cannot be published as a fresh intent', async t => {
  const f = fixture(t), d = await complete(f); await f.repository.archive(user.sub, d.id);
  await assert.rejects(f.service.publish(user, publicationInput(d)), status(404));
});

test('checkout context retry after a newer draft preserves its original context and immutable saved revision', async t => {
  const f = fixture(t), a = await complete(f, { kind: 'template', templateId: 'midnight-bloom' });
  const b = await complete(f, { kind: 'template', templateId: 'midnight-bloom' }), orderId = randomUUID();
  f.service.orders = async () => [{ id: orderId, templateId: 'midnight-bloom' }];
  const input = { designId: a.id, expectedRevision: a.revision, expectedDocumentHash: a.documentHash, mutationId: randomUUID() };
  const first = await f.service.attachContext(user, orderId, input);
  const second = await f.service.attachContext(user, orderId, { designId: b.id, expectedRevision: b.revision, expectedDocumentHash: b.documentHash, mutationId: randomUUID() });
  assert.notEqual(first.contextId, second.contextId); assert.equal((await f.service.contexts(user, orderId)).length, 2);
  await f.service.save(user, a.id, saveInput(a, 'Bản mới ở tab khác'));
  const replay = await f.service.attachContext(user, orderId, input);
  assert.equal(replay.contextId, first.contextId); assert.equal(replay.designRevision, a.revision); assert.equal(replay.replayed, true);
  const resumed = await f.service.context(user, orderId, first.contextId); assert.equal(resumed.changed, true); assert.equal(resumed.designId, a.id);
});
