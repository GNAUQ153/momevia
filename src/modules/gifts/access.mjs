import { timingSafeEqual } from 'node:crypto';
import { HttpError } from '../../shared/http.mjs';
import { randomId } from '../../shared/security.mjs';

export function giftStatus(gift) {
  if (gift.revokedAt) return 'revoked';
  return Date.parse(gift.expiresAt) <= Date.now() ? 'expired' : 'active';
}

export function requireActiveGift(gift) {
  const status = giftStatus(gift);
  if (status === 'active') return;
  const error = new HttpError(410, status === 'revoked'
    ? 'Người gửi đã ngừng chia sẻ món quà này.'
    : 'Món quà đã hết thời gian hoạt động.');
  error.code = status === 'revoked' ? 'GIFT_REVOKED' : 'GIFT_EXPIRED';
  throw error;
}

export function createGiftAccess(input) {
  if (input === undefined) return {};
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 3
    || !['link', 'invite'].includes(input.open)
    || !['link', 'invite', 'disabled'].includes(input.send)
    || !['link', 'invite', 'sender'].includes(input.read)) {
    throw new HttpError(422, 'Chọn đầy đủ phạm vi mở quà, gửi và đọc hồi đáp.');
  }
  const access = { open: input.open, send: input.send, read: input.read };
  return { access, ...(Object.values(access).includes('invite') ? { inviteToken: randomId(32) } : {}) };
}

export function requireGiftPermission(gift, invite, permission = 'canOpen') {
  requireActiveGift(gift);
  const { open = 'link', send = 'link', read = 'link' } = gift.access || {};
  const token = gift.inviteToken;
  const invited = Boolean(token && typeof invite === 'string' && invite.length === token.length
    && Buffer.byteLength(invite) === token.length
    && timingSafeEqual(Buffer.from(token), Buffer.from(invite)));
  const permissions = {
    canOpen: open === 'link' || invited,
    canSend: send === 'link' || (send === 'invite' && invited),
    canRead: read === 'link' || (read === 'invite' && invited),
    replyAudience: read === 'link' && open === 'link' ? 'link' : read === 'sender' ? 'sender' : 'invite',
    repliesDisabled: send === 'disabled',
  };
  if (!permissions.canOpen || !permissions[permission])
    throw new HttpError(403, 'Bạn không có quyền thực hiện thao tác này. Hãy dùng đường link người gửi đã cấp.');
  return permissions;
}
