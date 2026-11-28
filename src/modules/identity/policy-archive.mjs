import { createHash } from 'node:crypto';
import initial from './policy-archive/2026-11-28.1.json' with { type: 'json' };
import { registrationPolicyVersion } from '../../../web/js/shared/registration-consent.js';

// Lưu bản chụp chính sách bất biến theo phiên bản; không lấy văn bản mới thay cho bản cũ.
const versions = new Map([[initial.version, initial]]);

export function policyDigest(version, locale) {
  const archive = versions.get(version);
  const translations = archive?.translations[locale];
  if (!translations || !['vi', 'en'].includes(locale)) return null;
  const entries = Object.entries(translations).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  return createHash('sha256').update(JSON.stringify([version, archive.status, locale, entries])).digest('hex');
}

export function policySnapshot(version) {
  const archive = versions.get(version);
  return archive ? structuredClone(archive) : null;
}

// Không suy diễn người dùng cũ đã đồng ý; chỉ trả các trường bằng chứng được phép.
export function consentReceipt(user) {
  const evidence = user.registrationConsent;
  if (!evidence) return { currentVersion: registrationPolicyVersion, status: 'not-recorded', receipt: null };
  const { version, terms, privacy, purpose, source, locale, acceptedAt, policyDigest: recordedDigest } = evidence;
  const valid = typeof version === 'string' && terms === true && privacy === true &&
    purpose === 'account-creation' && ['email-registration', 'google-registration', 'zalo-registration'].includes(source) &&
    ['vi', 'en'].includes(locale) && typeof acceptedAt === 'string' && Number.isFinite(Date.parse(acceptedAt));
  if (!valid) return { currentVersion: registrationPolicyVersion, status: 'unrecognized', receipt: null };
  const digest = policyDigest(version, locale);
  const status = !digest ? 'archive-unavailable' : recordedDigest === undefined ? 'version-only' :
    recordedDigest === digest ? 'digest-matched' : 'digest-mismatch';
  return {
    currentVersion: registrationPolicyVersion, status,
    receipt: { version, terms, privacy, purpose, source, locale, acceptedAt,
      policyDigest: typeof recordedDigest === 'string' && /^[a-f0-9]{64}$/.test(recordedDigest) ? recordedDigest : null },
  };
}
