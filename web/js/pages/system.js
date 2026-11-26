import { escapeHtml as e } from '../core/api.js';
import { icon } from '../ui/icons.js';
import { isMessage, text } from '../core/i18n.js';


export function createSystemViews({ buttonLink }) {
  function errorPage(message, action = buttonLink('/', text('common.actions.home'))) {
    return `<section class="section"><div class="container"><div class="empty-state empty-state--panel">${icon('shield', 36)}<h2>${text('system.error.title')}</h2><p>${isMessage(message) ? text(message.key, message.params) : e(message)}</p>${action}</div></div></section>`;
  }

  function loadingPage() {
    return `<section class="section"><div class="container"><div class="centered-loading" role="status"><span class="loading-spinner" aria-hidden="true"></span> ${text('system.loading')}</div></div></section>`;
  }

  return { errorPage, loadingPage };
}
