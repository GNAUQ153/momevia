import { vi } from './locale.js';
import { uiSeparators } from './ui-copy.js';

export const templateCopyKey = (id, field) => `templates.${id}.${field}`;
export const isSystemTemplate = template => !template?.versionId &&
  template?.creator === 'Momevia Originals' && Object.hasOwn(vi, templateCopyKey(template.id, 'title'));

const metaKeys = new Map(Object.entries(vi)
  .filter(([key]) => key.startsWith('templates.meta.'))
  .map(([key, value]) => [`${key.split('.')[2]}:${uiSeparators(value)}`, key]));

export function templateFieldKey(template, field) {
  if (!isSystemTemplate(template)) return undefined;
  if (field === 'paletteLabel' && template.palette) return `templates.meta.palette.${template.palette}`;
  if (field === 'title' || field === 'subtitle') {
    const key = templateCopyKey(template.id, field);
    return vi[key] === template[field] ? key : undefined;
  }
  return templateMetaKey(field, template[field]);
}

export function templateMetaKey(field, value) {
  return metaKeys.get(`${field}:${typeof value === 'string' ? uiSeparators(value) : value}`);
}
