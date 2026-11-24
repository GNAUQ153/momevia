import { timingSafeEqual } from 'node:crypto';
import { localizedError } from '../../shared/http.mjs';
import { randomId } from '../../shared/security.mjs';
import { giftLinkPermissions } from '../../../web/js/shared/gift-permissions.js';

export function giftStatus(gift, now = Date.now()) {
  if (gift.revokedAt) return 'revoked';
  // Thiếu thời hạn hoặc thời hạn lỗi không được biến thành link có hiệu lực vô hạn.
  const expires = typeof gift.expiresAt === 'string' ? Date.parse(gift.expiresAt) : NaN;
  return !Number.isFinite(expires) || expires <= now ? 'expired' : 'active';
}

export function requireActiveGift(gift) {
  const status = giftStatus(gift);
  if (status === 'active') return;
  const error = localizedError(410, status === 'revoked' ? 'errors.gift.revoked' : 'errors.gift.expired');
  error.code = status === 'revoked' ? 'GIFT_REVOKED' : 'GIFT_EXPIRED';
  throw error;
}

export function createGiftAccess(input) {
  // Thiệp mới mặc định chỉ chủ sở hữu đọc lời đáp; giữ nguyên quyền của thiệp cũ.
  if (input === undefined) return { access: { open: 'link', send: 'link', read: 'sender' } };
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 3
    || !['link', 'invite'].includes(input.open)
    || !['link', 'invite', 'disabled'].includes(input.send)
    || !['link', 'invite', 'sender'].includes(input.read)) {
    throw localizedError(422, 'errors.gift.accessOptions');
  }
  const access = { open: input.open, send: input.send, read: input.read };
  return { access, ...(Object.values(access).includes('invite') ? { inviteToken: randomId(32) } : {}) };
}

export function requireGiftPermission(gift, invite, permission = 'canOpen') {
  requireActiveGift(gift);
  const token = gift.inviteToken;
  const invited = Boolean(token && typeof invite === 'string' && invite.length === token.length
    && Buffer.byteLength(invite) === token.length
    && timingSafeEqual(Buffer.from(token), Buffer.from(invite)));
  const permissions = giftLinkPermissions(gift.access, invited);
  if (!permissions.canOpen || !permissions[permission])
    throw localizedError(403, 'errors.gift.permission');
  return permissions;
}
