import { text } from '../../core/i18n.js';

// Mật khẩu chỉ tồn tại trong form và request; không lưu vào state ứng dụng hoặc storage.
export function mountPasswordChange(host, { api, isCurrent = () => true }) {
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const active = () => !signal.aborted && isCurrent();
  let pending = false;
  const login = () => `<a class="btn btn--outline" href="/login">${text('shell.pages.login')}</a>`;
  const field = (name, autocomplete, key) => `<label>${text(key)}<input type="password" name="${name}" autocomplete="${autocomplete}" maxlength="128" required></label>`;
  host.innerHTML = `<form class="privacy-password-form" data-password-form method="post" novalidate>
    ${field('currentPassword', 'current-password', 'passwordChange.current')}
    ${field('password', 'new-password', 'passwordChange.new')}
    <p id="password-change-hint">${text('auth.password.hint')}</p>
    ${field('confirmPassword', 'new-password', 'passwordChange.confirm')}
    <label class="privacy-password-confirm"><input type="checkbox" name="confirmLogout" required>${text('passwordChange.confirmLogout')}</label>
    <p role="alert" data-password-error></p>
    <button type="submit" class="btn btn--outline">${text('passwordChange.action')}</button>
  </form>`;
  const form = host.querySelector('[data-password-form]');
  const error = host.querySelector('[data-password-error]');
  const submit = form.querySelector('button');
  form.elements.password.setAttribute('aria-describedby', 'password-change-hint');
  const setError = key => { error.textContent = text(key); };
  host.addEventListener('submit', async event => {
    if (event.target !== form) return;
    event.preventDefault();
    if (!active() || pending) return;
    const { currentPassword, password, confirmPassword, confirmLogout } = form.elements;
    error.textContent = '';
    let key, invalid;
    if (!currentPassword.value) { key = 'errors.auth.currentPassword'; invalid = currentPassword; }
    else if (password.value.length < 8) { key = 'errors.auth.passwordLength'; invalid = password; }
    else if (password.value.length > 128) { key = 'errors.auth.passwordTooLong'; invalid = password; }
    else if (!/[A-Z]/.test(password.value) || !/[0-9]/.test(password.value)) { key = 'errors.auth.passwordComposition'; invalid = password; }
    else if (password.value !== confirmPassword.value) { key = 'auth.password.mismatch'; invalid = confirmPassword; }
    else if (password.value === currentPassword.value) { key = 'errors.auth.passwordUnchanged'; invalid = password; }
    else if (!confirmLogout.checked) { key = 'passwordChange.confirmRequired'; invalid = confirmLogout; }
    if (key) { setError(key); invalid.focus(); return; }
    const body = { currentPassword: currentPassword.value, password: password.value, confirmPassword: confirmPassword.value, confirmLogout: true };
    // Xóa ngay dữ liệu khỏi DOM; yêu cầu lại mật khẩu nếu cần thử lại.
    form.reset(); pending = true; submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    for (const input of form.querySelectorAll('input')) input.disabled = true;
    try {
      const result = await api.post('/auth/password/change', body, { signal, cache: 'no-store' });
      if (result?.ok !== true) throw new Error('Invalid password change response');
      if (active()) host.innerHTML = `<p role="status">${text('passwordChange.success')}</p>${login()}`;
    } catch (err) {
      if (!active()) return;
      if (err.status === 401) host.innerHTML = `<p role="alert">${text('privacyCenter.sessionExpired')}</p>${login()}`;
      else if (err.status === 409) host.innerHTML = `<p role="alert">${text('errors.auth.credentialChanged')}</p>${login()}`;
      else if (err.status === 400) setError('passwordChange.rejected');
      else if (err.status === 429) setError('errors.auth.attempts');
      else setError('passwordChange.failure');
    } finally {
      body.currentPassword = body.password = body.confirmPassword = '';
      pending = false;
      if (active() && host.contains(form)) {
        submit.disabled = false; form.removeAttribute('aria-busy');
        for (const input of form.querySelectorAll('input')) input.disabled = false;
      }
    }
  }, { signal });
  return { dispose() { lifetime.abort(); form.reset(); host.replaceChildren(); } };
}
