import { text } from '../../core/i18n.js';
import { archiveView, privacyFailure, receiptModel, receiptView } from '../../pages/privacy.js';
import { mountPrivacyRequests } from './privacy-requests.js';
import { mountConsentHistory } from './consent-history.js';
import { mountSessionSecurity } from './session-security.js';
import { mountPasswordChange } from './password-change.js';

// Mỗi lần mở trang có vòng đời riêng, không cache bằng chứng tài khoản ở localStorage.
export function mountPrivacyCenter(root, { api, isCurrent = () => true }) {
  const host = root.querySelector('[data-privacy-receipt]');
  const lifetime = new AbortController();
  const { signal } = lifetime;
  let model, loading = false, archiveLoading = false;
  const active = () => !signal.aborted && isCurrent();
  async function load() {
    if (!active() || loading) return;
    loading = true;
    model = undefined;
    host.setAttribute('aria-busy', 'true');
    host.innerHTML = `<p role="status">${text('privacyCenter.loading')}</p>`;
    try {
      const data = await api.get('/auth/consent', { signal, cache: 'no-store' });
      if (!active()) return;
      model = receiptModel(data);
      host.innerHTML = receiptView(model);
    } catch (error) {
      if (active()) host.innerHTML = privacyFailure(error.status);
    } finally {
      loading = false;
      if (active()) host.removeAttribute('aria-busy');
    }
  }
  async function loadArchive(button) {
    const target = host.querySelector('[data-privacy-archive-result]');
    const receipt = model?.receipt;
    if (!active() || archiveLoading || !target || !receipt) return;
    archiveLoading = true;
    button.disabled = true;
    target.setAttribute('aria-busy', 'true');
    target.innerHTML = `<p role="status">${text('privacyCenter.loading')}</p>`;
    try {
      const archive = await api.get(`/auth/policies/${encodeURIComponent(receipt.version)}`, { signal, cache: 'no-store' });
      if (active()) target.innerHTML = archiveView(archive, receipt);
    } catch (error) {
      if (active()) target.innerHTML = privacyFailure(error.status, { archive: true });
    } finally {
      archiveLoading = false;
      if (active()) {
        button.disabled = false;
        target.removeAttribute('aria-busy');
      }
    }
  }
  host.addEventListener('click', event => {
    const retry = event.target.closest('[data-privacy-retry]');
    const archive = event.target.closest('[data-privacy-archive]');
    if (retry) void load();
    else if (archive) void loadArchive(archive);
  }, { signal });
  const requestsHost = root.querySelector('[data-privacy-requests]');
  const requests = requestsHost ? mountPrivacyRequests(requestsHost, { api, isCurrent: active }) : null;
  const historyHost = root.querySelector('[data-consent-history]');
  const history = historyHost ? mountConsentHistory(historyHost, { api, isCurrent: active }) : null;
  const securityHost = root.querySelector('[data-session-security]');
  const security = securityHost ? mountSessionSecurity(securityHost, { api, isCurrent: active }) : null;
  const passwordHost = root.querySelector('[data-password-change]');
  const password = passwordHost ? mountPasswordChange(passwordHost, { api, isCurrent: active }) : null;
  return { ready: Promise.all([load(), requests?.ready, history?.ready]), refreshPrivacyRequests: () => requests?.load(),
    dispose() { lifetime.abort(); requests?.dispose(); history?.dispose(); security?.dispose(); password?.dispose(); model = undefined; host.replaceChildren(); } };
}
