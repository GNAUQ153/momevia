import { text } from '../../core/i18n.js';
import { escapeHtml as e } from '../../core/api.js';
import { archiveView, privacyFailure } from '../../pages/privacy.js';

const versionPattern = /^\d{4}-\d{2}-\d{2}\.\d{1,8}$/;
const statuses = new Set(['digest-matched', 'version-only', 'archive-unavailable', 'digest-mismatch']);
const sources = new Set(['email-registration', 'google-registration', 'zalo-registration', 'policy-confirmation']);

export function historyView(data) {
  const current = data?.current;
  if (!current || !versionPattern.test(current.version) || !['vi', 'en'].includes(current.locale) ||
    !/^[a-f0-9]{64}$/.test(current.digest) || !['draft', 'published'].includes(current.status) ||
    current.snapshot?.status !== current.status || typeof data.confirmed !== 'boolean' ||
    typeof data.historyValid !== 'boolean' || !Array.isArray(data.history)) throw new Error('Invalid consent history');
  const rows = data.history.map(({ status, receipt }) => {
    if (!receipt || !statuses.has(status) || !sources.has(receipt.source) || !['vi', 'en'].includes(receipt.locale) ||
      typeof receipt.version !== 'string' || !Number.isFinite(Date.parse(receipt.acceptedAt))) throw new Error('Invalid history receipt');
    return `<li><strong>${e(receipt.version)} — ${text(`privacyCenter.source.${receipt.source}`)}</strong><span>${text(`privacyCenter.status.${status}`)}</span><small>${text('privacyCenter.dateValue', { date: { format: 'date', value: receipt.acceptedAt, options: { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' } } })} (UTC) · ${text(`privacyCenter.language.${receipt.locale}`)}</small></li>`;
  });
  const archive = archiveView(current.snapshot, { version: current.version, locale: current.locale });
  const translation = current.snapshot.translations[current.locale];
  const checkbox = (name, label, link) => `<label lang="${current.locale}"><input type="checkbox" name="${name}" required> <span>${e(translation[label])} ${e(translation[link])}.</span></label>`;
  const form = !data.historyValid || data.confirmed ? '' : `<details class="privacy-confirmation-preview"><summary>${text('privacyCenter.confirmPreview')}</summary>${archive}
    <form data-policy-confirm class="privacy-confirmation-form">${checkbox('terms', 'auth.register.acceptTerms', 'auth.register.terms')}${checkbox('privacy', 'auth.register.acceptPrivacy', 'shell.footer.privacy')}
      <button type="submit" class="btn btn--outline">${text('privacyCenter.confirmPolicy')}</button><p data-policy-confirm-status role="status"></p></form></details>`;
  return `<p>${text('privacyCenter.confirmationNote')}</p>${current.status === 'draft' ? `<p class="legal-draft">${text('privacyCenter.confirmDraft')}</p>` : ''}
    <p role="status">${text(!data.historyValid ? 'privacyCenter.historyInvalid' : data.confirmed ? 'privacyCenter.confirmedCurrent' : 'privacyCenter.confirmationAvailable')}</p>
    ${rows.length ? `<ul class="privacy-request-list">${rows.join('')}</ul>` : `<p>${text('privacyCenter.noConfirmations')}</p>`}${form}
    <button type="button" class="btn btn--outline" data-policy-history-refresh>${text('privacyCenter.refreshRequests')}</button>`;
}

export function mountConsentHistory(host, { api, isCurrent = () => true }) {
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const active = () => !signal.aborted && isCurrent();
  let model, loading = false, submitting = false;
  async function load() {
    if (!active() || loading || submitting) return;
    loading = true;
    model = undefined;
    host.setAttribute('aria-busy', 'true');
    host.innerHTML = `<p role="status">${text('privacyCenter.loading')}</p>`;
    try {
      const data = await api.get('/auth/consent/history', { signal, cache: 'no-store' });
      if (!active()) return;
      host.innerHTML = historyView(data);
      model = data;
    } catch (error) {
      if (active()) host.innerHTML = privacyFailure(error.status).replace('data-privacy-retry', 'data-policy-history-refresh');
    } finally {
      loading = false;
      if (active()) host.removeAttribute('aria-busy');
    }
  }
  async function submit(form) {
    if (!active() || !model || model.confirmed || !model.historyValid || submitting || loading) return;
    if (!form.elements.terms.checked || !form.elements.privacy.checked) return;
    const button = form.querySelector('button[type="submit"]');
    const status = form.querySelector('[data-policy-confirm-status]');
    const { version, locale, digest } = model.current;
    submitting = true;
    button.disabled = true;
    status.innerHTML = text('privacyCenter.loading');
    try {
      const data = await api.post('/auth/consent/confirm', { version, locale, digest, terms: true, privacy: true }, { signal, cache: 'no-store' });
      if (!active()) return;
      host.innerHTML = historyView(data);
      model = data;
    } catch (error) {
      if (active()) status.innerHTML = text(error.status === 409 ? 'privacyCenter.confirmStale' : [401, 403].includes(error.status) ? 'privacyCenter.sessionExpired' : 'privacyCenter.confirmFailed');
    } finally {
      submitting = false;
      if (active()) button.disabled = false;
    }
  }
  host.addEventListener('click', event => {
    if (event.target.closest('[data-policy-history-refresh]')) void load();
  }, { signal });
  host.addEventListener('submit', event => {
    const form = event.target.closest('[data-policy-confirm]');
    if (form) { event.preventDefault(); void submit(form); }
  }, { signal });
  return { ready: load(), dispose() { lifetime.abort(); model = undefined; host.replaceChildren(); } };
}
