import { createElement } from './registry.js';
import { validateDocument } from './schema.js';
import { createBasicTemplate } from './basic-templates.js';
import { canonicalText } from '../locale.js';

const palettes = {
  violet: ['#F5EFFF', '#6136DF'], sunshine: ['#FFF8DE', '#906320'], rose: ['#FFF0F4', '#B93863'], navy: ['#EAF0FF', '#233F85'], peach: ['#FFF0E8', '#AA5735'], sage: ['#ECF7EF', '#34744D'], coral: ['#FFF0EB', '#BE4D51'], sky: ['#EAF8FF', '#326C9D'], lilac: ['#F5EFFF', '#7757A2'], cream: ['#FFF7EE', '#8B5D37'], amber: ['#FFF6DE', '#956D22'], mint: ['#E8FFF7', '#217760'],
};
export const PRESETS = Object.freeze([
  { id: 'blank', label: canonicalText('templates.preset.blank'), labelKey: 'templates.preset.blank' },
  { id: 'envelope-basic', label: canonicalText('templates.preset.envelope'), labelKey: 'templates.preset.envelope' },
  { id: 'celebration', label: canonicalText('templates.preset.celebration'), labelKey: 'templates.preset.celebration' },
]);

export function createDocument({ presetId = 'blank', template, localize = canonicalText } = {}) {
  if (!PRESETS.some(p => p.id === presetId)) throw new Error('Bố cục chưa được hỗ trợ.');
  const basic = template ? createBasicTemplate(template, localize) : null;
  if (basic) return basic;
  const [background, ink] = palettes[template?.theme] || palettes.violet;
  const document = {
    schemaVersion: 1, registryVersion: 1,
    artboard: { baseSize: { width: 390, height: 844 }, layoutMode: 'responsive-scene', safeInsets: { top: 24, right: 20, bottom: 24, left: 20 } },
    entrySceneId: 'scene-cover',
    bindings: { recipientName: { type: 'text', value: '' }, senderName: { type: 'text', value: '' }, message: { type: 'text', value: '' } },
    assets: [], scenes: [{ id: 'scene-cover', name: localize('templates.scene.cover'), background: { kind: 'solid', color: background }, elementIds: [] }], elements: [],
    responsive: { textOverflow: 'expand-flow', sceneOverflow: 'scroll', desktop: { maxContentWidth: 720, align: 'center' } },
  };
  if (presetId === 'blank' && !template) return document;
  const add = (sceneId, type, id, layout, props, extra = {}) => {
    const e = createElement(type, { id, layout, props, ...extra }, localize); document.elements.push(e); document.scenes.find(s => s.id === sceneId).elementIds.push(id); return e;
  };
  document.scenes.push({ id: 'scene-surprise', name: localize('templates.scene.surprise'), background: { kind: 'solid', color: background }, elementIds: [] }, { id: 'scene-message', name: localize('templates.scene.wish'), background: { kind: 'solid', color: background }, elementIds: [] });
  add('scene-cover', 'text', 'text-recipient', { x: 20, y: 110, width: 350, height: 105 }, { textBinding: 'recipientName', fontToken: 'heading', fontSize: 34, align: 'center', color: ink }, { accessibility: { role: 'heading', level: 1 } });
  add('scene-cover', presetId === 'celebration' ? 'gift-box' : 'envelope', 'open-gift', { x: 50, y: 290, width: 290, height: 220 }, { color: ink }, { actions: [{ on: 'activate', type: 'goToScene', targetSceneId: 'scene-surprise' }] });
  add('scene-cover', 'text', 'text-intro', { x: 35, y: 570, width: 320, height: 100 }, { text: localize('templates.preset.waiting'), fontSize: 20, align: 'center', color: ink });
  add('scene-surprise', 'sticker', 'birthday-cake', { x: 105, y: 130, width: 180, height: 180 }, { stickerId: 'cake' });
  add('scene-surprise', 'text', 'birthday-title', { x: 25, y: 340, width: 340, height: 140 }, { text: localize('templates.preset.birthday'), fontToken: 'heading', fontSize: 38, align: 'center', color: ink }, { accessibility: { role: 'heading', level: 1 } });
  add('scene-surprise', 'button', 'to-message', { x: 70, y: 550, width: 250, height: 64 }, { label: localize('templates.preset.read'), color: ink }, { actions: [{ on: 'activate', type: 'goToScene', targetSceneId: 'scene-message' }] });
  add('scene-message', 'text', 'text-message', { x: 25, y: 65, width: 340, height: 210 }, { textBinding: 'message', fontSize: 24, align: 'center', color: ink });
  add('scene-message', 'text', 'text-sender', { x: 25, y: 310, width: 340, height: 70 }, { textBinding: 'senderName', fontSize: 20, align: 'right', color: ink });
  add('scene-message', 'reply', 'reply-card', { x: 20, y: 420, width: 350, height: 300 }, {});
  add('scene-message', 'button', 'replay-gift', { x: 105, y: 745, width: 180, height: 55 }, { label: localize('templates.preset.replay'), color: ink }, { actions: [{ on: 'activate', type: 'replay' }] });
  return validateDocument(document);
}

export function templatePreviewDocument(template, localize = canonicalText) {
  const doc = createDocument({ template, localize });
  doc.bindings.recipientName.value = localize('templates.preview.recipient');
  doc.bindings.senderName.value = localize('templates.preview.sender');
  doc.bindings.message.value = localize('templates.preview.greeting');
  return validateDocument(doc, { mode: 'publish' });
}
