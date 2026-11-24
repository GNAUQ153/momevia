import { randomUUID, timingSafeEqual } from 'node:crypto';
import { randomId } from '../../shared/security.mjs';
import { localizedError } from '../../shared/http.mjs';
import { validateRecipientSettings, validRecipientName } from '../../../web/js/shared/recipient-naming.js';

export function namingError(key, status = 422) { return localizedError(status, key); }
export function checkedSettings(settings) {
  if (!settings) return null;
  try { return validateRecipientSettings(settings); } catch (error) { throw namingError(error.message); }
}
export function requireNamingEnabled(settings, ownerId) {
  const owners = process.env.RECIPIENT_NAMING_OWNER_IDS?.split(',').map(id => id.trim()).filter(Boolean);
  if (settings?.mode !== 'manual' && (process.env.RECIPIENT_NAMING_ENABLED === 'false' || (owners?.length && !owners.includes(ownerId)))) throw namingError('recipient.error.disabled', 503);
}
export function createRecipients(settings, ownerId) {
  if (!settings) return {};
  checkedSettings(settings); requireNamingEnabled(settings, ownerId);
  if (settings.mode === 'list' && !settings.names?.length) throw namingError('recipient.error.list');
  return { recipientMode: settings.mode, recipientTextVersion: 1, recipients: settings.mode === 'list'
    ? settings.names.map(item => ({ id: randomUUID(), token: randomId(32), name: item.name.trim().normalize('NFC'), row: item.row, source: 'list', createdAt: new Date().toISOString() })) : [] };
}
export function receiptFor(gift, token, required = true) {
  if (!['list', 'self'].includes(gift.recipientMode)) return null;
  const record = typeof token === 'string' && gift.recipients?.find(r => r.token.length === token.length
    && Buffer.byteLength(token) === Buffer.byteLength(r.token) && timingSafeEqual(Buffer.from(r.token), Buffer.from(token)));
  if (!record && required) throw namingError('recipient.error.receipt', 403);
  return record || null;
}
export function confirmRecipient(gift, body) {
  if (gift.recipientMode !== 'self' || !body || !/^[A-Za-z0-9_-]{43}$/.test(body.token || '') || !validRecipientName(body.name)) throw namingError('recipient.error.name');
  const name = body.name.trim().normalize('NFC');
  const previous = receiptFor(gift, body.token, false);
  if (previous) {
    if (previous.name !== name) throw namingError('recipient.error.retry', 409);
    return previous;
  }
  // A shared link already issued stays usable when new link creation is off.
  if (process.env.RECIPIENT_CONFIRMATIONS_ENABLED === 'false') throw namingError('recipient.error.disabled', 503);
  if ((gift.recipients?.length || 0) >= 1000) throw namingError('recipient.error.capacity', 409);
  const record = { id: randomUUID(), token: body.token, name, source: 'self', createdAt: new Date().toISOString(), confirmedAt: new Date().toISOString() };
  (gift.recipients ||= []).push(record);
  return record;
}
