import { attr, localeControl, text } from "../core/i18n.js";
import { api, escapeHtml as e } from "../core/api.js";
import { icon } from "../ui/icons.js";
import { recipientViralCta } from "../ui/recipient-viral.js";
import { recipientJourneyMarkup } from "../features/gifts/recipient-journey.js";
import { roleQuickLinks } from "../ui/role-workspace.js";
import { giftLinkDescriptionKeys } from "../shared/gift-permissions.js";

export function createGiftViews({
  state,
  buttonLink,
  requireLogin,
  location = globalThis.location,
}) {
  function livePreview(template) {
    return `<div class="preview-panel"><div class="preview-heading"><span>${icon("eye", 18)} ${text("gift.builder.preview")}</span><span class="preview-live">${text("gift.builder.live")}</span></div>
      <div class="live-preview artwork artwork--${e(template.theme)}">
        <span class="artwork__blur artwork__blur--one"></span><span class="artwork__shape artwork__shape--three"></span>
        <div class="live-preview__inner"><span class="live-preview__eyebrow">${text("gift.builder.noteFor")}</span><h3 id="preview-name">${text("gift.builder.sampleRecipient")}</h3><span class="preview-spark">${icon("sparkles", 42)}</span><p id="preview-message">${text("gift.builder.sampleGreeting")}</p><span id="preview-photo" class="preview-photo" hidden></span><small id="preview-sender">${text("gift.builder.sampleFrom")}</small></div>
      </div><p class="preview-help">${icon("shield", 16)} ${text("gift.builder.previewPrivacy")}</p>
    </div>`;
  }

  async function createPage(template) {
    const isSigned = Boolean(state.user);
    if (!isSigned) {
      setTimeout(() => requireLogin(`/create/${template.id}`), 50);
      return `<section class="section"><div class="container"><div class="centered-loading">${icon("lock", 25)} ${text("gift.builder.login")}</div></div></section>`;
    }
    const [access, paymentOptions] = await Promise.all([
      template.price === 0 ? Promise.resolve({ licensed: true }) :
        api.get(`/checkout/licenses/${encodeURIComponent(template.id)}`).catch(() => null),
      api.get("/checkout/payments/methods").catch(() => null),
    ]);
    const licensed = access?.licensed === true;
    const paymentAvailable = Boolean(paymentOptions?.methods?.length);
    const demoAvailable = paymentOptions?.demoPurchaseAvailable === true && !paymentAvailable;
    const checkoutNotice = licensed ? '' : `<div class="demo-notice">${icon("shield", 20)}<p>${
      !access || !paymentOptions ? text("errors.unavailable") : paymentAvailable ? text("gift.builder.realCheckout") :
        demoAvailable ? text("gift.builder.demoCheckout") : text("payment.checkout.noMethods")}</p></div>`;
    const checkoutAction = licensed ? `<button type="submit" class="btn btn--dark btn--wide">${text("gift.builder.publish")} ${icon("arrow", 19)}</button>` :
      !access || !paymentOptions ? '' : paymentAvailable ? `<button type="button" class="btn btn--dark btn--wide" data-action="payment-options" data-id="${e(template.id)}">${text("gift.builder.pay")} ${icon("arrow", 18)}</button>` :
      demoAvailable ? `<button type="button" class="btn btn--dark btn--wide" data-action="demo-buy" data-id="${e(template.id)}">${text("gift.builder.tryDemo")} ${icon("arrow", 18)}</button><p class="helper-text">${text("gift.builder.demoNotice")}</p>` : '';
    return `<section class="builder-section"><div class="container"><div class="breadcrumb"><a href="/template/${encodeURIComponent(template.id)}" data-link>${icon("arrow-left", 17)} ${text("gift.builder.back")}</a><span>/</span><span>${text("home.about.personal.title")}</span></div>
      <div class="builder-header"><div><span class="eyebrow">${text("gift.builder.badge")}</span><h1>${text("gift.builder.headline")} <em>${text("gift.builder.emphasis")}</em></h1><p>${text("gift.builder.intro")}</p></div><span class="builder-template-pill">${icon("layers", 17)} ${e(template.title)}</span></div>
      <div class="builder-grid"><div class="builder-form-wrap"><form id="create-gift-form" data-template-id="${e(template.id)}">
        <div class="form-step-head"><span>01</span><div><h2>${text("gift.builder.toWhom")}</h2><p>${text("gift.builder.toWhomHint")}</p></div></div>
        <div class="form-row"><label class="field"><span>${text("gift.builder.recipient")} <sup>*</sup></span><input id="recipientName" name="recipientName" maxlength="60" required ${attr("placeholder", "gift.builder.recipientExample")} autocomplete="off"/></label>
        <label class="field"><span>${text("gift.reply.name")} <sup>*</sup></span><input id="senderName" name="senderName" maxlength="60" required ${attr("placeholder", "gift.builder.senderExample")} value="${e(state.user.name)}"/></label></div>
        <label class="field"><span>${text("gift.builder.greeting")} <sup>*</sup></span><textarea id="gift-message" name="message" required maxlength="1000" rows="5" ${attr("placeholder", "gift.builder.greetingExample")}></textarea><small>${text("gift.builder.greetingLimit")}</small></label>
        <div class="form-step-head form-step-head--separated"><span>02</span><div><h2>${text("gift.builder.photo")}</h2><p>${text("gift.builder.photoHint")}</p></div></div>
        <label class="photo-drop" for="gift-photo"><span>${icon("upload-cloud", 25)}</span><strong>${text("gift.builder.choosePhoto")}</strong><small>${text("gift.builder.photoTypes")}</small><input type="file" id="gift-photo" class="visually-hidden" accept="image/png,image/jpeg,image/webp"/></label>
        <div class="form-bottom">${checkoutNotice}${checkoutAction}</div>
      </form></div>${livePreview(template)}</div>
    </div></section>`;
  }

  function successPage(gift) {
    if (gift.status && gift.status !== "active") return `<section class="success-section"><div class="container"><div class="success-card"><h1>${gift.status === "revoked" ? text("gift.share.revoked") : text("gift.share.expired")}</h1>${buttonLink("/studio", text("auth.recovery.studio"))}</div></div></section>`;
    if (gift.recipientMode === 'list') return `<section class="success-section"><div class="container"><div class="success-card"><h1>${text('gift.share.ready')}</h1><div data-recipient-results-host data-slug="${e(gift.slug)}"></div></div></div></section>`;
    const primaryInvited = gift.access?.open === "invite";
    const primaryUrl = primaryInvited ? gift.inviteUrl : gift.url;
    const shareLink = (url, invited, primary) => {
      const title = invited ? "gift.share.invite" : "gift.share.public";
      const share = typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare({ url }));
      const linkLabel = primary ? "gift.share.link" : title;
      return `<section class="share-option"><h2>${text(title)}</h2><p>${giftLinkDescriptionKeys(gift.access, invited).map(key => text(key)).join(' ')}</p>
        <div class="share-link" data-copy-container><input ${primary ? 'id="share-link"' : ''} data-copy-value readonly value="${e(url)}" ${attr("aria-label", linkLabel)}/><button data-action="copy-link" data-value="${e(url)}">${icon("copy", 18)} ${text("gift.share.copy")}</button></div>
        <div class="success-buttons">${primary ? buttonLink(new URL(url).pathname + new URL(url).search, text("gift.share.view"), "btn--dark") : ''}
        ${share ? `<button class="btn btn--outline" data-action="share-gift" data-value="${e(url)}">${text(primary ? "gift.share.share" : invited ? "gift.share.shareInvite" : "gift.share.sharePublic")}</button>` : ''}
        <button class="btn btn--outline" data-action="qr" data-value="${e(url)}">${icon("qr-code", 18)} ${text(primary ? "gift.share.generateQr" : invited ? "gift.share.inviteQr" : "gift.share.publicQr")}</button></div></section>`;
    };
    return `<section class="success-section"><div class="container"><div class="success-card"><span class="success-emblem">${icon("check", 35)}</span>
      <h1>${text("gift.share.ready")}</h1>
      <div class="sender-share-guide" role="group" ${attr('aria-label', 'gift.share.guide.label')}>
        <ol>
          <li><span aria-hidden="true">01</span><strong>${text('gift.share.guide.preview')}</strong></li>
          <li><span aria-hidden="true">02</span><strong>${text('gift.share.guide.copy')}</strong></li>
          <li><span aria-hidden="true">03</span><strong>${text('gift.share.guide.send')}</strong></li>
        </ol>
        <p>${text('gift.share.guide.hint')}</p>
      </div>
      ${shareLink(primaryUrl, primaryInvited, true)}
      ${gift.inviteUrl ? shareLink(primaryInvited ? gift.url : gift.inviteUrl, !primaryInvited, false) : ''}
      ${gift.inviteUrl ? `<div class="success-foot">${icon("lock", 15)} ${text("gift.share.inviteNotice")}</div>` : ''}
    </div></div></section>`;
  }

  function giftPage(gift) {
    const permissions = gift.replyPermissions;
    return `<section class="recipient-page recipient-page--${e(gift.theme)}"><div class="recipient-backdrop recipient-backdrop--one"></div><div class="recipient-backdrop recipient-backdrop--two"></div>
      <div class="recipient-wrapper"><div class="recipient-preferences">${localeControl()}</div><div class="gift-topline"><span>${icon("sparkles", 17)} ${text("gift.legacy.eyebrow")}</span><span>${icon("lock", 14)} ${text("gift.legacy.private")}</span></div>
        ${recipientJourneyMarkup()}
        <div class="recipient-card" id="recipient-card">
          <div class="recipient-sealed"><span class="recipient-sealed__subtitle">${text("gift.legacy.dedicated")}</span><h1>${["list","self"].includes(gift.recipientMode) ? text("recipient.address", { name: gift.recipientName }) : e(gift.recipientName)}</h1><div class="envelope-scene"><span class="envelope-scene__letter"></span><span class="envelope-scene__body"></span><span class="envelope-scene__flap"></span><span class="envelope-scene__seal">${icon("heart", 24)}</span></div>
            <p>${text("gift.legacy.surprise")}</p><button class="btn btn--gift" data-action="open-gift">${text("gift.legacy.open")} ${icon("arrow", 18)}</button></div>
          <div class="recipient-surprise"><span class="eyebrow">${text("gift.legacy.surpriseBadge")}</span><div class="surprise-halo">${icon("sparkles", 67)}</div><h2>${text("gift.legacy.today")}<br><em>${text("gift.legacy.todayEmphasis")}</em></h2><p>${text("gift.legacy.greetingIntro")}</p><button class="btn btn--gift" data-action="reveal-gift">${text("gift.legacy.discover")} ${icon("arrow", 18)}</button></div>
          <div class="recipient-opened"><span class="eyebrow">${text("gift.legacy.letter")}</span><div class="opened-spark">${icon("sparkles", 42)}</div>
            <h1>${text('gift.legacy.address', { recipient: gift.recipientName })}</h1>
            ${gift.photoUrl ? `<img class="recipient-photo" src="${e(gift.photoUrl)}" ${attr("alt", "gift.legacy.photoAlt")}/>` : ""}
            <p class="recipient-message">${e(gift.message)}</p><div class="recipient-signature">${text("templates.copy.signOff")}<br><strong>${e(gift.senderName)}</strong></div>
            ${permissions.canSend ? `<div class="reply-container"><div class="reply-heading">${icon("message-circle", 24)}<div><h2>${text("gift.legacy.replyTitle")}</h2><p>${replyAudienceLabel(permissions.replyAudience)}</p></div></div>
              <form id="reply-form" data-slug="${e(gift.slug)}"><label class="field"><span>${text("gift.legacy.replyName")}</span><input name="name" maxlength="50" ${attr("placeholder", "gift.builder.recipient")} value="${e(gift.recipientName)}"/></label>
                <label class="field"><span>${text("gift.legacy.replyMessage")}</span><textarea name="message" rows="3" maxlength="1000" required ${attr("placeholder", "gift.legacy.replyPlaceholder")}></textarea></label>
                <button class="btn btn--dark" type="submit">${text("gift.legacy.replySend")} ${icon("send", 17)}</button></form>
            </div>` : `<p>${permissions.repliesDisabled ? text("gift.reply.disabled") : text("gift.reply.inviteRequired")}</p>`}
            ${permissions.canRead ? `<div class="memory-container"><h3>${icon("heart", 19)} ${text("gift.legacy.memory")} <span>(${gift.replyCount})</span></h3><div class="reply-list" id="reply-list" aria-live="polite">${text("gift.legacy.loadingReplies")}</div></div>` : ''}
          </div>
        </div>
        <p class="recipient-disclaimer">${text("gift.player.forwarded")}</p>
        <button class="btn btn--outline" data-action="report-content" data-kind="gift" data-id="${e(gift.slug)}">${text("gift.player.report")}</button>
        ${recipientViralCta()}
      </div>
    </section>`;
  }

  function renderReplies(replies, owner = false) {
    return replies.length
      ? replies
        .map(
          (r) =>
            `<article class="reply-item"${owner && r.unread ? ` data-unread-reply="${e(r.id)}"` : ''}><div class="reply-avatar">${e(r.name.charAt(0).toUpperCase())}</div><div><strong>${e(r.name)}</strong><span>${text('common.values.date', { date: { format: 'date', value: r.createdAt } })}</span><p>${e(r.message)}</p>${owner && r.cardName ? `<small>${text("recipient.results.cardName", { name: r.cardName })}</small>` : ""}</div></article>`,
        )
        .join("")
      : `<p class="no-replies">${text("gift.legacy.emptyReplies")}</p>`;
  }

  function draftCards(designs, emphasizeLatest = false) {
    return designs.map((d, index) => {
      const latest = emphasizeLatest && index === 0;
      return `<article class="my-gift"><div class="my-gift-detail"><strong>${e(d.title)}</strong><p>${text('studio.drafts.revision', { revision: Number(d.revision), date: { format: 'date', value: d.updatedAt } })}</p></div><div class="my-gift-actions"><a class="btn ${latest ? 'btn--dark' : 'btn--outline'}" href="/design/${e(d.id)}" data-link>${latest ? text("studio.drafts.latest") : text("studio.drafts.continue")}</a><button class="btn btn--outline" data-action="duplicate-design" data-id="${e(d.id)}">${text("studio.drafts.duplicate")}</button><button class="btn btn--outline" data-action="archive-design" data-id="${e(d.id)}">${text("studio.drafts.archive")}</button></div></article>`;
    }).join('');
  }
  function dashboard() {
    return `<section class="page-banner page-banner--dashboard"><div class="container"><h1>${text('studio.greeting')} <em>${e(state.user.name)}.</em></h1>
      ${state.providers?.recoveryEmail && state.user.provider === "email" && !state.user.emailVerified ? `<a href="/verify-email" data-link>${text("studio.verify")}</a>` : ''}</div></section>
    <section class="section dashboard-section role-workspace role-workspace--sender"><div class="container">
      <div class="role-workspace__navigation-wrap">${roleQuickLinks([
        { href: '#sender-drafts', labelKey: 'role.sender.draftsLink', iconName: 'pencil' },
        { href: '#sender-gifts', labelKey: 'role.sender.giftsLink', iconName: 'gift' },
        { href: '#sender-orders', labelKey: 'role.sender.ordersLink', iconName: 'layers' },
      ])}</div>
      <section class="role-workspace__section" id="sender-drafts" aria-labelledby="sender-drafts-heading"><div class="dashboard-heading"><h2 id="sender-drafts-heading">${text("studio.drafts.title")}</h2>${buttonLink("/design/new", text("studio.drafts.create"))}</div><div id="studio-drafts-section"></div></section>
      <section class="role-workspace__section" id="sender-gifts" aria-labelledby="sender-gifts-heading"><div class="dashboard-heading"><div><h2 id="sender-gifts-heading">${text("studio.gifts.title")}</h2></div><div class="dashboard-heading__actions"><a class="btn btn--outline" href="/favorites" data-link>${icon("heart", 17)} ${text('studio.gifts.favorites', { count: state.favorites.size })}</a>${buttonLink("/explore", text("studio.gifts.useTemplate"))}</div></div><div id="studio-gifts-section"></div></section>
      <section class="role-workspace__section" id="sender-orders" aria-labelledby="sender-orders-heading"><div class="dashboard-heading"><h2 id="sender-orders-heading">${text("studio.orders.title")}</h2></div><div id="studio-orders-section"></div></section>
    </div></section>`;
  }
  function studioDrafts({ designs, nextOffset }) {
    return `<div class="my-gifts" id="studio-drafts">${designs.length ? draftCards(designs, true) : `<p>${text("studio.drafts.empty")}</p>`}</div>
    ${nextOffset !== null ? `<button class="btn btn--outline" data-action="load-more-designs" data-offset="${Number(nextOffset)}">${text("studio.drafts.more")}</button>` : ''}`;
  }
  function studioGifts({ gifts }) {
    const usedTemplates = new Set(gifts.map(gift => gift.templateId).filter(Boolean)).size;
    const visible = gifts.filter(gift => !gift.senderArchivedAt);
    const archived = gifts.filter(gift => gift.senderArchivedAt);
    return `<div class="dashboard-stats">
      <article class="stat-card">${icon("gift", 23)}<strong>${gifts.length}</strong><span>${text("studio.stats.gifts")}</span></article>
      <article class="stat-card">${icon("message-circle", 23)}<strong>${gifts.reduce((n, g) => n + g.replyCount, 0)}</strong><span>${text("gift.reply.title")}</span></article>
      <article class="stat-card">${icon("layers", 23)}<strong>${usedTemplates}</strong><span>${text("studio.stats.templates")}</span></article>
      </div>${visible.length
        ? `<div class="my-gifts">${visible.map(giftCard).join("")}</div>`
        : archived.length ? `<p>${text("studio.gifts.noUnarchived")}</p>` : `<div class="empty-state empty-state--panel">${icon("gift", 38)}<h3>${text("studio.gifts.empty")}</h3><p>${text("studio.gifts.emptyHint")}</p>${buttonLink("/explore", text("studio.gifts.firstTemplate"))}</div>`
      }${archived.length ? `<details class="gift-archive"><summary>${text("studio.gifts.archiveTitle", { count: archived.length })}</summary><p>${text("studio.gifts.archiveHint")}</p><div class="my-gifts">${archived.map(giftCard).join("")}</div></details>` : ''}`;
  }
  function studioOrders({ orders }) {
    const paid = orders.filter(order => order.status === "paid");
    return paid.length ? `<div class="my-gifts">${paid.map(order =>
      `<article class="my-gift"><div class="my-gift-detail"><strong>${e(order.templateTitle)}</strong><p>${text('common.price.value', { amount: { format: 'currency', value: order.grossAmount } })}</p></div><a class="btn btn--outline" href="/payment-result/${e(order.id)}" data-link>${text("studio.orders.view")}</a></article>`,
    ).join("")}</div>` : `<p>${text("studio.orders.empty")}</p>`;
  }
  function giftCard(gift) {
    const active = gift.status === "active";
    const url = gift.access?.open === "invite" ? gift.inviteUrl : gift.url;
    const status = ['active', 'expired', 'revoked'].includes(gift.status) ? text(`studio.gifts.${gift.status}`) : '';
    const slug = e(gift.slug);
    const opens = active && gift.recipientMode === "list" ? `<a class="btn btn--outline" href="/success/${slug}" data-link>${text("studio.gifts.share")}</a><button class="btn btn--outline" data-action="revoke-gift" data-id="${slug}">${text("studio.gifts.revoke")}</button>` : active ? `<a href="${e(new URL(url).pathname + new URL(url).search)}" data-link class="btn btn--outline">${text("studio.gifts.open")} ${icon("arrow-up-right", 16)}</a><a class="btn btn--outline" href="/success/${slug}" data-link>${text("studio.gifts.share")}</a><button class="icon-button" ${attr("aria-label", "studio.gifts.copy")} data-action="copy-link" data-value="${e(url)}">${icon("copy", 18)}</button><button class="btn btn--outline" data-action="revoke-gift" data-id="${slug}">${text("studio.gifts.revoke")}</button>` : '';
    const recipient = ['list','self'].includes(gift.recipientMode) ? text(`recipient.mode.${gift.recipientMode}`) : gift.recipientName ? text('studio.gifts.recipient', { name: gift.recipientName }) : text('studio.gifts.anonymous');
    const archive = gift.senderArchivedAt
      ? `<button type="button" class="btn btn--outline" data-action="restore-gift-list" data-id="${slug}">${text("studio.gifts.restoreList")}</button>`
      : !active ? `<button type="button" class="btn btn--outline" data-action="archive-gift" data-id="${slug}">${text("studio.gifts.archive")}</button>` : '';
    const warning = active && gift.expiringSoon ? `<p role="status">${text("studio.gifts.expiringSoon")}</p>` : '';
    const renewal = active && Number.isInteger(gift.renewalDays) && gift.renewalDays > 0 && gift.renewalDays <= 30
      ? `<button type="button" class="btn btn--outline" data-action="renew-gift" data-id="${slug}" data-expiry="${e(gift.expiresAt)}" data-days="${gift.renewalDays}">${text("studio.gifts.renew", { days: gift.renewalDays })}</button>` : '';
    const regift = gift.canRegift ? `<button class="btn btn--outline" data-action="regift" data-id="${slug}">${text("studio.gifts.regift")}</button>` : "";
    return `<article class="my-gift my-gift--sent"><div class="my-gift-art artwork artwork--${e(gift.theme)}">${icon("gift", 40)}</div><div class="my-gift-detail"><span>${recipient}</span><h3>${e(gift.templateTitle)}</h3><p>${status} - ${text('studio.gifts.expiry', { date: { format: 'date', value: gift.expiresAt } })}</p>${warning}</div><div class="my-gift-actions">${opens}${renewal}<button class="btn btn--outline" data-action="gift-inbox" data-id="${slug}">${text('studio.gifts.replies', { count: Number(gift.replyCount) })}<span data-unread-count>${gift.unreadCount ? text('studio.gifts.unread', { count: Number(gift.unreadCount) }) : ''}</span></button>${gift.recipientMode && gift.recipientMode !== "manual" ? `<button class="btn btn--outline" data-action="recipient-results" data-id="${slug}">${text("recipient.results.button", { count: Number(gift.recipientCount || 0) })}</button>` : ""}${regift}${archive}</div></article>`;
  }

  return {
    livePreview,
    createPage,
    successPage,
    giftPage,
    renderReplies,
    dashboard,
    studioDrafts,
    studioGifts,
    studioOrders,
    draftCards,
  };
}

export function replyAudienceLabel(audience) {
  const key = { link: 'gift.reply.linkAudience', invite: 'gift.reply.inviteAudience', sender: 'gift.reply.senderAudience' }[audience];
  return key ? text(key) : '';
}
