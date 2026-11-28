import { message, setText } from '../../core/i18n.js';
import { api, errorCopy } from '../../core/api.js';
import { registrationConsent } from '../../shared/registration-consent.js';

// Kiểm tra theo chính sách mật khẩu và độ dài của backend hiện tại.
export function registrationErrors({ name = '', email = '', password = '', confirmPassword = '', terms = false, privacy = false } = {}) {
  const errors = {};
  if (name.trim().length < 2 || name.trim().length > 50) errors.name = 'auth.validation.name';
  if (email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'auth.validation.email';
  if (password.length < 8) errors.password = 'errors.auth.passwordLength';
  else if (password.length > 128) errors.password = 'errors.auth.passwordTooLong';
  else if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) errors.password = 'errors.auth.passwordComposition';
  if (!confirmPassword) errors.confirmPassword = 'auth.validation.confirm';
  else if (password !== confirmPassword) errors.confirmPassword = 'auth.password.mismatch';
  if (!terms) errors.terms = 'auth.validation.terms';
  if (!privacy) errors.privacy = 'auth.validation.privacy';
  return errors;
}

const fields = form => ({
  name: form.elements.namedItem('name'),
  email: form.elements.namedItem('email'),
  password: form.elements.namedItem('password'),
  confirmPassword: form.elements.namedItem('confirmPassword'),
  terms: form.querySelector('#auth-terms'),
  privacy: form.querySelector('#auth-privacy'),
});
const values = controls => Object.fromEntries(Object.entries(controls).map(([key, control]) => [key,
  control.type === 'checkbox' ? control.checked : control.value]));

function paintError(control, key, error) {
  const holder = control.closest('.auth-field, .auth-consent');
  const id = `auth-error-${key}`;
  let node = control.form.querySelector(`#${id}`);
  if (!node && error) {
    node = document.createElement('span');
    node.id = id;
    node.className = 'auth-field-error';
    // Không đặt lỗi bên trong nhãn input (tránh đọc lặp nội dung nhãn).
    if (holder.matches('label')) holder.after(node);
    else holder.append(node);
  }
  const ids = (control.getAttribute('aria-describedby') || '').split(/\s+/).filter(value => value && value !== id);
  if (error) {
    control.setAttribute('aria-invalid', 'true');
    ids.push(id);
    setText(node, message(error));
    node.hidden = false;
  } else {
    control.removeAttribute('aria-invalid');
    if (node) node.hidden = true;
  }
  if (ids.length) control.setAttribute('aria-describedby', ids.join(' '));
  else control.removeAttribute('aria-describedby');
}

function checkForm(form, keys) {
  const controls = fields(form);
  const errors = registrationErrors(values(controls));
  for (const key of keys || Object.keys(controls)) paintError(controls[key], key, errors[key]);
  return { controls, errors };
}

export function validateRegistrationForm(form) {
  form.dataset.authAttempted = 'true';
  const { controls, errors } = checkForm(form);
  sync(form);
  const first = Object.keys(errors)[0];
  if (!first) return true;
  const summary = form.querySelector('.auth-inline-error');
  // Lỗi từng trường đã đủ; vùng thông báo chung chỉ dành cho phản hồi API.
  if (summary) {
    setText(summary, '');
    summary.hidden = true;
  }
  controls[first].focus();
  return false;
}

function sync(form) {
  const controls = fields(form);
  const data = values(controls);
  const busy = form.getAttribute('aria-busy') === 'true';
  const rules = form.querySelector('#auth-password-rules');
  const validRules = { length: data.password.length >= 8,
    letter: /[A-Z]/.test(data.password), number: /[0-9]/.test(data.password) };
  rules.dataset.active = String(Boolean(data.password) || form.dataset.authAttempted === 'true');
  for (const rule of rules.querySelectorAll('[data-password-rule]')) {
    const met = validRules[rule.dataset.passwordRule];
    rule.dataset.met = String(met);
    setText(rule.querySelector('[data-password-rule-status]'), message(met ? 'auth.rules.met' : 'auth.rules.unmet'));
  }
  // Chỉ nút submit bị khóa trong lúc gửi; OAuth vẫn cần đủ hai đồng ý.
  form.querySelector('[type=submit]').disabled = busy;
  for (const provider of form.closest('.auth-panel').querySelectorAll('[data-auth-provider-url]')) {
    provider.disabled = busy || !data.terms || !data.privacy;
  }
}

export function setRegistrationPending(form, pending) {
  form.setAttribute('aria-busy', String(pending));
  setText(form.querySelector('[data-auth-submit-label]'), message(pending ? 'auth.register.pending' : 'auth.register.submit'));
  sync(form);
}

export function mountRegistration(root) {
  const form = root.querySelector('#register-form');
  if (!form || form.dataset.registrationMounted === 'true') return;
  form.dataset.registrationMounted = 'true';
  const controls = fields(form);
  const touched = new Set();
  form.addEventListener('focusout', event => {
    const key = Object.keys(controls).find(name => controls[name] === event.target);
    if (!key) return;
    touched.add(key);
    checkForm(form, [key]);
  });
  const update = event => {
    const key = Object.keys(controls).find(name => controls[name] === event.target);
    if (!key) return;
    if (form.dataset.authAttempted === 'true') {
      const { errors } = checkForm(form);
      if (!Object.keys(errors).length) form.querySelector('.auth-inline-error').hidden = true;
    } else {
      const affected = key === 'password' ? [key, 'confirmPassword'] : [key];
      checkForm(form, affected.filter(name => touched.has(name)));
    }
    sync(form);
  };
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  for (const provider of form.closest('.auth-panel').querySelectorAll('[data-auth-provider-url]')) {
    provider.addEventListener('click', async () => {
      if (form.getAttribute('aria-busy') === 'true' || !controls.terms.checked || !controls.privacy.checked) return;
      const url = provider.dataset.authProviderUrl;
      if (url !== '/api/auth/google' && url !== '/api/auth/zalo') return;
      const summary = form.querySelector('.auth-inline-error');
      summary.hidden = true;
      setRegistrationPending(form, true);
      let navigating = false;
      try {
        const { url: destination } = await api.post(`${url.slice(4)}/start`, {
          consent: registrationConsent(controls.terms.checked, controls.privacy.checked),
        });
        if (!form.isConnected) return;
        const next = new URL(destination);
        const endpoint = url.endsWith('/google') ? 'https://accounts.google.com/o/oauth2/v2/auth' : 'https://oauth.zaloapp.com/v4/permission';
        if (`${next.origin}${next.pathname}` !== endpoint || next.username || next.password || next.hash)
          throw new Error('');
        location.assign(next.href);
        navigating = true;
      } catch (error) {
        if (form.isConnected) {
          setText(summary, errorCopy(error, message('errors.auth.oauthSession')));
          summary.hidden = false;
          summary.focus();
        }
      } finally {
        if (!navigating && form.isConnected) setRegistrationPending(form, false);
      }
    });
  }
  sync(form);
}
