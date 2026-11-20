import { timingSafeEqual } from 'node:crypto';
import { localizedError } from '../../shared/http.mjs';
import { randomId } from '../../shared/security.mjs';
import { giftLinkPermissions } from '../../../web/js/shared/gift-permissions.js';

export function giftStatus(gift) {
  if (gift.revokedAt) return 'revoked';
  return Date.parse(gift.expiresAt) <= Date.now() ? 'expired' : 'active';
}

export function requireActiveGift(gift) {
  const status = giftStatus(gift);
  if (status === 'active') return;
  const error = localizedError(410, status === 'revoked' ? 'errors.gift.revoked' : 'errors.gift.expired');
  error.code = status === 'revoked' ? 'GIFT_REVOKED' : 'GIFT_EXPIRED';
  throw error;
}

export function createGiftAccess(input) {
  if (input === undefined) return {};
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
