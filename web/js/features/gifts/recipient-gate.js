import { localeControl, message, setText, text, t } from '../../core/i18n.js';
import { validRecipientName } from '../../shared/recipient-naming.js';

const keyFor = slug => `momevia:recipient:${slug}`;
function read(slug) { try { return JSON.parse(sessionStorage.getItem(keyFor(slug))) || {}; } catch { return {}; } }
function save(slug, value) { sessionStorage.setItem(keyFor(slug), JSON.stringify(value)); }
export function recipientSession(slug) { return read(slug).token || ''; }
function newToken() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
export async function openRecipientGate(main, { slug, endpoint, api, signal }) {
  main.innerHTML = `<section class="recipient-name-page"><div class="recipient-name-card"><div class="recipient-preferences">${localeControl()}</div><form data-recipient-gate><h1>${text('recipient.gate.title')}</h1><label class="field"><span>${text('recipient.gate.label')}</span><input name="cardName" maxlength="60" required autocomplete="off" aria-describedby="recipient-name-notice recipient-name-error"/></label><p id="recipient-name-notice">${text('recipient.gate.notice')}</p><p id="recipient-name-error" class="recipient-field-error" role="alert"></p><button class="btn btn--dark btn--wide" type="submit">${text('recipient.gate.open')}</button></form></div></section>`;
  const form = main.querySelector('form'), name = form.elements.cardName, error = form.querySelector('[role="alert"]'), submit = form.querySelector('button');
  const previous = read(slug); name.value = previous.name || '';
  const other = addChangeRecipient(main, slug, () => { name.value = ''; setText(error, ''); name.focus(); });
  return new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (submit.disabled) return;
      if (!validRecipientName(name.value)) { setText(error, message('recipient.error.name')); name.setAttribute('aria-invalid', 'true'); name.focus(); return; }
      submit.disabled = true; other.disabled = true; name.readOnly = true; setText(error, ''); name.removeAttribute('aria-invalid');
      // Persist the intent before sending. A lost ACK retries the same receipt.
      const pending = read(slug);
      const token = pending.token || newToken();
      const value = name.value.trim().normalize('NFC');
      try {
        save(slug, { token, name: value });
        await api.post(endpoint, { token, name: value }, { signal });
        resolve(token);
      } catch (failure) {
        if (signal.aborted) return;
        setText(error, failure.messageKey ? message(failure.messageKey) : failure.message || t('recipient.error.network'));
        submit.disabled = false; other.disabled = false; name.readOnly = false;
      }
    }, { signal });
  });
}
export function addChangeRecipient(main, slug, reload) {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn--outline recipient-change-name';
  setText(button, message('recipient.gate.other'));
  button.addEventListener('click', () => {
    if (!window.confirm(t('recipient.gate.otherNotice'))) return;
    try { sessionStorage.removeItem(keyFor(slug)); } catch { /* Gate will explain storage failure. */ }
    reload();
  });
  main.querySelector('.recipient-preferences')?.append(button);
  return button;
}
