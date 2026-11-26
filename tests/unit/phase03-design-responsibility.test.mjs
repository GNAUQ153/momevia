import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DesignsService, hash, designView, designSummary, giftSummary, publicGiftView } from '../../src/modules/designs/designs.service.mjs';
import { hash as documentHash } from '../../src/modules/designs/document-hash.mjs';
import * as views from '../../src/modules/designs/design-views.mjs';
import { createDocument, createElement } from '../../web/js/shared/canvas/index.js';
import { createOpenMeTemplate } from '../../web/js/shared/canvas/open-me-templates.js';

const user = { sub: randomUUID(), role: 'sender' };
function design({ price = 59000 } = {}) {
  const document = createDocument({ presetId: 'envelope-basic' });
  for (const binding of Object.values(document.bindings)) binding.value = 'QA';
  return { id: randomUUID(), ownerId: user.sub, title: 'QA', source: { kind: 'template', templateId: 'qa-template' },
    provenance: { adapter: 'legacy-v1' }, policy: { kind: 'sender-basic', lockedElements: {} }, revision: 1,
    document, documentHash: hash(document), templatePrice: price };
}
function service(record, extra = {}) {
  return new DesignsService({ repository: { get: async () => record },
    catalog: { getTemplate: async () => ({ id: record.source.templateId, title: 'QA', price: record.templatePrice, status: 'published' }) },
    checkout: { hasLicense: async () => true }, config: { giftTtlDays: 365 },
    profile: { supported: true, mode: 'mysql', checkoutMode: 'mysql' }, flags: { edit: true, publish: true }, ...extra });
}
const request = record => ({ designId: record.id, expectedRevision: record.revision, expectedDocumentHash: record.documentHash, idempotencyKey: randomUUID() });

test('giữ nguyên các export cũ và fingerprint canonical', () => {
  assert.equal(hash, documentHash);
  assert.equal(hash({ b: 2, a: 1 }), hash({ a: 1, b: 2 }));
  for (const [name, fn] of Object.entries({ designView, designSummary, giftSummary, publicGiftView })) assert.equal(fn, views[name]);
});

test('projection không sửa bản ghi và không xuất metadata riêng tư của thiệp', () => {
  const record = design();
  const snapshot = structuredClone(record);
  const view = designView(record);
  view.document.bindings.senderName.value = 'changed';
  view.policy.kind = 'changed';
  assert.deepEqual(record, snapshot);
  const gift = { id: randomUUID(), slug: 'qa', title: 'QA', expiresAt: '2100-01-01', documentSnapshot: record.document,
    inviteToken: 'secret', senderArchivedAt: '2026-01-01', userId: user.sub, runtimeVersion: 1 };
  const before = structuredClone(gift);
  const publicView = publicGiftView(gift);
  for (const key of ['inviteToken', 'senderArchivedAt', 'userId']) assert.equal(Object.hasOwn(publicView, key), false);
  assert.deepEqual(gift, before);
});

test('existing invitation drafts keep editable event slots across projection and save policy', () => {
  for (const templateId of ['club-22-invitation', 'cozy-christmas-invitation']) {
    const record = design();
    record.source.templateId = templateId;
    record.document = createOpenMeTemplate(templateId);
    const before = structuredClone(record);
    const view = designView(record);
    assert.deepEqual(view.invitationSlotIds, {
      dateElementId: record.document.invitation.dateElementId,
      venueElementId: record.document.invitation.venueElementId,
    });
    const editor = service(record);
    assert.doesNotThrow(() => editor.enforcePolicy(record, view.document));
    view.document.invitation.venueElementId = 'unapproved-slot';
    assert.throws(() => editor.enforcePolicy(record, view.document), { code: 'INVITATION_SOURCE_UNSUPPORTED' });
    assert.deepEqual(record, before);
  }
});

test('khóa chỉnh sửa được kiểm tra trên revision trong callback repository.save', async () => {
  const record = design();
  const element = record.document.elements[0];
  const locked = structuredClone(record);
  locked.policy.lockedElements[element.id] = { editableProps: [] };
  const next = structuredClone(record.document);
  next.elements[0].opacity = 0;
  let checked = false;
  const repository = { get: async () => record, save: async (owner, id, input, verify) => {
    assert.equal(owner, user.sub); assert.equal(id, record.id);
    assert.equal(input.documentHash, hash(input.document));
    checked = true; verify(locked);
    assert.fail('Không được lưu khi chính sách khóa thay đổi trong transaction');
  } };
  await assert.rejects(service(record, { repository }).save(user, record.id, { expectedRevision: 1, mutationId: randomUUID(), title: record.title, document: next }), { code: 'LOCKED_ELEMENT', status: 403 });
  assert.equal(checked, true);
});

test('preflight và publish dùng quyền tại transaction, không dùng kết quả preflight cũ', async () => {
  const record = design();
  let calls = 0;
  const publication = { publish: async (owner, input, fingerprint, build) => {
    assert.equal(owner, user.sub); assert.equal(fingerprint, hash(input));
    await build({ design: record, getTemplate: async () => ({ id: record.source.templateId, price: 59000, status: 'published' }),
      hasLicense: async (ownerId, templateId) => { calls++; assert.equal(ownerId, user.sub); assert.equal(templateId, record.source.templateId); return false; } });
    assert.fail('Không được xuất bản khi quyền đã mất');
  } };
  const s = service(record, { publication });
  assert.equal((await s.check(record)).canPublish, true);
  await assert.rejects(s.publish(user, request(record)), { code: 'PUBLISH_BLOCKED', status: 402 });
  assert.equal(calls, 1);
});

test('preflight giữ lỗi fail-closed khi provider quyền không khả dụng', async () => {
  const record = design();
  await assert.rejects(service(record).check(record, { hasLicense: async () => { throw Object.assign(new Error('offline'), { code: 'QA_OFFLINE' }); } }),
    error => error.status === 503 && error.code === 'AUTHORIZATION_UNAVAILABLE' && error.authorization.reasonCodes[0] === 'QA_OFFLINE');
});

test('preflight kiểm tra tài sản từ callback được truyền và chặn tài sản khác chủ', async () => {
  const record = design({ price: 0 });
  const assetId = randomUUID();
  const photo = createElement('image', { id: 'qa-photo', props: { assetId } });
  record.document.assets.push({ kind: 'image', assetId });
  record.document.elements.push(photo);
  record.document.scenes[0].elementIds.push(photo.id);
  let count = 0;
  const s = service(record);
  s.assetExists = () => { assert.fail('Không đọc file khi tài sản không thuộc chủ'); };
  const result = await s.check(record, { getAsset: async id => { count++; assert.equal(id, assetId); return { ownerId: randomUUID(), status: 'ready' }; } });
  assert.equal(count, 1);
  assert.equal(result.canPublish, false);
  assert(result.blockers.some(item => item.code === 'ASSET_NOT_READY' && item.path === `assets.${assetId}`));
});
