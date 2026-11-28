import { text } from '../../core/i18n.js';

// Không lưu token hay danh sách phiên ở client; xác nhận trước khi gửi thao tác thu hồi.
export function mountSessionSecurity(host, { api, isCurrent = () => true }) {
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const active = () => !signal.aborted && isCurrent();
  let phase = 'idle';
  function render() {
    if (!active()) return;
    const button = (action, key, disabled = false) => `<button type="button" class="btn btn--outline" data-session-action="${action}"${disabled ? ' disabled' : ''}>${text(key)}</button>`;
    if (phase === 'expired') {
      host.innerHTML = `<p role="alert">${text('privacyCenter.sessionExpired')}</p><a href="/login" data-link>${text('shell.pages.login')}</a>`;
      return;
    }
    if (phase === 'confirm' || phase === 'pending') {
      host.innerHTML = `<p class="privacy-note">${text('sessionSecurity.confirmNote')}</p>${button('confirm', phase === 'pending' ? 'sessionSecurity.pending' : 'sessionSecurity.confirm', phase === 'pending')} ${button('cancel', 'sessionSecurity.cancel', phase === 'pending')}`;
      return;
    }
    const message = phase === 'success' ? `<p role="status">${text('sessionSecurity.success')}</p>` : phase === 'error' ? `<p role="alert">${text('sessionSecurity.failure')}</p>` : '';
    host.innerHTML = `${message}${button('open', 'sessionSecurity.action')}`;
  }
  async function revoke() {
    if (!active() || phase !== 'confirm') return;
    phase = 'pending';
    render();
    try {
      const result = await api.post('/auth/sessions/revoke-others', { confirm: true }, { signal, cache: 'no-store' });
      if (result?.ok !== true) throw new Error('Invalid session response');
      if (active()) phase = 'success';
    } catch (error) {
      if (active()) phase = [401, 403].includes(error.status) ? 'expired' : 'error';
    }
    render();
  }
  host.addEventListener('click', event => {
    if (!active() || phase === 'pending') return;
    const action = event.target.closest('[data-session-action]')?.dataset.sessionAction;
    if (action === 'open' && ['idle', 'success', 'error'].includes(phase)) { phase = 'confirm'; render(); }
    else if (action === 'cancel' && phase === 'confirm') { phase = 'idle'; render(); }
    else if (action === 'confirm') void revoke();
  }, { signal });
  render();
  return { dispose() { lifetime.abort(); host.replaceChildren(); } };
}
