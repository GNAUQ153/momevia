import { attr, message, setText, t, text } from '../core/i18n.js';
import { escapeHtml as e } from '../core/api.js';
import { paymentMethodText } from '../pages/payment-status.js';

// Nhóm hành động payment; nhận dependency từ Application Controller.
export function createPaymentActions({
  state,
  api,
  toast,
  render,
  navigate,
  requireLogin,
  openModal,
  closeModal,
  openCanvasCheckout,
  getCanvasCheckout,
  getRenderGeneration,
}) {
  return [
    [["payment-login"], async () => {
      return requireLogin(location.pathname + location.search + location.hash);
    }],
    [["print-receipt"], async (action, element) => {
      window.print();
      return;
    }],
    [["payment-status"], async (action, element) => {
      closeModal();
      navigate(`/payment-result/${encodeURIComponent(element.dataset.id)}`);
      return;
    }],
    [["reconcile-payment"], async (action, element) => {
      const orderId = location.pathname.split('/').filter(Boolean).at(-1);
      if (!orderId) return;
      element.disabled = true;
      try {
        const result = await api.post(`/checkout/payments/orders/${encodeURIComponent(orderId)}/reconcile`);
        if (result.providerState === 'terminal_review') toast(message('payment.status.manualReview'));
        else toast(result.payment.status === 'paid' ? message("payment.status.confirmed") : message("payment.status.unconfirmed"));
        await render();
      } finally { element.disabled = false; }
      return;
    }],
    [["refresh-payment"], async (action, element) => {
      await render();
      return;
    }],
    [["retry-canvas-payment"], async (action, element) => {
      const checkout = getCanvasCheckout();
      if (checkout) return openCanvasCheckout(checkout);
    }],
    [["payment-options"], async (action, element) => {
      if (!requireLogin(location.pathname)) return;
      const generation = getRenderGeneration();
      const { methods, repurchaseAvailable } = await api.get("/checkout/payments/methods");
      if (!methods.length)
        throw new Error(t("payment.checkout.unavailable"));
      const previousOrderId = repurchaseAvailable
        ? (await api.get(`/checkout/payments/repurchase/${encodeURIComponent(element.dataset.id)}`)).previousOrderId : null;
      if (generation !== getRenderGeneration() || !element.isConnected) return;
      openModal(`<div class="support-modal"><h2>${previousOrderId ? text("payment.checkout.repurchase") : text("payment.checkout.choose")}</h2>
        <p>${previousOrderId ? text("payment.checkout.repurchaseHint") : text("payment.checkout.serverAmount")}</p>
        ${methods.map((m) => `<button class="btn btn--outline btn--wide" type="button" data-action="start-payment" data-id="${e(element.dataset.id)}" data-method="${e(m.id)}"${previousOrderId ? ` data-previous-order-id="${e(previousOrderId)}"` : ""}>${paymentMethodText(m)}</button>`).join("")}
      </div>`);
      return;
    }],
    [["start-payment"], async (action, element) => {
      const checkoutContext = getCanvasCheckout(),
        checkoutGeneration = getRenderGeneration();
      const stillActive = () =>
        checkoutGeneration === getRenderGeneration() &&
        getCanvasCheckout() === checkoutContext &&
        element.isConnected;
      element.disabled = true;
      try {
        if (checkoutContext) await checkoutContext.flushSave();
        if (!stillActive()) return;
        const { payment } = await api.post("/checkout/payments/create", {
          templateId: element.dataset.id,
          method: element.dataset.method,
          ...(element.dataset.previousOrderId ? { previousOrderId: element.dataset.previousOrderId } : {}),
        });
        if (!stillActive()) return;
        if (checkoutContext) {
          const ack = await checkoutContext.flushSave();
          if (!stillActive()) return;
          const fingerprint = `${ack.revision}:${ack.documentHash}`;
          checkoutContext.contextMutations ||= new Map();
          if (!checkoutContext.contextMutations.has(fingerprint))
            checkoutContext.contextMutations.set(
              fingerprint,
              crypto.randomUUID(),
            );
          const { context } = await api.post(
            `/checkout/payments/orders/${encodeURIComponent(payment.orderId)}/design-contexts`,
            {
              designId: checkoutContext.design.id,
              expectedRevision: ack.revision,
              expectedDocumentHash: ack.documentHash,
              mutationId: checkoutContext.contextMutations.get(fingerprint),
            },
          );
          if (!stillActive()) return;
          try {
            sessionStorage.setItem(
              `momevia:checkout-context:${state.user.id || state.user.sub}:${payment.orderId}`,
              context.contextId,
            );
          } catch {
            /* Server context list also supports resume. */
          }
        }
        if (payment.status === "paid") {
          closeModal();
          navigate(`/payment-result/${encodeURIComponent(payment.orderId)}`);
          return;
        }
        if (!payment.checkoutUrl)
          throw new Error(t("payment.checkout.noUrl"));
        const destination = new URL(payment.checkoutUrl);
        if (destination.protocol !== "https:")
          throw new Error(t("payment.checkout.unsafeUrl"));
        if (element.dataset.method === "payos" && payment.qrPayload) {
          const {giftQrDataUrl}=await import('../features/gifts/qr.js');
          if(!element.isConnected)return;
          const qr = giftQrDataUrl(payment.qrPayload);
          openModal(`<div class="qr-modal"><h2>${text("payment.checkout.qrTitle")}</h2>
            <p>${text("payment.checkout.orderAmount", { amount: { format: "currency", value: Number(payment.amount) } })}</p>
            <p>${text("payment.checkout.qrHint")}</p>
            <img class="qr-image" src="${e(qr)}" ${attr("alt", "payment.checkout.qrAlt")}/>
            <p><a class="btn btn--outline btn--wide" href="${e(destination.href)}" target="_blank" rel="noopener noreferrer">${text("payment.checkout.openPayos")}</a></p>
            <button class="btn btn--dark btn--wide" data-action="payment-status" data-id="${e(payment.orderId)}">${text("payment.checkout.checkStatus")}</button>
            <p>${text("payment.checkout.webhook")}</p>
          </div>`);
          return;
        }
        if (checkoutContext) await checkoutContext.flushSave();
        if (!stillActive()) return;
        window.location.assign(destination.href);
      } finally {
        element.disabled = false;
      }
      return;
    }],
    [["demo-buy"], async (action, element) => {
      if (!requireLogin(location.pathname + location.search)) return;
      const context = getCanvasCheckout();
      const id = element.dataset.id;
      element.disabled = true;
      setText(element, message("payment.checkout.demoLoading"));
      try {
        if (context) await context.flushSave();
        if (!element.isConnected || getCanvasCheckout() !== context) return;
        await api.post("/checkout/orders/demo-purchase", { templateId: id });
        if (!element.isConnected || getCanvasCheckout() !== context) return;
        toast(t("payment.checkout.demoGranted"));
        if (context) closeModal();
        else await render();
      } catch (error) {
        if (!element.isConnected) return;
        element.disabled = false;
        setText(element, message("payment.checkout.demoButton"));
        toast(error.message, "error");
      }
      return;
    }],
  ];
}
