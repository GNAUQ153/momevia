import { attr, priceText, text } from "../core/i18n.js";
import { escapeHtml as e } from '../core/api.js';

const dateValue = value => value && Number.isFinite(new Date(value).getTime())
  ? { format: 'date', value, options: { dateStyle: 'medium', timeStyle: 'medium' } }
  : { format: 'message', key: 'admin.payments.noData' };
export const reviewStates = ['pending', 'paid', 'terminal_review', 'provider_error', 'invalid_response', 'mismatch', 'settlement_error'];
const stateValue = (state, fallback) => reviewStates.includes(state)
  ? { format: 'message', key: `admin.payments.state.${state}` }
  : state || { format: 'message', key: fallback };
const providerLabels = { momo: 'MoMo', payos: 'payOS / VietQR' };

export function filterPendingReviews(orders, { search = '', provider = 'all', outcome = 'all' } = {}) {
  const q = String(search).trim().toLowerCase();
  return (Array.isArray(orders) ? orders : []).filter(order =>
    (provider === 'all' || order.provider === provider) &&
    (outcome === 'all' || (outcome === 'needs-review'
      ? ![null, undefined, '', 'pending', 'paid'].includes(order.lastInquiryOutcome)
      : order.lastInquiryOutcome === outcome)) &&
    (!q || String(order.orderId || '').toLowerCase().includes(q)));
}

export function paymentReviewRows(orders, filters = {}) {
  const matches = filterPendingReviews(orders, filters);
  if (!matches.length) return `<div class="empty-state empty-state--panel" role="status">
    <h3>${text("admin.payments.empty")}</h3><p>${text("admin.payments.emptyHint")}</p>
  </div>`;
  return matches.map(order => `<article class="payment-review-card" data-payment-order="${e(order.orderId)}">
    <div class="payment-review-card__main">
      <div><span class="payment-review-card__label">${text("admin.payments.orderId")}</span>
        <strong class="payment-review-card__id">${e(order.orderId)}</strong></div>
      <strong class="payment-review-card__amount">${priceText(order.amountVnd)}</strong>
    </div>
    <div class="payment-review-card__meta">
      <span>${order.provider ? e(providerLabels[order.provider] || order.provider) : text('admin.payments.methodUnknown')}</span>
      <span>${text(order.sandbox ? 'admin.payments.env.sandbox' : 'admin.payments.env.live')}</span>
      <span>${text('admin.payments.pendingSince', { date: dateValue(order.pendingSince) })}</span>
      <span>${text('admin.payments.reconciliation', { state: stateValue(order.lastInquiryOutcome, 'admin.payments.noAttempt') })}</span>
      ${order.lastInquiryAt ? `<span>${text('admin.payments.lastAttempt', { date: dateValue(order.lastInquiryAt) })}</span>` : ''}
    </div>
    <div class="payment-review-card__actions">
      <button class="btn btn--outline" type="button" data-action="admin-payment-audit" data-order-id="${e(order.orderId)}">${text("admin.payments.showAudit")}</button>
    </div>
    <div class="payment-review-card__audit" data-payment-audit hidden aria-live="polite"></div>
  </article>`).join('');
}

export function paymentAuditRows(attempts) {
  if (!Array.isArray(attempts) || !attempts.length)
    return `<p class="helper-text">${text("admin.payments.auditEmpty")}</p>`;
  return `<h3>${text("admin.payments.auditTitle")}</h3><ol class="payment-audit-list">${attempts.map(item => `<li>
    <span>${text('common.values.date', { date: dateValue(item.checkedAt) })}</span><strong>${text('admin.payments.outcomeValue', { outcome: stateValue(item.outcome, 'admin.payments.unknownState') })}</strong>
  </li>`).join('')}</ol>`;
}

export function adminPaymentsPage(orders = [], { error = null } = {}) {
  const list = Array.isArray(orders) ? orders : [];
  return `<section class="section admin-payments"><div class="container">
    <p><a href="/admin" data-link>${text("admin.payments.back")}</a></p>
    <div class="admin-payments__heading"><div><h1>${text("shell.pages.adminPayments")}</h1>
      <p>${text("admin.payments.intro")}</p></div>
      <button class="btn btn--outline" type="button" data-action="admin-payment-refresh">${text("admin.payments.refresh")}</button></div>
    <div class="admin-payments__summary"><strong>${error ? '—' : list.length}</strong><span>${text("admin.payments.summary")}</span></div>
    <div class="admin-payments__notice" role="note">${text("admin.payments.notice")}</div>
    ${error ? `<p role="alert">${typeof error === 'string' ? e(error) : text(error.key, error.params)}</p>` : ''}
    <div class="admin-payments__filters">
      <label for="admin-payment-search">${text("admin.payments.search")}
        <input id="admin-payment-search" type="search" autocomplete="off" ${attr("placeholder", "admin.payments.searchHint")} maxlength="100"/></label>
      <label for="admin-payment-provider">${text("admin.payments.method")}
        <select id="admin-payment-provider"><option value="all">${text("admin.payments.filterAll")}</option><option value="momo">MoMo</option><option value="payos">payOS / VietQR</option></select></label>
      <label for="admin-payment-outcome">${text("admin.payments.outcome")}
        <select id="admin-payment-outcome"><option value="all">${text("admin.payments.filterAll")}</option><option value="needs-review">${text("admin.payments.checkNeeded")}</option><option value="pending">${text("admin.payments.stillWaiting")}</option></select></label>
    </div>
    <p class="admin-payments__count" id="admin-payment-result-count" role="status">${error ? text("admin.payments.unavailableCount") : text('admin.payments.count', { visible: list.length, total: list.length })}</p>
    <div class="admin-payments__list" id="admin-payment-results">${error ? `<p role="status">${text("admin.payments.unavailable")}</p>` : paymentReviewRows(list)}</div>
  </div></section>`;
}
