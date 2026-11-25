import { attr, priceText, text } from '../core/i18n.js';
import { escapeHtml as e } from '../core/api.js';

const allowedStatuses = new Set(['submitted', 'in_review', 'awaiting_provider', 'closed_declined']);
const allowedReasons = new Set(['duplicate_payment', 'technical_problem', 'not_as_described', 'other']);
const nextStatuses = Object.freeze({
  submitted: ['in_review', 'closed_declined'],
  in_review: ['awaiting_provider', 'closed_declined'],
  awaiting_provider: ['in_review'],
  closed_declined: [],
});

function refundStatus(value) {
  return allowedStatuses.has(value) ? text(`refund.status.${value}`) : text('refund.status.unknown');
}

function refundReason(value) {
  return allowedReasons.has(value) ? text(`refund.reason.${value}`) : text('refund.reason.other');
}

export function refundBuyerPanel(payment, request, available = true) {
  if (payment?.status !== 'paid') return '';
  const intro = `<h2>${text('refund.buyer.title')}</h2><p>${text('refund.buyer.notice')}</p>`;
  if (!available) return `<section class="refund-review" ${attr('aria-label','refund.buyer.title')}>
    ${intro}<p role="status">${text('refund.unavailable')}</p></section>`;
  if (request) return `<section class="refund-review" ${attr('aria-label','refund.buyer.title')}>
    ${intro}<div class="refund-review__summary" role="status">
      <span>${text('refund.buyer.current')}</span><strong>${refundStatus(request.status)}</strong>
      <span>${text('refund.buyer.reason')}</span><span>${refundReason(request.reasonCode)}</span>
    </div><p>${text('refund.buyer.existing')}</p></section>`;
  return `<section class="refund-review" ${attr('aria-label','refund.buyer.title')}>
    ${intro}<form id="refund-request-form" data-order-id="${e(payment.orderId || '')}">
      <label>${text('refund.buyer.reason')}
        <select name="reasonCode" required>
          ${Array.from(allowedReasons, key => `<option value="${key}">${text('refund.reason.' + key)}</option>`).join('')}
        </select>
      </label>
      <label>${text('refund.buyer.detail')}
        <textarea name="detail" minlength="10" maxlength="500" rows="3" required ${attr('placeholder','refund.buyer.detailHint')}></textarea>
      </label>
      <button class="btn btn--outline" type="submit">${text('refund.buyer.submit')}</button>
    </form></section>`;
}

// Dữ liệu chỉ đọc; nhãn không khẳng định đã hoàn tiền hoặc đủ điều kiện hoàn tiền.
function assessmentPanel(assessment) {
  if (!assessment || typeof assessment !== 'object') return '';
  const entitlement = ['missing', 'mismatch', 'revoked', 'active', 'inactive'].includes(assessment.entitlement) ? assessment.entitlement : 'unknown';
  const credit = ['not_recorded', 'unused', 'consumed', 'unavailable'].includes(assessment.credit) ? assessment.credit : 'unknown';
  const countLabel = value => Number.isSafeInteger(value) && value >= 0 ? String(value) : text('refund.assessment.unknown');
  return `<div class="refund-review__summary">
    <strong>${text('refund.assessment.title')}</strong><span>${text('refund.assessment.notice')}</span>
    <span>${text('refund.assessment.receipt')}</span><span>${text(assessment.receipt === 'consistent' ? 'refund.assessment.consistent' : 'refund.assessment.review')}</span>
    <span>${text('refund.assessment.entitlement')}</span><span>${text(`refund.assessment.entitlement.${entitlement}`)}</span>
    <span>${text('refund.assessment.credit')}</span><span>${text(`refund.assessment.credit.${credit}`)}</span>
    <span>${text('refund.assessment.sales')}</span><span>${countLabel(assessment.creatorSaleEntries)}</span>
    <span>${text('refund.assessment.refunds')}</span><span>${countLabel(assessment.creatorRefundEntries)}</span>
  </div>`;
}

export function refundAdminPanel(requests, { filter = 'active', nextCursor = null, hasPrev = false } = {}) {
  const intro = `<header class="refund-review__heading"><h2>${text('refund.admin.title')}</h2>
    <p>${text('refund.admin.notice')}</p></header>`;
  if (!Array.isArray(requests)) return `<section class="refund-review refund-review--admin">${intro}
    <p role="status">${text('refund.unavailable')}</p></section>`;
  const queueStates = ['active', 'submitted', 'in_review', 'awaiting_provider', 'closed_declined', 'all'];
  const safeFilter = queueStates.includes(filter) ? filter : 'active';
  return `<section class="refund-review refund-review--admin">${intro}
    <div class="refund-review__queue-tools">
      <label for="admin-refund-filter">${text('refund.queue.filter')}
        <select id="admin-refund-filter">${queueStates.map(value => `<option value="${value}" ${safeFilter === value ? 'selected' : ''}>${text('refund.queue.' + value)}</option>`).join('')}</select>
      </label>
      <p role="status">${text('refund.queue.pageCount', { count: requests.length })}</p>
    </div>
    <p class="refund-review__feedback" data-refund-queue-feedback role="status" aria-live="polite"></p>
    ${requests.length ? `<div class="refund-review__list">${requests.map(item => {
      const status = allowedStatuses.has(item.status) ? item.status : 'unknown';
      const choices = nextStatuses[status] || [];
      return `<article class="refund-review__card" data-refund-item="${e(item.id)}">
        <div class="refund-review__top"><strong>${text('refund.admin.order')} <code>${e(item.orderId || '')}</code></strong>
          <span>${refundStatus(status)}</span></div>
        <p>${text('refund.admin.amount')} ${priceText(Number(item.amountVnd))} - ${text(item.sandbox ? 'finance.group.sandbox' : 'finance.group.live')}</p>
        <p>${text('refund.admin.reason')}: ${refundReason(item.reasonCode)}</p>
        <p class="refund-review__detail">${e(item.detail || '')}</p>
        ${assessmentPanel(item.assessment)}
        ${choices.length ? `<div class="refund-review__actions">
          <label>${text('refund.admin.next')}
            <select data-refund-next>${choices.map(value => `<option value="${value}">${refundStatus(value)}</option>`).join('')}</select>
          </label>
          <label>${text('refund.admin.note')}
            <textarea data-refund-note rows="2" minlength="10" maxlength="500" ${attr('placeholder','refund.admin.noteHint')}></textarea>
          </label>
          <button class="btn btn--outline" type="button" data-action="admin-refund-move" data-request-id="${e(item.id)}" data-expected-status="${status}">${text('refund.admin.update')}</button>
        </div>` : ''}
        <button class="btn btn--outline" type="button" data-action="admin-refund-history" data-request-id="${e(item.id)}">${text('refund.admin.history')}</button>
      </article>`;
    }).join('')}</div>` : `<p>${text('refund.queue.empty')}</p>`}
    <nav class="refund-review__pagination" aria-label="${text('refund.queue.pagination')}">
      ${hasPrev ? `<button class="btn btn--outline" type="button" data-action="admin-refund-prev">${text('refund.queue.previous')}</button>` : ''}
      ${nextCursor ? `<button class="btn btn--outline" type="button" data-action="admin-refund-next">${text('refund.queue.next')}</button>` : ''}
    </nav>
  </section>`;
}

export function refundHistoryPanel(events) {
  if (!Array.isArray(events) || !events.length) return `<p>${text('refund.admin.noHistory')}</p>`;
  return `<ol class="refund-review__history">${events.map(event => `<li>
    <strong>${refundStatus(event.toStatus)}</strong>
    <p>${e(event.note || '')}</p>
    <small>${e(event.createdAt || '')}</small>
  </li>`).join('')}</ol>`;
}
