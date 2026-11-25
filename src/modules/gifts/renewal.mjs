import { localizedError } from '../../shared/http.mjs';
import { giftStatus } from './access.mjs';

const DAY = 86400_000;
const WINDOW = 7 * DAY;

// Giữ đường import cũ cho các module và bộ kiểm thử hiện có.
export { giftRenewalDays } from '../../shared/feature-config.mjs';

export function renewalView(gift, days = 0, now = Date.now()) {
  if (giftStatus(gift, now) !== 'active' || gift.senderArchivedAt) return {};
  const expiry = Date.parse(gift.expiresAt);
  const expiringSoon = expiry - now <= WINDOW;
  const eligible = expiringSoon && !gift.senderRenewal && Number.isInteger(days) && days > 0 && days <= 30
    && expiry + days * DAY <= Date.parse('9999-12-31T23:59:59.999Z');
  return { ...(expiringSoon ? { expiringSoon: true } : {}), ...(eligible ? { renewalDays: days } : {}) };
}

// CAS theo hạn hiện tại; retry cùng yêu cầu trả kết quả cũ, không cộng thêm ngày.
// Gọi khi đã khóa bản ghi. Không mở lại link đã đóng hoặc sửa dữ liệu khách mời.
export function renewGift(gift, ownerId, body, days, now = Date.now()) {
  if (!gift || gift.userId !== ownerId) throw localizedError(404, 'errors.gift.notFound');
  if (!body || Object.keys(body).length !== 1 || typeof body.expectedExpiresAt !== 'string'
    || !Number.isFinite(Date.parse(body.expectedExpiresAt))) throw localizedError(422, 'errors.gift.renewInput');
  if (!Number.isInteger(days) || days < 1 || days > 30) throw localizedError(409, 'errors.gift.renewDisabled');
  if (giftStatus(gift, now) !== 'active' || gift.senderArchivedAt) throw localizedError(409, 'errors.gift.renewUnavailable');
  const previous = gift.senderRenewal;
  if (previous?.previousExpiresAt === body.expectedExpiresAt && previous.expiresAt === gift.expiresAt)
    return { expiresAt: gift.expiresAt, replayed: true };
  if (body.expectedExpiresAt !== gift.expiresAt || !renewalView(gift, days, now).renewalDays)
    throw localizedError(409, 'errors.gift.renewUnavailable');
  const expiresAt = new Date(Date.parse(gift.expiresAt) + days * DAY).toISOString();
  gift.senderRenewal = { previousExpiresAt: gift.expiresAt, expiresAt, renewedAt: new Date(now).toISOString() };
  gift.expiresAt = expiresAt;
  return { expiresAt, replayed: false };
}
