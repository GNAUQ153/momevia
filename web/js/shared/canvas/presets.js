import { signatureTemplateDefinition } from './signature/templates.js';
import { originalDefinition } from './originals-data.js';
import { editInvitation } from './invitation.js';
import { createElement } from './registry.js';
import { validateDocument } from './schema.js';
import { createBasicTemplate } from './basic-templates.js';
import { OPEN_ME_TEMPLATE_IDS } from './open-me-templates.js';
import { canonicalText } from '../locale.js';
import { EVENT_CARD_IDS } from './event-cards.js';
import { predictionCard, predictionFields } from './prediction.js';
import { eventMediaId } from './event-media.js';
import { libraryDocument, libraryEntry, libraryEntries, libraryLabel as libraryText, libraryLocale } from './library-state.js';
import { pinDocumentArtwork } from './library-materialize.js';
import { REFRESH_21 } from './refresh-21-config.js';

const palettes = {
  violet: ['#F5EFFF', '#6136DF'], sunshine: ['#FFF8DE', '#906320'], rose: ['#FFF0F4', '#B93863'], navy: ['#EAF0FF', '#233F85'], peach: ['#FFF0E8', '#AA5735'], sage: ['#ECF7EF', '#34744D'], coral: ['#FFF0EB', '#BE4D51'], sky: ['#EAF8FF', '#326C9D'], lilac: ['#F5EFFF', '#7757A2'], cream: ['#FFF7EE', '#8B5D37'], amber: ['#FFF6DE', '#956D22'], mint: ['#E8FFF7', '#217760'],
};
export const PRESETS = Object.freeze([
  { id: 'blank', label: canonicalText('templates.preset.blank'), labelKey: 'templates.preset.blank' },
  { id: 'envelope-basic', label: canonicalText('templates.preset.envelope'), labelKey: 'templates.preset.envelope' },
  { id: 'celebration', label: canonicalText('templates.preset.celebration'), labelKey: 'templates.preset.celebration' },
]);

export function createDocument({ presetId = 'blank', template, localize = canonicalText } = {}) {
  const configured = libraryDocument(template ? 'template' : 'preset', template?.id || presetId, localize);
  if (configured) return validateDocument(pinDocumentArtwork(configured));
  if (!PRESETS.some(p => p.id === presetId) && !libraryEntry('preset', presetId)) throw new Error('Bố cục chưa được hỗ trợ.');
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
  add('scene-surprise', 'sticker', 'birthday-cake', { x: 105, y: 130, width: 180, height: 180 }, { stickerId: presetId === 'celebration' ? 'cake' : 'flower' });
  add('scene-surprise', 'text', 'birthday-title', { x: 25, y: 340, width: 340, height: 140 }, { text: localize(presetId === 'celebration' ? 'templates.preset.birthday' : 'templates.preset.special'), fontToken: 'heading', fontSize: 38, align: 'center', color: ink }, { accessibility: { role: 'heading', level: 1 } });
  add('scene-surprise', 'button', 'to-message', { x: 70, y: 550, width: 250, height: 64 }, { label: localize('templates.preset.read'), color: ink }, { actions: [{ on: 'activate', type: 'goToScene', targetSceneId: 'scene-message' }] });
  add('scene-message', 'text', 'text-message', { x: 25, y: 65, width: 340, height: 210 }, { textBinding: 'message', fontSize: 24, align: 'center', color: ink });
  add('scene-message', 'text', 'text-sender', { x: 25, y: 310, width: 340, height: 70 }, { textBinding: 'senderName', fontSize: 20, align: 'right', color: ink });
  add('scene-message', 'reply', 'reply-card', { x: 20, y: 420, width: 350, height: 300 }, {});
  add('scene-message', 'button', 'replay-gift', { x: 105, y: 745, width: 180, height: 55 }, { label: localize('templates.preset.replay'), color: ink }, { actions: [{ on: 'activate', type: 'replay' }] });
  return validateDocument(document);
}

export function starterPresets(localize = canonicalText) {
  const rows = libraryEntries('preset');
  return rows ? rows.map(row => ({ id: row.id, label: libraryText(row.definition.title, libraryLocale(localize)) })) : PRESETS;
}

export function templatePreviewDocument(template, localize = canonicalText) {
  const doc = createDocument({ template, localize });
  doc.bindings.recipientName.value = localize('templates.preview.recipient');
  doc.bindings.senderName.value = localize('templates.preview.sender');
  doc.bindings.message.value = localize('templates.preview.greeting');
  if (signatureTemplateDefinition(template?.id)) doc.bindings.message.value = localize('signature.templates.sample');
  const original = originalDefinition(template?.id);
  if (original) {
    doc.bindings.recipientName.value = localize('originals.sampleRecipient');
    doc.bindings.senderName.value = localize('originals.sampleSender');
    doc.bindings.message.value = localize(`templates.${original.id}.note`);
    if (original.cardType === 'invitation') {
      const date = doc.elements.find(e => e.id === 'event-date' && e.type === 'text');
      const venue = doc.elements.find(e => e.id === 'event-location' && e.type === 'text');
      if (date) date.props.text = localize('originals.sampleDate');
      if (venue) venue.props.text = localize('originals.sampleVenue');
    }
  }
  if (Object.hasOwn(REFRESH_21, template?.id || '') || ['loi-moi-ben-hien','cuon-phim-ngay-ay','ban-do-ngay-ra-truong'].includes(template?.id))
    doc.bindings.message.value = localize(`templates.${template.id}.previewMessage`);
  if (OPEN_ME_TEMPLATE_IDS.includes(template?.id)) {
    for (const [binding, field] of [['recipientName', 'previewRecipient'], ['senderName', 'previewSender'], ['message', 'previewMessage']])
      doc.bindings[binding].value = localize(`templates.${template.id}.${field}`);
  }
  if (template?.id === 'garden-tea') {
    doc.personalization = { version: 1, mode: 'manual' };
    for (const [binding, field] of [['recipientName','previewRecipient'],['senderName','previewSender'],['message','previewMessage']]) doc.bindings[binding].value = localize(`templates.garden-tea.${field}`);
    editInvitation(doc, 'date', '2027-01-09T15:00');
    editInvitation(doc, 'venue', localize('templates.garden-tea.previewVenue'));
  }
  const prediction = predictionCard(doc);
  if (prediction) {
    doc.bindings.senderName.value = 'Minh'; doc.bindings.recipientName.value = 'An';
    for (const key of Object.keys(predictionFields)) prediction.props[key] = localize(`prediction.sample.${key}`);
    prediction.props.prediction = 'A';
  }
  if (EVENT_CARD_IDS.includes(template?.id)) {
    for (const [binding, field] of [['recipientName', 'previewRecipient'], ['message', 'previewMessage']])
      doc.bindings[binding].value = localize(`templates.${template.id}.${field}`);
    const memory = doc.elements.find(element => element.id === 'envelope-memory');
    if (memory) memory.props.text = localize('templates.hai-phong-bi.previewMemory');
    const album = doc.elements.find(e => e.id === 'event-album');
    const occasion = { 'birthday-radiance': 'birthday', 'hai-phong-bi': 'wedding', 'proud-of-you': 'graduation' }[template.id];
    if (album) for (const [i, key] of [`${occasion}-album`, occasion].entries()) {
      const assetId = eventMediaId(key);
      if (!doc.assets.some(a => a.assetId === assetId)) doc.assets.push({ assetId, kind: 'image' });
      Object.assign(album.props.photos[i], { assetId, alt: localize('templates.story.samplePhoto'), caption: localize(`templates.story.${i ? 'sampleDetail' : 'samplePhoto'}`), focalPoint: { x: .5, y: !i && occasion !== 'birthday' ? 0 : .5 } });
    }
    for (const e of doc.elements.filter(e => e.type === 'interaction' && e.props.kind === 'event-countdown'))
      e.props.eventAt = e.props.clockMode === 'elapsed' ? '2021-08-14T02:00:00.000Z' : '2026-12-31T12:00:00.000Z';
  }
  if (['loi-moi-ben-hien','cuon-phim-ngay-ay'].includes(template?.id)) {
    const album=doc.elements.find(e=>e.id==='event-album');
    for (const [i,key] of ['wedding-album','birthday-album','graduation-album'].entries()) {
      const assetId=eventMediaId(key);doc.assets.push({assetId,kind:'image'});
      Object.assign(album.props.photos[i],{assetId,alt:localize('templates.story.samplePhoto'),caption:localize('templates.story.sampleDetail')});
    }
  }
  // Illustrative details belong only to the preview, never to a sender draft.
  if (template?.id === 'loi-moi-ben-hien') {
    for (const [id, field] of [['event-date','previewDate'],['event-location','previewPlace'],['event-1-time','previewTime1'],['event-1-address','previewAddress1'],['event-2-time','previewTime2'],['event-2-address','previewAddress2']])
      doc.elements.find(e=>e.id===id).props.text = localize(`templates.${template.id}.${field}`);
  }
  if (template?.id === 'ban-do-ngay-ra-truong') {
    for (let i=1;i<=3;i++) doc.elements.find(e=>e.id===`milestone-${i}-body`).props.text = localize(`templates.${template.id}.previewMilestone${i}`);
  }
  return validateDocument(doc, { mode: 'publish' });
}
