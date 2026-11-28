import { text } from '../../core/i18n.js';
import { escapeHtml as e } from '../../core/api.js';
import { withdrawalHistoryLimit } from '../../shared/privacy-requests.js';

const states = new Set(['new', 'in_progress', 'resolved']);
export function privacyRequestsView(data) {
  if (!Array.isArray(data?.requests) || data.requests.length > withdrawalHistoryLimit) throw new Error('Invalid request history');
  const rows = data.requests.map(({ code, status, createdAt }) => {
    if (typeof code !== 'string' || !/^HT-\d{4}-[A-F0-9]{8}$/.test(code) || !states.has(status) ||
      typeof createdAt !== 'string' || !Number.isFinite(Date.parse(createdAt))) throw new Error('Invalid request');
    return `<li><strong>${e(code)}</strong><span>${text(`privacyCenter.requestStatus.${status}`)}</span><small>${text('privacyCenter.dateValue', { date: { format: 'date', value: createdAt, options: { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' } } })} (UTC)</small></li>`;
  });
  return (rows.length ? `<ul class="privacy-request-list">${rows.join('')}</ul>` : `<p>${text('privacyCenter.noRequests')}</p>`) +
    `<button type="button" class="btn btn--outline" data-privacy-requests-refresh>${text('privacyCenter.refreshRequests')}</button>`;
}

// Vòng đời độc lập với bằng chứng consent; không hiển thị phản hồi của phiên đã rời trang.
export function mountPrivacyRequests(host, { api, isCurrent = () => true }) {
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const active = () => !signal.aborted && isCurrent();
  let sequence = 0;
  async function load() {
    if (!active()) return;
    const id = ++sequence;
    host.setAttribute('aria-busy', 'true');
    host.innerHTML = `<p role="status">${text('privacyCenter.loading')}</p>`;
    try {
      const data = await api.get('/support/privacy-requests', { signal, cache: 'no-store' });
      if (active() && id === sequence) host.innerHTML = privacyRequestsView(data);
    } catch (error) {
      if (!active() || id !== sequence) return;
      host.innerHTML = [401, 403].includes(error.status)
        ? `<p role="alert">${text('privacyCenter.sessionExpired')}</p><a href="/login" data-link>${text('shell.pages.login')}</a>`
        : `<p role="alert">${text('privacyCenter.requestsFailed')}</p><button type="button" class="btn btn--outline" data-privacy-requests-refresh>${text('common.actions.retry')}</button>`;
    } finally {
      if (active() && id === sequence) host.removeAttribute('aria-busy');
    }
  }
  host.addEventListener('click', event => {
    if (event.target.closest('[data-privacy-requests-refresh]')) void load();
  }, { signal });
  return { ready: load(), load, dispose() { lifetime.abort(); host.replaceChildren(); } };
}
