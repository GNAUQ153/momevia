import { attr, t, text } from '../../core/i18n.js';
import { escapeHtml as e } from '../../shared/locale.js';
import { templateFieldKey } from '../../shared/template-copy.js';
import { libraryEntry, librarySnapshot } from '../../shared/canvas/library-state.js';
import {catalogCoverRevision} from '../../core/catalog-bootstrap.js';
import { COVER_WIDTHS, CATALOG_COVER_SIZES } from '../../shared/cover-images.js';

export function templateField(template, field) {
  const key = templateFieldKey(template, field);
  return key ? text(key) : e(template[field]);
}

export function templateValue(template, field) {
  const key = templateFieldKey(template, field);
  return key ? { format: 'message', key } : template[field];
}

export function heroTemplateCover(template) {
  return template.thumbnail ? `src="${e(template.thumbnail)}"` : templateCover(template, {variant:'portrait'});
}

export function templateSearchFields(template) {
  return ['title', 'subtitle', 'style', 'category', 'paletteLabel']
    .map(field => templateFieldKey(template, field)).filter(Boolean).map(key => t(key));
}

const coverRevision = 10;
export function templateCover(template,{defer=false,variant='catalog',responsive=false,sizes=CATALOG_COVER_SIZES}={}) {
  const id=typeof template==='string'?template:template.id;
  const target=defer?'data-src':'src',marker=defer?' data-cover-lazy':'';
  const revision=template.coverRevision||catalogCoverRevision(id);
  const suffix=['catalog','seasonal'].includes(variant)?variant:null;
  const thumbnailAttrs=(key,value)=>{
    const params={id:encodeURIComponent(id),revision:value,variant:suffix};
    const sources=Object.fromEntries(COVER_WIDTHS.map(width=>[`w${width}`,{format:'message',key,params:{...params,width}}]));
    return attr(target,key,{...params,width:320})+' '+
      attr(defer?'data-srcset':'srcset','templates.assets.databaseCoverSrcset',sources)+` sizes="${e(sizes)}"`+marker;
  };
  const databaseAttrs=value=>{
    const params={id:encodeURIComponent(id),revision:value,...(suffix?{variant:suffix}:{})};
    if(responsive&&suffix)return thumbnailAttrs('templates.assets.databaseCoverThumbnail',value);
    return attr(target,suffix?'templates.assets.databaseCoverVariant':'templates.assets.databaseCover',params)+marker;
  };
  if(revision)return databaseAttrs(revision);
  if (libraryEntry('template', id)) return databaseAttrs(librarySnapshot().revision);
  if(responsive&&suffix)return thumbnailAttrs('templates.assets.coverThumbnail',coverRevision);
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
  ].join(' - ');
}
