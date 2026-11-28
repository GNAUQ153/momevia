import { escapeHtml as e } from '../core/api.js';
import { attr, text } from '../core/i18n.js';
import { icon } from '../ui/icons.js';

const states = new Set(['digest-matched', 'version-only', 'not-recorded', 'archive-unavailable', 'digest-mismatch', 'unrecognized']);
const sources = new Set(['email-registration', 'google-registration', 'zalo-registration']);
const versionPattern = /^\d{4}-\d{2}-\d{2}\.\d{1,8}$/;

export function privacyPage(user) {
  return `<section class="legal-hero"><div class="container"><span class="eyebrow">${text('privacyCenter.eyebrow')}</span><h1>${text('privacyCenter.title')}</h1><p>${text('privacyCenter.intro')}</p></div></section>
  <section class="legal-body"><div class="container legal-layout privacy-layout">
    <nav class="legal-sidebar" ${attr('aria-label', 'privacyCenter.title')}><h2>${text('privacyCenter.navigation')}</h2>
      <a href="/privacy-center" data-link class="is-active" aria-current="page">${text('privacyCenter.title')}</a>
      <a href="/studio" data-link>${text('shell.nav.studio')}</a>
      <a href="/policies/general" data-link>${text('auth.register.terms')}</a>
      <a href="/policies/privacy" data-link>${text('shell.footer.privacy')}</a>
    </nav>
    <article class="legal-document privacy-document">
      <section class="privacy-panel" aria-labelledby="privacy-receipt-title"><h2 id="privacy-receipt-title">${icon('shield', 23)} ${text('privacyCenter.receipt')}</h2>
        <div data-privacy-receipt aria-live="polite" aria-busy="true"><p role="status">${text('privacyCenter.loading')}</p></div>
      </section>
      <section class="privacy-panel" aria-labelledby="privacy-history-title"><h2 id="privacy-history-title">${text('privacyCenter.confirmationHistory')}</h2>
        <div data-consent-history aria-live="polite"><p role="status">${text('privacyCenter.loading')}</p></div>
      </section>
      <section class="privacy-panel" aria-labelledby="privacy-security-title"><h2 id="privacy-security-title">${icon('shield', 23)} ${text('sessionSecurity.title')}</h2>
        <p>${text('sessionSecurity.description')}</p><div data-session-security></div>
      </section>
      ${user?.provider === 'email' ? `<section class="privacy-panel" aria-labelledby="password-change-title"><h2 id="password-change-title">${text('passwordChange.title')}</h2>
        <p>${text('passwordChange.description')}</p><div data-password-change></div>
      </section>` : ''}
      <section class="privacy-panel" aria-labelledby="privacy-support-title"><h2 id="privacy-support-title">${text('privacyCenter.requests')}</h2><p>${text('privacyCenter.requestsDescription')}</p>
        <button class="btn btn--outline" type="button" data-action="support" data-privacy-withdrawal="true">${text('privacyCenter.withdrawalTopic')}</button>
        <button class="btn btn--outline" type="button" data-action="support">${text('common.actions.support')}</button>
        <h3>${text('privacyCenter.requestHistory')}</h3>
        <p>${text('privacyCenter.historyNote')}</p>
        <div data-privacy-requests aria-live="polite"><p role="status">${text('privacyCenter.loading')}</p></div>
      </section>
    </article></div></section>`;
}

// Chỉ hiển thị dữ liệu bằng chứng hợp lệ, không suy diễn từ trạng thái tài khoản.
export function receiptModel(data) {
  if (!data || !states.has(data.status) || !versionPattern.test(data.currentVersion || '')) throw new Error('Invalid consent response');
  const { status, currentVersion, receipt } = data;
  if (status === 'not-recorded' || status === 'unrecognized') {
    if (receipt !== null) throw new Error('Unexpected consent receipt');
    return { status, currentVersion, receipt: null };
  }
  if (!receipt || typeof receipt.version !== 'string' || !receipt.version || receipt.version.length > 128 ||
      (status !== 'archive-unavailable' && !versionPattern.test(receipt.version)) || !sources.has(receipt.source) || !['vi', 'en'].includes(receipt.locale) ||
      receipt.terms !== true || receipt.privacy !== true || receipt.purpose !== 'account-creation' ||
      typeof receipt.acceptedAt !== 'string' || !Number.isFinite(Date.parse(receipt.acceptedAt))) throw new Error('Invalid consent receipt');
  return { status, currentVersion, receipt: { version: receipt.version, source: receipt.source, locale: receipt.locale, acceptedAt: receipt.acceptedAt } };
}

export function receiptView(model) {
  const { status, currentVersion, receipt } = model;
  const row = (key, value) => `<div><dt>${text(`privacyCenter.${key}`)}</dt><dd>${value}</dd></div>`;
  return `<p class="privacy-status" data-status="${e(status)}">${text(`privacyCenter.status.${status}`)}</p>
    <p>${text('privacyCenter.statusExplanation')}</p><dl class="privacy-facts">
    ${row('currentVersion', e(currentVersion))}
    ${receipt ? row('acceptedVersion', e(receipt.version)) + row('acceptedAt', text('privacyCenter.dateValue', { date: { format: 'date', value: receipt.acceptedAt, options: { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' } } })) + row('source', text(`privacyCenter.source.${receipt.source}`)) + row('language', text(`privacyCenter.language.${receipt.locale}`)) : ''}</dl>
    ${receipt && receipt.version !== currentVersion ? `<p class="privacy-note">${text('privacyCenter.versionChanged')}</p>` : ''}
    ${receipt && status !== 'archive-unavailable' ? `<button type="button" class="btn btn--outline" data-privacy-archive>${text('privacyCenter.viewArchive')}</button><div data-privacy-archive-result aria-live="polite"></div>` : ''}`;
}

// Bản lưu được đọc đúng ngôn ngữ mà tài khoản đã xác nhận, không thay bằng bản dịch hiện tại.
export function archiveView(snapshot, receipt) {
  if (!snapshot || snapshot.version !== receipt.version || !['draft', 'published'].includes(snapshot.status)) throw new Error('Invalid policy archive');
  const translation = snapshot.translations?.[receipt.locale];
  if (!translation || !['vi', 'en'].includes(receipt.locale)) throw new Error('Missing policy translation');
  const value = key => {
    if (!Object.hasOwn(translation, key) || typeof translation[key] !== 'string') throw new Error('Incomplete policy archive');
    return e(translation[key]);
  };
  const policies = ['general', 'privacy'].map(id => {
    const prefix = `policies.${id}`;
    return `<details class="privacy-archive-policy"><summary lang="${receipt.locale}">${value(`${prefix}.title`)}</summary><div lang="${receipt.locale}"><p>${value(`${prefix}.description`)}</p>${Array.from({ length: 5 }, (_, index) => `<h3>${value(`${prefix}.sections.${index + 1}.title`)}</h3><p>${value(`${prefix}.sections.${index + 1}.text`)}</p>`).join('')}</div></details>`;
  }).join('');
  return `<div class="privacy-archive"><h3>${text('privacyCenter.archiveTitle', { version: receipt.version })}</h3><p>${text('privacyCenter.archiveLanguage', { language: { format: 'message', key: `privacyCenter.language.${receipt.locale}` } })}</p>${snapshot.status === 'draft' ? `<p class="legal-draft" lang="${receipt.locale}">${value('policies.note')} ${value('policies.draft')}</p>` : ''}<div lang="${receipt.locale}"><p>${value('auth.register.acceptTerms')} ${value('auth.register.terms')}.</p><p>${value('auth.register.acceptPrivacy')} ${value('shell.footer.privacy')}.</p></div>${policies}</div>`;
}

export function privacyFailure(status, { archive = false } = {}) {
  if (status === 401 || status === 403) return `<p role="alert">${text('privacyCenter.sessionExpired')}</p><a class="btn btn--outline" href="/login" data-link>${text('shell.pages.login')}</a>`;
  return `<p role="alert">${text(archive ? 'privacyCenter.archiveFailed' : 'privacyCenter.loadFailed')}</p><button type="button" class="btn btn--outline" ${archive ? 'data-privacy-archive' : 'data-privacy-retry'}>${text('common.actions.retry')}</button>`;
}
