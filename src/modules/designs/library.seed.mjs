import { stickerVector } from '../../../web/js/shared/canvas/sticker-style.js';
import { eventRecipes } from '../../../web/js/shared/canvas/event-recipes.js';
import { registry } from '../../../web/js/shared/canvas/registry.js';
import { catalog } from '../../../web/js/features/canvas-editor/library.js';
import { effectFamilies, effectsFor } from '../../../web/js/shared/canvas/effects.js';
import { createDocument, PRESETS } from '../../../web/js/shared/canvas/presets.js';
import { stickerArt, shapes, lines, masks } from '../../../web/js/shared/canvas/artwork.js';
import { installLibrary, librarySnapshot } from '../../../web/js/shared/canvas/library-state.js';
import { pinDocumentArtwork } from '../../../web/js/shared/canvas/library-materialize.js';
import { templates } from '../catalog/seed.mjs';
import { serverText } from '../../shared/locale.mjs';

let cached;
export function builtinLibraryItems() {
  if (cached) return structuredClone(cached);
  const before = librarySnapshot();
  const items = [], add = (kind, id, definition) => items.push({ kind, id, revision: id==='natural-motion-heart'?2:1, status: 'active', sortOrder: items.length, definition });
  const words = key => ({ vi: serverText('vi', key), en: serverText('en', key) });
  try {
    installLibrary(null);
    for (const [type, spec] of Object.entries(registry)) add('element_type', type, {
      title: words(`editor.element.${type}`), renderer: type,
      defaults: Object.fromEntries(Object.entries(spec.defaults).filter(([key]) => !['text','label','title','submitLabel'].includes(key))),
      accessibility: Object.fromEntries(Object.entries(spec.accessibility).filter(([key]) => !['alt','label'].includes(key))),
    });
    for (const [key, parts] of Object.entries(stickerArt)) add('artwork', `sticker-${key}`, {
      title: words(`editor.library.item.${key}`), target: 'sticker', key, vector: stickerVector(key, parts),
    });
    for (const [target, values] of [['shape', shapes], ['line', lines], ['mask', masks]]) for (const [key, d] of Object.entries(values))
      add('artwork', `${target}-${key}`, { target, key, vector: { paths: [{ d, fill: target === 'line' ? 'none' : 'color',
        ...(target !== 'mask' ? { stroke: target === 'line' ? 'color' : 'strokeColor', strokeWidth: 'strokeWidth' } : {}),
        ...(key === 'stitched' ? { dash: '8 8' } : {}) }] } });
    for (const [family, group] of Object.entries(effectFamilies)) for (const id of Object.keys(group.presets)) {
      add('animation', id, { engine: 'builtin', builtinId: id });
      const types = Object.keys(registry).filter(type => effectsFor(family, { type, props: { kind: 'flip-card' } }, { builtin: true }).some(([key]) => key === id));
      if (id === 'R04') types.push('interaction');
      add('effect', id, { title: words(`editor.effects.preset.${id}`), family, animationId: id,
        targets: { scenes: ['surface','transition','ambience'].includes(family) && effectsFor(family, null, { builtin: true }).some(([key]) => key === id),
          types: ['transition','ambience'].includes(family) ? [] : types,
          ...(id === 'R04' ? { kinds: ['light-a-candle'] } : {}), ...(id === 'R03' ? { excludeKinds: ['event-countdown','photo-comparison'] } : {}) },
        defaults: { ...(family !== 'surface' ? { speed: 'normal' } : {}), ...(family === 'entrance' ? { delay: 0 } : {}), ...(family === 'ambience' ? { density: 'normal' } : {}) },
      });
    }
    for (const {id,animation,...definition} of eventRecipes) {
      add('animation', id, animation);
      add('effect', id, {...definition, animationId:id});
    }
    // Capture the complete compositions, not names pointing back to JS factories.
    for (const [index, group] of catalog.entries()) for (const card of group.items){
      const elements=card.create();
      if(card.titleTexts||card.id==='natural-motion-heart'){
        const ids=new Map(elements.map((e,i)=>[e.id,card.id+'-subject'+(i?'-'+i:'')]));
        for(const e of elements){e.id=ids.get(e.id);if(e.groupId)e.groupId=ids.get(e.groupId);}
      }
      const assets=[...new Set(elements.filter(e=>e.type==='image'&&e.props.assetId).map(e=>e.props.assetId))].map(assetId=>({assetId,kind:'image'}));
      add('element',card.id,{title:card.titleTexts||words(`editor.library.item.${card.id}`),group:group.titleTexts||words(`editor.library.group.${index}`),keywords:card.keywords||'',elements,...(assets.length?{assets}:{}),...(card.visualKind?{visualKind:card.visualKind}:{})});
    }
    // Pin path data into the DB documents; old source definitions remain solely
    // as migration/bootstrap input and backwards-compatible renderer contracts.
    installLibrary({ items });
    const documents = options => Object.fromEntries(['vi','en'].map(locale => [locale,
      pinDocumentArtwork(createDocument({ ...options, localize: (key, params) => serverText(locale, key, params) }))]));
    for (const p of PRESETS) add('preset', p.id, { title: words(p.labelKey), documents: documents({ presetId: p.id }) });
    for (const t of templates) add('template', t.id, { title: { vi: t.title, en: serverText('en', `templates.${t.id}.title`) }, documents: documents({ template: t }) });
    cached = structuredClone(items);
    return structuredClone(items);
  } finally { installLibrary(before); }
}
