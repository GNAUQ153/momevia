import { attr, priceText, text } from "../core/i18n.js";
import { canonicalText, escapeHtml as e } from '../shared/locale.js';
import { icon } from '../ui/icons.js';

// Chỉ hiển thị trạng thái do Backend trả về, tuyệt đối không dùng query URL làm bằng chứng đã trả tiền.
export function paymentStatusPanel(payment) {
  const paid = payment?.status === 'paid';
  const pending = payment?.status === 'pending';
  const needsReview = pending && payment?.needsReview === true;
  const title = paid ? text("payment.status.paid")
    : pending ? text("payment.status.pending")
      : text("payment.status.review");
  const message = paid
    ? text("payment.status.paidHint")
    : pending
      ? text("payment.status.pendingHint")
      : text("payment.status.reviewHint");

  return `<header class="payment-status payment-status--${paid ? 'success' : needsReview ? 'review' : 'pending'}">
    <span class="payment-status__icon" aria-hidden="true">${icon(paid ? 'check-circle' : needsReview ? 'shield' : 'clock', 26)}</span>
    <span class="payment-status__eyebrow">${text("payment.status.eyebrow")}</span>
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="payment-status__facts" ${attr("aria-label", "payment.status.details")}>
      <div><span>${text("payment.status.order")}</span><strong>${payment?.orderId ? e(payment.orderId) : text("payment.status.noOrder")}</strong></div>
      <div><span>${text("payment.status.amount")}</span><strong>${priceText(payment?.amountVnd ?? payment?.amount ?? 0)}</strong></div>
    </div>
    ${!paid ? `<div class="payment-status__notice" role="note">
      ${icon('shield', 18)}
      <span>${text("payment.status.wait")}</span>
    </div>
    <div class="payment-status__actions">
      <button class="btn btn--dark" type="button" data-action="refresh-payment">${text("payment.status.refresh")} ${icon('arrow', 17)}</button>
      ${pending ? `<button class="btn btn--outline" type="button" data-action="reconcile-payment">${text("payment.status.reconcile")}</button>` : ''}
    </div>` : ''}
    ${needsReview ? `<div class="payment-status__review" role="alert">
      <strong>${text("payment.status.supportReview")}</strong>
      <p>${systemPaymentText(payment.notice, 'payment.status.longPending', 'payment.status.stale')}</p>
      <button type="button" class="btn btn--outline" data-action="support">${text("common.actions.support")}</button>
    </div>` : ''}
  </header>`;
}

function systemPaymentText(value, key, fallback) {
  if (value === canonicalText(key)) return text(key);
  return value ? e(value) : fallback ? text(fallback) : '';
}

export function paymentMethodText(method) {
  return ['momo', 'payos'].includes(method.id) ? text(`payment.methods.${method.id}`) : e(method.label);
}

export function paymentReceipt(receipt) {
  return `<div id="payment-receipt">
    <h2>${text('payment.receipt.title', { receipt: receipt.receiptNo })}</h2>
    <p>${text('payment.receipt.template', { template: receipt.templateTitle })}</p>
    <p>${text('payment.receipt.amount', { amount: { format: 'currency', value: receipt.amountVnd } })}</p>
    <p>${text('payment.receipt.method', { provider: receipt.provider })}</p>
    <p>${text('payment.receipt.reference', { reference: receipt.transactionReference })}</p>
    <p>${receipt.testPayment ? text('payment.receipt.testNote') : systemPaymentText(receipt.note, 'payment.receipt.taxNote')}</p>
    </div><button class="btn btn--outline" data-action="print-receipt">${text('payment.receipt.print')}</button>`;
}
