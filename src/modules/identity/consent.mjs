import { policyDigest } from './policy-archive.mjs';
import { localizedError } from '../../shared/http.mjs';
import { registrationPolicyVersion } from '../../../web/js/shared/registration-consent.js';

// Chỉ nhận hai boolean thật; thời điểm và phạm vi xác nhận do máy chủ quyết định.
export function registrationEvidence(consent, locale) {
  if (consent?.terms !== true || consent?.privacy !== true) {
    throw localizedError(400, 'errors.auth.consentRequired');
  }
  if (consent.version !== registrationPolicyVersion) {
    throw localizedError(409, 'errors.auth.consentVersion');
  }
  const language = locale === 'en' ? 'en' : 'vi';
  const digest = policyDigest(registrationPolicyVersion, language);
  if (!digest) throw new Error('Missing active registration policy archive');
  return {
    version: registrationPolicyVersion,
    terms: true,
    privacy: true,
    purpose: 'account-creation',
    source: 'email-registration',
    locale: language,
    policyDigest: digest,
    acceptedAt: new Date().toISOString(),
  };
}
