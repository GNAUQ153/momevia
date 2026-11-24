// Phase 6.0b: Thuộc tính hiển thị được phép chỉnh trong Fabric Studio.
// Không truyền thuộc tính Fabric tùy ý vào Canvas Document hoặc vượt quyền Creator.
import { canFabricEdit } from './fabric-adapter.js';

const COLOR = /^#[0-9a-fA-F]{6}$/;
const TEXT_FIELDS = Object.freeze(['color', 'fontToken', 'fontSize', 'align', 'lineHeight']);
const SHAPE_FIELDS = Object.freeze(['color', 'strokeColor', 'strokeWidth', 'radius']);
const IMAGE_FIELDS = Object.freeze([]);
const ALLOWED_FONTS = Object.freeze(['body', 'heading', 'serif']);
const ALLOWED_ALIGN = Object.freeze(['left', 'center', 'right']);

export function styleFieldsFor(element) {
  if (!element || !['text', 'shape', 'image'].includes(element.type)) return [];
  if(element.assembly)return ['color','opacity'];
  if(element.type==='shape'&&element.artwork)return [...(element.artwork.paths.some(p=>p.fill==='color')?['color']:[]),'opacity'];
  // Unpinned custom shapes still require an explicit renderer.
  if (element.type === 'shape' && !['rectangle', 'ellipse'].includes(element.props?.kind)) return [];
  const specific = element.type === 'text' ? TEXT_FIELDS :
    element.type === 'shape' ? SHAPE_FIELDS : IMAGE_FIELDS;
  return [...specific.filter(field => field !== 'radius' || element.props?.kind === 'rectangle'), 'opacity'];
}

export function currentStyleValue(element, field) {
  if (!styleFieldsFor(element).includes(field)) throw new Error('Thuộc tính không phù hợp loại lớp.');
  if (field === 'opacity') return element.opacity ?? 1;
  const defaults = {
    color: element.type === 'text' ? '#30243B' : '#DCCDFC',
    fontToken: 'body', fontSize: 24, align: 'left', lineHeight: 1.4,
    strokeColor: element.props?.color || '#DCCDFC', strokeWidth: 0, radius: 0,
  };
  return element.props?.[field] ?? defaults[field];
}

export function validateFabricStyleField(element, field, value) {
  if (!styleFieldsFor(element).includes(field)) throw new Error('Thuộc tính lớp không được hỗ trợ.');
  if (field === 'color' || field === 'strokeColor') {
    if (typeof value !== 'string' || !COLOR.test(value)) throw new Error('Màu phải có dạng #RRGGBB.');
    return value.toUpperCase();
  }
  if (field === 'fontToken') {
    if (!ALLOWED_FONTS.includes(value)) throw new Error('Phông chữ không hợp lệ.');
    return value;
  }
  if (field === 'align') {
    if (!ALLOWED_ALIGN.includes(value)) throw new Error('Căn chữ không hợp lệ.');
    return value;
  }
  const minMax = {
    fontSize: [10, 160], lineHeight: [1, 3], strokeWidth: [0, 40],
    radius: [0, 512], opacity: [0, 1],
  }[field];
  if (!minMax || typeof value !== 'number' || !Number.isFinite(value) ||
    value < minMax[0] || value > minMax[1]) {
    throw new Error('Giá trị thuộc tính không hợp lệ.');
  }
  return Math.round(value * 100) / 100;
}

export function applyFabricStylePatch(document, sceneId, styles = [], policy = null) {
  if (!Array.isArray(styles) || styles.length > document?.elements?.length) {
    throw new Error('Danh sách thuộc tính Fabric không hợp lệ.');
  }
  const scene = document?.scenes?.find(item => item.id === sceneId);
  if (!scene) throw new Error('Cảnh Canvas không tồn tại.');
  const next = structuredClone(document);
  const seen = new Set();
  for (const update of styles) {
    if (!update || Object.getPrototypeOf(update) !== Object.prototype ||
      Object.keys(update).sort().join(',') !== 'fields,id' || typeof update.id !== 'string' ||
      seen.has(update.id) || !scene.elementIds.includes(update.id)) {
      throw new Error('Bản cập nhật thuộc tính Fabric có ID không hợp lệ hoặc bị trùng.');
    }
    seen.add(update.id);
    const element = next.elements.find(item => item.id === update.id);
    // Ẩn lớp trong cùng phiên vẫn được lưu kiểu dáng; 'ẩn' không phải quyền khóa.
    if (!element || !canFabricEdit({ ...element, visible: true }, policy) ||
      !update.fields || Object.getPrototypeOf(update.fields) !== Object.prototype ||
      !Object.keys(update.fields).length) {
      throw new Error('Lớp bị khóa, bị ẩn hoặc thuộc tính không hợp lệ.');
    }
    for (const [field, rawValue] of Object.entries(update.fields)) {
      const value = validateFabricStyleField(element, field, rawValue);
      if (field === 'opacity') element.opacity = value;
      else element.props[field] = value;
    }
  }
  return next;
}

export function styleDiffFromDraft(layerModels, changes) {
  const updates = [];
  for (const [id, fields] of changes.entries()) {
    const model = layerModels.get(id);
    if (!model) throw new Error('Lớp chỉnh sửa không còn tồn tại.');
    const selected = {};
    for (const [field, rawValue] of fields.entries()) {
      const value = validateFabricStyleField(model, field, rawValue);
      const previous = currentStyleValue(model, field);
      if (String(value).toUpperCase() !== String(previous).toUpperCase()) selected[field] = value;
    }
    if (Object.keys(selected).length) updates.push({ id, fields: selected });
  }
  return updates;
}
