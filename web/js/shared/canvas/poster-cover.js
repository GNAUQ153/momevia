import { createElement } from './registry.js';

// Short cover editions use the actual entry-scene layers, including Admin artwork
// and wording. This document is for rendering only. The editable portrait stays intact.
const photoCovers = new Set([
  'birthday-radiance', 'proud-of-you', 'loi-moi-ben-hien',
  'cuon-phim-ngay-ay', 'ban-do-ngay-ra-truong',
]);
const letterCovers = new Set(['club-22-invitation', 'cozy-christmas-invitation', 'tet-phong-thu']);

function fitLayers(layers, reference, box) {
  const scale = Math.min(box.width / reference.width, box.height / reference.height);
  const x = box.x + (box.width - reference.width * scale) / 2;
  const y = box.y + (box.height - reference.height * scale) / 2;
  for (const layer of layers) {
    const layout = layer.layout;
    Object.assign(layout, {
      x: x + (layout.x - reference.x) * scale,
      y: y + (layout.y - reference.y) * scale,
      width: Math.max(1, layout.width * scale),
      height: Math.max(1, layout.height * scale),
    });
  }
}

export function posterCover(document, variant, id) {
  if (!photoCovers.has(id) && !letterCovers.has(id) && id !== 'hai-phong-bi' && id !== 'to-doan-cau-se-chon' && id !== 'garden-tea') return document;
  if (id === 'garden-tea' && variant !== 'portrait') {
    const doc = structuredClone(document), height = variant === 'seasonal' ? 466 : 330;
    const scale = height / doc.artboard.baseSize.height;
    for (const e of doc.elements) {
      e.layout.y *= scale; e.layout.height = Math.max(1, e.layout.height * scale);
      if (e.type === 'text') e.props.fontSize = Math.max(10, e.props.fontSize * Math.sqrt(scale));
    }
    doc.artboard.baseSize.height = height;
    return doc;
  }
  const seasonal = variant === 'seasonal';
  const height = seasonal ? 466 : 330;
  const doc = structuredClone(document);
  const scene = doc.scenes.find(item => item.id === doc.entrySceneId);
  const byId = new Map(doc.elements.map(layer => [layer.id, layer]));
  const layers = scene.elementIds.map(key => byId.get(key)).filter(layer => layer && layer.visible !== false);
  const keep = new Set();
  const rect = (x, y, width, h) => ({ x, y, width, height: h });
  const place = (layer, box) => {
    if (!layer) return;
    Object.assign(layer.layout, box);
    keep.add(layer.id);
  };
  const placeGroup = (items, anchor, box) => {
    if (!anchor || !items.length) return;
    fitLayers(items, { ...anchor.layout }, box);
    items.forEach(layer => keep.add(layer.id));
  };
  const title = layers.find(layer => layer.id === 'cover-title') ??
    layers.find(layer => layer.type === 'text' && layer.accessibility?.role === 'heading');
  const kicker = seasonal && layers.find(layer => layer.id === 'cover-kicker' || layer.id === 'cover-brand');
  if (kicker) {
    place(kicker, rect(16, 18, 358, 25));
    Object.assign(kicker.props, { fontSize: 15, align: 'center' });
  }
  if (title) {
    place(title, rect(24, kicker ? 48 : 16, 342, seasonal ? 94 : 78));
    Object.assign(title.props, { align: 'center', fontSize: seasonal ? 34 : 30, lineHeight: 1.08 });
  }
  const top = seasonal ? 141 : 97;
  const artBox = rect(14, top, 362, height - top - 14);

  if (photoCovers.has(id)) {
    const photo = layers.find(layer => layer.type === 'image');
    if (photo) {
      const art = layers.filter(layer => layer === photo ||
        /^(graduation-paper-|graduation-tassel$|cover-route-|cover-marker-)/.test(layer.id));
      placeGroup(art, photo, artBox);
    }
  } else if (id === 'hai-phong-bi') {
    const rings = layers.filter(layer => /^ring-(one|two)$/.test(layer.id));
    for (const [i, ring] of rings.entries()) place(ring, rect(164 + 27 * i, top, 40, 40));
    for (const [i, suffix] of ['memory', 'wish'].entries()) {
      const photo = layers.find(layer => layer.id === 'event-photo-wedding-' + suffix);
      const action = layers.find(layer => layer.id === 'open-' + suffix);
      const x = 10 + i * 191;
      if (photo) placeGroup([photo], photo, rect(x, top + 48, 179, artBox.height - 100));
      if (action) {
        // A cover communicates the two choices without copying their navigation
        // actions or the envelope's portrait-sized photo overlay.
        const caption = createElement('text', { id: action.id, props: {
          text: action.props.label, color: action.props.color, fontSize: 20, fontToken: 'body', align: 'center', lineHeight: 1.1,
        } });
        byId.set(caption.id, caption);
        place(caption, rect(x + 4, top + artBox.height - 48, 171, 46));
      }
    }
  } else if (letterCovers.has(id)) {
    const envelope = layers.filter(layer => layer.id.startsWith('envelope-') || layer.id === 'seal-mark');
    const paper = envelope.find(layer => layer.id === 'envelope-paper');
    placeGroup(envelope, paper, rect(38, top + 10, 314, artBox.height - 46));
    for (const border of layers.filter(layer => /-(outer|inner)-border$/.test(layer.id))) {
      const pad = border.id.endsWith('outer-border') ? 8 : 14;
      place(border, rect(pad, pad, 390 - 2 * pad, height - 2 * pad));
    }
    for (const [left, right] of [['cover-star','cover-flower'],['cover-tea','cover-tree']]) {
      place(layers.find(layer => layer.id === left), rect(19, height - 45, 28, 28));
      place(layers.find(layer => layer.id === right), rect(343, height - 45, 28, 28));
    }
    const bow = layers.find(layer => layer.id === 'cover-bow');
    if (bow) {
      placeGroup(layers.filter(layer => layer === bow || layer.id.startsWith('cover-gingham-')),
        bow, rect(166, height - 49, 58, 38));
    }
    if (id === 'tet-phong-thu') {
      for (const [i, side] of ['left', 'right'].entries()) {
        const sprig = layers.filter(layer => layer.id === 'cover-branch-' + side ||
          (/^cover-flower-(heart-)?[0-5]$/.test(layer.id) && (Number(layer.id.slice(-1)) < 3) === (i === 0)));
        if (!sprig.length) continue;
        const x = Math.min(...sprig.map(layer => layer.layout.x));
        const y = Math.min(...sprig.map(layer => layer.layout.y));
        const right = Math.max(...sprig.map(layer => layer.layout.x + layer.layout.width));
        const bottom = Math.max(...sprig.map(layer => layer.layout.y + layer.layout.height));
        fitLayers(sprig, rect(x, y, right - x, bottom - y), rect(i ? 279 : 14, height - 49, 97, 36));
        sprig.forEach(layer => keep.add(layer.id));
      }
    }
  } else {
    const choices = layers.find(layer => layer.type === 'interaction' && layer.props.kind === 'prediction-choice');
    place(choices, rect(18, top, 354, height - top - 14));
  }
  // A customized entry scene may no longer have these original layer IDs.
  // Keep its authored composition rather than substituting unrelated built-in art.
  if (![...keep].some(key => key !== title?.id && key !== kicker?.id)) return document;
  scene.elementIds = scene.elementIds.filter(key => keep.has(key));
  doc.scenes = [scene];
  // The short poster contains no RSVP flow or editable invitation slots.
  delete doc.invitation;
  doc.elements = scene.elementIds.map(key => {
    const layer = byId.get(key);
    delete layer.actions;
    return layer;
  });
  doc.artboard.baseSize = { width: 390, height };
  return doc;
}
