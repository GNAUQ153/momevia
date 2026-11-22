import { registry, STICKERS, FONT_TOKENS, BINDINGS, LIMITS } from './registry.js';
import { soundtrackById } from './soundtracks.js';
import { lines, masks, originalStickerIds, shapes } from './artwork.js';
import { predictionFields, normalizeChoice } from './prediction.js';
import { interactionKinds, photoSlots } from './interactions.js';
import { effectsFor, effectSpeed, elementEffectFamilies, sceneEffectFamilies, CELEBRATION_IDS } from './effects.js';
import { validatePortableEffect, validateVector } from './library-contract.js';
import { SOUND_TYPES, usesSound, validateSound } from './sound.js';

export const CANVAS_VERSIONS = Object.freeze([1, 2, 3]);
export const runtimeVersionFor = document => document.schemaVersion;
export const requiresCanvasV2 = document => Boolean(document.soundtrack) || document.scenes.some(scene => scene.effects) || document.elements.some(e =>
  e.type === 'interaction' || e.effects || e.artwork ||
  ['dropCap', 'pattern', 'mask', 'optional', 'caption'].some(key => own(e.props, key)) ||
  (e.type === 'sticker' && !originalStickerIds.includes(e.props.stickerId)) ||
  (e.type === 'shape' && Object.hasOwn(shapes, e.props.kind)));

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

function validateInteraction(p, path, assets, publishing) {
  enumeration(p.kind, `${path}.kind`, Object.keys(interactionKinds));
  const spec = interactionKinds[p.kind];
  const keys = ['kind', 'color', ...(spec.fields ? ['entries'] : []),
    ...(spec.prediction ? [...Object.keys(predictionFields), 'prediction'] : []),
    ...(spec.slots ? ['photos'] : []), ...(spec.clock ? ['eventAt', 'timeZone'] : [])];
  const extras = [...(['light-a-candle','foldout-letter'].includes(p.kind) ? ['appearance'] : []), ...(p.kind === 'swipe-album' ? ['optional', 'autoplay'] : []), ...(spec.clock ? ['optional', 'clockMode'] : [])];
  object(p, path, [...keys, ...extras], keys);
  if (own(p, 'optional')) boolean(p.optional, `${path}.optional`);
  if (own(p, 'autoplay')) boolean(p.autoplay, `${path}.autoplay`);
  if (own(p, 'clockMode')) enumeration(p.clockMode, `${path}.clockMode`, ['countdown', 'elapsed']);
  color(p.color, `${path}.color`);
  if (own(p,'appearance')) enumeration(p.appearance,`${path}.appearance`,p.kind==='foldout-letter'?['classic','paper-fold-v2']:['classic','cake-overlay-v1','cake-photo-v2']);
  if (spec.prediction) {
    for (const [key, max] of Object.entries(predictionFields)) {
      string(p[key], `${path}.${key}`, max);
      if (publishing && !p[key].trim()) fail(`${path}.${key}`, 'Nhập nội dung cho trường này.', 'PREDICTION_CONTENT_REQUIRED');
    }
    if (p.prediction !== null || publishing) enumeration(p.prediction, `${path}.prediction`, ['A', 'B']);
    if (publishing && normalizeChoice(p.optionA) === normalizeChoice(p.optionB))
      fail(`${path}.optionB`, 'Hai lựa chọn cần khác nhau sau khi bỏ khoảng trắng thừa.', 'PREDICTION_DUPLICATE_CHOICES');
  }
  if (spec.fields) {
    array(p.entries, `${path}.entries`, spec.fields.length);
    if (p.entries.length !== spec.fields.length) fail(`${path}.entries`, 'Thiếu vùng nội dung tương tác.');
    for (const [i, entry] of p.entries.entries()) {
      const fields = spec.fields[i].length === 2 ? ['heading', 'body'] : ['heading'];
      const q = `${path}.entries.${i}`;
      object(entry, q, fields, fields);
      string(entry.heading, `${q}.heading`, 120, publishing ? 1 : 0);
      if (fields.includes('body')) string(entry.body, `${q}.body`, LIMITS.text, publishing ? 1 : 0);
      if (publishing) for (const [index, field] of fields.entries())
        if (!entry[field].trim()) fail(`${q}.${field}`, `Nhập ${spec.fields[i][index].toLowerCase()} cho ${spec.label}.`, 'INTERACTION_CONTENT_REQUIRED');
    }
  }
  if (spec.slots) {
    array(p.photos, `${path}.photos`, spec.slots);
    if (p.photos.length !== spec.slots) fail(`${path}.photos`, 'Thiếu ô ảnh tương tác.');
    const slots = new Set();
    for (const [i, photo] of p.photos.entries()) {
      const q = `${path}.photos.${i}`;
      const fields = ['id', 'assetId', 'alt', 'caption', 'focalPoint'];
      object(photo, q, fields, fields);
      id(photo.id, `${q}.id`);
      if (slots.has(photo.id)) fail(`${q}.id`, 'Ô ảnh trùng ID.');
      slots.add(photo.id);
      if (photo.assetId !== null) {
        id(photo.assetId, `${q}.assetId`);
        if (!assets.has(photo.assetId)) fail(`${q}.assetId`, 'Asset chưa được khai báo.', 'ASSET_REFERENCE');
        if (publishing && !photo.alt?.trim()) fail(`${q}.alt`, `Ảnh ${i + 1} cần mô tả.`, 'IMAGE_ALT_REQUIRED');
      }
      string(photo.alt, `${q}.alt`, LIMITS.accessibilityText);
      string(photo.caption, `${q}.caption`, LIMITS.text);
      object(photo.focalPoint, `${q}.focalPoint`, ['x','y'], ['x','y']);
      for (const axis of ['x','y']) number(photo.focalPoint[axis], `${q}.focalPoint.${axis}`, 0, 1);
    }
    if (publishing && !p.optional && p.photos.filter(photo => photo.assetId).length < spec.minimumPhotos) {
      const missing = p.photos.findIndex(photo => !photo.assetId);
      fail(`${path}.photos.${missing}.assetId`, `${spec.label} cần ${spec.minimumPhotos} ảnh. Chọn ảnh cho ô ${missing+1}.`, 'INTERACTION_PHOTO_REQUIRED');
    }
  }
  if (spec.clock) {
    string(p.timeZone, `${path}.timeZone`, 65, 1);
    if (!/^[A-Za-z][\w+-]*(?:\/[\w+-]+)*$/.test(p.timeZone)) fail(`${path}.timeZone`, 'Múi giờ không hợp lệ.');
    try { new Intl.DateTimeFormat('vi', {timeZone:p.timeZone}); }
    catch { fail(`${path}.timeZone`, 'Múi giờ không hợp lệ.'); }
    if (p.eventAt !== null || (publishing && !p.optional)) {
      string(p.eventAt, `${path}.eventAt`, 24, 24);
      const time = new Date(p.eventAt);
      if (!Number.isFinite(time.getTime()) || time.toISOString() !== p.eventAt) fail(`${path}.eventAt`, 'Chọn ngày giờ hẹn hợp lệ.');
    }
  }
}

function validateEffects(effects, path, model) {
  const families = model ? elementEffectFamilies : sceneEffectFamilies;
  object(effects,path,model ? families : [...families, 'celebrations']);
  for (const [family, preset] of Object.entries(effects)) {
    const q = `${path}.${family}`;
    if (family === 'celebrations') {
      object(preset,q,CELEBRATION_IDS);
      for (const [id, settings] of Object.entries(preset)) {
        const at = `${q}.${id}`;
        object(settings,at,['enabled','speed','density','loop','definition'],['enabled']);
        boolean(settings.enabled,`${at}.enabled`);
        if (own(settings,'speed')) enumeration(settings.speed,`${at}.speed`,Object.keys(effectSpeed));
        if (own(settings,'density')) enumeration(settings.density,`${at}.density`,['sparse','normal','dense']);
        if (own(settings,'loop')) boolean(settings.loop,`${at}.loop`);
        if (settings.definition) { try { validatePortableEffect(settings.definition, 'ambience'); if (settings.definition.id !== id) fail(at, 'Effect identity mismatch.'); } catch (e) { fail(at, e.message); } }
      }
      continue;
    }
    const option = { surface: 'color', entrance: 'delay', ambience: 'density' }[family];
    object(preset,q,['id','definition', ...(family === 'surface' ? [] : ['speed']), ...(family === 'ambience' ? ['loop'] : []), ...(option ? [option] : [])],['id']);
    if (preset.definition) {
      try { validatePortableEffect(preset.definition, family, model); } catch (e) { fail(q, e.message); }
      if (preset.definition.id !== preset.id) fail(q, 'Effect identity mismatch.');
    } else enumeration(preset.id,`${q}.id`, effectsFor(family, model, { builtin: true }).map(([id]) => id));
    if (own(preset,'speed')) enumeration(preset.speed,`${q}.speed`,Object.keys(effectSpeed));
    if (own(preset,'delay')) enumeration(preset.delay,`${q}.delay`,[0,150,300]);
    if (own(preset,'color')) color(preset.color,`${q}.color`);
    if (own(preset,'density')) enumeration(preset.density,`${q}.density`,['sparse','normal']);
    if (own(preset,'loop')) boolean(preset.loop,`${q}.loop`);
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
  object(document, 'document', ['schemaVersion', 'registryVersion', 'artboard', 'entrySceneId', 'bindings', 'assets', 'scenes', 'elements', 'responsive', 'soundtrack'], ['schemaVersion', 'registryVersion', 'artboard', 'entrySceneId', 'bindings', 'assets', 'scenes', 'elements', 'responsive']);
  if (own(document, 'soundtrack')) {
    object(document.soundtrack, 'soundtrack', ['id', 'volume'], ['id', 'volume']);
    if (!soundtrackById(document.soundtrack.id)) fail('soundtrack.id', 'Bài nhạc không thuộc thư viện đã duyệt.', 'SOUNDTRACK_NOT_ALLOWED');
    number(document.soundtrack.volume, 'soundtrack.volume', 0, 1);
  }
  enumeration(document.schemaVersion, 'schemaVersion', CANVAS_VERSIONS);
  enumeration(document.registryVersion, 'registryVersion', [document.schemaVersion]);
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
  for (const [i, a] of document.assets.entries()) { const p = `assets.${i}`; object(a, p, ['assetId', 'kind'], ['assetId', 'kind']); id(a.assetId, `${p}.assetId`); enumeration(a.kind, `${p}.kind`, document.schemaVersion >= 3 ? ['image','audio'] : ['image']); if (assets.has(a.assetId)) fail(p, 'Asset trùng ID.'); assets.add(a.assetId); }
  const imageAssets = new Set(document.assets.filter(a=>a.kind==='image').map(a=>a.assetId));
  array(document.scenes, 'scenes', LIMITS.scenes); array(document.elements, 'elements', LIMITS.elements);
  if (!document.scenes.length) fail('scenes', 'Cần ít nhất một cảnh.');
  const sceneIds = new Set(), elementIds = new Set(), assigned = new Set();
  for (const [i, s] of document.scenes.entries()) {
    const p = `scenes.${i}`; object(s, p, ['id', 'name', 'background', 'elementIds', 'effects'], ['id', 'name', 'background', 'elementIds']); id(s.id, `${p}.id`); string(s.name, `${p}.name`, 100, 1);
    if (own(s,'effects')) validateEffects(s.effects,`${p}.effects`);
    if (sceneIds.has(s.id)) fail(`${p}.id`, 'Cảnh trùng ID.'); sceneIds.add(s.id);
    object(s.background, `${p}.background`, ['kind', 'color'], ['kind', 'color']); enumeration(s.background.kind, `${p}.background.kind`, ['solid']); color(s.background.color, `${p}.background.color`);
    array(s.elementIds, `${p}.elementIds`, LIMITS.elements);
    for (const e of s.elementIds) { id(e, `${p}.elementIds`); if (assigned.has(e)) fail(`${p}.elementIds`, 'Element chỉ được thuộc một cảnh.'); assigned.add(e); }
  }
  id(document.entrySceneId, 'entrySceneId'); if (!sceneIds.has(document.entrySceneId)) fail('entrySceneId', 'Cảnh mở đầu không tồn tại.');
  for (const [i, e] of document.elements.entries()) {
    const p = `elements.${i}`; object(e, p, ['id', 'type', 'elementVersion', 'layout', 'props', 'accessibility', 'actions', 'name', 'visible', 'locked', 'opacity', 'effects', 'artwork', 'sound'], ['id', 'type', 'elementVersion', 'layout', 'props', 'accessibility']);
    if (own(e,'sound')) {
      if (!SOUND_TYPES.includes(e.type)) fail(`${p}.sound`, 'Phần tử này không hỗ trợ âm khi nhấn.');
      try { validateSound(e.sound); } catch(error) { fail(`${p}.sound`, error.message, 'INVALID_SOUND'); }
      if(e.sound.kind==='audio'&&!document.assets.some(a=>a.assetId===e.sound.assetId&&a.kind==='audio'))fail(`${p}.sound.assetId`,'Âm cá nhân chưa được khai báo.','ASSET_REFERENCE');
    }
    if (e.artwork) { if (!['shape','line','sticker'].includes(e.type)) fail(p, 'Vector artwork requires a vector element.'); try { validateVector(e.artwork); } catch (error) { fail(p, error.message); } }
    id(e.id, `${p}.id`); if (elementIds.has(e.id) || sceneIds.has(e.id)) fail(`${p}.id`, 'Node trùng ID.'); elementIds.add(e.id);
    if (!own(registry, e.type)) fail(`${p}.type`, 'Element chưa được hỗ trợ.', 'UNSUPPORTED_ELEMENT'); enumeration(e.elementVersion, `${p}.elementVersion`, [1]);
    if (own(e, 'name')) string(e.name, `${p}.name`, 100); if (own(e, 'visible')) boolean(e.visible, `${p}.visible`); if (own(e, 'locked')) boolean(e.locked, `${p}.locked`); if (own(e, 'opacity')) number(e.opacity, `${p}.opacity`, 0, 1);
    object(e.layout, `${p}.layout`, ['x', 'y', 'width', 'height', 'rotation'], ['x', 'y', 'width', 'height', 'rotation']);
    for (const k of ['x', 'y']) number(e.layout[k], `${p}.layout.${k}`, -LIMITS.coordinate, LIMITS.coordinate);
    for (const k of ['width', 'height']) number(e.layout[k], `${p}.layout.${k}`, 1, LIMITS.coordinate);
    number(e.layout.rotation, `${p}.layout.rotation`, -360, 360);
    const propKeys = e.type === 'text' ? ['text', 'textBinding', 'fontToken', 'fontSize', 'align', 'color', 'lineHeight', 'dropCap'] : registry[e.type].inspector;
    object(e.props, `${p}.props`, propKeys);
    if (e.type === 'interaction') validateInteraction(e.props, `${p}.props`, imageAssets, mode === 'publish');
    for (const [k, v] of e.type === 'interaction' ? [] : Object.entries(e.props)) {
      const q = `${p}.props.${k}`;
      if (['text', 'label', 'title', 'submitLabel'].includes(k)) string(v, q, k === 'text' ? LIMITS.text : 120);
      else if (k === 'textBinding') enumeration(v, q, BINDINGS);
      else if (k === 'fontToken') enumeration(v, q, FONT_TOKENS);
      else if (k === 'fontSize') number(v, q, 10, 160);
      else if (k === 'lineHeight') number(v, q, 1, 3);
      else if (k === 'dropCap') boolean(v, q);
      else if (k === 'mask') { if (!e.props.maskPath) enumeration(v, q, Object.keys(masks)); else id(v, q); }
      else if (k === 'maskPath') { try { validateVector({ paths: [{ d: v }] }); } catch (error) { fail(q, error.message); } }
      else if (k === 'optional') boolean(v, q);
      else if (k === 'caption') string(v, q, LIMITS.text);
      else if (k === 'pattern') { if (!e.artwork) enumeration(v, q, Object.keys(lines)); else id(v, q); }
      else if (k === 'align') enumeration(v, q, ['left', 'center', 'right']);
      else if (k === 'color' || k === 'strokeColor') color(v, q);
      else if (k === 'radius') number(v, q, 0, 512);
      else if (k === 'strokeWidth') number(v, q, 0, 40);
      else if (k === 'kind') { if (!e.artwork) enumeration(v, q, ['rectangle', 'ellipse', 'line', ...Object.keys(shapes)]); else id(v, q); }
      else if (k === 'fit') enumeration(v, q, ['cover', 'contain']);
      else if (k === 'focalPoint') { object(v, q, ['x', 'y'], ['x', 'y']); number(v.x, `${q}.x`, 0, 1); number(v.y, `${q}.y`, 0, 1); }
      else if (k === 'assetId') { if (v === null && (mode === 'draft' || e.props.optional)) continue; id(v, q); if (!imageAssets.has(v)) fail(q, 'Ảnh chưa được khai báo.', 'ASSET_REFERENCE'); }
      else if (k === 'stickerId') { if (!e.artwork) enumeration(v, q, Object.keys(STICKERS)); else id(v, q); }
      else if (k === 'preset') enumeration(v, q, e.type === 'envelope' ? ['classic','compact-v2','photo-caption-v3'] : ['classic']);
    }
    if (e.type === 'text' && !own(e.props, 'text') && !own(e.props, 'textBinding')) fail(`${p}.props`, 'Văn bản cần literal hoặc binding.');
    if (e.type === 'text' && own(e.props, 'text') && own(e.props, 'textBinding')) fail(`${p}.props`, 'Chỉ chọn literal hoặc binding.');
    if (e.type === 'image' && !own(e.props, 'assetId')) fail(`${p}.props.assetId`, 'Cần asset hoặc placeholder null.');
    object(e.accessibility, `${p}.accessibility`, ['role', 'level', 'label', 'alt', 'decorative']);
    for (const [k, v] of Object.entries(e.accessibility)) { const q = `${p}.accessibility.${k}`; if (k === 'role') enumeration(v, q, ['heading', 'paragraph']); else if (k === 'level') { number(v, q, 1, 6); if (!Number.isInteger(v)) fail(q, 'Heading level phải nguyên.'); } else if (k === 'decorative') boolean(v, q); else string(v, q, LIMITS.accessibilityText); }
    if (mode === 'publish' && e.type === 'image' && e.props.assetId && !e.accessibility.decorative && !e.accessibility.alt?.trim()) fail(`${p}.accessibility.alt`, 'Ảnh cần mô tả hoặc đánh dấu trang trí.', 'IMAGE_ALT_REQUIRED');
    if (own(e, 'actions')) {
      array(e.actions, `${p}.actions`, LIMITS.actionsPerElement);
      const allowed = e.type === 'interaction' && interactionKinds[e.props.kind].targets ? ['goToScene'] : registry[e.type].actions;
      for (const [j, a] of e.actions.entries()) { const q = `${p}.actions.${j}`; object(a, q, ['on', 'type', 'targetSceneId'], ['on', 'type']); enumeration(a.on, `${q}.on`, ['activate']); enumeration(a.type, `${q}.type`, allowed); if (a.type === 'goToScene') { if (a.targetSceneId === null && mode === 'draft') continue; id(a.targetSceneId, `${q}.targetSceneId`); if (!sceneIds.has(a.targetSceneId)) fail(`${q}.targetSceneId`, 'Cảnh đích không tồn tại.', 'ACTION_TARGET'); } else if (own(a, 'targetSceneId')) fail(q, 'Replay không có target.'); }
    }
    if (e.type === 'interaction' && interactionKinds[e.props.kind].targets) {
      if (e.actions?.length !== 2) fail(`${p}.actions`, 'Hai cửa cần hai thao tác chuyển cảnh.', 'ACTION_REQUIRED');
      if (mode === 'publish' && e.actions[0].targetSceneId === e.actions[1].targetSceneId)
        fail(`${p}.actions.1.targetSceneId`, 'Cửa thứ hai cần một cảnh khác cửa thứ nhất.', 'ACTION_TARGET');
    }
    if (mode === 'publish' && registry[e.type].actions.length && !e.actions?.length) fail(`${p}.actions`, 'Nút cần thao tác hợp lệ.', 'ACTION_REQUIRED');
    if (own(e,'effects')) validateEffects(e.effects,`${p}.effects`,e);
  }
  for (const e of assigned) if (!elementIds.has(e)) fail('scenes.elementIds', 'Element không tồn tại.');
  for (const e of elementIds) if (!assigned.has(e)) fail(`elements.${e}`, 'Element chưa thuộc cảnh nào.');
  if (document.schemaVersion === 1 && requiresCanvasV2(document)) fail('schemaVersion', 'Khối này cần tài liệu Canvas phiên bản 2.');
  if (document.schemaVersion < 3 && usesSound(document)) fail('schemaVersion', 'Âm thanh cần Canvas phiên bản 3.');
  object(document.responsive, 'responsive', ['textOverflow', 'sceneOverflow', 'desktop'], ['textOverflow', 'sceneOverflow', 'desktop']);
  enumeration(document.responsive.textOverflow, 'responsive.textOverflow', ['expand-flow']); enumeration(document.responsive.sceneOverflow, 'responsive.sceneOverflow', ['scroll']);
  object(document.responsive.desktop, 'responsive.desktop', ['maxContentWidth', 'align'], ['maxContentWidth', 'align']); number(document.responsive.desktop.maxContentWidth, 'responsive.desktop.maxContentWidth', 240, 1440); enumeration(document.responsive.desktop.align, 'responsive.desktop.align', ['center']);
  return JSON.parse(serialized);
}

export function imageAssetIds(document) { return [...new Set(document.elements.flatMap(photoSlots).map(photo => photo.assetId).filter(Boolean))]; }
export function assetIds(document) { return [...new Set([...imageAssetIds(document),...document.elements.filter(e=>e.sound?.kind==='audio').map(e=>e.sound.assetId)])]; }

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
  const used = new Set(assetIds(d));
  return {
    schemaVersion: d.schemaVersion, registryVersion: d.registryVersion, artboard: d.artboard, entrySceneId: d.entrySceneId,
    bindings: d.bindings, assets: d.assets.filter(a => used.has(a.assetId)), scenes: d.scenes,
    ...(d.soundtrack ? { soundtrack: d.soundtrack } : {}),
    elements: d.elements.map(e => ({ id: e.id, type: e.type, elementVersion: e.elementVersion, layout: e.layout, props: e.props, accessibility: e.accessibility, ...(e.sound ? {sound:e.sound} : {}), ...(e.actions ? { actions: e.actions } : {}), ...(e.effects ? { effects: e.effects } : {}), ...(e.artwork ? { artwork: e.artwork } : {}), ...(own(e, 'visible') ? { visible: e.visible } : {}), ...(own(e, 'opacity') ? { opacity: e.opacity } : {}) })),
    responsive: d.responsive,
  };
}
