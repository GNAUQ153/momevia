import { canonicalStringify, assetIds } from '../../../web/js/shared/canvas/index.js';
import { requiresCanvasV2 } from '../../../web/js/shared/canvas/schema.js';
import { clearTemplateBindingDefaults } from '../../../web/js/shared/canvas/personalization.js';
import { canvasError } from './errors.mjs';
import { invitationSlotIds } from './design-views.mjs';

const copy = value => structuredClone(value);

// Chính sách khóa mẫu được kiểm tra lại trong callback lưu của repository.
export function enforceEditPolicy(current, document) {
  if (document.invitation && current.provenance?.purpose === 'creator')
    throw canvasError(403, 'INVITATION_CREATOR_DRAFT', 'invitation.error.creator');
  if (document.invitation) {
    const slots = invitationSlotIds(current);
    if (!slots || slots.dateElementId !== document.invitation.dateElementId || slots.venueElementId !== document.invitation.venueElementId)
      throw canvasError(403, 'INVITATION_SOURCE_UNSUPPORTED', 'invitation.error.source');
  }
  if (current.policy?.kind === 'creator-template') {
    if (document.personalization?.mode !== 'manual' && document.personalization && !current.policy.editableBindings.includes('recipientName'))
      throw canvasError(403, 'RECIPIENT_LOCKED', 'Mẫu không cho phép đổi tên người nhận.');
    const normalize = input => {
      const comparable = copy(input);
      comparable.assets = [];
      delete comparable.personalization;
      // Nhạc từ danh mục được phép cá nhân hóa, không mở khóa cấu trúc mẫu.
      delete comparable.soundtrack;
      // Với mẫu Canvas V1, chỉ chấp nhận lên V2 nếu thay đổi là nhạc nền.
      if (current.document.schemaVersion === 1 && comparable.schemaVersion === 2 && !requiresCanvasV2(comparable)) {
        comparable.schemaVersion = 1;
        comparable.registryVersion = 1;
      }
      for (const key of current.policy.editableBindings) comparable.bindings[key].value = '';
      const photo = comparable.elements.find(element => element.id === current.policy.photoId);
      if (photo) photo.props.assetId = null;
      return canonicalStringify(comparable);
    };
    const before = copy(current.document);
    clearTemplateBindingDefaults(before, current.policy.editableBindings);
    if (normalize(before) !== normalize(document) || document.assets.length !== assetIds(document).length)
      throw canvasError(403, 'LOCKED_ELEMENT', 'Mẫu chỉ cho chỉnh các vùng cá nhân hóa đã duyệt.');
    return;
  }
  // Khóa của server là bắt buộc; giao diện không được tự nới lỏng.
  for (const [id, rule] of Object.entries(current.policy?.lockedElements || {})) {
    const before = current.document.elements.find(e => e.id === id); const after = document.elements.find(e => e.id === id);
    const permitted = Array.isArray(rule.editableProps) ? rule.editableProps : [];
    if (!before || !after) throw canvasError(403, 'LOCKED_ELEMENT', 'Không được xóa vùng khóa của mẫu.');
    const beforeScene = current.document.scenes.find(scene => scene.elementIds.includes(id));
    const afterScene = document.scenes.find(scene => scene.elementIds.includes(id));
    if (beforeScene?.id !== afterScene?.id) throw canvasError(403, 'LOCKED_ELEMENT', 'Không được chuyển vùng khóa sang cảnh khác.');
    const a = copy(before); const b = copy(after);
    for (const key of permitted) { delete a.props[key]; delete b.props[key]; }
    if (canonicalStringify(a) !== canonicalStringify(b)) throw canvasError(403, 'LOCKED_ELEMENT', 'Vùng này không được phép chỉnh sửa.');
  }
}
