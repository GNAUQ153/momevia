import { createHash, randomUUID } from 'node:crypto';
import { localizedError } from '../../shared/http.mjs';

const uuid = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
const replyUuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
export function replyId(giftId, intentId) {
  if (intentId === undefined) return randomUUID();
  if (typeof intentId !== 'string' || !uuid.test(intentId)) throw localizedError(422, 'errors.gift.replyIntent');
  const hex = createHash('sha256').update(`${giftId}:${intentId.toLowerCase()}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function checkReplyReplay(previous, intended) {
  if (previous.name !== intended.name || previous.message !== intended.message || previous.recipientId !== intended.recipientId)
    throw localizedError(409, 'errors.gift.replyConflict');
  return previous;
}

export function replyView(reply, owner = false) {
  const { readStatus, recipientId, cardName, ...publicFields } = reply;
  return { ...publicFields, ...(owner ? { recipientId, cardName, unread: readStatus === 'unread' } : {}) };
}

export function readRequestIds(body) {
  if (!Array.isArray(body.ids) || body.ids.length < 1 || body.ids.length > 100 ||
      body.ids.some(id => typeof id !== 'string' || !replyUuid.test(id)))
    throw localizedError(422, 'errors.gift.replySelection');
  return new Set(body.ids);
}
