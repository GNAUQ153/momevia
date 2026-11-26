import { requireNamingEnabled } from '../gifts/recipients.mjs';
import { validateDocument, assetIds } from '../../../web/js/shared/canvas/index.js';
import { PREDICTION_KIND } from '../../../web/js/shared/canvas/prediction.js';
import { invitationTimingIssue } from '../../../web/js/shared/canvas/invitation.js';
import { lockedVisibleNames, visibleBindingKeys } from '../../../web/js/shared/canvas/personalization.js';
import { canvasError } from './errors.mjs';
import { serverText } from '../../shared/locale.mjs';
import { designView } from './design-views.mjs';
import { hash } from './document-hash.mjs';

const preflightCopy = (path, code, messageKey, messageParams) => ({
  path, code, message: serverText('vi', messageKey, messageParams), messageKey, messageParams,
});

// Callback đọc dữ liệu có thể đến từ transaction xuất bản, không tự mở repository mới.
export async function checkPublication(design, { getAsset, hasLicense, getTemplate, assetExists, config, profile }) {
  if (design.provenance?.purpose === 'creator') throw canvasError(403, 'CREATOR_DRAFT', 'Gửi bản mẫu qua Creator Studio để Admin duyệt.');
  const blockers = []; let authorization = { status: 'allowed', reasonCodes: [] }; let template = null;
  const { document, reviewTemplateDefaults } = designView(design);
  const editable = design.policy?.kind === 'creator-template' ? design.policy.editableBindings : null;
  if (document.personalization?.mode !== 'manual' && document.personalization) {
    try { requireNamingEnabled(document.personalization, design.ownerId); } catch { blockers.push(preflightCopy('personalization', 'RECIPIENT_DISABLED', 'recipient.error.disabled')); }
    if (editable && !editable.includes('recipientName')) blockers.push(preflightCopy('personalization', 'RECIPIENT_LOCKED', 'recipient.locked'));
    if (document.personalization.mode === 'list' && !document.personalization.names?.length) blockers.push(preflightCopy('personalization.names', 'RECIPIENT_LIST_REQUIRED', 'recipient.error.list'));
  }
  if (reviewTemplateDefaults) blockers.push(preflightCopy('document.bindings', 'REVIEW_TEMPLATE_DEFAULTS', 'editor.preflight.reviewDefaults'));
  try { validateDocument(document, { mode: 'publish', requiredBindings: [] }); }
  catch (error) {
    for (const detail of error.details || [{ path: 'document', code: 'INVALID_DOCUMENT', message: error.message }]) {
      const index = /^elements\.(\d+)\.props\.(\w+)$/.exec(detail.path || '');
      if (index && document.elements[Number(index[1])]?.props.kind === PREDICTION_KIND &&
        (index[2] === 'prediction' || ['PREDICTION_CONTENT_REQUIRED', 'PREDICTION_DUPLICATE_CHOICES'].includes(detail.code))) {
        const field = index[2];
        blockers.push(preflightCopy(detail.path, detail.code, detail.code === 'PREDICTION_DUPLICATE_CHOICES' ? 'prediction.duplicate'
          : field === 'prediction' ? 'prediction.chooseRequired' : 'prediction.required',
        { field: { format: 'message', key: `prediction.${field}` } }));
      } else if (detail.code === 'INVALID_INVITATION') {
        blockers.push(preflightCopy(detail.path, detail.code, detail.message));
      } else blockers.push(detail);
    }
  }
  if (document.invitation) {
    const now = Date.now();
    const eventIssue = invitationTimingIssue(document, now, now + config.giftTtlDays * 86400000);
    if (eventIssue) blockers.push(preflightCopy('invitation', 'INVITATION_TIME', `invitation.error.${eventIssue}`));
  }
  // Chỉ áp dụng cho lượt xuất bản mới; snapshot cũ dùng validation của reader.
  const { bindings, elements } = document;
  const hasContent = elements.some(element => {
    if (element.visible === false || element.opacity === 0) return false;
    if (element.type === 'text') {
      const text = element.props.textBinding ? bindings[element.props.textBinding]?.value : element.props.text;
      return Boolean(text?.trim());
    }
    return element.type !== 'image' || Boolean(element.props.assetId || element.props.caption?.trim());
  });
  if (!hasContent) blockers.push(preflightCopy('document.elements', 'EMPTY_DESIGN', 'editor.preflight.empty'));
  if (design.source.kind === 'template') {
    try {
      template = design.provenance?.adapter === 'creator-v1'
        ? { id: design.source.templateId, title: design.title, price: design.provenance.price, status: 'published' }
        : await getTemplate(design.source.templateId);
      if (template?.price > 0 && profile.mode && profile.checkoutMode && profile.mode !== profile.checkoutMode) throw canvasError(503, 'CHECKOUT_PROFILE_UNSUPPORTED', 'Quyền mẫu trả phí cần Checkout cùng profile dữ liệu.');
      if (!template || template.status === 'rejected') authorization = { status: 'denied', reasonCodes: ['TEMPLATE_UNAVAILABLE'] };
      else if (template.price > 0 && !await hasLicense(design.ownerId, design.source.templateId)) authorization = { status: 'needs_template_license', reasonCodes: ['TEMPLATE_LICENSE_REQUIRED'] };
    } catch (error) {
      if (error.status === 404) authorization = { status: 'denied', reasonCodes: ['TEMPLATE_UNAVAILABLE'] };
      else throw Object.assign(canvasError(503, 'AUTHORIZATION_UNAVAILABLE', 'Không kiểm tra được quyền mẫu. Thử lại sau.', [{ path: 'authorization', status: 'unavailable' }]), { authorization: { status: 'unavailable', reasonCodes: [error.code || 'AUTHORIZATION_UNAVAILABLE'] } });
    }
  }
  for (const id of assetIds(design.document)) {
    const a = await getAsset(id);
    if (!a || a.ownerId !== design.ownerId || a.status !== 'ready' || !assetExists(a))
      blockers.push(preflightCopy(`assets.${id}`, 'ASSET_NOT_READY', 'editor.preflight.asset'));
  }
  if (authorization.status !== 'allowed') blockers.push(preflightCopy('source', authorization.reasonCodes[0], 'editor.preflight.permission'));
  const values = design.document.bindings;
  const predictionStory = elements.some(e => e.type === 'interaction' && e.props.kind === PREDICTION_KIND && e.visible !== false && e.opacity !== 0);
  const visibleBindings = visibleBindingKeys(document);
  for (const [key, max] of [['recipientName', 60], ['senderName', 60], ['message', 1000]]) {
    if (key === 'recipientName' && document.personalization && document.personalization.mode !== 'manual') continue;
    if (editable && !editable.includes(key)) continue;
    // Tương tác dự đoán dùng hai kết thúc thay cho lời chúc chung không hiển thị.
    if (key === 'message' && predictionStory && !visibleBindings.has(key)) continue;
    const v = values[key]?.value;
    if (typeof v !== 'string' || !v.trim() || v.length > max)
      blockers.push(preflightCopy(`bindings.${key}`, 'BINDING_REQUIRED', 'editor.preflight.binding',
        { binding: { format: 'message', key: `catalog.personalization.${key}` }, max }));
  }
  return { designId: design.id, revision: design.revision, documentHash: hash(design.document), authorization, canPublish: authorization.status === 'allowed' && blockers.length === 0,
    blockers, warnings: editable && lockedVisibleNames(document, editable).length
      ? [preflightCopy('document.bindings', 'LOCKED_NAMES_OMITTED', 'editor.preflight.lockedNames')] : [],
    summary: { sceneCount: document.scenes.length, assetCount: assetIds(document).length }, ...(template ? { template: { id: template.id, title: template.title, price: template.price } } : {}) };
}
