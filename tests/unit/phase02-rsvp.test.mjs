import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createDocument } from '../../web/js/shared/canvas/index.js';
import { editInvitation } from '../../web/js/shared/canvas/invitation.js';
import { rsvpCounts } from '../../web/js/shared/rsvp.js';
import { supportsRsvp, rsvpRecord, rsvpView, updateRsvp } from '../../src/modules/gifts/rsvp.mjs';
import { publicGiftView, DesignsService } from '../../src/modules/designs/designs.service.mjs';
import { JsonDesignRepository } from '../../src/modules/designs/json.repository.mjs';
import { templates } from '../../src/modules/catalog/seed.mjs';

const tokenA = 'a'.repeat(43), tokenB = 'b'.repeat(43), inviteToken = 'c'.repeat(43);
const now = Date.now();
const eventAt = new Date(now + 2 * 86400000).toISOString().slice(0, 16);
const noLimit = () => {};
function fixture(mode = 'list') {
  const documentSnapshot = createDocument({ template: { id: 'loi-moi-ben-hien' } });
  for (const binding of Object.values(documentSnapshot.bindings)) binding.value = 'QA';
  editInvitation(documentSnapshot, 'enabled', true);
  editInvitation(documentSnapshot, 'zone', 'UTC');
  editInvitation(documentSnapshot, 'date', eventAt);
  editInvitation(documentSnapshot, 'venue', 'Hội trường A');
  return { id: 'gift-id', slug: 'qa-gift-slug-123456789', userId: 'owner', recipientMode: mode,
    recipientName: 'QA', senderName: 'QA', message: 'QA', documentSnapshot,
    createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 4 * 86400000).toISOString(),
    access: { open: 'link', send: 'link', read: 'sender' }, recipients: [
      { id: 'a', token: tokenA, name: 'Lan', source: mode },
      { id: 'b', token: tokenB, name: 'Lan', source: mode },
    ] };
}
const update = (gift, token, status, time = now) => updateRsvp(gift, null, token, { status }, noLimit, time);

test('RSVP chỉ hỗ trợ thiệp sự kiện có lượt nhận riêng; không tự phân loại thiệp cũ', () => {
  const gift = fixture();
  assert(supportsRsvp(gift));
  assert(supportsRsvp(fixture('self')));
  assert(!supportsRsvp(fixture('manual')));
  delete gift.documentSnapshot.invitation;
  assert(!supportsRsvp(gift));
  assert.throws(() => update(gift, tokenA, 'attending'), { status: 422 });
  assert.equal(rsvpView(gift, gift.recipients[0], true), undefined);
  assert.equal(rsvpView(fixture(), null, true), undefined);
});

test('RSVP một trạng thái mỗi lượt nhận, hai người trùng tên vẫn độc lập', () => {
  const gift = fixture();
  assert.deepEqual(rsvpRecord(gift.recipients[0]), { status: null, updatedAt: null });
  const first = update(gift, tokenA, 'attending');
  assert.equal(first.status, 'attending');
  update(gift, tokenB, 'tentative');
  const changed = update(gift, tokenA, 'declined', now + 1000);
  assert.equal(changed.status, 'declined');
  assert.equal(changed.updatedAt, new Date(now + 1000).toISOString());
  assert.equal(gift.recipients[1].rsvp.status, 'tentative');
  assert.deepEqual(rsvpCounts(gift.recipients), { attending: 0, declined: 1, tentative: 1, unanswered: 0 });
});

test('RSVP retry không tính thêm quota, không đổi thời điểm; quota từ chối không ghi dữ liệu', () => {
  const gift = fixture(); let uses = 0;
  const accept = () => { uses++; };
  const first = updateRsvp(gift, null, tokenA, { status: 'attending' }, accept, now);
  assert.deepEqual(updateRsvp(gift, null, tokenA, { status: 'attending' }, accept, now + 1000), first);
  assert.equal(uses, 1);
  assert.throws(() => updateRsvp(gift, null, tokenA, { status: 'declined' }, () => { throw new Error('quota'); }, now + 2000), /quota/);
  assert.equal(gift.recipients[0].rsvp.status, 'attending');
});

test('RSVP từ chối token thiếu/sai, giả mạo người nhận, lựa chọn không hợp lệ', () => {
  const gift = fixture();
  for (const token of [null, '', 'z'.repeat(43)]) assert.throws(() => update(gift, token, 'attending'), { status: 403 });
  for (const body of [{}, { status: 'yes' }, { status: 'attending', recipientId: 'b' }, { status: null }])
    assert.throws(() => updateRsvp(gift, null, tokenA, body, noLimit, now), { status: 422 });
  assert(gift.recipients.every(receipt => !receipt.rsvp));
});

test('RSVP tôn trọng quyền mở/gửi, thu hồi, hết hạn và giờ bắt đầu sự kiện', () => {
  const gift = fixture();
  gift.access = { open: 'invite', send: 'invite', read: 'sender' }; gift.inviteToken = inviteToken;
  assert.throws(() => update(gift, tokenA, 'attending'), { status: 403 });
  assert.equal(updateRsvp(gift, inviteToken, tokenA, { status: 'attending' }, noLimit, now).status, 'attending');
  gift.access.send = 'disabled';
  assert.throws(() => updateRsvp(gift, inviteToken, tokenA, { status: 'declined' }, noLimit, now), { status: 403 });
  assert.equal(rsvpView(gift, gift.recipients[0], false, now).canRespond, false);
  gift.access = { open: 'link', send: 'link', read: 'sender' };
  const cutoff = Date.parse(gift.documentSnapshot.invitation.eventAt);
  assert.equal(rsvpView(gift, gift.recipients[0], true, cutoff).canRespond, false);
  assert.throws(() => update(gift, tokenA, 'declined', cutoff), { status: 409 });
  gift.revokedAt = new Date(now).toISOString();
  assert.throws(() => update(gift, tokenA, 'declined'), { status: 410 });
  delete gift.revokedAt;
  gift.expiresAt = '2000-01-01T00:00:00.000Z';
  assert.throws(() => update(gift, tokenA, 'declined'), { status: 410 });
});

test('RSVP chỉ chiếu trạng thái cá nhân, không đưa danh sách hay token vào public snapshot', () => {
  const gift = fixture(); update(gift, tokenB, 'attending');
  assert.deepEqual(rsvpView(gift, gift.recipients[0], true, now), { status: null, updatedAt: null, canRespond: true });
  const publicGift = publicGiftView(gift);
  assert(!Object.hasOwn(publicGift, 'recipients'));
  assert(!Object.hasOwn(publicGift, 'rsvp'));
  assert(!JSON.stringify(publicGift).includes(tokenB));
  assert.deepEqual(rsvpCounts([{rsvp:{status:'tentative'}},{rsvp:{status:null}},{}]), { attending: 0, declined: 0, tentative: 1, unanswered: 2 });
});

test('RSVP lưu trên snapshot JSON thật, ghi đồng thời không mất lượt nhận và giữ qua mở lại kho', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'momevia-rsvp-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const filename = path.join(root, 'canvas.json');
  const repository = new JsonDesignRepository(filename);
  const owner = { sub: randomUUID(), role: 'sender' };
  const service = new DesignsService({ repository, publication: repository,
    catalog: { getTemplate: async id => structuredClone(templates.find(row => row.id === id)) },
    checkout: { hasLicense: async () => true }, config: { giftTtlDays: 30 },
    flags: { edit: true, publish: true }, profile: { supported: true, mode: 'json' }, mediaRoot: path.join(root, 'assets') });
  const { design } = await service.create(owner, { source: { kind: 'template', templateId: 'loi-moi-ben-hien' }, mutationId: randomUUID() });
  const doc = structuredClone(design.document);
  for (const binding of Object.values(doc.bindings)) binding.value = 'QA';
  doc.personalization = { version: 1, mode: 'list', names: [{row:2,name:'Lan'}, {row:3,name:'Lan'}] };
  editInvitation(doc, 'enabled', true, design.invitationSlotIds);
  editInvitation(doc, 'zone', 'UTC'); editInvitation(doc, 'date', eventAt); editInvitation(doc, 'venue', 'Hội trường A');
  await service.save(owner, design.id, { expectedRevision: design.revision, mutationId: randomUUID(), title: design.title, document: doc });
  const saved = await service.get(owner, design.id);
  const preflight = await service.check(saved);
  assert.equal(preflight.canPublish, true, JSON.stringify(preflight.blockers));
  const { gift } = await service.publish(owner, { designId: saved.id, expectedRevision: saved.revision, expectedDocumentHash: saved.documentHash, idempotencyKey: randomUUID() });
  const initial = await repository.findBySlug(gift.slug);
  const [a,b] = initial.recipients;
  await Promise.all([repository.mutateGift(gift.id, g => update(g,a.token,'attending')), repository.mutateGift(gift.id,g=>update(g,b.token,'declined'))]);
  const reopened = await new JsonDesignRepository(filename).findBySlug(gift.slug);
  assert.deepEqual(rsvpCounts(reopened.recipients), { attending: 1, declined: 1, tentative: 0, unanswered: 0 });
  assert.deepEqual(reopened.documentSnapshot, initial.documentSnapshot);
  assert.equal(reopened.replyCount, initial.replyCount);
  assert.equal(reopened.recipients[0].token, a.token);
});
