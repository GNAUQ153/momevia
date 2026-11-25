import { publicDocument } from '../../../web/js/shared/canvas/index.js';
import { publicInvitation, invitationSlots } from '../../../web/js/shared/canvas/invitation.js';
import { clearTemplateBindingDefaults } from '../../../web/js/shared/canvas/personalization.js';
import { giftStatus } from '../gifts/access.mjs';

const copy = value => structuredClone(value);

// Vai trò vùng nội dung của mẫu được giữ khi nhân bản và đổi ID Canvas.
export function invitationSlotIds(d) {
  if (d.source?.templateId !== 'loi-moi-ben-hien' || d.policy?.kind !== 'sender-basic') return undefined;
  const mapped = d.provenance?.slotMap?.elements;
  const slots = invitationSlots(d.document, { dateElementId: mapped?.['event-date'], venueElementId: mapped?.['event-location'] });
  return slots ? { dateElementId: slots.date.id, venueElementId: slots.venue.id } : undefined;
}
export function designView(d) {
  const document = copy(d.document);
  const reviewTemplateDefaults = d.source.kind === 'template' && d.source.templateVersionId && d.provenance?.adapter === 'creator-v1'
    && d.policy?.kind === 'creator-template' && clearTemplateBindingDefaults(document, d.policy.editableBindings);
  const slots = invitationSlotIds(d);
  return { ...(slots ? { invitationSlotIds: slots } : {}), ...(d.provenance?.restyledFrom ? {restyledFrom:copy(d.provenance.restyledFrom)} : {}), id: d.id, title: d.title, source: copy(d.source), policy: copy(d.policy), purpose: d.provenance?.purpose, revision: d.revision, schemaVersion: document.schemaVersion, document, documentHash: d.documentHash,
    ...(reviewTemplateDefaults ? { reviewTemplateDefaults } : {}),
    ...(d.provenance?.startingLocale ? { startingLocale: d.provenance.startingLocale } : {}),
    createdAt: d.createdAt, updatedAt: d.updatedAt };
}
export const designSummary = d => ({ id: d.id, title: d.title, revision: d.revision, sourceKind: d.source.kind, updatedAt: d.updatedAt, createdAt: d.createdAt });
export function giftSummary(gift) {
  return { id: gift.id, slug: gift.slug, title: gift.title || gift.templateTitle, templateId: gift.templateId, templateTitle: gift.title || gift.templateTitle,
    theme: gift.theme, recipientMode: gift.recipientMode || 'manual', recipientCount: gift.recipients?.length || 0, recipientName: gift.recipientName, senderName: gift.senderName, replyCount: gift.replyCount,
    createdAt: gift.createdAt, expiresAt: gift.expiresAt, status: giftStatus(gift) };
}
export function publicGiftView(gift) {
  const base = { ...giftSummary(gift), message: gift.message, photoUrl: gift.imageFile ? `/api/gifts/gifts/${gift.slug}/photo` : null };
  if (gift.documentSnapshot) {
    base.runtimeVersion = gift.runtimeVersion; base.schemaVersion = gift.documentSnapshot.schemaVersion;
    base.documentSnapshot = publicDocument(gift.documentSnapshot);
    // Reader cũ vẫn đọc được Canvas: dữ liệu sự kiện có contract riêng ở API.
    const invitation = publicInvitation(base.documentSnapshot);
    if (invitation) base.invitation = invitation;
    delete base.documentSnapshot.invitation;
  }
  return base;
}
