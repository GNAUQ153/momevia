import { attr, t, text } from '../../core/i18n.js';
import { escapeHtml as e } from '../../shared/locale.js';
import { templateFieldKey } from '../../shared/template-copy.js';
import { libraryEntry, librarySnapshot } from '../../shared/canvas/library-state.js';
import {catalogCoverRevision} from '../../core/catalog-bootstrap.js';

export function templateField(template, field) {
  const key = templateFieldKey(template, field);
  return key ? text(key) : e(template[field]);
}

export function templateValue(template, field) {
  const key = templateFieldKey(template, field);
  return key ? { format: 'message', key } : template[field];
}

export function templateSearchFields(template) {
  return ['title', 'subtitle', 'style', 'category', 'paletteLabel']
    .map(field => templateFieldKey(template, field)).filter(Boolean).map(key => t(key));
}

const coverRevision = 9;
export function templateCover(template,{defer=false,variant='catalog'}={}) {
  const id=typeof template==='string'?template:template.id;
  const target=defer?'data-src':'src',marker=defer?' data-cover-lazy':'';
  const revision=template.coverRevision||catalogCoverRevision(id);
  const suffix=['catalog','seasonal'].includes(variant)?variant:null;
  const databaseAttrs=value=>attr(target,suffix?'templates.assets.databaseCoverVariant':'templates.assets.databaseCover',{
    id:encodeURIComponent(id),revision:value,...(suffix?{variant:suffix}:{}),
  })+marker;
  if(revision)return databaseAttrs(revision);
  if (libraryEntry('template', id)) return databaseAttrs(librarySnapshot().revision);
  return attr(target, 'templates.assets.cover', { id: encodeURIComponent(id)+(suffix?'-'+suffix:''), revision: coverRevision })+marker;
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
