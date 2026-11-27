import { t } from '../../core/i18n.js';
import { displayLayerText } from '../../shared/recipient-naming.js';
import { displayCopy } from '../../shared/locale.js';
// Bản đồ chuyển đổi tối thiểu từ Canvas schema Momevia sang Fabric.js.
// Document Momevia luôn là dữ liệu gốc: không lưu Fabric JSON lên máy chủ.
export const FABRIC_EDITABLE_TYPES = Object.freeze(['text', 'shape', 'image']);

export function canFabricEdit(element, policy = null) {
  return FABRIC_EDITABLE_TYPES.includes(element.type) &&
    element.locked !== true &&
    element.visible !== false &&
    !policy?.lockedElements?.[element.id] &&
    policy?.kind !== 'creator-template';
}

export function displayText(element, document) {
  return displayLayerText(element, document, t);
}

export function fabricView(document, sceneId, policy = null, { includeHidden = false } = {}) {
  const scene = document.scenes.find(item => item.id === sceneId);
  if (!scene) throw new Error('Cảnh không tồn tại.');
  return {
    width: document.artboard.baseSize.width,
    height: document.artboard.baseSize.height,
    background: scene.background.color,
    ...(scene.effects ? { effects: structuredClone(scene.effects) } : {}),
    elements: scene.elementIds.map(id => document.elements.find(item => item.id === id))
      .filter(item => item && (includeHidden || item.visible !== false))
      .map(item => ({
        id: item.id,
        ...(item.groupId ? { groupId: item.groupId } : {}),
        name: item.name || item.accessibility?.label || item.type,
        type: item.type,
        layout: structuredClone(item.layout),
        props: structuredClone(item.props),
        accessibility: structuredClone(item.accessibility),
        ...(item.artwork ? { artwork: structuredClone(item.artwork) } : {}),
        ...(item.assembly ? { assembly: structuredClone(item.assembly) } : {}),
        ...(item.motions ? { motions: structuredClone(item.motions) } : {}),
        ...(item.effects ? { effects: structuredClone(item.effects) } : {}),
        text: item.type === 'text' ? displayText(item, document) : null,
        editable: canFabricEdit(item, policy),
        hidden: item.visible === false,
        opacity: item.opacity ?? 1,
        textEditable: item.type === 'text' && !item.props.textBinding && !(document.personalization && item.props.text?.includes('{người nhận}')) && canFabricEdit(item, policy),
      })),
  };
}

export function normalizedLayout(element, rect) {
  if (!rect || !Object.values(rect).every(Number.isFinite)) {
    throw new Error('Bố cục Fabric không hợp lệ.');
  }
  // Opening and applying Fabric must not quantize untouched fractional geometry.
  const round = (value, field) => Math.abs(value-element.layout[field]) < 1e-7
    ? element.layout[field] : Math.round(value * 100) / 100;
  return {
    ...element.layout,
    x: round(Math.max(-10000, Math.min(10000, rect.x)), 'x'),
    y: round(Math.max(-10000, Math.min(10000, rect.y)), 'y'),
    width: round(Math.max(1, Math.min(10000, rect.width)), 'width'),
    height: round(Math.max(1, Math.min(10000, rect.height)), 'height'),
    rotation: round(Math.max(-360, Math.min(360, rect.rotation)), 'rotation'),
  };
}

// Fabric origin tại tâm, còn schema Momevia lưu tọa độ góc trên-trái.
export function layoutFromFabric(element, shape) {
  const width = Math.abs(shape.width * (shape.scaleX || 1));
  const height = Math.abs((shape.momeviaBaseHeight ?? shape.height) * (shape.scaleY || 1));
  const angle = shape.angle || 0;
  const rotation = angle >= -360 && angle <= 360
    ? angle
    : (((angle + 180) % 360 + 360) % 360) - 180;
  return normalizedLayout(element, {
    x: shape.left - width / 2,
    y: shape.momeviaFlowHeightRatio
      ? shape.top - Math.abs(shape.height*(shape.scaleY||1))/2 - shape.momeviaFlowOffsetY
      : shape.top - height / 2 - (shape.momeviaDisplayOffsetY || 0) * (shape.scaleY || 1),
    width,
    height: shape.momeviaFlowHeightRatio && element.type!=='text' ? height/shape.momeviaFlowHeightRatio : height,
    rotation,
  });
}

export function fabricDiff(document, sceneId, shapes, policy = null) {
  const scene = document.scenes.find(item => item.id === sceneId);
  if (!scene) throw new Error('Cảnh không tồn tại.');
  const updates = [];
  for (const shape of shapes) {
    if (typeof shape.momeviaId !== 'string' || !scene.elementIds.includes(shape.momeviaId)) continue;
    const element = document.elements.find(item => item.id === shape.momeviaId);
    if (!element || !canFabricEdit(element, policy)) continue;
    const layout = element.groupId ? element.layout : layoutFromFabric(element, shape);
    const text = element.type === 'text' && !element.props.textBinding &&
      typeof shape.text === 'string' && !(document.personalization && element.props.text?.includes('{người nhận}')) ? shape.text.slice(0, 4000) : null;
    const textChanged = text !== null && displayCopy(text) !== displayCopy(element.props.text);
    if (JSON.stringify(layout) !== JSON.stringify(element.layout) || textChanged) {
      updates.push({ id: element.id, layout, ...(textChanged ? { text } : {}) });
    }
  }
  return updates;
}

export function applyFabricDiff(document, sceneId, updates, policy = null) {
  const next = structuredClone(document);
  const scene = next.scenes.find(item => item.id === sceneId);
  if (!scene) throw new Error('Cảnh không tồn tại.');
  for (const update of updates) {
    const element = next.elements.find(item => item.id === update.id);
    if (!element || !scene.elementIds.includes(update.id) || !canFabricEdit(element, policy)) {
      throw new Error('Thao tác không hợp lệ hoặc element đã bị khóa.');
    }
    const layout = normalizedLayout(element, update.layout);
    if (element.groupId && Object.keys(element.layout).some(key => layout[key] !== element.layout[key]))
      throw new Error(t('editor.fabric.layer.grouped'));
    element.layout = layout;
    if ('text' in update) {
      if (element.type !== 'text' || element.props.textBinding || typeof update.text !== 'string' || update.text.length > 4000) {
        throw new Error('Không được sửa nội dung cá nhân hóa bị khóa.');
      }
      element.props.text = update.text;
    }
  }
  return next;
}
