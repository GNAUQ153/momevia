import { t, message } from '../../core/i18n.js';
import { node } from '../canvas-editor/dom.js';
import { registry, STICKERS } from '../../shared/canvas/registry.js';
import { shapes, masks, lines } from '../../shared/canvas/artwork.js';
import { CORE_EFFECT_IDS } from '../../shared/canvas/library-contract.js';
import { interactionKinds, localEventTime } from '../../shared/canvas/interactions.js';
import { predictionFields } from '../../shared/canvas/prediction.js';
import { libraryText } from '../../shared/canvas/library-state.js';
import { getDocument, layers, frameValue, compatibleAnimation, itemTitle, primitiveTypes, dependencies } from './model.js';

const label = key => message(key.startsWith('adminLibrary.') || key.startsWith('editor.') ? key : `adminLibrary.${key}`);
const action = (key, name, attrs = {}) => node('button', { type: 'button', class: 'library-admin__small-button', 'data-library-action': name, ...attrs }, label(key));
function field(key, control, help) { return node('label', { class: 'library-admin__field' }, node('span', {}, label(key)), control, help ? node('small', {}, label(help)) : null); }
function input(key, value, path, attrs = {}) {
  const control = node(attrs.multiline ? 'textarea' : 'input', { type: 'text', 'data-path': path, 'data-field': path, ...attrs });
  delete control.dataset.multiline; control.value = value ?? '';
  return field(key, control);
}
function choose(key, value, path, options, attrs = {}) {
  const control = node('select', { 'data-path': path, 'data-field': path, ...attrs },
    ...options.map(([id, title, disabled]) => node('option', { value: id, disabled }, title)));
  control.value = value ?? ''; return field(key, control);
}
const number = (key, value, path, min, max, attrs = {}) => input(key, value, path, { type: 'number', min, max, step: 'any', ...attrs });
function check(key, checked, attrs = {}) { return node('label', { class: 'library-admin__check' }, node('input', { type: 'checkbox', checked, ...attrs }), node('span', {}, label(key))); }
const section = (key, ...children) => node('fieldset', { class: 'library-admin__section' }, node('legend', {}, label(key)), ...children);
const grid = (...children) => node('div', { class: 'library-admin__fields' }, ...children);
const local = (item, key, locale) => typeof item.definition[key] === 'string' ? item.definition[key] : item.definition[key]?.[locale] || '';
const metaInput = (key, value, meta, locale, attrs = {}) => input(key, value, '', { 'data-meta': meta, 'data-meta-locale': locale, 'data-field': `${meta}.${locale}`, maxlength: 160, ...attrs });

export function libraryFields(item, rows, { locale = 'vi', sceneIndex = 0, layerIndex = 0, addType = 'text' } = {}) {
  const d = item.definition;
  const common = section('section.details',
    grid(metaInput('nameVi', local(item, 'title', 'vi') || itemTitle(item, rows, 'vi'), 'title', 'vi', { required: true }), metaInput('nameEn', local(item, 'title', 'en'), 'title', 'en')),
    choose('status.label', item.status, 'status', [['active', t('adminLibrary.status.active')], ['disabled', t('adminLibrary.status.disabled')]]),
    node('details', { class: 'library-admin__advanced' }, node('summary', {}, message('adminLibrary.advanced')),
      grid(input('itemId', item.id, 'id', { readonly: item.revision > 0, required: true, pattern: '[A-Za-z0-9_-]{1,128}', maxlength: 128 }),
        number('sortOrder', item.sortOrder, 'sortOrder', -2147483648, 2147483647, { step: 1, required: true }))));
  const used = dependencies(item, rows);
  const dependency = used.length ? node('details', { class: 'library-admin__dependencies' }, node('summary', {}, message('adminLibrary.dependencies', { count: used.length })),
    node('ul', {}, ...used.map(row => node('li', {}, itemTitle(row, rows))))) : null;
  const output = [common, dependency];
  if (item.kind === 'animation') output.push(animationFields(item));
  if (item.kind === 'effect') output.push(effectFields(item, rows));
  if (item.kind === 'element') output.push(node('details', { class: 'library-admin__advanced' }, node('summary', {}, message('adminLibrary.section.group')),
    grid(metaInput('groupVi', local(item, 'group', 'vi'), 'group', 'vi', { required: true }), metaInput('groupEn', local(item, 'group', 'en'), 'group', 'en')),
    input('keywords', libraryText(d.keywords), 'definition.keywords', { maxlength: 4000 })));
  if (['element','preset','template'].includes(item.kind)) output.push(...compositionFields(item, rows, { locale, sceneIndex, layerIndex, addType }));
  return output.filter(Boolean);
}

function animationFields(item) {
  const d = item.definition, prefix = 'definition.';
  const fields = [choose('animation.engine', d.engine, prefix + 'engine', ['builtin','keyframes','surface','particles'].map(id => [id, t(`adminLibrary.engine.${id}`)]), { 'data-operation': 'engine' })];
  if (d.engine === 'builtin') fields.push(choose('animation.builtin', d.builtinId, prefix + 'builtinId', Object.values(CORE_EFFECT_IDS).flat().map(id => [id, t(`editor.effects.preset.${id}`)])));
  if (['builtin','keyframes','particles'].includes(d.engine)) fields.push(grid(number('animation.duration', d.duration, prefix + 'duration', 100, 10000, { 'data-optional': 'true' }),
    ...(d.engine === 'keyframes' ? [choose('animation.easing', d.easing || 'ease-out', prefix + 'easing', ['linear','ease','ease-in','ease-out','ease-in-out'].map(id => [id, t(`adminLibrary.easing.${id}`)])),
      number('animation.iterations', d.iterations || 1, prefix + 'iterations', 1, 5, { step: 1 }),choose('animation.composite',d.composite || 'replace',prefix+'composite',[['replace',t('adminLibrary.composite.replace')],['add',t('adminLibrary.composite.add')]])] : [])));
  if (d.engine === 'keyframes') fields.push(node('div', { class: 'library-admin__keyframes' },
    node('p', { class: 'library-admin__help' }, message('adminLibrary.animation.frameHelp')),
    ...(d.keyframes || []).map((frame, index) => node('section', { class: 'library-admin__keyframe' },
      node('div', { class: 'library-admin__row-heading' }, node('strong', {}, message('adminLibrary.animation.frame', { number: index + 1 })),
        action('remove', 'remove-frame', { 'data-index': index, disabled: d.keyframes.length <= 2 })),
      grid(...['offset','opacity','x','y','scale','rotate'].map(name => number(`animation.frame.${name}`, frameValue(frame, name), '',
        ['offset','opacity','scale'].includes(name) ? 0 : -1000, ['offset','opacity'].includes(name) ? 100 : name === 'scale' ? 10 : 1000,
        { step: 'any', 'data-frame': index, 'data-frame-field': name, 'data-field': `frame.${index}.${name}` }))))),
    action('animation.addFrame', 'add-frame', { disabled: d.keyframes.length >= 16 })));
  if (d.engine === 'surface') fields.push(grid(...['color','backgroundColor','borderColor','shadowColor'].map(key => input(`style.${key}`, d.styles?.[key], prefix + 'styles.' + key,
    { placeholder: '#RRGGBB', pattern: '#[0-9a-fA-F]{6}', 'data-optional': 'true' })),
  ...['borderWidth','borderRadius','shadowBlur','blur'].map(key => number(`style.${key}`, d.styles?.[key], prefix + 'styles.' + key, 0, key==='blur'?32:128, { 'data-optional': 'true' })),
  ...['shadowX','shadowY'].map(key=>number(`style.${key}`,d.styles?.[key],prefix+'styles.'+key,-64,64,{'data-optional':'true'})),
  number('style.shadowOpacity',d.styles?.shadowOpacity,prefix+'styles.shadowOpacity',0,1,{step:.01,'data-optional':'true'}),
  choose('style.shadowMode',d.styles?.shadowMode||'box',prefix+'styles.shadowMode',[['box',t('adminLibrary.shadow.box')],['alpha',t('adminLibrary.shadow.alpha')]]),
  choose('style.texture',d.styles?.texture||'',prefix+'styles.texture',[['',t('adminLibrary.texture.none')],['paper-grain-v1',t('adminLibrary.texture.paper')]],{'data-optional':'true'})));
  if (d.engine === 'particles') fields.push(input('animation.glyphs', d.glyphs?.join(' '), '', { 'data-operation': 'glyphs', 'data-field': 'glyphs', maxlength: 80, required: true }),
    input('animation.colors', d.colors?.join(', '), '', { 'data-operation': 'colors', 'data-field': 'particle-colors', maxlength: 80, required: true }),
    grid(number('animation.count', d.count, prefix + 'count', 1, 24, { step: 1, required: true }), number('animation.drift', d.drift, prefix + 'drift', -300, 300, { 'data-optional': 'true' })));
  return section('section.animation', ...fields);
}

function effectFields(item, rows) {
  const d = item.definition, family = d.family;
  const animations = rows.filter(r => r.kind === 'animation' && (r.status === 'active' || r.id === d.animationId) && compatibleAnimation(r, family));
  const fields = [grid(choose('effect.family', family, 'definition.family', Object.keys(CORE_EFFECT_IDS).map(id => [id, t(`editor.effects.family.${id}`)]), { 'data-operation': 'family' }),
    choose('effect.animation', d.animationId, 'definition.animationId', animations.map(row => [row.id, itemTitle(row, rows), row.status !== 'active']), { required: true })),
  node('div', { class: 'library-admin__checks' },
    ...(['surface','transition','ambience'].includes(family) ? [check('effect.scenes', d.targets.scenes, { 'data-path': 'definition.targets.scenes', 'data-field': 'effect.scenes' })] : []),
    ...(!['transition','ambience'].includes(family) ? primitiveTypes.map(type => check(`editor.element.${type}`, d.targets.types?.includes(type), {
      'data-toggle': 'definition.targets.types', value: type, 'data-field': `target.${type}` })) : []))];
  if (d.targets.types?.includes('interaction')) fields.push(node('details', {}, node('summary', {}, message('adminLibrary.effect.interactions')),
    node('p', { class: 'library-admin__help' }, message('adminLibrary.effect.allKinds')),
    ...['kinds','excludeKinds'].map(key => section(`effect.${key}`, node('div', { class: 'library-admin__checks' }, ...Object.keys(interactionKinds).map(kind => check(`interactionKind.${kind}`, d.targets[key]?.includes(kind), {
      'data-toggle': `definition.targets.${key}`, value: kind, 'data-field': `target.${key}.${kind}` })))))));
  if (family === 'surface') fields.push(input('effect.color', d.defaults?.color, 'definition.defaults.color', { placeholder: '#RRGGBB', pattern: '#[0-9a-fA-F]{6}', 'data-optional': 'true' }));
  else fields.push(choose('effect.speed', d.defaults?.speed || 'normal', 'definition.defaults.speed', ['slow','normal','fast'].map(id => [id, t(`editor.interface.${id}`)])));
  if (family === 'entrance') fields.push(choose('effect.delay', d.defaults?.delay || 0, 'definition.defaults.delay', [[0,t('adminLibrary.effect.immediate')],[150,'150 ms'],[300,'300 ms']], { 'data-number': 'true' }));
  if (family === 'ambience') fields.push(choose('effect.density', d.defaults?.density || 'normal', 'definition.defaults.density', [['sparse',t('editor.interface.sparse')],['normal',t('editor.interface.normal')]]));
  if (animations.find(r => r.id === d.animationId)?.definition.engine === 'particles') fields.push(check('effect.loop', d.defaults?.loop, { 'data-path': 'definition.defaults.loop' }));
  return section('section.effect', ...fields);
}

function compositionFields(item, rows, { locale, sceneIndex, layerIndex, addType }) {
  const doc = getDocument(item, locale), currentScene = doc?.scenes[sceneIndex] || doc?.scenes[0];
  const list = layers(item, locale, sceneIndex), selected = list[layerIndex] || list[0];
  const root = doc ? `definition.documents.${locale}` : 'definition';
  const out = [];
  if (doc) out.push(section('section.scenes',
    choose('contentLocale', locale, '', [['vi', t('adminLibrary.locale.vi')],['en', t('adminLibrary.locale.en')]], { 'data-operation': 'content-locale', 'data-field': 'content-locale' }),
    grid(number('canvas.width', doc.artboard.baseSize.width, root + '.artboard.baseSize.width', 240, 4096, { required: true }), number('canvas.height', doc.artboard.baseSize.height, root + '.artboard.baseSize.height', 240, 4096, { required: true })),
    choose('scene.current', currentScene?.id, '', doc.scenes.map(s => [s.id, s.name]), { 'data-operation': 'scene-select', 'data-field': 'scene-select' }),
    choose('scene.entry', doc.entrySceneId, root + '.entrySceneId', doc.scenes.map(s => [s.id, s.name])),
    currentScene ? grid(input('scene.name', currentScene.name, `${root}.scenes.${sceneIndex}.name`, { required: true, maxlength: 100 }),
      input('scene.color', currentScene.background.color, `${root}.scenes.${sceneIndex}.background.color`, { type: 'color' })) : null,
    node('div', { class: 'library-admin__inline-actions' }, action('scene.add', 'add-scene', { disabled: doc.scenes.length >= 32 }), action('scene.remove', 'remove-scene', { disabled: doc.scenes.length <= 1 }))));
  out.push(section('section.layers',
    choose('layer.current', selected?.id, '', list.map((e, index) => [e.id, e.name || `${t(`editor.element.${e.type}`)} ${index + 1}`]), { 'data-operation': 'layer-select', 'data-field': 'layer-select' }),
    node('div', { class: 'library-admin__inline-actions' },
      choose('layer.addType', addType, '', primitiveTypes.map(type => [type,t(`editor.element.${type}`)]), { 'data-operation': 'add-type', 'data-field': 'add-type' }), action('layer.add', 'add-layer'),
      action('layer.up', 'layer-up', { disabled: layerIndex <= 0 }), action('layer.down', 'layer-down', { disabled: layerIndex >= list.length - 1 }), action('layer.remove', 'remove-layer', { disabled: !selected || !doc && list.length <= 1 }))));
  if (!selected) return out;
  const index = doc ? doc.elements.findIndex(e => e.id === selected.id) : item.definition.elements.indexOf(selected);
  const path = `${root}.elements.${index}`, e = selected;
  out.push(section('section.layer', input('layer.name', e.name || '', path + '.name', { maxlength: 100 }),
    ...layerProperties(e, path, rows, doc),
    node('details', { class: 'library-admin__advanced' }, node('summary', {}, message('adminLibrary.layoutMore')),
    grid(...['x','y','width','height','rotation'].map(key => number(`layout.${key}`, e.layout[key], `${path}.layout.${key}`, ['width','height'].includes(key) ? 1 : key === 'rotation' ? -360 : -10000, key === 'rotation' ? 360 : 10000, { required: true }))),
    node('div', { class: 'library-admin__checks' }, check('layer.visible', e.visible !== false, { 'data-path': path + '.visible' }), check('layer.locked', e.locked === true, { 'data-path': path + '.locked' })),
    number('layer.opacity', (e.opacity ?? 1) * 100, '', 0, 100, { 'data-operation': 'opacity', 'data-field': 'layer-opacity' }))));
  return out;
}

function layerProperties(e, path, rows, doc) {
  const p = e.props, at = key => `${path}.props.${key}`, output = [];
  const artOptions = target => rows.filter(row => row.kind === 'artwork' && row.status === 'active' && row.definition.target === target).map(row => [row.definition.key, libraryText(row.definition.title) || row.definition.key]);
  if (e.type === 'text') output.push(choose('text.binding', p.textBinding || '', '', [['',t('adminLibrary.text.literal')],...['recipientName','senderName','message'].map(id => [id,t(`catalog.personalization.${id}`)])], { 'data-operation': 'binding', 'data-field': 'text-binding' }),
    ...(!p.textBinding ? [input('text.content', p.text, at('text'), { multiline: true, rows: 4, maxlength: 4000 })] : []),
    grid(choose('text.font', p.fontToken || 'body', at('fontToken'), ['body','heading','serif'].map(id => [id,t(`adminLibrary.font.${id}`)])), number('text.size', p.fontSize || 24, at('fontSize'), 10, 160),
      choose('text.align', p.align || 'left', at('align'), ['left','center','right'].map(id => [id,t(`adminLibrary.align.${id}`)]))));
  if (e.type === 'interaction') {
    output.push(choose('interaction.kind', p.kind, '', Object.keys(interactionKinds).map(id => [id,t(`adminLibrary.interactionKind.${id}`)]), { 'data-operation': 'interaction', 'data-field': 'interaction-kind' }));
    for (const [i, entry] of (p.entries || []).entries()) output.push(input('interaction.heading', entry.heading, at(`entries.${i}.heading`), { maxlength: 120 }),
      ...('body' in entry ? [input('interaction.body', entry.body, at(`entries.${i}.body`), { multiline: true, rows: 3, maxlength: 4000 })] : []));
    for (const [i, photo] of (p.photos || []).entries()) output.push(input('image.alt', photo.alt, at(`photos.${i}.alt`), { maxlength: 240 }), input('image.caption', photo.caption, at(`photos.${i}.caption`), { maxlength: 4000 }));
    if (interactionKinds[p.kind].prediction) {
      for (const [key, max] of Object.entries(predictionFields)) output.push(input(`prediction.${key}`, p[key], at(key), { multiline: max > 500, rows: 3, maxlength: max }));
      output.push(choose('prediction.prediction', p.prediction, at('prediction'), [['',t('adminLibrary.prediction.unset')],['A',t('adminLibrary.prediction.A')],['B',t('adminLibrary.prediction.B')]], { 'data-null': 'true' }));
    }
    if (interactionKinds[p.kind].clock) {
      let time = ''; try { if (p.eventAt) time = localEventTime(p.eventAt, p.timeZone); } catch { /* editable invalid draft */ }
      output.push(input('interaction.time', time, '', { type: 'datetime-local', 'data-operation': 'event-time', 'data-field': 'event-time' }), input('interaction.zone', p.timeZone, at('timeZone')));
    }
  }
  if (e.type === 'shape') output.push(choose('shape.kind', p.kind, at('kind'), [...new Map([['rectangle',t('editor.interface.shapeRectangle')],['ellipse',t('editor.interface.shapeEllipse')],['line',t('editor.interface.shapeLine')],...Object.keys(shapes).map(id => [id,id]),...artOptions('shape')])], { 'data-structural': 'true' }));
  if (e.type === 'sticker') output.push(choose('sticker', p.stickerId, at('stickerId'), [...new Map([...Object.keys(STICKERS).map(id => [id,id]),...artOptions('sticker')])], { 'data-structural': 'true' }));
  if (e.type === 'line') output.push(choose('line.pattern', p.pattern || '', at('pattern'), [['',t('adminLibrary.line.plain')],...new Map([...Object.keys(lines).map(id => [id,id]),...artOptions('line')])], { 'data-optional': 'true', 'data-structural': 'true' }));
  if (e.type === 'image') output.push(node('p', { class: 'library-admin__help' }, message('adminLibrary.image.placeholder')),
    choose('image.fit', p.fit, at('fit'), [['cover',t('editor.interface.fitCover')],['contain',t('editor.interface.fitContain')]]),
    choose('image.mask', p.mask || '', at('mask'), [['',t('adminLibrary.image.noMask')],...new Map([...Object.keys(masks).map(id => [id,id]),...artOptions('mask')])], { 'data-optional': 'true', 'data-structural': 'true' }),
    input('image.alt', e.accessibility.alt || '', `${path}.accessibility.alt`, { maxlength: 240 }));
  for (const key of ['text','label','title','submitLabel','caption']) if (Object.hasOwn(p, key) && !(e.type === 'text' && key === 'text'))
    output.push(input(`property.${key}`, p[key], at(key), { maxlength: key === 'caption' ? 4000 : 120 }));
  for (const key of ['color','strokeColor']) if (Object.hasOwn(p, key)) output.push(input(`property.${key}`, p[key], at(key), { type: 'color' }));
  for (const key of ['radius','strokeWidth']) if (Object.hasOwn(p, key)) output.push(number(`property.${key}`, p[key], at(key), 0, key === 'radius' ? 512 : 40));
  for (const [i, a] of (e.actions || []).entries()) {
    if (registry[e.type].actions.includes('replay')) output.push(choose('action.kind', a.type, '', [['goToScene',t('adminLibrary.action.goToScene')],['replay',t('adminLibrary.action.replay')]], { 'data-operation': 'action-type', 'data-action-index': i, 'data-field': `action-kind.${i}` }));
    if (a.type === 'goToScene') output.push(doc ? choose('action.target', a.targetSceneId || '', `${path}.actions.${i}.targetSceneId`, [['',t('adminLibrary.action.unset')],...doc.scenes.map(s => [s.id,s.name])], { 'data-null': 'true' }) : node('p', { class: 'library-admin__help' }, message('adminLibrary.action.onInsert')));
  }
  return output;
}
