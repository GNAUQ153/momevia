import { libraryEntry, librarySnapshot } from './library-state.js';
import { requiresCanvasV2 } from './schema.js';
import { effectPreset } from './effects.js';
import { usesSound } from './sound.js';
import { usesMotions } from './motion-stack.js';
import {addObjectAssets} from './natural-objects.js';

function pinEffect(preset, family) {
  const row = librarySnapshot()?.items.find(item => item.kind === 'effect' && item.id === preset.id);
  if (row?.status === 'disabled') throw Object.assign(new Error(`Active library composition references disabled effect ${preset.id}.`), { status: 422, code: 'INVALID_LIBRARY_DEFINITION' });
  if (!row) return preset;
  const current = effectPreset(preset.id, family);
  return { ...current, ...preset, definition: current.definition };
}

export function pinArtwork(models) {
  for (const e of models) {
    for (const [family, preset] of Object.entries(e.effects || {})) e.effects[family] = pinEffect(preset, family);
    const key = e.type === 'sticker' ? e.props.stickerId : e.type === 'shape' ? e.props.kind : e.type === 'line' ? e.props.pattern : null;
    const art = key && libraryEntry('artwork', `${e.type}-${key}`);
    // Authored compositions carry their own frozen paths. Explicitly changing
    // the shape/sticker calls refreshElementArtwork and removes that override.
    if (art && !e.artwork) e.artwork = structuredClone(art.definition.vector);
    const mask = e.type === 'image' && e.props.mask && libraryEntry('artwork', `mask-${e.props.mask}`);
    if (mask) e.props.maskPath = mask.definition.vector.paths[0].d;
  }
  return models;
}
export function materializeModels(source) {
  const models = pinArtwork(structuredClone(source));
  const ids = new Map(models.map(e => [e.id, globalThis.crypto.randomUUID()]));
  for (const e of models) {
    e.id = ids.get(e.id);
    if (e.groupId) e.groupId = ids.get(e.groupId);
    for (const action of e.actions || []) if (action.targetSceneId && ids.has(action.targetSceneId)) action.targetSceneId = ids.get(action.targetSceneId);
  }
  return models;
}
export function refreshElementArtwork(model) {
  delete model.artwork;
  if (model.type === 'image') delete model.props.maskPath;
  pinArtwork([model]);
}
export function pinDocumentArtwork(document) {
  addObjectAssets(document);
  pinArtwork(document.elements);
  for (const scene of document.scenes) for (const [family, preset] of Object.entries(scene.effects || {})) {
    if (family === 'celebrations') {
      for (const [id, settings] of Object.entries(preset)) if (settings.enabled) {
        const selected = pinEffect({ id, ...settings }, 'ambience');
        if (selected.definition) settings.definition = selected.definition;
      }
    } else scene.effects[family] = pinEffect(preset, family);
  }
  if (usesMotions(document)) document.schemaVersion = document.registryVersion = 4;
  else if ((usesSound(document)||document.assets.some(a=>a.kind==='video')) && document.schemaVersion < 3) document.schemaVersion = document.registryVersion = 3;
  else if (requiresCanvasV2(document) && document.schemaVersion < 2) document.schemaVersion = document.registryVersion = 2;
  return document;
}
