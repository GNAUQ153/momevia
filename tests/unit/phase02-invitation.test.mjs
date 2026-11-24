import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument } from '../../web/js/shared/canvas/index.js';
import { validateDocument, duplicateDocument, publicDocument } from '../../web/js/shared/canvas/schema.js';
import { cleanGiftLayout } from '../../web/js/shared/canvas/clean-layout.js';
import { editInvitation, invitationSlots, publicInvitation, invitationTimingIssue } from '../../web/js/shared/canvas/invitation.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { JsonDesignRepository } from '../../src/modules/designs/json.repository.mjs';
import { templates } from '../../src/modules/catalog/seed.mjs';
import { publicGiftView, DesignsService } from '../../src/modules/designs/designs.service.mjs';
import { serverText } from '../../src/shared/locale.mjs';
import { animatedElementCards } from '../../web/js/shared/canvas/animated-elements.js';

function draft(locale = 'vi') {
  const doc = createDocument({ template: { id: 'loi-moi-ben-hien' }, localize: (key, params) => serverText(locale, key, params) });
  for (const b of Object.values(doc.bindings)) b.value = 'QA';
  return doc;
}
function complete(locale) {
  const doc = draft(locale);
  editInvitation(doc, 'enabled', true);
  editInvitation(doc, 'date', '2030-01-15T18:30');
  editInvitation(doc, 'venue', 'Phòng A, TP.HCM');
  return doc;
}
const publish = doc => validateDocument(doc, { mode: 'publish' });
const invalid = (doc, issue) => assert.throws(() => publish(doc), { code: 'INVALID_INVITATION', message: `invitation.error.${issue}` });

test('lời mời Canvas v4 giữ nguyên assembly và motion qua snapshot công khai, nhân bản và public gift', () => {
  const doc = complete();
  doc.schemaVersion = doc.registryVersion = 4;
  doc.personalization = { version: 1, mode: 'manual' };
  const [animated] = animatedElementCards(0)[0].create();
  doc.elements.push(animated);
  doc.scenes.find(scene => scene.id === doc.entrySceneId).elementIds.push(animated.id);
  const snapshot = publicDocument(doc);
  assert.deepEqual(snapshot.invitation, doc.invitation);
  const view = publicGiftView({ documentSnapshot: snapshot, runtimeVersion: 4, expiresAt: '2030-02-01' });
  for (const result of [snapshot, duplicateDocument(snapshot), view.documentSnapshot]) {
    const element = result.elements.find(item => item.assembly);
    assert.deepEqual(element.assembly, animated.assembly);
    assert.deepEqual(element.motions, animated.motions);
    assert.doesNotThrow(() => publish(result));
  }
});

test('thiệp cũ và mẫu Greeting không bị thêm trường hoặc thay đổi contract', () => {
  for (const locale of ['vi','en']) {
    const doc = draft(locale);
    assert.equal(Object.hasOwn(publish(doc), 'invitation'), false);
    assert.equal(Object.hasOwn(publicDocument(doc), 'invitation'), false);
  }
  const doc = createDocument({ template: { id: 'birthday-radiance' } });
  assert.equal(invitationSlots(doc), null);
  assert.throws(() => editInvitation(doc, 'enabled', true), /INVITATION_SLOT_REQUIRED/);
});

test('cho lưu nháp chưa hoàn tất nhưng chặn xuất bản nếu thiếu ngày hoặc địa điểm ở cả VI và EN', () => {
  for (const locale of ['vi','en']) {
    const doc = draft(locale);
    const before = structuredClone(doc);
    editInvitation(doc, 'enabled', true);
    assert.deepEqual(doc.elements, before.elements);
    assert.doesNotThrow(() => validateDocument(doc));
    invalid(doc, 'date');
    editInvitation(doc, 'date', '2030-01-15T18:30');
    invalid(doc, 'venue');
    editInvitation(doc, 'venue', '   ');
    invalid(doc, 'venue');
    editInvitation(doc, 'venue', 'A'.repeat(301));
    invalid(doc, 'venue');
    editInvitation(doc, 'venue', 'Hội trường A');
    assert.doesNotThrow(() => publish(doc));
  }
});

test('ngày giờ UTC, chuyển múi giờ không đổi thời điểm và đồng bộ nội dung Canvas', () => {
  const doc = complete();
  assert.deepEqual(publicInvitation(doc), { eventAt: '2030-01-15T11:30:00.000Z', timeZone: 'Asia/Ho_Chi_Minh', venue: 'Phòng A, TP.HCM' });
  assert.equal(invitationSlots(doc).date.props.text, '2030-01-15 18:30 (Asia/Ho_Chi_Minh)');
  editInvitation(doc, 'zone', 'UTC');
  assert.equal(doc.invitation.eventAt, '2030-01-15T11:30:00.000Z');
  assert.equal(invitationSlots(doc).date.props.text, '2030-01-15 11:30 (UTC)');
  editInvitation(doc, 'zone', 'America/New_York');
  assert.throws(() => editInvitation(doc, 'date', '2030-03-10T02:30'));
  assert.throws(() => editInvitation(doc, 'date', '2030-02-30T12:00'));
  assert.doesNotThrow(() => publish(doc));
});

test('kiểm tra trường lạ, múi giờ, ngày sai, tham chiếu và nội dung ngày bị sửa tay', () => {
  const original = complete();
  for (const [mutate, issue] of [
    [d => { d.invitation.private = 'PII'; }, 'structure'],
    [d => { d.invitation.eventAt = '2030-02-30T11:30:00.000Z'; }, 'date'],
    [d => { d.invitation.timeZone = 'Bad/Zone'; }, 'zone'],
    [d => { d.invitation.venueElementId = d.invitation.dateElementId; }, 'slots'],
    [d => { d.invitation.dateElementId = 'missing'; }, 'slots'],
    [d => { invitationSlots(d).venue.visible = false; }, 'slots'],
    [d => { invitationSlots(d).date.props.text = 'Another date'; }, 'dateMismatch'],
  ]) { const doc = structuredClone(original); mutate(doc); invalid(doc, issue); }
});

test('nhân bản remap vùng nội dung; tặng lại xóa dữ liệu sự kiện cá nhân', () => {
  const doc = complete();
  let i = 0;
  const duplicate = duplicateDocument(doc, { idFactory: () => `copy-${++i}` });
  assert.notEqual(duplicate.invitation.dateElementId, doc.invitation.dateElementId);
  assert.deepEqual(publicInvitation(duplicate), publicInvitation(doc));
  assert.doesNotThrow(() => publish(duplicate));
  const clean = cleanGiftLayout(publicDocument(doc));
  assert.equal(Object.hasOwn(clean, 'invitation'), false);
  assert(!clean.elements.some(e => e.props.text?.includes('Phòng A')));
  assert.deepEqual(publicInvitation(doc), publicInvitation(duplicate));
  editInvitation(doc, 'enabled', false);
  assert.equal(Object.hasOwn(doc, 'invitation'), false);
  assert.equal(invitationSlots(doc).venue.props.text, 'Phòng A, TP.HCM');
});

test('snapshot lưu thông tin sự kiện, public API chỉ chiếu trường cho phép và Canvas cũ vẫn đọc được', () => {
  const doc = complete();
  const snapshot = publicDocument(doc);
  assert.deepEqual(snapshot.invitation, doc.invitation);
  const view = publicGiftView({ documentSnapshot: snapshot, runtimeVersion: doc.schemaVersion, expiresAt: '2030-02-01' });
  assert.deepEqual(view.invitation, publicInvitation(doc));
  assert.equal(Object.hasOwn(view.documentSnapshot, 'invitation'), false);
  assert.doesNotThrow(() => publish(view.documentSnapshot));
  assert.equal(Object.hasOwn(publicGiftView({ documentSnapshot: publicDocument(draft()), expiresAt: '2030-02-01' }), 'invitation'), false);
});

test('kiểm tra thời hạn lúc xuất bản, không dùng đồng hồ hiện tại khi đọc snapshot', () => {
  const doc = complete(), time = Date.parse(doc.invitation.eventAt);
  assert.equal(invitationTimingIssue(doc, time - 60000, time + 60000), null);
  assert.equal(invitationTimingIssue(doc, time, time + 60000), 'past');
  assert.equal(invitationTimingIssue(doc, time - 60000, time), 'expiry');
  assert.equal(invitationTimingIssue(draft(), time, time), null);
  assert.doesNotThrow(() => publish(doc));
});

test('không đưa dữ liệu sự kiện riêng vào nháp mẫu Creator', () => {
  const service = new DesignsService({});
  assert.throws(() => service.enforcePolicy({ provenance: { purpose: 'creator' } }, complete()), { code: 'INVITATION_CREATOR_DRAFT' });
});


test('lưu nháp và xuất bản qua service/JSON: chặn ngày hết hạn, giữ snapshot và idempotency', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'momevia-invitation-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const user = { sub: randomUUID(), role: 'sender' };
  const repository = new JsonDesignRepository(path.join(root, 'canvas.json'));
  const service = new DesignsService({ repository, publication: repository,
    catalog: { getTemplate: async id => structuredClone(templates.find(row => row.id === id)) },
    checkout: { hasLicense: async () => true }, config: { giftTtlDays: 30 },
    flags: { edit: true, publish: true }, profile: { supported: true, mode: 'json' }, mediaRoot: path.join(root, 'assets') });
  const { design } = await service.create(user, { source: { kind: 'template', templateId: 'loi-moi-ben-hien' }, mutationId: randomUUID() });
  const doc = structuredClone(design.document);
  for (const b of Object.values(doc.bindings)) b.value = 'QA';
  editInvitation(doc, 'enabled', true, design.invitationSlotIds);
  const now = Date.now();
  const future = days => new Date(now + days * 86400000).toISOString().slice(0, 16);
  editInvitation(doc, 'zone', 'UTC');
  editInvitation(doc, 'date', future(31));
  editInvitation(doc, 'venue', 'Hội trường A');
  await service.save(user, design.id, { expectedRevision: 1, mutationId: randomUUID(), title: design.title, document: doc });
  const first = await service.get(user, design.id);
  const blocked = await service.check(first);
  assert(blocked.blockers.some(b => b.messageKey === 'invitation.error.expiry'));
  await assert.rejects(service.publish(user, { designId: first.id, expectedRevision: first.revision, expectedDocumentHash: first.documentHash, idempotencyKey: randomUUID() }), { code: 'PUBLISH_BLOCKED' });
  editInvitation(doc, 'date', future(2));
  await service.save(user, design.id, { expectedRevision: 2, mutationId: randomUUID(), title: design.title, document: doc });
  const second = await service.get(user, design.id);
  assert.equal((await service.check(second)).canPublish, true);
  const request = { designId: second.id, expectedRevision: second.revision, expectedDocumentHash: second.documentHash, idempotencyKey: randomUUID() };
  const result = await service.publish(user, request);
  assert.equal((await service.publish(user, request)).gift.id, result.gift.id);
  assert.deepEqual(publicGiftView(await repository.findBySlug(result.gift.slug)).invitation, publicInvitation(doc));
  const duplicate = (await service.duplicate(user, design.id, { mutationId: randomUUID() })).design;
  assert.notEqual(duplicate.invitationSlotIds.dateElementId, design.invitationSlotIds.dateElementId);
  const copied = structuredClone(duplicate.document);
  editInvitation(copied, 'enabled', false, duplicate.invitationSlotIds);
  editInvitation(copied, 'enabled', true, duplicate.invitationSlotIds);
  assert.equal(copied.invitation.dateElementId, duplicate.invitationSlotIds.dateElementId);
  assert.equal(copied.invitation.eventAt, null);
  await service.save(user, duplicate.id, { expectedRevision: 1, mutationId: randomUUID(), title: duplicate.title, document: copied });
  editInvitation(doc, 'venue', 'Địa điểm khác');
  await service.save(user, design.id, { expectedRevision: 3, mutationId: randomUUID(), title: design.title, document: doc });
  assert.equal(publicGiftView(await repository.findBySlug(result.gift.slug)).invitation.venue, 'Hội trường A');
});
