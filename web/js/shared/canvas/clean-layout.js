import { clearTemplateBindingDefaults } from './personalization.js';
import { duplicateDocument } from './schema.js';
import { EVENT_ARTWORK_LABEL } from './event-media.js';
import { emptyPrediction, PREDICTION_KIND } from './prediction.js';
import { canonicalText } from '../locale.js';

export function cleanGiftLayout(snapshot, { sharedImages = new Map() } = {}) {
  const document = structuredClone(snapshot);
  clearTemplateBindingDefaults(document);
  // Tặng lại chỉ giữ bố cục, không mang theo lựa chọn nhạc cá nhân của người gửi trước.
  delete document.soundtrack;
  document.assets = [];
  document.elements = document.elements.filter(element => element.type !== 'image' || sharedImages.has(element.props.assetId));
  for (const element of document.elements.filter(e => e.type === 'image')) {
    element.props.assetId = sharedImages.get(element.props.assetId);
    delete element.props.caption;
    if (!document.assets.some(a => a.assetId === element.props.assetId)) document.assets.push({ assetId: element.props.assetId, kind: 'image' });
  }
  const ids = new Set(document.elements.map(element => element.id));
  for (const [index, scene] of document.scenes.entries()) {
    scene.name = `Cảnh ${index + 1}`;
    scene.elementIds = scene.elementIds.filter(id => ids.has(id));
  }
  for (const element of document.elements) {
    if(element.sound?.kind==='audio')delete element.sound;
    if(element.type==='sound-button')element.props.label=canonicalText('sfx.listen');
    delete element.name;
    delete element.locked;
    const { role, level } = element.accessibility;
    element.accessibility = { ...(role ? { role } : {}), ...(level ? { level } : {}) };
    if (element.type === 'image') element.accessibility = { decorative: true, label: EVENT_ARTWORK_LABEL };
    if (element.type === 'text' && Object.hasOwn(element.props, 'text')) element.props.text = '';
    if (['button', 'envelope', 'gift-box'].includes(element.type))
      element.props.label = element.actions?.some(action => action.type === 'replay') ? 'Xem lại' : 'Tiếp tục';
    if (element.type === 'reply') {
      element.props.title = 'Lời đáp';
      element.props.submitLabel = 'Gửi lời đáp';
    }
    if (element.type === 'interaction') {
      if (element.props.kind === PREDICTION_KIND) Object.assign(element.props, emptyPrediction());
      for (const entry of element.props.entries || []) {
        entry.heading = '';
        if (Object.hasOwn(entry, 'body')) entry.body = '';
      }
      for (const photo of element.props.photos || []) {
        photo.assetId = null;
        photo.alt = '';
        photo.caption = '';
      }
      if (element.props.kind === 'event-countdown') {
        element.props.eventAt = null;
        if (element.props.optional) element.props.entries[0] = {
          heading: canonicalText(`templates.story.${element.props.clockMode === 'elapsed' ? 'elapsed' : 'countdown'}`),
          body: canonicalText('templates.story.clockArrived'),
        };
      }
    }
  }
  return duplicateDocument(document);
}
