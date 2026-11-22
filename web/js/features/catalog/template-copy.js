import { attr, t, text } from '../../core/i18n.js';
import { escapeHtml as e } from '../../shared/locale.js';
import { templateFieldKey } from '../../shared/template-copy.js';
import { libraryEntry, librarySnapshot } from '../../shared/canvas/library-state.js';

export function templateField(template, field) {
  const key = templateFieldKey(template, field);
  return key ? text(key) : e(template[field]);
}

export function templateValue(template, field) {
  const key = templateFieldKey(template, field);
  return key ? { format: 'message', key } : template[field];
}

export function templateSearchFields(template) {
  return ['title', 'subtitle', 'style', 'category']
    .map(field => templateFieldKey(template, field)).filter(Boolean).map(key => t(key));
}

const coverRevision = 6;
export function templateCover(id) {
  if (libraryEntry('template', id)) return attr('src', 'templates.assets.databaseCover', { id: encodeURIComponent(id), revision: librarySnapshot().revision });
  return attr('src', 'templates.assets.cover', { id: encodeURIComponent(id), revision: coverRevision });
}

export function personalizationText(personalization) {
  if (!personalization) return '';
  const { bindings, photoFrames, layout } = personalization;
  return [
    ...(bindings.length ? [text('catalog.personalization.edit', {
      bindings: { format: 'messages', keys: bindings.map(key => `catalog.personalization.${key}`) },
    })] : []),
    ...(photoFrames ? [text('catalog.personalization.photos', { count: photoFrames })] : []),
    text(layout ? 'catalog.personalization.addPhotos' : 'catalog.personalization.fixed'),
  ].join(' · ');
}
