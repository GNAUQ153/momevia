import { eventTimeFromLocal, localEventTime } from './interactions.js';
import { canonicalText } from '../locale.js';

export const INVITATION_VENUE_LIMIT = 300;
export const INVITATION_ZONE = 'Asia/Ho_Chi_Minh';
const venuePrompts = new Set([canonicalText('interactive.placePrompt'), 'Meeting place · Add when ready']);
const keys = ['dateElementId', 'venueElementId', 'eventAt', 'timeZone'];
const textSlot = (doc, id) => doc.elements.find(e => e.id === id && e.type === 'text' && typeof e.props.text === 'string' && !e.props.textBinding);

export function invitationSlots(doc, fallback = {}) {
  const date = textSlot(doc, doc.invitation?.dateElementId ?? fallback.dateElementId ?? 'event-date');
  const venue = textSlot(doc, doc.invitation?.venueElementId ?? fallback.venueElementId ?? 'event-location');
  return date && venue && date !== venue ? { date, venue } : null;
}

export function invitationDateText(eventAt, timeZone) {
  return `${localEventTime(eventAt, timeZone).replace('T', ' ')} (${timeZone})`;
}

export function invitationVenue(slot) {
  const value = slot.props.text.trim();
  return venuePrompts.has(value) ? '' : value;
}

// Chỉ tạo dữ liệu sự kiện khi người gửi chủ động bật; không suy diễn từ văn bản cũ.
export function editInvitation(doc, field, value, fallback) {
  if (field === 'enabled' && !value) {
    delete doc.invitation;
    return;
  }
  const slots = invitationSlots(doc, fallback);
  if (!slots) throw new Error('INVITATION_SLOT_REQUIRED');
  if (field === 'enabled') {
    doc.invitation ??= { dateElementId: slots.date.id, venueElementId: slots.venue.id, eventAt: null, timeZone: INVITATION_ZONE };
    return;
  }
  const event = doc.invitation;
  if (!event) throw new Error('INVITATION_SLOT_REQUIRED');
  if (field === 'venue') {
    slots.venue.props.text = value;
    return;
  }
  if (field === 'date') event.eventAt = value ? eventTimeFromLocal(value, event.timeZone) : null;
  else if (field === 'zone') event.timeZone = value;
  else throw new Error('INVITATION_FIELD');
  slots.date.props.text = event.eventAt ? invitationDateText(event.eventAt, event.timeZone) : '';
}

// Kiểm tra cấu trúc khi lưu nháp, chỉ bắt buộc đầy đủ nội dung khi xuất bản.
export function invitationIssue(doc, publishing = false) {
  if (!Object.hasOwn(doc, 'invitation')) return null;
  const event = doc.invitation;
  if (!event || typeof event !== 'object' || Array.isArray(event) ||
      Object.keys(event).length !== keys.length || keys.some(key => !Object.hasOwn(event, key))) return 'structure';
  if (typeof event.dateElementId !== 'string' || typeof event.venueElementId !== 'string') return 'structure';
  const slots = invitationSlots(doc);
  if (!slots) return 'slots';
  if (typeof event.timeZone !== 'string' || event.timeZone.length > 65 || !/^[A-Za-z][\w+-]*(?:\/[\w+-]+)*$/.test(event.timeZone)) return 'zone';
  try { new Intl.DateTimeFormat('en', { timeZone: event.timeZone }); } catch { return 'zone'; }
  if (event.eventAt !== null) {
    if (typeof event.eventAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/.test(event.eventAt)) return 'date';
    const date = new Date(event.eventAt);
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== event.eventAt) return 'date';
  }
  if (!publishing) return null;
  if (!event.eventAt) return 'date';
  if ([slots.date, slots.venue].some(e => e.visible === false || e.opacity === 0)) return 'slots';
  if (slots.date.props.text !== invitationDateText(event.eventAt, event.timeZone)) return 'dateMismatch';
  const venue = invitationVenue(slots.venue);
  if (!venue || venue.length > INVITATION_VENUE_LIMIT) return 'venue';
  return null;
}

export function publicInvitation(doc) {
  if (!doc?.invitation || invitationIssue(doc, true)) return undefined;
  const { eventAt, timeZone } = doc.invitation;
  return { eventAt, timeZone, venue: invitationVenue(invitationSlots(doc).venue) };
}

// Áp dụng riêng lúc xuất bản, không làm hỏng snapshot đã phát hành khi sự kiện qua ngày.
export function invitationTimingIssue(doc, now, expiresAt) {
  const event = publicInvitation(doc);
  if (!event) return null;
  const time = Date.parse(event.eventAt);
  if (time <= now) return 'past';
  if (time >= expiresAt) return 'expiry';
  return null;
}
