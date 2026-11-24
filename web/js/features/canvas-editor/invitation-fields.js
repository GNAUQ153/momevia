import { message } from '../../core/i18n.js';
import { input, node, select } from './dom.js';
import { localEventTime } from '../../shared/canvas/interactions.js';
import { invitationSlots, invitationVenue, INVITATION_ZONE, INVITATION_VENUE_LIMIT } from '../../shared/canvas/invitation.js';

export function createInvitationFields(doc, fallback) {
  const slots = invitationSlots(doc, fallback);
  if (!slots) return null;
  const event = doc.invitation;
  const zone = event?.timeZone ?? INVITATION_ZONE;
  const zones = [...new Set([INVITATION_ZONE, 'UTC', zone, ...Intl.supportedValuesOf('timeZone')])];
  return node('fieldset', { class: 'editor-event-fields', 'data-invitation-fields': '' },
    node('legend', {}, message('invitation.title')),
    node('p', { class: 'editor-help' }, message('invitation.hint')),
    node('label', { class: 'editor-field' },
      node('input', { type: 'checkbox', checked: Boolean(event), 'data-editor-field': 'invitation.enabled' }),
      node('span', {}, message('invitation.enable'))),
    node('div', { 'data-invitation-inputs': '', hidden: !event },
      input(message('invitation.date'), 'invitation.date', event?.eventAt ? localEventTime(event.eventAt, zone) : '', { type: 'datetime-local' }),
      select(message('invitation.zone'), 'invitation.zone', zone, zones.map(z => [z, z])),
      input(message('invitation.venue'), 'invitation.venue', invitationVenue(slots.venue), { maxlength: INVITATION_VENUE_LIMIT }),
      node('p', { class: 'editor-help' }, message('invitation.publishHint')),
    ),
  );
}

export function updateInvitationFields(root, doc, fallback) {
  const host = root.querySelector('[data-invitation-fields]');
  if (!host) return;
  const slots = invitationSlots(doc, fallback);
  host.hidden = !slots;
  const event = doc.invitation;
  const control = key => host.querySelector(`[data-editor-field="invitation.${key}"]`);
  control('enabled').checked = Boolean(event);
  host.querySelector('[data-invitation-inputs]').hidden = !event;
  const zone = event?.timeZone ?? INVITATION_ZONE;
  const assign = (key, value) => {
    const el = control(key);
    if (el !== document.activeElement) el.value = value;
  };
  assign('date', event?.eventAt ? localEventTime(event.eventAt, zone) : '');
  assign('zone', zone);
  assign('venue', slots ? invitationVenue(slots.venue) : '');
  // Không cho sửa hai nguồn song song trong chế độ nhập nội dung nhanh.
  for (const el of root.querySelectorAll('[data-editor-field^="story-text."]')) {
    const id = el.dataset.editorField.slice('story-text.'.length);
    if ([slots?.date.id, slots?.venue.id, 'event-date', 'event-location'].includes(id))
      el.closest('label').hidden = Boolean(event);
  }
}
