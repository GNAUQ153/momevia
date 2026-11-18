import { createHash, randomUUID } from 'node:crypto';
import { HttpError } from '../../shared/http.mjs';

const uuid = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
const replyUuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
export function replyId(giftId, intentId) {
  if (intentId === undefined) return randomUUID();
  if (typeof intentId !== 'string' || !uuid.test(intentId)) throw new HttpError(422, 'Mã gửi lời đáp không hợp lệ.');
  const hex = createHash('sha256').update(`${giftId}:${intentId.toLowerCase()}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function checkReplyReplay(previous, intended) {
  if (previous.name !== intended.name || previous.message !== intended.message)
    throw new HttpError(409, 'Mã gửi lời đáp đã dùng cho nội dung khác.');
  return previous;
}

export function replyView(reply, owner = false) {
  const { readStatus, ...publicFields } = reply;
  return { ...publicFields, ...(owner ? { unread: readStatus === 'unread' } : {}) };
}

export function readRequestIds(body) {
  if (!Array.isArray(body.ids) || body.ids.length < 1 || body.ids.length > 100 ||
      body.ids.some(id => typeof id !== 'string' || !replyUuid.test(id)))
    throw new HttpError(422, 'Chọn các lời đáp đã hiển thị.');
  return new Set(body.ids);
}
