import fs from 'node:fs';
import { canonicalUiText as canonicalText, escapeHtml, vi } from '../../web/js/shared/locale.js';

const index = new URL('../../web/index.html', import.meta.url);
const copy = key => {
  if (!Object.hasOwn(vi, key)) throw new Error(`Unknown shell translation: ${key}`);
  return escapeHtml(canonicalText(key));
};

export function buildLocalizedHtml() {
  const source = fs.readFileSync(index, 'utf8');
  const html = source.replace(/(<[a-z][^>]*?\bdata-i18n="([^"]+)"[^>]*>)[^<]*(<\/)/gi,
    (_, opening, key, closing) => `${opening}${copy(key)}${closing}`)
    .replace(/<[a-z][^>]*\bdata-i18n-[a-z-]+="[^"]+"[^>]*>/gi, tag => {
      for (const [, name, key] of tag.matchAll(/\bdata-i18n-([a-z-]+)="([^"]+)"/g))
        tag = tag.replace(new RegExp(`(\\s${name}=")[^"]*(")`), (_, opening, closing) => `${opening}${copy(key)}${closing}`);
      return tag;
    });
  if (source !== html) fs.writeFileSync(index, html);
}
