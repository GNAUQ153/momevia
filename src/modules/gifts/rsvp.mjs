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
    updatedAt: isRsvpStatus(receipt.rsvp?.status) ? receipt.rsvp.updatedAt : null };
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
  if (!body || Object.keys(body).length !== 1 || !isRsvpStatus(body.status))
    throw localizedError(422, 'rsvp.error.status');
  if (now >= Date.parse(gift.documentSnapshot.invitation.eventAt)) throw localizedError(409, 'rsvp.error.closed');
  // Retry cùng trạng thái không tạo bản ghi mới hoặc thay đổi thời điểm.
  if (receipt.rsvp?.status !== body.status) {
    acceptNew(receipt.id);
    receipt.rsvp = { status: body.status, updatedAt: new Date(now).toISOString() };
  }
  return { ...rsvpRecord(receipt), canRespond: true };
}
