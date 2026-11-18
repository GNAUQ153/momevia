import { registry, STICKERS, FONT_TOKENS, BINDINGS, LIMITS } from './registry.js';

export class CanvasValidationError extends Error {
  constructor(path, message, code = 'INVALID_DOCUMENT') { super(message); this.name = 'CanvasValidationError'; this.code = code; this.status = 422; this.details = [{ path, code, message }]; }
}
const fail = (path, message, code) => { throw new CanvasValidationError(path, message, code); };
const own = (value, key) => Object.hasOwn(value, key);
function object(value, path, keys, required = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(path, 'Cần một object hợp lệ.');
  for (const k of Object.keys(value)) if (!keys.includes(k)) fail(`${path}.${k}`, 'Trường chưa được hỗ trợ.');
  for (const k of required) if (!own(value, k)) fail(`${path}.${k}`, 'Thiếu trường bắt buộc.');
}
function string(value, path, max = 160, min = 0) { if (typeof value !== 'string' || value.length > max || value.length < min || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)) fail(path, `Văn bản cần từ ${min} đến ${max} ký tự.`); }
function id(value, path) { string(value, path, 128, 1); if (!/^[A-Za-z0-9_-]+$/.test(value)) fail(path, 'ID không hợp lệ.'); }
function number(value, path, min, max) { if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(path, 'Số nằm ngoài giới hạn kỹ thuật.'); }
function enumeration(value, path, values) { if (!values.includes(value)) fail(path, 'Giá trị chưa được hỗ trợ.'); }
function boolean(value, path) { if (typeof value !== 'boolean') fail(path, 'Cần giá trị boolean.'); }
function color(value, path) { if (typeof value !== 'string' || !/^#[\da-fA-F]{6}$/.test(value)) fail(path, 'Màu cần ở dạng #RRGGBB.'); }
function array(value, path, max) { if (!Array.isArray(value) || value.length > max) fail(path, 'Danh sách vượt giới hạn kỹ thuật.'); }
function preflightTree(value, path = 'document', depth = 0, ancestors = new Set()) {
  if (depth > LIMITS.depth) fail(path, 'Nội dung lồng quá sâu.');
  if (typeof value === 'number' && !Number.isFinite(value)) fail(path, 'Số không hữu hạn.');
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') fail(path, 'Dữ liệu không thuộc JSON.');
  if (value && typeof value === 'object') {
    if (ancestors.has(value)) fail(path, 'Nội dung tham chiếu vòng.');
    ancestors.add(value);
    for (const [k, v] of Object.entries(value)) preflightTree(v, `${path}.${k}`, depth + 1, ancestors);
    ancestors.delete(value);
  }
}

export function canonicalStringify(value) {
  preflightTree(value);
  const encode = item => item === null || typeof item !== 'object' ? JSON.stringify(item) : Array.isArray(item) ? `[${item.map(encode).join(',')}]` : `{${Object.keys(item).sort().map(k => `${JSON.stringify(k)}:${encode(item[k])}`).join(',')}}`;
  return encode(value);
}

export function validateDocument(document, { mode = 'draft', requiredBindings = BINDINGS } = {}) {
  enumeration(mode, 'mode', ['draft', 'publish']);
  preflightTree(document);
  const serialized = JSON.stringify(document);
  if (new TextEncoder().encode(serialized).length > LIMITS.documentBytes) fail('document', 'Thiết kế vượt giới hạn 256 KiB.', 'DOCUMENT_BUDGET');
  object(document, 'document', ['schemaVersion', 'registryVersion', 'artboard', 'entrySceneId', 'bindings', 'assets', 'scenes', 'elements', 'responsive'], ['schemaVersion', 'registryVersion', 'artboard', 'entrySceneId', 'bindings', 'assets', 'scenes', 'elements', 'responsive']);
  enumeration(document.schemaVersion, 'schemaVersion', [1]); enumeration(document.registryVersion, 'registryVersion', [1]);
  object(document.artboard, 'artboard', ['baseSize', 'layoutMode', 'safeInsets'], ['baseSize', 'layoutMode', 'safeInsets']);
  object(document.artboard.baseSize, 'artboard.baseSize', ['width', 'height'], ['width', 'height']);
  for (const [k, v] of Object.entries(document.artboard.baseSize)) number(v, `artboard.baseSize.${k}`, 240, LIMITS.artboard);
  enumeration(document.artboard.layoutMode, 'artboard.layoutMode', ['responsive-scene']);
  object(document.artboard.safeInsets, 'artboard.safeInsets', ['top', 'right', 'bottom', 'left'], ['top', 'right', 'bottom', 'left']);
  for (const [k, v] of Object.entries(document.artboard.safeInsets)) number(v, `artboard.safeInsets.${k}`, 0, 256);
  object(document.bindings, 'bindings', BINDINGS, BINDINGS);
  for (const key of BINDINGS) {
    const p = `bindings.${key}`, b = document.bindings[key]; object(b, p, ['type', 'value'], ['type', 'value']); enumeration(b.type, `${p}.type`, ['text']);
    string(b.value, `${p}.value`, key === 'message' ? 1000 : 60);
    if (mode === 'publish' && requiredBindings.includes(key) && !b.value.trim())
      fail(`${p}.value`, 'Nội dung bắt buộc chưa được nhập.', 'BINDING_REQUIRED');
  }
  array(document.assets, 'assets', LIMITS.assets); const assets = new Set();
  for (const [i, a] of document.assets.entries()) { const p = `assets.${i}`; object(a, p, ['assetId', 'kind'], ['assetId', 'kind']); id(a.assetId, `${p}.assetId`); enumeration(a.kind, `${p}.kind`, ['image']); if (assets.has(a.assetId)) fail(p, 'Asset trùng ID.'); assets.add(a.assetId); }
  array(document.scenes, 'scenes', LIMITS.scenes); array(document.elements, 'elements', LIMITS.elements);
  if (!document.scenes.length) fail('scenes', 'Cần ít nhất một cảnh.');
  const sceneIds = new Set(), elementIds = new Set(), assigned = new Set();
  for (const [i, s] of document.scenes.entries()) {
    const p = `scenes.${i}`; object(s, p, ['id', 'name', 'background', 'elementIds'], ['id', 'name', 'background', 'elementIds']); id(s.id, `${p}.id`); string(s.name, `${p}.name`, 100, 1);
    if (sceneIds.has(s.id)) fail(`${p}.id`, 'Cảnh trùng ID.'); sceneIds.add(s.id);
    object(s.background, `${p}.background`, ['kind', 'color'], ['kind', 'color']); enumeration(s.background.kind, `${p}.background.kind`, ['solid']); color(s.background.color, `${p}.background.color`);
    array(s.elementIds, `${p}.elementIds`, LIMITS.elements);
    for (const e of s.elementIds) { id(e, `${p}.elementIds`); if (assigned.has(e)) fail(`${p}.elementIds`, 'Element chỉ được thuộc một cảnh.'); assigned.add(e); }
  }
  id(document.entrySceneId, 'entrySceneId'); if (!sceneIds.has(document.entrySceneId)) fail('entrySceneId', 'Cảnh mở đầu không tồn tại.');
  for (const [i, e] of document.elements.entries()) {
    const p = `elements.${i}`; object(e, p, ['id', 'type', 'elementVersion', 'layout', 'props', 'accessibility', 'actions', 'name', 'visible', 'locked', 'opacity'], ['id', 'type', 'elementVersion', 'layout', 'props', 'accessibility']);
    id(e.id, `${p}.id`); if (elementIds.has(e.id) || sceneIds.has(e.id)) fail(`${p}.id`, 'Node trùng ID.'); elementIds.add(e.id);
    if (!own(registry, e.type)) fail(`${p}.type`, 'Element chưa được hỗ trợ.', 'UNSUPPORTED_ELEMENT'); enumeration(e.elementVersion, `${p}.elementVersion`, [1]);
    if (own(e, 'name')) string(e.name, `${p}.name`, 100); if (own(e, 'visible')) boolean(e.visible, `${p}.visible`); if (own(e, 'locked')) boolean(e.locked, `${p}.locked`); if (own(e, 'opacity')) number(e.opacity, `${p}.opacity`, 0, 1);
    object(e.layout, `${p}.layout`, ['x', 'y', 'width', 'height', 'rotation'], ['x', 'y', 'width', 'height', 'rotation']);
    for (const k of ['x', 'y']) number(e.layout[k], `${p}.layout.${k}`, -LIMITS.coordinate, LIMITS.coordinate);
    for (const k of ['width', 'height']) number(e.layout[k], `${p}.layout.${k}`, 1, LIMITS.coordinate);
    number(e.layout.rotation, `${p}.layout.rotation`, -360, 360);
    const propKeys = e.type === 'text' ? ['text', 'textBinding', 'fontToken', 'fontSize', 'align', 'color', 'lineHeight'] : registry[e.type].inspector;
    object(e.props, `${p}.props`, propKeys);
    for (const [k, v] of Object.entries(e.props)) {
      const q = `${p}.props.${k}`;
      if (['text', 'label', 'title', 'submitLabel'].includes(k)) string(v, q, k === 'text' ? LIMITS.text : 120);
      else if (k === 'textBinding') enumeration(v, q, BINDINGS);
      else if (k === 'fontToken') enumeration(v, q, FONT_TOKENS);
      else if (k === 'fontSize') number(v, q, 10, 160);
      else if (k === 'lineHeight') number(v, q, 1, 3);
      else if (k === 'align') enumeration(v, q, ['left', 'center', 'right']);
      else if (k === 'color' || k === 'strokeColor') color(v, q);
      else if (k === 'radius') number(v, q, 0, 512);
      else if (k === 'strokeWidth') number(v, q, 0, 40);
      else if (k === 'kind') enumeration(v, q, ['rectangle', 'ellipse', 'line']);
      else if (k === 'fit') enumeration(v, q, ['cover', 'contain']);
      else if (k === 'focalPoint') { object(v, q, ['x', 'y'], ['x', 'y']); number(v.x, `${q}.x`, 0, 1); number(v.y, `${q}.y`, 0, 1); }
      else if (k === 'assetId') { if (v === null && mode === 'draft') continue; id(v, q); if (!assets.has(v)) fail(q, 'Asset chưa được khai báo.', 'ASSET_REFERENCE'); }
      else if (k === 'stickerId') enumeration(v, q, Object.keys(STICKERS));
      else if (k === 'preset') enumeration(v, q, ['classic']);
    }
    if (e.type === 'text' && !own(e.props, 'text') && !own(e.props, 'textBinding')) fail(`${p}.props`, 'Văn bản cần literal hoặc binding.');
    if (e.type === 'text' && own(e.props, 'text') && own(e.props, 'textBinding')) fail(`${p}.props`, 'Chỉ chọn literal hoặc binding.');
    if (e.type === 'image' && !own(e.props, 'assetId')) fail(`${p}.props.assetId`, 'Cần asset hoặc placeholder null.');
    object(e.accessibility, `${p}.accessibility`, ['role', 'level', 'label', 'alt', 'decorative']);
    for (const [k, v] of Object.entries(e.accessibility)) { const q = `${p}.accessibility.${k}`; if (k === 'role') enumeration(v, q, ['heading', 'paragraph']); else if (k === 'level') { number(v, q, 1, 6); if (!Number.isInteger(v)) fail(q, 'Heading level phải nguyên.'); } else if (k === 'decorative') boolean(v, q); else string(v, q, 240); }
    if (mode === 'publish' && e.type === 'image' && !e.accessibility.decorative && !e.accessibility.alt?.trim()) fail(`${p}.accessibility.alt`, 'Ảnh cần mô tả hoặc đánh dấu trang trí.', 'IMAGE_ALT_REQUIRED');
    if (own(e, 'actions')) {
      array(e.actions, `${p}.actions`, LIMITS.actionsPerElement);
      for (const [j, a] of e.actions.entries()) { const q = `${p}.actions.${j}`; object(a, q, ['on', 'type', 'targetSceneId'], ['on', 'type']); enumeration(a.on, `${q}.on`, ['activate']); enumeration(a.type, `${q}.type`, registry[e.type].actions); if (a.type === 'goToScene') { if (a.targetSceneId === null && mode === 'draft') continue; id(a.targetSceneId, `${q}.targetSceneId`); if (!sceneIds.has(a.targetSceneId)) fail(`${q}.targetSceneId`, 'Cảnh đích không tồn tại.', 'ACTION_TARGET'); } else if (own(a, 'targetSceneId')) fail(q, 'Replay không có target.'); }
    }
    if (mode === 'publish' && registry[e.type].actions.length && !e.actions?.length) fail(`${p}.actions`, 'Nút cần thao tác hợp lệ.', 'ACTION_REQUIRED');
  }
  for (const e of assigned) if (!elementIds.has(e)) fail('scenes.elementIds', 'Element không tồn tại.');
  for (const e of elementIds) if (!assigned.has(e)) fail(`elements.${e}`, 'Element chưa thuộc cảnh nào.');
  object(document.responsive, 'responsive', ['textOverflow', 'sceneOverflow', 'desktop'], ['textOverflow', 'sceneOverflow', 'desktop']);
  enumeration(document.responsive.textOverflow, 'responsive.textOverflow', ['expand-flow']); enumeration(document.responsive.sceneOverflow, 'responsive.sceneOverflow', ['scroll']);
  object(document.responsive.desktop, 'responsive.desktop', ['maxContentWidth', 'align'], ['maxContentWidth', 'align']); number(document.responsive.desktop.maxContentWidth, 'responsive.desktop.maxContentWidth', 240, 1440); enumeration(document.responsive.desktop.align, 'responsive.desktop.align', ['center']);
  return JSON.parse(serialized);
}

export function assetIds(document) { return [...new Set(document.elements.filter(e => e.type === 'image' && e.props.assetId).map(e => e.props.assetId))]; }

export function duplicateDocument(document, { idFactory = () => globalThis.crypto.randomUUID() } = {}) {
  const result = validateDocument(document); const ids = new Map();
  for (const node of [...result.scenes, ...result.elements]) ids.set(node.id, idFactory());
  result.entrySceneId = ids.get(result.entrySceneId);
  for (const s of result.scenes) { s.id = ids.get(s.id); s.elementIds = s.elementIds.map(id => ids.get(id)); }
  for (const e of result.elements) { e.id = ids.get(e.id); for (const a of e.actions || []) if (a.targetSceneId) a.targetSceneId = ids.get(a.targetSceneId); }
  return validateDocument(result);
}

// Build an explicit public allowlist; private envelope/policy/view state never crosses here.
export function publicDocument(document) {
  const d = validateDocument(document, { mode: 'publish', requiredBindings: [] });
  return {
    schemaVersion: d.schemaVersion, registryVersion: d.registryVersion, artboard: d.artboard, entrySceneId: d.entrySceneId,
    bindings: d.bindings, assets: d.assets.filter(a => assetIds(d).includes(a.assetId)), scenes: d.scenes,
    elements: d.elements.map(e => ({ id: e.id, type: e.type, elementVersion: e.elementVersion, layout: e.layout, props: e.props, accessibility: e.accessibility, ...(e.actions ? { actions: e.actions } : {}), ...(own(e, 'visible') ? { visible: e.visible } : {}), ...(own(e, 'opacity') ? { opacity: e.opacity } : {}) })),
    responsive: d.responsive,
  };
}
