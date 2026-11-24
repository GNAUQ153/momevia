import { createElement, registry } from '../../shared/canvas/registry.js';
import { createDocument } from '../../shared/canvas/presets.js';
import { interactionKinds } from '../../shared/canvas/interactions.js';
import { emptyPrediction } from '../../shared/canvas/prediction.js';
import { libraryLabel as libraryText } from '../../shared/canvas/library-state.js';
import { validateAnimation } from '../../shared/canvas/library-contract.js';
import { canonicalStringify } from '../../shared/canvas/schema.js';

export const categories = ['element','effect','animation','preset'];
export const categoryFor = kind => kind === 'template' ? 'preset' : kind;
export const itemKey = item => `${item.kind}:${item.id}`;
export const fingerprint = value => JSON.stringify(value);
export function itemTitle(item, rows, locale = 'vi') {
  return libraryText(item.definition.title, locale) || (item.kind === 'animation'
    ? libraryText(rows.find(r => r.kind === 'effect' && r.definition.animationId === item.id)?.definition.title, locale) : '') || item.id;
}
export function animationDefaults(engine) {
  return engine === 'builtin' ? { engine, builtinId: 'E01' } : engine === 'surface' ? { engine, styles: { borderColor: '#6136DF', borderWidth: 2, borderRadius: 16, shadowColor: '#D9C8FF', shadowBlur: 12 } }
    : engine === 'particles' ? { engine, glyphs: ['✦','❀'], colors: ['#B98ADC','#F45278'], count: 8, duration: 1600, drift: -100 }
      : { engine: 'keyframes', duration: 700, easing: 'ease-out', iterations: 1,
        keyframes: [{ offset: 0, opacity: 0, transform: 'translateY(20px) scale(0.96)' }, { offset: 1, opacity: 1, transform: 'translateY(0px) scale(1)' }] };
}
export function makeInteraction(kind) {
  const spec = interactionKinds[kind], props = { kind, color: '#F5EFFF' };
  if (spec.fields) props.entries = spec.fields.map(fields => ({ heading: '', ...(fields.length === 2 ? { body: '' } : {}) }));
  if (spec.slots) props.photos = Array.from({ length: spec.slots }, (_, i) => ({ id: `photo-${i + 1}`, assetId: null, alt: '', caption: '', focalPoint: { x: .5, y: .5 } }));
  if (kind === 'swipe-album') Object.assign(props, { optional: true, autoplay: false });
  if (spec.clock) Object.assign(props, { eventAt: null, timeZone: 'Asia/Ho_Chi_Minh', optional: true, clockMode: 'countdown' });
  if (spec.prediction) Object.assign(props, emptyPrediction());
  return createElement('interaction', { props, layout: { x: 25, y: 80, width: spec.size[0], height: spec.size[1] },
    ...(spec.targets ? { actions: Array.from({ length: 2 }, () => ({ on: 'activate', type: 'goToScene', targetSceneId: null })) } : {}) });
}
export function makeLayer(type, localize) {
  if (type === 'interaction') return makeInteraction('flip-card');
  return createElement(type, { layout: { x: 25, y: 80, width: 300, height: type === 'text' ? 100 : type === 'line' ? 10 : 160 } }, localize);
}
export function makeItem(kind, rows, localize) {
  const id = `library-${kind}-${globalThis.crypto.randomUUID().slice(0, 8)}`, title = { vi: localize(`adminLibrary.new.${kind}`), en: '' };
  const definition = kind === 'animation' ? { ...animationDefaults('keyframes'), title }
    : kind === 'effect' ? { title, family: 'entrance', animationId: rows.find(r => r.kind === 'animation' && r.status === 'active' && compatibleAnimation(r, 'entrance'))?.id || 'E01',
      targets: { scenes: false, types: ['text','image','shape','sticker'] }, defaults: { speed: 'normal', delay: 0 } }
      : kind === 'preset' ? { title, documents: { vi: createDocument() } }
        : { title, group: { vi: localize('adminLibrary.group.default'), en: '' }, keywords: '', elements: [makeLayer('text', localize)] };
  return { kind, id, revision: 0, status: 'active', sortOrder: 10000, definition };
}
export function duplicateItem(item, rows, localize) {
  const result = structuredClone(item); result.kind = categoryFor(item.kind);
  result.id = `library-${result.kind}-${globalThis.crypto.randomUUID().slice(0, 8)}`; result.revision = 0; result.status = 'active';
  result.definition.title = { vi: localize('adminLibrary.copyName', { name: itemTitle(item, rows, 'vi') }).slice(0, 160), en: item.definition.title?.en || '' };
  return result;
}
export const compatibleAnimation = (row, family) => { try { validateAnimation(row.definition, family); return true; } catch { return false; } };
export function getDocument(item, locale = 'vi', ensure = false) {
  if (!['preset','template'].includes(item.kind)) return null;
  if (!item.definition.documents) {
    if (!ensure) return item.definition.document;
    item.definition.documents = { vi: item.definition.document }; delete item.definition.document;
  }
  if (ensure && !item.definition.documents[locale]) item.definition.documents[locale] = structuredClone(item.definition.documents.vi);
  return item.definition.documents[locale] || item.definition.documents.vi;
}
export function layers(item, locale = 'vi', sceneIndex = 0) {
  const doc = getDocument(item, locale);
  if (!doc) return item.definition.elements || [];
  const byId = new Map(doc.elements.map(e => [e.id, e]));
  return (doc.scenes[sceneIndex]?.elementIds || []).map(id => byId.get(id)).filter(Boolean);
}
export function normalizeSelection(item, locale, sceneIndex, layerIndex) {
  const doc = getDocument(item, locale);
  const scene = doc ? Math.max(0, Math.min(Number.isInteger(sceneIndex) ? sceneIndex : 0, doc.scenes.length - 1)) : 0;
  return { sceneIndex: scene, layerIndex: Math.max(0, Math.min(Number.isInteger(layerIndex) ? layerIndex : 0, layers(item, locale, scene).length - 1)) };
}
export const sameItemContent = (left, right) => Boolean(left && right && itemKey(left) === itemKey(right) &&
  canonicalStringify({ definition: left.definition, status: left.status, sortOrder: left.sortOrder }) ===
  canonicalStringify({ definition: right.definition, status: right.status, sortOrder: right.sortOrder }));
export function setPath(value, path, next) {
  const keys = path.split('.');
  if (keys.some(k => ['__proto__','prototype','constructor'].includes(k))) throw new Error('Invalid field path');
  let target = value;
  for (const key of keys.slice(0, -1)) { if (target[key] == null) target[key] = {}; target = target[key]; }
  if (next === undefined) delete target[keys.at(-1)]; else target[keys.at(-1)] = next;
}
export function metadata(item, key, locale, value) {
  if (typeof item.definition[key] !== 'object' || !item.definition[key]) item.definition[key] = { vi: item.definition[key] || '', en: '' };
  item.definition[key][locale] = value;
}
export function frameValue(frame, field) {
  if (field === 'opacity') return frame.opacity === undefined ? '' : frame.opacity * 100;
  if (field === 'offset') return frame.offset === undefined ? '' : frame.offset * 100;
  const fn = { x: 'translateX', y: 'translateY', scale: 'scale', rotate: 'rotate' }[field];
  return frame.transform?.match(new RegExp(fn + '\\((-?[\\d.]+)(?:px|deg)?\\)'))?.[1] || '';
}
export function editFrame(frame, field, value) {
  if (['opacity','offset'].includes(field)) { if (value === '') delete frame[field]; else frame[field] = Number(value) / 100; return; }
  const fn = { x: 'translateX', y: 'translateY', scale: 'scale', rotate: 'rotate' }[field];
  const source = frame.transform || '', pattern = new RegExp(fn + '\\([^)]*\\)');
  const replacement = value === '' ? '' : `${fn}(${Number(value)}${field === 'rotate' ? 'deg' : ['x','y'].includes(field) ? 'px' : ''})`;
  frame.transform = (pattern.test(source) ? source.replace(pattern, replacement) : [source, replacement].filter(Boolean).join(' ')).trim();
  if (!frame.transform) delete frame.transform;
}
export function dependencies(item, rows) {
  const contains = value => {
    if (!value || typeof value !== 'object') return false;
    if (item.kind === 'animation' && value.animationId === item.id) return true;
    if (item.kind === 'effect' && Object.entries(value.effects || {}).some(([family, effect]) => family === 'celebrations' ? effect[item.id]?.enabled : effect.id === item.id)) return true;
    return Object.values(value).some(contains);
  };
  return rows.filter(row => row.status === 'active' && itemKey(row) !== itemKey(item) && contains(row.definition));
}
export function removeScene(doc, index) {
  if (doc.scenes.length < 2) return;
  const scene = doc.scenes[index], ids = new Set(scene.elementIds);
  doc.elements = doc.elements.filter(e => !ids.has(e.id)); doc.scenes.splice(index, 1);
  if (doc.entrySceneId === scene.id) doc.entrySceneId = doc.scenes[0].id;
  for (const e of doc.elements) for (const a of e.actions || []) if (a.targetSceneId === scene.id) a.targetSceneId = null;
}
export const primitiveTypes = Object.keys(registry);
