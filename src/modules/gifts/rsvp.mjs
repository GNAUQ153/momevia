import { localizedError } from '../../shared/http.mjs';
import { publicInvitation } from '../../../web/js/shared/canvas/invitation.js';
import { isRsvpStatus } from '../../../web/js/shared/rsvp.js';
import { requireGiftPermission } from './access.mjs';
import { receiptFor } from './recipients.mjs';

export function supportsRsvp(gift) {
  return ['list', 'self'].includes(gift.recipientMode) && Boolean(publicInvitation(gift.documentSnapshot));
}

// Chỉ trả trạng thái của một lượt nhận, không trả mã truy cập hoặc danh sách khách.
export function rsvpRecord(receipt) {
  return { status: isRsvpStatus(receipt.rsvp?.status) ? receipt.rsvp.status : null,
    updatedAt: isRsvpStatus(receipt.rsvp?.status) ? receipt.rsvp.updatedAt : null,
    ...(Number.isInteger(receipt.rsvp?.partySize) ? { partySize: receipt.rsvp.partySize } : {}),
    ...(typeof receipt.rsvp?.note === 'string' ? { note: receipt.rsvp.note } : {}) };
}

export function rsvpView(gift, receipt, canSend, now = Date.now()) {
  if (!receipt || !supportsRsvp(gift)) return undefined;
  return { ...rsvpRecord(receipt), canRespond: Boolean(canSend && now < Date.parse(gift.documentSnapshot.invitation.eventAt)) };
}

// Được gọi bên trong thao tác ghi có khóa; kiểm tra lại quyền và thời điểm trên dữ liệu mới nhất.
export function updateRsvp(gift, invite, token, body, acceptNew, now = Date.now()) {
  requireGiftPermission(gift, invite, 'canSend');
  if (!supportsRsvp(gift)) throw localizedError(422, 'rsvp.error.unsupported');
  const receipt = receiptFor(gift, token);
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['status','partySize','note'].includes(key)) || !isRsvpStatus(body.status)
    || (Object.hasOwn(body, 'partySize') && (!Number.isInteger(body.partySize) || body.partySize < 1 || body.partySize > 5))
    || (Object.hasOwn(body, 'note') && (typeof body.note !== 'string' || body.note.length > 140 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(body.note))))
    throw localizedError(422, 'rsvp.error.status');
  if (now >= Date.parse(gift.documentSnapshot.invitation.eventAt)) throw localizedError(409, 'rsvp.error.closed');
  const details = { ...(receipt.rsvp?.partySize ? { partySize: receipt.rsvp.partySize } : {}), ...(typeof receipt.rsvp?.note === 'string' ? { note: receipt.rsvp.note } : {}), ...(Object.hasOwn(body,'partySize') ? { partySize: body.partySize } : {}), ...(Object.hasOwn(body,'note') ? { note: body.note.trim() } : {}) };
  // Idempotent retries preserve the timestamp; changed party details are a real update.
  if (receipt.rsvp?.status !== body.status || receipt.rsvp?.partySize !== details.partySize || receipt.rsvp?.note !== details.note) {
    acceptNew(receipt.id);
    receipt.rsvp = { status: body.status, updatedAt: new Date(now).toISOString(), ...details };
  }
  return { ...rsvpRecord(receipt), canRespond: true };
}
