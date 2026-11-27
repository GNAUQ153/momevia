import { serverText } from '../../shared/locale.mjs';
import { templatePreviewDocument } from '../../../web/js/shared/canvas/presets.js';
import { libraryDocument, libraryEntry, libraryText } from '../../../web/js/shared/canvas/library-state.js';
import { coverVariant } from '../../../web/js/shared/canvas/refresh-21-config.js';
import { previewSvg } from '../../../web/js/shared/canvas/cover-svg.js';

export function renderTemplateCover(id, locale, variant, { images, serifWoff2 }) {
  const translate = (key, params) => serverText(locale, key, params);
  let document;
  try {
    document = templatePreviewDocument({ id }, translate);
  } catch (error) {
    // Admins can change a document so that its original demo scenario no longer
    // applies. Use that same approved document for both the SVG and its thumbnail.
    document = libraryDocument('template', id, translate);
    if (!document) throw error;
    for (const [key, field] of [['recipientName','recipient'],['senderName','sender'],['message','greeting']]) {
      document.bindings[key].value = translate('templates.preview.' + field);
    }
  }
  const title = libraryText(libraryEntry('template', id)?.definition.title, locale) ||
    translate('templates.' + id + '.title');
  const ariaLabel = translate('catalog.artwork.systemAlt', { title });
  return previewSvg(coverVariant(document, variant, id), undefined, images, { serifWoff2, locale, ariaLabel });
}
