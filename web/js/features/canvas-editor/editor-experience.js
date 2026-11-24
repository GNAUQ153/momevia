import { canonicalUiText as canonicalText } from '../../shared/locale.js';

// Thành phần hiển thị UX Canvas; không tạo/thay đổi dữ liệu thiết kế.
export function canOpenAdvancedEditor(policy) {
  return policy?.kind !== 'creator-template';
}

export function scenePositionLabel(document, sceneId, localize = canonicalText) {
  const scenes = Array.isArray(document?.scenes) ? document.scenes : [];
  if (!scenes.length) return localize('editor.scene.none');
  const index = scenes.findIndex(scene => scene.id === sceneId);
  if (index < 0) return localize('editor.scene.count', { count: scenes.length });
  return localize('editor.scene.progress', { index: index + 1, total: scenes.length });
}

export function selectionDescription(document, sceneId, selectionId, policy, localize = canonicalText) {
  if (!selectionId) return localize('editor.selection.guide');
  const scene = document?.scenes?.find(item => item.id === sceneId);
  if (!scene?.elementIds?.includes(selectionId)) return localize('editor.selection.current');
  const element = document?.elements?.find(item => item.id === selectionId);
  if (!element) return localize('editor.selection.missing');
  const key = {
    text: 'editor.element.text', image: 'editor.selection.photo', shape: 'editor.element.shape', sticker: 'editor.selection.decoration',
  }[element.type] || 'editor.selection.element';
  const label = element.name || { format: 'message', key };
  const locked = Boolean(element.locked || policy?.lockedElements?.[element.id]);
  return localize(locked ? 'editor.selection.locked' : 'editor.selection.editable', { label });
}
