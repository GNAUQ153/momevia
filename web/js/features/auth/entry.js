import { message, setText } from '../../core/i18n.js';

// Chỉ phản hồi trên form hiện tại. Quy tắc xác thực cuối cùng thuộc API.
export function mountAuthEntry(root) {
  const form = root.querySelector('#email-login-form, #register-form');
  if (!form) return;
  const password = form.elements.password;
  const confirmation = form.elements.confirmPassword;
  const checklist = form.querySelector('.auth-password-rules');
  const rules = [...form.querySelectorAll('[data-password-rule]')];
  const error = form.querySelector('.auth-inline-error');

  function updateRules() {
    const value = password.value;
    checklist.dataset.active = String(value.length > 0);
    const checks = {
      length: value.length >= password.minLength && value.length <= password.maxLength,
      letter: /[a-zA-Z]/.test(value),
      number: /[0-9]/.test(value),
    };
    for (const rule of rules) {
      const met = checks[rule.dataset.passwordRule];
      rule.dataset.met = String(met);
      setText(rule.querySelector('[data-password-rule-status]'),
        message(met ? 'auth.rules.met' : 'auth.rules.unmet'));
    }
  }

  form.addEventListener('input', event => {
    if (confirmation && event.target === password) updateRules();
    if (error.hidden) return;
    error.hidden = true;
    setText(error, '');
    confirmation?.removeAttribute('aria-invalid');
    confirmation?.removeAttribute('aria-describedby');
  });
  if (!confirmation) return;
  updateRules();
  syncRegistrationActions(form);
  form.addEventListener('change', event => {
    if (event.target.matches('[data-auth-consent]')) syncRegistrationActions(form);
  });
  for (const provider of root.querySelectorAll('[data-auth-provider-url]')) {
    provider.addEventListener('click', () => {
      if (!provider.disabled) globalThis.location.assign(provider.dataset.authProviderUrl);
    });
  }
}

function syncRegistrationActions(form) {
  const consents = [...form.querySelectorAll('[data-auth-consent]')];
  const disabled = form.getAttribute('aria-busy') === 'true' || consents.some(input => !input.checked);
  form.querySelector('button[type=submit]').disabled = disabled;
  for (const provider of form.parentElement.querySelectorAll('[data-auth-provider-url]')) {
    provider.disabled = disabled;
  }
}

export function setAuthPending(form, pending) {
  const label = form.querySelector('[data-auth-submit-label]');
  const register = form.id === 'register-form';
  form.setAttribute('aria-busy', String(pending));
  const key = register
    ? (pending ? 'auth.register.pending' : 'auth.register.submit')
    : (pending ? 'auth.login.pending' : 'shell.pages.login');
  setText(label, message(key));
  if (register) syncRegistrationActions(form);
  else form.querySelector('button[type=submit]').disabled = pending;
}

export function showPasswordMismatch(form) {
  const field = form.elements.confirmPassword;
  const error = form.querySelector('.auth-inline-error');
  setText(error, message('auth.password.mismatch'));
  error.hidden = false;
  field.setAttribute('aria-invalid', 'true');
  field.setAttribute('aria-describedby', error.id);
  field.focus();
}
