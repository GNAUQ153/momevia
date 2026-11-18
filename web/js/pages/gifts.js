import { api, escapeHtml as e } from "../core/api.js";
import { icon } from "../ui/icons.js";
import { giftLinkDescription } from "../shared/gift-permissions.js";

export function createGiftViews({
  state,
  buttonLink,
  requireLogin,
  location = globalThis.location,
}) {
  function livePreview(template) {
    return `<div class="preview-panel"><div class="preview-heading"><span>${icon("eye", 18)} Xem trước</span><span class="preview-live">TRỰC TIẾP</span></div>
      <div class="live-preview artwork artwork--${e(template.theme)}">
        <span class="artwork__blur artwork__blur--one"></span><span class="artwork__shape artwork__shape--three"></span>
        <div class="live-preview__inner"><span class="live-preview__eyebrow">A LITTLE NOTE FOR</span><h3 id="preview-name">Người đặc biệt</h3><span class="preview-spark">${icon("sparkles", 42)}</span><p id="preview-message">Điều đẹp nhất là có bạn trong cuộc đời này.</p><span id="preview-photo" class="preview-photo" hidden></span><small id="preview-sender">Từ một người thương</small></div>
      </div><p class="preview-help">${icon("shield", 16)} Chỉ người có link riêng mới xem được nội dung quà.</p>
    </div>`;
  }

  async function createPage(template) {
    const isSigned = Boolean(state.user);
    if (!isSigned) {
      setTimeout(() => requireLogin(`/create/${template.id}`), 50);
      return `<section class="section"><div class="container"><div class="centered-loading">${icon("lock", 25)} Vui lòng đăng nhập để tiếp tục cá nhân hóa.</div></div></section>`;
    }
    const [orders, paymentOptions] = await Promise.all([
      api.get("/checkout/orders").catch(() => ({ orders: [] })),
      api.get("/checkout/payments/methods").catch(() => ({ methods: [] })),
    ]);
    const licensed =
      template.price === 0 ||
      orders.orders.some(
        (o) =>
          o.templateId === template.id &&
          ["demo_paid", "paid"].includes(o.status),
      );
    state.purchased = new Set(
      orders.orders
        .filter((o) => ["demo_paid", "paid"].includes(o.status))
        .map((o) => o.templateId),
    );
    const paymentAvailable = paymentOptions.methods.length > 0;
    return `<section class="builder-section"><div class="container"><div class="breadcrumb"><a href="/template/${encodeURIComponent(template.id)}" data-link>${icon("arrow-left", 17)} Quay lại mẫu</a><span>/</span><span>Cá nhân hóa</span></div>
      <div class="builder-header"><div><span class="eyebrow">MỘT CHÚT RIÊNG, MỘT CHÚT THƯƠNG</span><h1>Biến mẫu thành <em>món quà của bạn.</em></h1><p>Thêm những điều bạn muốn nói. Chúng mình đã chuẩn bị phần còn lại.</p></div><span class="builder-template-pill">${icon("layers", 17)} ${e(template.title)}</span></div>
      <div class="builder-grid"><div class="builder-form-wrap"><form id="create-gift-form" data-template-id="${e(template.id)}">
        <div class="form-step-head"><span>01</span><div><h2>Dành tặng ai?</h2><p>Chỉ cần một vài thông tin nhỏ thôi.</p></div></div>
        <div class="form-row"><label class="field"><span>Tên người nhận <sup>*</sup></span><input id="recipientName" name="recipientName" maxlength="60" required placeholder="Ví dụ: Linh, bạn thân, mẹ yêu..." autocomplete="off"/></label>
        <label class="field"><span>Tên của bạn <sup>*</sup></span><input id="senderName" name="senderName" maxlength="60" required placeholder="Người gửi món quà" value="${e(state.user.name)}"/></label></div>
        <label class="field"><span>Lời chúc từ trái tim <sup>*</sup></span><textarea id="gift-message" name="message" required maxlength="1000" rows="5" placeholder="Hãy viết điều mà bạn muốn người ấy nhớ mãi..."></textarea><small>Tối đa 1.000 ký tự</small></label>
        <div class="form-step-head form-step-head--separated"><span>02</span><div><h2>Thêm một bức ảnh</h2><p>Không bắt buộc, nhưng sẽ làm món quà thật riêng.</p></div></div>
        <label class="photo-drop" for="gift-photo"><span>${icon("upload-cloud", 25)}</span><strong>Chọn ảnh từ thiết bị</strong><small>JPG, PNG hoặc WebP · Tối đa 2 MB</small><input type="file" id="gift-photo" class="visually-hidden" accept="image/png,image/jpeg,image/webp"/></label>
        <div class="form-bottom"><div class="demo-notice">${icon("shield", 20)}<p>${paymentAvailable ? "Thanh toán qua cổng được xác thực. Chỉ cấp quyền sau khi nhận xác nhận từ nhà cung cấp." : "Thanh toán trực tuyến chưa được kích hoạt; chế độ dùng thử tùy cấu hình."}</p></div>
        ${licensed ? `<button type="submit" class="btn btn--dark btn--wide">Xuất bản món quà ${icon("arrow", 19)}</button>` : paymentAvailable ? `<button type="button" class="btn btn--dark btn--wide" data-action="payment-options" data-id="${e(template.id)}">Thanh toán mẫu ${icon("arrow", 18)}</button>` : `<button type="button" class="btn btn--dark btn--wide" data-action="demo-buy" data-id="${e(template.id)}">Dùng thử (mô phỏng) ${icon("arrow", 18)}</button><p class="helper-text">Đây không phải giao dịch thật.</p>`}</div>
      </form></div>${livePreview(template)}</div>
    </div></section>`;
  }

  function successPage(gift) {
    if (gift.status && gift.status !== "active") return `<section class="success-section"><div class="container"><div class="success-card"><h1>${gift.status === "revoked" ? "Quà đã ngừng chia sẻ" : "Quà đã hết hạn"}</h1>${buttonLink("/studio", "Về Studio")}</div></div></section>`;
    const primaryInvited = gift.access?.open === "invite";
    const primaryUrl = primaryInvited ? gift.inviteUrl : gift.url;
    const shareLink = (url, invited, primary) => {
      const title = invited ? "Link mời riêng" : "Link thường";
      const share = typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare({ url }));
      const linkLabel = primary ? "Đường link quà tặng" : title;
      return `<section class="share-option"><h2>${title}</h2><p>${giftLinkDescription(gift.access, invited)}</p>
        <div class="share-link" data-copy-container><input ${primary ? 'id="share-link"' : ''} data-copy-value readonly value="${e(url)}" aria-label="${linkLabel}"/><button data-action="copy-link" data-value="${e(url)}">${icon("copy", 18)} Sao chép</button></div>
        <div class="success-buttons">${primary ? buttonLink(new URL(url).pathname + new URL(url).search, "Xem món quà", "btn--dark") : ''}
        ${share ? `<button class="btn btn--outline" data-action="share-gift" data-value="${e(url)}">${primary ? "Chia sẻ link" : `Chia sẻ ${title.toLocaleLowerCase('vi')}`}</button>` : ''}
        <button class="btn btn--outline" data-action="qr" data-value="${e(url)}">${icon("qr-code", 18)} ${primary ? "Tạo mã QR" : `Mã QR ${invited ? "link mời" : "link thường"}`}</button></div></section>`;
    };
    return `<section class="success-section"><div class="container"><div class="success-card"><span class="success-emblem">${icon("check", 35)}</span>
      <h1>Món quà đã sẵn sàng</h1>
      ${shareLink(primaryUrl, primaryInvited, true)}
      ${gift.inviteUrl ? shareLink(primaryInvited ? gift.url : gift.inviteUrl, !primaryInvited, false) : ''}
      ${gift.inviteUrl ? `<div class="success-foot">${icon("lock", 15)} Người nhận có thể chuyển tiếp link mời. Quyền đi cùng link.</div>` : ''}
    </div></div></section>`;
  }

  function giftPage(gift) {
    const permissions = gift.replyPermissions;
    return `<section class="recipient-page recipient-page--${e(gift.theme)}"><div class="recipient-backdrop recipient-backdrop--one"></div><div class="recipient-backdrop recipient-backdrop--two"></div>
      <div class="recipient-wrapper"><div class="gift-topline"><span>${icon("sparkles", 17)} MỘT MÓN QUÀ TỪ MOMEVIA</span><span>${icon("lock", 14)} ĐƯỜNG LINK RIÊNG</span></div>
        <div class="recipient-card" id="recipient-card">
          <div class="recipient-sealed"><span class="recipient-sealed__subtitle">DÀNH RIÊNG CHO</span><h1>${e(gift.recipientName)}</h1><div class="envelope-scene"><span class="envelope-scene__letter"></span><span class="envelope-scene__body"></span><span class="envelope-scene__flap"></span><span class="envelope-scene__seal">${icon("heart", 24)}</span></div>
            <p>Một điều bất ngờ đang chờ bạn ở đây.</p><button class="btn btn--gift" data-action="open-gift">Chạm để mở quà ${icon("arrow", 18)}</button></div>
          <div class="recipient-surprise"><span class="eyebrow">MỘT BẤT NGỜ THẬT RIÊNG</span><div class="surprise-halo">${icon("sparkles", 67)}</div><h2>Ngày hôm nay<br><em>có điều đặc biệt.</em></h2><p>Có người đã dành thời gian để gửi đến bạn một lời chúc từ trái tim.</p><button class="btn btn--gift" data-action="reveal-gift">Khám phá lời nhắn ${icon("arrow", 18)}</button></div>
          <div class="recipient-opened"><span class="eyebrow">A LETTER FROM SOMEONE SPECIAL</span><div class="opened-spark">${icon("sparkles", 42)}</div>
            <h1>Gửi ${e(gift.recipientName)},</h1>
            ${gift.photoUrl ? `<img class="recipient-photo" src="${e(gift.photoUrl)}" alt="Bức ảnh người gửi chọn cho món quà"/>` : ""}
            <p class="recipient-message">${e(gift.message)}</p><div class="recipient-signature">Thương mến,<br><strong>${e(gift.senderName)}</strong></div>
            ${permissions.canSend ? `<div class="reply-container"><div class="reply-heading">${icon("message-circle", 24)}<div><h2>Gửi lời hồi đáp</h2><p>${replyAudienceLabel(permissions.replyAudience)}</p></div></div>
              <form id="reply-form" data-slug="${e(gift.slug)}"><label class="field"><span>Tên bạn</span><input name="name" maxlength="50" placeholder="Tên người nhận" value="${e(gift.recipientName)}"/></label>
                <label class="field"><span>Lời nhắn</span><textarea name="message" rows="3" maxlength="1000" required placeholder="Mình nhận được quà rồi, cảm ơn bạn rất nhiều..."></textarea></label>
                <button class="btn btn--dark" type="submit">Gửi hồi đáp ${icon("send", 17)}</button></form>
            </div>` : `<p>${permissions.repliesDisabled ? "Người gửi đã tắt hồi đáp." : "Cần link mời để gửi hồi đáp."}</p>`}
            ${permissions.canRead ? `<div class="memory-container"><h3>${icon("heart", 19)} Góc kỷ niệm <span>(${gift.replyCount})</span></h3><div class="reply-list" id="reply-list" aria-live="polite">Đang tải lời hồi đáp…</div></div>` : ''}
          </div>
        </div>
        <p class="recipient-disclaimer">Đường link có thể được chuyển tiếp.</p>
        <button class="btn btn--outline" data-action="report-content" data-kind="gift" data-id="${e(gift.slug)}">Báo cáo món quà</button>
        <a class="recipient-footer-logo" href="/" data-link>Created with <strong>momevia.</strong></a>
      </div>
    </section>`;
  }

  function renderReplies(replies) {
    return replies.length
      ? replies
          .map(
            (r) =>
              `<article class="reply-item"><div class="reply-avatar">${e(r.name.charAt(0).toUpperCase())}</div><div><strong>${e(r.name)}</strong><span>${new Date(r.createdAt).toLocaleDateString("vi-VN")}</span><p>${e(r.message)}</p></div></article>`,
          )
          .join("")
      : '<p class="no-replies">Chưa có lời hồi đáp. Hãy là người đầu tiên viết một điều dễ thương.</p>';
  }

  function draftCards(designs, emphasizeLatest = false) {
    return designs.map((d, index) => {
      const latest = emphasizeLatest && index === 0;
      return `<article class="my-gift"><div class="my-gift-detail"><strong>${e(d.title)}</strong><p>Bản nháp r${Number(d.revision)} · ${new Date(d.updatedAt).toLocaleDateString('vi-VN')}</p></div><div class="my-gift-actions"><a class="btn ${latest ? 'btn--dark' : 'btn--outline'}" href="/design/${e(d.id)}" data-link>${latest ? 'Tiếp tục nháp gần nhất' : 'Tiếp tục'}</a><button class="btn btn--outline" data-action="duplicate-design" data-id="${e(d.id)}">Nhân bản</button><button class="btn btn--outline" data-action="archive-design" data-id="${e(d.id)}">Lưu trữ bản nháp</button></div></article>`;
    }).join('');
  }
  function dashboard() {
    return `<section class="page-banner page-banner--dashboard"><div class="container"><h1>Xin chào, <em>${e(state.user.name)}.</em></h1></div></section>
    <section class="section dashboard-section"><div class="container">
      <section><div class="dashboard-heading"><h2>Nháp của bạn</h2>${buttonLink("/design/new", "Tự thiết kế")}</div><div id="studio-drafts-section"></div></section>
      <section><div class="dashboard-heading"><div><h2>Những điều bạn đã gửi</h2></div><div class="dashboard-heading__actions"><a class="btn btn--outline" href="/favorites" data-link>${icon("heart", 17)} Mẫu yêu thích (${state.favorites.size})</a>${buttonLink("/explore", "Tạo quà từ mẫu")}</div></div><div id="studio-gifts-section"></div></section>
      <section><div class="dashboard-heading"><h2>Biên nhận thanh toán</h2></div><div id="studio-orders-section"></div></section>
    </div></section>`;
  }
  function studioDrafts({ designs, nextOffset }) {
    return `<div class="my-gifts" id="studio-drafts">${designs.length ? draftCards(designs, true) : "<p>Bạn chưa có bản nháp. Bắt đầu từ trang trống hoặc chọn một mẫu.</p>"}</div>
    ${nextOffset !== null ? `<button class="btn btn--outline" data-action="load-more-designs" data-offset="${Number(nextOffset)}">Xem thêm nháp</button>` : ''}`;
  }
  function studioGifts({ gifts }) {
    const usedTemplates = new Set(gifts.map(gift => gift.templateId).filter(Boolean)).size;
    return `<div class="dashboard-stats">
      <article class="stat-card">${icon("gift", 23)}<strong>${gifts.length}</strong><span>Món quà đã tạo</span></article>
      <article class="stat-card">${icon("message-circle", 23)}<strong>${gifts.reduce((n, g) => n + g.replyCount, 0)}</strong><span>Lời hồi đáp</span></article>
      <article class="stat-card">${icon("layers", 23)}<strong>${usedTemplates}</strong><span>Mẫu đã sử dụng</span></article>
      </div>${
        gifts.length
          ? `<div class="my-gifts">${gifts.map(giftCard).join("")}</div>`
          : `<div class="empty-state empty-state--panel">${icon("gift", 38)}<h3>Chưa có món quà nào</h3><p>Mọi kỷ niệm đẹp đều bắt đầu từ một hành động nhỏ.</p>${buttonLink("/explore", "Khám phá mẫu đầu tiên")}</div>`
      }`;
  }
  function studioOrders({ orders }) {
    const paid = orders.filter(order => order.status === "paid");
    return paid.length ? `<div class="my-gifts">${paid.map(order =>
      `<article class="my-gift"><div class="my-gift-detail"><strong>${e(order.templateTitle)}</strong><p>${Number(order.grossAmount).toLocaleString("vi-VN")} VND</p></div><a class="btn btn--outline" href="/payment-result/${e(order.id)}" data-link>Xem biên nhận</a></article>`,
    ).join("")}</div>` : '<p>Chưa có biên nhận thanh toán.</p>';
  }
  function giftCard(gift) {
    const active = gift.status === "active";
    const url = gift.access?.open === "invite" ? gift.inviteUrl : gift.url;
    const status = { active: "Đang hoạt động", expired: "Hết hạn", revoked: "Đã thu hồi" }[gift.status];
    const slug = e(gift.slug);
    const opens = active ? `<a href="${e(new URL(url).pathname + new URL(url).search)}" data-link class="btn btn--outline">Mở quà ${icon("arrow-up-right", 16)}</a><a class="btn btn--outline" href="/success/${slug}" data-link>Chia sẻ và QR</a><button class="icon-button" aria-label="Sao chép link" data-action="copy-link" data-value="${e(url)}">${icon("copy", 18)}</button><button class="btn btn--outline" data-action="revoke-gift" data-id="${slug}">Ngừng chia sẻ món quà</button>` : '';
    const recipient = gift.recipientName ? `GỬI TỚI ${e(gift.recipientName).toLocaleUpperCase("vi")}` : 'QUÀ KHÔNG GHI TÊN NGƯỜI NHẬN';
    return `<article class="my-gift"><div class="my-gift-art artwork artwork--${e(gift.theme)}">${icon("gift", 40)}</div><div class="my-gift-detail"><span>${recipient}</span><h3>${e(gift.templateTitle)}</h3><p>${e(status)} · Hết hạn ngày ${new Date(gift.expiresAt).toLocaleDateString("vi-VN")}</p></div><div class="my-gift-actions">${opens}<button class="btn btn--outline" data-action="gift-inbox" data-id="${slug}">Hồi đáp (${Number(gift.replyCount)})</button></div></article>`;
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
  return { link: "Người gửi và ai có link quà đều đọc được lời đáp.", invite: "Chỉ người gửi và người có link mời đọc được lời đáp.", sender: "Chỉ người gửi quà đọc được lời đáp." }[audience];
}
