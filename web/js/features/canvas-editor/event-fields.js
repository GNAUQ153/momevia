import { message } from '../../core/i18n.js';
import { node, field, input, button, select } from './dom.js';
import { localEventTime } from '../../shared/canvas/interactions.js';

export const storyAlbum = doc => doc.elements.find(e => e.type === 'interaction' && e.props.kind === 'swipe-album' && e.props.optional);
export const storyClock = (doc, mode) => doc.elements.find(e => e.type === 'interaction' && e.props.kind === 'event-countdown' && e.props.clockMode === mode);
const copy = key => message(`templates.story.${key}`);

export function createEventFields(doc) {
  const album = storyAlbum(doc);
  if (!album) return null;
  return node('fieldset', { class: 'editor-event-fields', 'data-event-fields': '' },
    node('legend', {}, copy('options')),
    node('p', { class: 'editor-help' }, copy('optional')),
    ...['countdown', 'elapsed'].map(mode => {
      const clock = storyClock(doc, mode);
      if (!clock) return null;
      return node('div', { class: 'editor-event-date' },
        input(copy(mode), `event-date.${mode}`, clock.props.eventAt ? localEventTime(clock.props.eventAt, clock.props.timeZone) : '', { type: 'datetime-local' }),
        select(copy('zone'), `event-zone.${mode}`, clock.props.timeZone,
          [...new Set(['Asia/Ho_Chi_Minh', 'UTC', 'America/New_York', 'Europe/Paris', clock.props.timeZone])].map(zone => [zone, zone])),
      );
    }),
    ...album.props.photos.map((photo, index) => node('details', { class: 'editor-event-photo', open: index === 0 ? '' : null },
      node('summary', {}, message('templates.story.photo', { index: index + 1 })),
      node('div', { 'data-event-photo-preview': photo.id }),
      field(copy('upload'), node('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', 'data-editor-field': 'event-photo', 'data-target': album.id, 'data-slot': photo.id })),
      input(copy('caption'), `event-caption.${photo.id}`, photo.caption, { maxlength: 240 }),
      input(copy('alt'), `event-alt.${photo.id}`, photo.alt, { maxlength: 240 }),
      button(copy('remove'), 'event-remove-photo', { 'data-slot': photo.id }),
    )),
  );
}

export function updateEventFields(root, doc, assetUrl) {
  const fields = root.querySelector('[data-event-fields]');
  if (!fields) return;
  const assign = (key, value) => {
    const control = fields.querySelector(`[data-editor-field="${CSS.escape(key)}"]`);
    if (control && control !== document.activeElement) control.value = value;
  };
  for (const mode of ['countdown', 'elapsed']) {
    const clock = storyClock(doc, mode);
    if (clock) {
      assign(`event-date.${mode}`, clock.props.eventAt ? localEventTime(clock.props.eventAt, clock.props.timeZone) : '');
      assign(`event-zone.${mode}`, clock.props.timeZone);
    }
  }
  for (const photo of storyAlbum(doc)?.props.photos || []) {
    assign(`event-caption.${photo.id}`, photo.caption); assign(`event-alt.${photo.id}`, photo.alt);
    const preview = fields.querySelector(`[data-event-photo-preview="${CSS.escape(photo.id)}"]`);
    if (!preview) continue;
    const src = photo.assetId ? assetUrl(photo.assetId) : '';
    if (preview.dataset.src === src) continue;
    preview.dataset.src = src;
    preview.replaceChildren(...(src ? [node('img', { src, alt: photo.alt || '', width: 90, height: 90 })] : []));
  }
}
