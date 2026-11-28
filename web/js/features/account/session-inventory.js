import { text } from '../../core/i18n.js';

const limit = 50;
const date = value => text('accountSessions.date', { date: { format: 'date', value, options: { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' } } });
const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

export function sessionPage() {
  return `<section class="legal-hero"><div class="container"><h1>${text('shell.pages.accountSessions')}</h1><p>${text('accountSessions.intro')}</p></div></section>
  <section class="legal-body"><div class="container session-inventory"><a href="/studio" data-link>${text('shell.nav.studio')}</a><div data-session-inventory aria-live="polite"></div></div></section>`;
}

const validRef = value => typeof value === 'string' && value.length === 64 && /^[a-f0-9]{64}$/.test(value);

export function inventoryView(data, selected = null) {
  const rows = data?.sessions;
  if (!Array.isArray(rows) || !rows.length || rows.length > limit || rows.filter(row => row?.current === true).length !== 1 ||
      typeof data.truncated !== 'boolean' || !Number.isSafeInteger(data.unclassifiedCount) || data.unclassifiedCount < 0 ||
      rows.some(row => !row || typeof row.current !== 'boolean' || !validDate(row.expiresAt) || (row.issuedAt !== null && !validDate(row.issuedAt)) ||
        (row.revokeRef !== undefined && (row.current || !validRef(row.revokeRef))))) throw new Error('Invalid session inventory');
  const refs = rows.filter(row => row.revokeRef !== undefined).map(row => row.revokeRef);
  if (new Set(refs).size !== refs.length) throw new Error('Duplicate session action reference');
  const action = row => !row.revokeRef ? '' : row.revokeRef === selected
    ? `<div class="session-revoke-confirm"><p>${text('accountSessions.confirmNote')}</p><div class="session-revoke-actions">
      <button type="button" class="btn btn--outline" data-session-confirm="${row.revokeRef}">${text('accountSessions.confirm')}</button>
      <button type="button" class="btn btn--outline" data-session-cancel>${text('accountSessions.cancel')}</button></div></div>`
    : `<button type="button" class="btn btn--outline" data-session-revoke="${row.revokeRef}">${text('accountSessions.revoke')}</button>`;
  const sorted = [...rows].sort((a, b) => Number(b.current) - Number(a.current));
  return `<ul class="session-inventory-list">${sorted.map(row => `<li><strong>${text(row.current ? 'accountSessions.current' : 'accountSessions.other')}</strong>
    <dl><div><dt>${text('accountSessions.issued')}</dt><dd>${row.issuedAt === null ? text('accountSessions.unknown') : date(row.issuedAt)}</dd></div>
    <div><dt>${text('accountSessions.expires')}</dt><dd>${date(row.expiresAt)}</dd></div></dl>${action(row)}</li>`).join('')}</ul>
    ${data.unclassifiedCount ? `<p>${text('accountSessions.legacy', { count: data.unclassifiedCount })}</p>` : ''}
    ${data.truncated ? `<p>${text('accountSessions.truncated')}</p>` : ''}
    <button type="button" class="btn btn--outline" data-session-refresh>${text('accountSessions.refresh')}</button>`;
}

export function mountSessionInventory(host, { api, isCurrent = () => true }) {
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const active = () => !signal.aborted && isCurrent();
  let pending = false, model = null, selected = null;
  function render(notice = '') {
    if (active() && model) host.innerHTML = (notice ? `<p role="status">${text(notice)}</p>` : '') + inventoryView(model, selected);
  }
  function failure(error, revoking = false) {
    if (!active()) return;
    if ([401, 403].includes(error.status)) host.innerHTML = `<p role="alert">${text('errors.unauthorized')}</p><a href="/login" data-link>${text('shell.pages.login')}</a>`;
    else host.innerHTML = `<p role="alert">${text(revoking ? (error.status === 404 ? 'accountSessions.unavailable' : error.status === 429 ? 'errors.auth.attempts' : 'accountSessions.revokeFailure') : 'accountSessions.failure')}</p><button class="btn btn--outline" type="button" data-session-refresh>${text('common.actions.retry')}</button>`;
  }
  async function load(notice = '') {
    if (!active() || pending) return;
    pending = true; model = null; selected = null;
    host.setAttribute('aria-busy', 'true');
    host.innerHTML = (notice ? `<p role="status">${text(notice)}</p>` : '') + `<p role="status">${text('accountSessions.loading')}</p>`;
    try {
      const data = await api.get('/auth/sessions', { signal, cache: 'no-store' });
      if (active()) { inventoryView(data); model = data; render(notice); }
    } catch (error) {
      failure(error);
      if (active() && notice) host.innerHTML = `<p role="status">${text(notice)}</p>` + host.innerHTML;
    } finally {
      pending = false;
      if (active()) host.removeAttribute('aria-busy');
    }
  }
  async function revoke(ref) {
    if (!active() || pending || !model || ref !== selected || !validRef(ref) ||
      !model.sessions.some(row => !row.current && row.revokeRef === ref)) return;
    pending = true; model = null; selected = null;
    host.setAttribute('aria-busy', 'true');
    host.innerHTML = `<p role="status">${text('accountSessions.revoking')}</p>`;
    let success = false;
    try {
      const result = await api.post('/auth/sessions/revoke', { ref, confirm: true }, { signal, cache: 'no-store' });
      if (result?.ok !== true) throw new Error('Invalid revoke response');
      success = true;
    } catch (error) { failure(error, true); }
    finally {
      pending = false;
      if (active()) host.removeAttribute('aria-busy');
    }
    if (success && active()) await load('accountSessions.revoked');
  }
  host.addEventListener('click', event => {
    if (!active() || pending) return;
    if (event.target.closest('[data-session-refresh]')) { void load(); return; }
    if (!model) return;
    const ref = event.target.closest('[data-session-revoke]')?.dataset.sessionRevoke;
    const confirm = event.target.closest('[data-session-confirm]')?.dataset.sessionConfirm;
    if (validRef(ref) && model.sessions.some(row => row.revokeRef === ref && !row.current)) { selected = ref; render(); host.querySelector?.('[data-session-confirm]')?.focus(); }
    else if (event.target.closest('[data-session-cancel]')) { const previous = selected; selected = null; render(); if (validRef(previous)) host.querySelector?.(`[data-session-revoke="${previous}"]`)?.focus(); }
    else if (confirm) void revoke(confirm);
  }, { signal });
  return { ready: load(), dispose() { lifetime.abort(); model = null; selected = null; host.replaceChildren(); } };
}
