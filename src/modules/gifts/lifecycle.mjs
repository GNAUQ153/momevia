import { localizedError } from '../../shared/http.mjs';
import { giftStatus } from './access.mjs';

// Lưu trữ chỉ thay đổi cách tổ chức danh sách Sender, không mở lại link hay hoàn lượt.
// Gọi trong thao tác ghi hiện có để kiểm tra chủ sở hữu và trạng thái mới nhất.
export function setGiftArchive(gift, ownerId, body, now = Date.now()) {
  if (!gift || gift.userId !== ownerId) throw localizedError(404, 'errors.gift.notFound');
  if (!body || Object.keys(body).length !== 1 || typeof body.archived !== 'boolean')
    throw localizedError(422, 'errors.gift.archiveInput');
  if (body.archived && giftStatus(gift, now) === 'active')
    throw localizedError(409, 'errors.gift.archiveActive');
  if (body.archived) gift.senderArchivedAt ||= new Date(now).toISOString();
  else gift.senderArchivedAt = null;
  return { senderArchivedAt: gift.senderArchivedAt };
}
