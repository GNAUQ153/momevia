import { attr, message, setText, t, text } from '../core/i18n.js';
import { escapeHtml as e } from '../core/api.js';
import { icon } from '../ui/icons.js';
import { advanceRecipientStage } from '../features/gifts/recipient-journey.js';
import { mountInbox } from '../features/gifts/inbox.js';

// Nhóm hành động studio; nhận dependency từ Application Controller.
export function createStudioActions({
  api,
  render,
  navigate,
  openModal,
  modal,
  getRenderGeneration,
  setDisposeInbox,
  renderReplies,
  draftCards,
  copyText,
}) {
  return [
    [["archive-design", "revoke-gift"], async (action, element) => {
      const archive = action === "archive-design";
      const confirmed = window.confirm(archive
        ? t("studio.drafts.confirmArchive")
        : t("studio.gifts.confirmRevoke"));
      if (!confirmed) return;
      const id = encodeURIComponent(element.dataset.id);
      await api.post(archive ? `/designs/designs/${id}/archive` : `/gifts/gifts/mine/${id}/revoke`);
      await render();
      return;
    }],
    [["renew-gift"], async (action, element) => {
      if (!window.confirm(t("studio.gifts.confirmRenew", { days: Number(element.dataset.days) }))) return;
      element.disabled = true;
      try {
        await api.post(`/gifts/gifts/mine/${encodeURIComponent(element.dataset.id)}/renew`, { expectedExpiresAt: element.dataset.expiry });
        await render();
      } finally { if (element.isConnected) element.disabled = false; }
      return;
    }],
    [["archive-gift", "restore-gift-list"], async (action, element) => {
      const archived = action === "archive-gift";
      if (archived && !window.confirm(t("studio.gifts.confirmArchive"))) return;
      element.disabled = true;
      try {
        await api.post(`/gifts/gifts/mine/${encodeURIComponent(element.dataset.id)}/archive`, { archived });
        await render();
      } finally { if (element.isConnected) element.disabled = false; }
      return;
    }],
    [["recipient-results"], async (action, element) => {
      openModal(`<div data-recipient-results-host></div>`);
      const { mountRecipientResults } = await import("../features/gifts/recipient-results.js");
      await mountRecipientResults(modal.querySelector("[data-recipient-results-host]"), element.dataset.id);
      return;
    }],
    [["gift-inbox"], async (action, element) => {
      const endpoint = `/gifts/gifts/mine/${encodeURIComponent(element.dataset.id)}/replies`;
      const { replies } = await api.get(endpoint);
      if (!element.isConnected) return;
      openModal(`<h2>${text('gift.inbox.title')}</h2><label class="inbox-filter"><input type="checkbox"/> ${text('gift.inbox.unread')}</label>
        <p class="inbox-status" role="status"></p><div class="reply-list"></div>`);
      setDisposeInbox(mountInbox(modal.querySelector(".dialog"), {
        replies, renderReplies,
        markRead: ids => api.post(endpoint + "/read", { ids }),
        onUnreadCount: count => {
          if (element.isConnected) setText(element.querySelector("[data-unread-count]"), count ? message('studio.gifts.unread', { count }) : '');
        },
      }));
      return;
    }],
    [["regift"], async (action, element) => {
      element.disabled = true;
      try {
        const mutationId = element.dataset.mutation || (element.dataset.mutation = crypto.randomUUID());
        const { design } = await api.post(`/gifts/gifts/mine/${encodeURIComponent(element.dataset.id)}/regift`, { mutationId });
        if (element.isConnected) navigate(`/design/${encodeURIComponent(design.id)}${design.source.kind === "template" ? "?mode=quick" : ""}`);
      } finally {
        if (element.isConnected) element.disabled = false;
      }
      return;
    }],
    [["duplicate-design"], async (action, element) => {
      element.disabled = true;
      try {
        const result = await api.post(
          `/designs/designs/${encodeURIComponent(element.dataset.id)}/duplicate`,
          { mutationId: crypto.randomUUID() },
        );
        navigate(`/design/${result.design.id}`);
      } finally {
        element.disabled = false;
      }
      return;
    }],
    [["load-more-designs"], async (action, element) => {
      const generation = getRenderGeneration(); element.disabled = true;
      try {
        const result = await api.get(`/designs/designs?offset=${Number(element.dataset.offset)}`);
        if (generation !== getRenderGeneration()) return;
        document.getElementById('studio-drafts').insertAdjacentHTML('beforeend', draftCards(result.designs));
        if (result.nextOffset === null) element.remove(); else element.dataset.offset = String(result.nextOffset);
      } finally { if (element.isConnected) element.disabled = false; }
      return;
    }],
    [["open-gift", "reveal-gift"], async (action, element) => {
      // Chỉ đổi trạng thái giao diện; nội dung và quyền quà vẫn do backend quyết định.
      advanceRecipientStage(
        document.getElementById("recipient-card"),
        action === "open-gift" ? "surprise" : "opened",
      );
      return;
    }],
    [["copy-link"], async (action, element) => {
      return copyText(element);
    }],
    [["share-gift"], async (action, element) => {
      try {
        await navigator.share({ url: element.dataset.value });
      } catch (error) {
        if (error.name !== "AbortError") await copyText(element);
      }
      return;
    }],
    [["qr"], async (action, element) => {
      const link = element.dataset.value;
      const generation=getRenderGeneration(),{giftQrDataUrl}=await import('../features/gifts/qr.js');
      if(generation!==getRenderGeneration()||!element.isConnected)return;
      const url = giftQrDataUrl(link);
      openModal(
        `<div class="qr-modal" data-copy-container><h2>${text('gift.qr.title')}</h2><p>${text('gift.qr.hint')}</p><img class="qr-image" src="${e(url)}" ${attr('alt', 'gift.qr.alt')}/><a class="btn btn--dark btn--wide" href="${e(url)}" download="momevia-qr.gif">${text('gift.qr.download')}</a><button class="btn btn--outline btn--wide" data-action="copy-link" data-value="${e(link)}">${icon("copy", 17)} ${text('studio.gifts.copy')}</button><label class="field" data-copy-fallback hidden><span>${text('gift.share.link')}</span><input data-copy-value readonly value="${e(link)}"/></label></div>`,
      );
      return;
    }],
  ];
}
