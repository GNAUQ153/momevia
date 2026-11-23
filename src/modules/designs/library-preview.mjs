import { randomUUID } from 'node:crypto';
import { createElement, LIMITS } from '../../../web/js/shared/canvas/registry.js';
import { effectPreset } from '../../../web/js/shared/canvas/effects.js';
import { CORE_EFFECT_IDS } from '../../../web/js/shared/canvas/library-contract.js';
import { pinDocumentArtwork } from '../../../web/js/shared/canvas/library-materialize.js';
import { validateDocument } from '../../../web/js/shared/canvas/schema.js';
import { eventMediaId } from '../../../web/js/shared/canvas/event-media.js';
import { predictionFields } from '../../../web/js/shared/canvas/prediction.js';
import { serverText } from '../../shared/locale.mjs';

const copy = structuredClone;
export function activatePreviewDependencies(item, items) {
  const visited = new Set();
  function enable(kind, id) {
    const row = items.find(r => r.kind === kind && r.id === id), key = `${kind}:${id}`;
    if (!row || visited.has(key)) return;
    visited.add(key); row.status = 'active'; visit(row.definition);
  }
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.animationId === 'string') enable('animation', value.animationId);
    for (const [family, preset] of Object.entries(value.effects || {})) {
      if (family === 'celebrations') { for (const [id, settings] of Object.entries(preset)) if (settings.enabled) enable('effect', id); }
      else enable('effect', preset.id);
    }
    const props = value.props;
    if (props) {
      const key = value.type === 'sticker' ? props.stickerId : value.type === 'shape' ? props.kind : value.type === 'line' ? props.pattern : null;
      if (key) enable('artwork', `${value.type}-${key}`);
      if (value.type === 'image' && props.mask) enable('artwork', `mask-${props.mask}`);
    }
    for (const nested of Object.values(value)) visit(nested);
  }
  visit(item.definition);
}
function base(elements, localize) {
  return { schemaVersion: 2, registryVersion: 2,
    artboard: { baseSize: { width: 390, height: 844 }, layoutMode: 'responsive-scene', safeInsets: { top: 24, right: 20, bottom: 24, left: 20 } },
    entrySceneId: 'library-preview', bindings: Object.fromEntries(['recipientName','senderName','message'].map((key, i) => [key, { type: 'text', value: localize(`templates.preview.${['recipient','sender','greeting'][i]}`) }])),
    assets: [], elements, scenes: [{ id: 'library-preview', name: localize('adminLibrary.preview.title'), background: { kind: 'solid', color: '#F5EFFF' }, elementIds: elements.map(e => e.id) }],
    responsive: { textOverflow: 'expand-flow', sceneOverflow: 'scroll', desktop: { maxContentWidth: 720, align: 'center' } } };
}
function fit(elements) {
  const left = Math.min(...elements.map(e => e.layout.x)), top = Math.min(...elements.map(e => e.layout.y));
  const width = Math.max(...elements.map(e => e.layout.x + e.layout.width)) - left;
  const height = Math.max(...elements.map(e => e.layout.y + e.layout.height)) - top;
  const scale = Math.min(1, 340 / width, 620 / height);
  for (const e of elements) {
    e.layout = { ...e.layout, x: 25 + (340 - width * scale) / 2 + (e.layout.x - left) * scale,
      y: 80 + (e.layout.y - top) * scale, width: Math.max(1, e.layout.width * scale), height: Math.max(1, e.layout.height * scale) };
    if (e.props.fontSize) e.props.fontSize = Math.max(10, e.props.fontSize * scale);
  }
}
function sample(type, kind, items, localize) {
  const found = items.filter(r => r.kind === 'element' && r.status === 'active').flatMap(r => r.definition.elements)
    .find(e => e.type === type && (!kind || e.props.kind === kind));
  const model = found ? copy(found) : createElement(type, { props: type === 'text' ? { text: localize('adminLibrary.preview.sampleText'), fontSize: 34, align: 'center' } : {} });
  model.id = 'preview-subject'; delete model.effects;
  return model;
}
export function buildLibraryPreview(item, items, locale = 'vi', requestedFamily) {
  const localize = (key, params) => serverText(locale, key, params);
  let document, effectPreview, playSceneId, current = item;
  if (item.kind === 'animation') {
    const animation = item.definition;
    const family = animation.engine === 'builtin' ? Object.entries(CORE_EFFECT_IDS).find(([, ids]) => ids.includes(animation.builtinId))?.[0]
      : animation.engine === 'surface' ? 'surface' : animation.engine === 'particles' ? 'ambience'
        : ['entrance','emphasis','transition','reaction','ambience'].includes(requestedFamily) ? requestedFamily : 'entrance';
    const original = items.find(r => r.kind === 'effect' && r.definition.animationId === item.id) || (animation.engine === 'builtin' && items.find(r => r.kind === 'effect' &&
      items.find(a => a.kind === 'animation' && a.id === r.definition.animationId)?.definition.builtinId === animation.builtinId));
    const targets = animation.engine === 'builtin' && original ? original.definition.targets : { scenes: ['transition','ambience','surface'].includes(family), types: family === 'reaction' ? ['button'] : ['text','image','shape'] };
    current = { kind: 'effect', id: `preview-${randomUUID()}`, revision: 1, status: 'active', definition: { family, animationId: item.id, targets, title: item.definition.title || item.id, defaults: {} } };
    items.push(current);
  }
  if (current.kind === 'effect') {
    const d = current.definition, family = d.family;
    const selected = item.kind === 'animation' ? { id: current.id, definition: { id: current.id, revision: 1, family,
      title: current.definition.title, targets: current.definition.targets, animation: copy(item.definition) } } : effectPreset(current.id, family);
    const type = d.targets.scenes ? null : d.targets.types[0];
    const subject = sample(type || 'text', d.targets.kinds?.[0], items, localize);
    document = base([subject], localize); fit(document.elements);
    if (family === 'transition') {
      const next = copy(document.scenes[0]); next.id = 'preview-next'; next.elementIds = ['preview-ending'];
      const text = createElement('text', { id: 'preview-ending', props: { text: localize('adminLibrary.preview.sampleText'), fontSize: 32 }, layout: { x: 25, y: 140, width: 340, height: 180 } });
      document.elements.push(text); document.scenes.push(next); next.effects = { transition: selected }; playSceneId = next.id;
    } else if (type) { subject.effects = { [family]: selected }; effectPreview = { family, sceneId: document.entrySceneId, elementId: subject.id }; }
    else document.scenes[0].effects = { [family]: selected };
  } else if (item.kind === 'element') { document = base(copy(item.definition.elements), localize);document.assets=copy(item.definition.assets||[]);fit(document.elements); }
  else if (['preset','template'].includes(item.kind)) document = copy(item.definition.documents?.[locale] || item.definition.documents?.vi || item.definition.document);
  else throw Object.assign(new Error('Unsupported preview kind.'), { status: 422 });
  for (const [i, key] of ['recipientName','senderName','message'].entries())
    if (!document.bindings[key].value) document.bindings[key].value = localize(`templates.preview.${['recipient','sender','greeting'][i]}`);
  const endings = [];
  for (const e of document.elements) {
    if (e.type === 'image' && !e.props.assetId) {
      const id = eventMediaId('birthday'); e.props.assetId = id;
      if (!document.assets.some(a => a.assetId === id)) document.assets.push({ assetId: id, kind: 'image' });
    }
    if (e.type === 'interaction' && e.props.kind === 'prediction-choice') {
      for (const key of Object.keys(predictionFields)) if (!e.props[key]) e.props[key] = localize(`prediction.sample.${key}`);
      e.props.prediction ||= 'A';
    }
    if (e.type === 'interaction' && e.props.kind === 'event-countdown' && !e.props.eventAt) e.props.eventAt = '2030-01-01T00:00:00.000Z';
    for (const [index, action] of (e.actions || []).entries()) if (action.type === 'goToScene' && action.targetSceneId === null) {
      if (endings[index]) { action.targetSceneId = endings[index]; continue; }
      if (document.scenes.length >= LIMITS.scenes) { action.targetSceneId = document.scenes.at(-1).id; continue; }
      const id = `preview-target-${document.scenes.length}`, endingId = `${id}-text`;
      document.scenes.push({ id, name: localize('adminLibrary.preview.nextScene'), background: { kind: 'solid', color: '#FFF1F4' }, elementIds: [endingId] });
      document.elements.push(createElement('text', { id: endingId, props: { text: localize('adminLibrary.preview.sampleText') } })); action.targetSceneId = id; endings[index] = id;
    }
  }
  document = validateDocument(pinDocumentArtwork(document));
  return { document, ...(effectPreview ? { effectPreview } : {}), ...(playSceneId ? { playSceneId } : {}) };
}
