import { clearTemplateBindingDefaults } from './personalization.js';
import { duplicateDocument } from './schema.js';

export function cleanGiftLayout(snapshot) {
  const document = structuredClone(snapshot);
  clearTemplateBindingDefaults(document);
  document.assets = [];
  document.elements = document.elements.filter(element => element.type !== 'image');
  const ids = new Set(document.elements.map(element => element.id));
  for (const [index, scene] of document.scenes.entries()) {
    scene.name = `Cảnh ${index + 1}`;
    scene.elementIds = scene.elementIds.filter(id => ids.has(id));
  }
  for (const element of document.elements) {
    delete element.name;
    delete element.locked;
    const { role, level } = element.accessibility;
    element.accessibility = { ...(role ? { role } : {}), ...(level ? { level } : {}) };
    if (element.type === 'text' && Object.hasOwn(element.props, 'text')) element.props.text = '';
    if (['button', 'envelope', 'gift-box'].includes(element.type))
      element.props.label = element.actions?.some(action => action.type === 'replay') ? 'Xem lại' : 'Tiếp tục';
    if (element.type === 'reply') {
      element.props.title = 'Lời đáp';
      element.props.submitLabel = 'Gửi lời đáp';
    }
    if (element.type === 'interaction') {
      for (const entry of element.props.entries || []) {
        entry.heading = '';
        if (Object.hasOwn(entry, 'body')) entry.body = '';
      }
      for (const photo of element.props.photos || []) {
        photo.assetId = null;
        photo.alt = '';
        photo.caption = '';
      }
      if (element.props.kind === 'event-countdown') element.props.eventAt = null;
    }
  }
  return duplicateDocument(document);
}
