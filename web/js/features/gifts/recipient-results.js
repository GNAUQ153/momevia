import { api, escapeHtml as e } from '../../core/api.js';
import { text, attr } from '../../core/i18n.js';

export async function mountRecipientResults(host, slug) {
  host.innerHTML = `<p role="status">${text('recipient.results.loading')}</p>`;
  const { recipients } = await api.get(`/gifts/gifts/mine/${encodeURIComponent(slug)}/recipients`);
  if (!host.isConnected) return;
  host.innerHTML = `<div class="recipient-results"><h2>${text('recipient.results.title', { count: recipients.length })}</h2><p>${text('recipient.results.hint')}</p><a class="btn btn--outline" href="/api/gifts/gifts/mine/${encodeURIComponent(slug)}/recipients.xlsx" download>${text('recipient.results.export')}</a><label class="field"><span>${text('recipient.results.filter')}</span><select data-recipient-filter><option value="all">${text('recipient.results.all')}</option><option value="created">${text('recipient.status.created')}</option><option value="confirmed">${text('recipient.status.confirmed')}</option><option value="replied">${text('recipient.status.replied')}</option></select></label><div data-recipient-results></div></div>`;
  const rows = host.querySelector('[data-recipient-results]');
  function render(status) {
    rows.innerHTML = recipients.filter(r => status === 'all' || status === r.status).map(r => `<article class="recipient-result"><strong>${e(r.name)}</strong><span>${text(`recipient.source.${r.source}`)} - ${text(`recipient.status.${r.status}`)}${r.row ? ` - ${text('recipient.results.row', { row: r.row })}` : ''}</span>${r.source === 'list' ? `<div class="share-link" data-copy-container><input data-copy-value readonly value="${e(r.url)}" ${attr('aria-label', 'gift.share.link')}/><button type="button" data-action="copy-link" data-value="${e(r.url)}">${text('gift.share.copy')}</button><button type="button" data-action="qr" data-value="${e(r.url)}">${text('gift.share.generateQr')}</button></div>` : ''}</article>`).join('');
  }
  host.querySelector('select').addEventListener('change', event => render(event.target.value)); render('all');
}
