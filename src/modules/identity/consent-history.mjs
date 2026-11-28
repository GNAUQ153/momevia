import { localizedError } from '../../shared/http.mjs';
import { registrationPolicyVersion } from '../../../web/js/shared/registration-consent.js';
import { consentReceipt, policyDigest, policySnapshot } from './policy-archive.mjs';

function confirmationReceipt(evidence) {
  if (evidence?.source !== 'policy-confirmation' || evidence.purpose !== 'policy-confirmation') return null;
  const result = consentReceipt({ registrationConsent: { ...evidence, source: 'email-registration', purpose: 'account-creation' } });
  return result.receipt ? { status: result.status, receipt: { ...result.receipt, source: evidence.source, purpose: evidence.purpose } } : null;
}

// Bằng chứng lúc đăng ký luôn giữ nguyên; mỗi lần xác nhận lại là một bản ghi riêng.
export function consentHistory(user, locale) {
  const language = locale === 'en' ? 'en' : 'vi';
  const snapshot = policySnapshot(registrationPolicyVersion);
  const digest = policyDigest(registrationPolicyVersion, language);
  if (!snapshot || !digest) throw new Error('Missing active registration policy archive');
  const original = consentReceipt(user);
  const stored = user.policyConfirmations === undefined ? [] : user.policyConfirmations;
  const confirmations = Array.isArray(stored) ? stored.map(confirmationReceipt) : [];
  const historyValid = Array.isArray(stored) && confirmations.every(Boolean);
  const history = [...(original.receipt ? [{ status: original.status, receipt: original.receipt }] : []), ...confirmations.filter(Boolean)]
    .sort((a, b) => Date.parse(b.receipt.acceptedAt) - Date.parse(a.receipt.acceptedAt));
  const confirmed = history.some(item => item.status === 'digest-matched' && item.receipt.version === snapshot.version);
  return { current: { version: snapshot.version, locale: language, digest, status: snapshot.status, snapshot },
    history, historyValid, confirmed };
}

export function confirmationEvidence(input) {
  if (input?.terms !== true || input?.privacy !== true) throw localizedError(400, 'errors.auth.consentRequired');
  if (!['vi', 'en'].includes(input.locale) || input.version !== registrationPolicyVersion ||
    typeof input.digest !== 'string' || input.digest !== policyDigest(registrationPolicyVersion, input.locale)) {
    throw localizedError(409, 'errors.auth.consentVersion');
  }
  return { version: registrationPolicyVersion, terms: true, privacy: true, purpose: 'policy-confirmation',
    source: 'policy-confirmation', locale: input.locale, policyDigest: input.digest, acceptedAt: new Date().toISOString() };
}

export async function confirmPolicy(users, userId, input) {
  const evidence = confirmationEvidence(input);
  // mutate khóa hàng MySQL trong transaction; JSON repo thực hiện đồng bộ trong một tiến trình.
  const updated = await users.mutate(userId, user => {
    const state = consentHistory(user, evidence.locale);
    if (!state.historyValid) throw localizedError(409, 'errors.auth.consentHistoryInvalid');
    if (state.confirmed) return null;
    return { policyConfirmations: [...(user.policyConfirmations ?? []), evidence] };
  });
  if (!updated) throw localizedError(401, 'errors.unauthorized');
  return consentHistory(updated, evidence.locale);
}
