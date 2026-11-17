import { api, escapeHtml as e } from "../core/api.js";
import { icon } from "../ui/icons.js";

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
    const url = `${location.origin}/g/${gift.slug}`;
    return `<section class="success-section"><div class="container"><div class="success-card"><span class="success-emblem">${icon("check", 35)}</span>
      <span class="eyebrow">MỘT BẤT NGỜ ĐÃ SẴN SÀNG</span><h1>Món quà của bạn<br><em>đã thành hình.</em></h1><p>Gửi ngay đường link này để người ấy khám phá điều bất ngờ bạn đã chuẩn bị.</p>
      <div class="share-link"><input id="share-link" readonly value="${e(url)}" aria-label="Đường link quà tặng"/><button data-action="copy-link" data-value="${e(url)}">${icon("copy", 18)} Sao chép</button></div>
      <div class="success-buttons">${buttonLink(`/g/${encodeURIComponent(gift.slug)}`, "Xem món quà", "btn--dark")}
      <button class="btn btn--outline" data-action="qr" data-value="${e(url)}">${icon("qr-code", 18)} Tạo mã QR</button></div>
      <div class="success-foot">${icon("lock", 15)} Link riêng chỉ nên gửi cho người bạn tin tưởng.</div>
    </div></div></section>`;
  }

  function giftPage(gift, replies = []) {
    return `<section class="recipient-page recipient-page--${e(gift.theme)}"><div class="recipient-backdrop recipient-backdrop--one"></div><div class="recipient-backdrop recipient-backdrop--two"></div>
      <div class="recipient-wrapper"><div class="gift-topline"><span>${icon("sparkles", 17)} MỘT MÓN QUÀ TỪ MOMEVIA</span><span>${icon("lock", 14)} ĐƯỜNG LINK RIÊNG</span></div>
        <div class="recipient-card ${state.giftOpened ? "is-open" : ""}" id="recipient-card">
          <div class="recipient-sealed"><span class="recipient-sealed__subtitle">DÀNH RIÊNG CHO</span><h1>${e(gift.recipientName)}</h1><div class="envelope-scene"><span class="envelope-scene__letter"></span><span class="envelope-scene__body"></span><span class="envelope-scene__flap"></span><span class="envelope-scene__seal">${icon("heart", 24)}</span></div>
            <p>Một điều bất ngờ đang chờ bạn ở đây.</p><button class="btn btn--gift" data-action="open-gift">Chạm để mở quà ${icon("arrow", 18)}</button></div>
          <div class="recipient-surprise"><span class="eyebrow">MỘT BẤT NGỜ THẬT RIÊNG</span><div class="surprise-halo">${icon("sparkles", 67)}</div><h2>Ngày hôm nay<br><em>có điều đặc biệt.</em></h2><p>Có người đã dành thời gian để gửi đến bạn một lời chúc từ trái tim.</p><button class="btn btn--gift" data-action="reveal-gift">Khám phá lời nhắn ${icon("arrow", 18)}</button></div>
          <div class="recipient-opened"><span class="eyebrow">A LETTER FROM SOMEONE SPECIAL</span><div class="opened-spark">${icon("sparkles", 42)}</div>
            <h1>Gửi ${e(gift.recipientName)},</h1>
            ${gift.photoUrl ? `<img class="recipient-photo" src="${e(gift.photoUrl)}" alt="Bức ảnh người gửi chọn cho món quà"/>` : ""}
            <p class="recipient-message">${e(gift.message)}</p><div class="recipient-signature">Thương mến,<br><strong>${e(gift.senderName)}</strong></div>
            <div class="reply-container"><div class="reply-heading">${icon("message-circle", 24)}<div><h2>Gửi lời hồi đáp</h2><p>Viết vài dòng để cùng lưu lại khoảnh khắc này.</p></div></div>
              <form id="reply-form" data-slug="${e(gift.slug)}"><label class="field"><span>Tên bạn</span><input name="name" maxlength="50" placeholder="Tên người nhận" value="${e(gift.recipientName)}"/></label>
                <label class="field"><span>Lời nhắn</span><textarea name="message" rows="3" maxlength="1000" required placeholder="Mình nhận được quà rồi, cảm ơn bạn rất nhiều..."></textarea></label>
                <button class="btn btn--dark" type="submit">Gửi hồi đáp ${icon("send", 17)}</button></form>
            </div>
            <div class="memory-container"><h3>${icon("heart", 19)} Góc kỷ niệm <span>(${replies.length})</span></h3><div class="reply-list" id="reply-list">${renderReplies(replies)}</div></div>
          </div>
        </div>
        <p class="recipient-disclaimer">Đường link có thể được chuyển tiếp. Mọi người có link đều xem được lời hồi đáp.</p>
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

  function draftCards(designs) {
    return designs.map(d => `<article class="my-gift"><div class="my-gift-detail"><strong>${e(d.title)}</strong><p>Bản nháp r${Number(d.revision)} · ${new Date(d.updatedAt).toLocaleDateString('vi-VN')}</p></div><div class="my-gift-actions"><a class="btn btn--outline" href="/design/${e(d.id)}" data-link>Tiếp tục</a><button class="btn btn--outline" data-action="duplicate-design" data-id="${e(d.id)}">Nhân bản</button></div></article>`).join('');
  }
  function dashboard(gifts, orders, designs = [], nextOffset = null) {
    return `<section class="page-banner page-banner--dashboard"><div class="container"><span class="eyebrow">KHÔNG GIAN CỦA BẠN</span><h1>Xin chào, <em>${e(state.user.name)}.</em></h1><p>Nơi những món quà bạn gửi đi luôn được nâng niu.</p></div></section>
    <section class="section dashboard-section"><div class="container"><div class="dashboard-stats">
      <article class="stat-card">${icon("gift", 23)}<strong>${gifts.length}</strong><span>Món quà đã tạo</span></article>
      <article class="stat-card">${icon("message-circle", 23)}<strong>${gifts.reduce((n, g) => n + g.replyCount, 0)}</strong><span>Lời hồi đáp</span></article>
      <article class="stat-card">${icon("layers", 23)}<strong>${orders.length}</strong><span>Mẫu đã sử dụng</span></article>
    </div><div class="dashboard-heading"><div><span class="eyebrow">THIẾT KẾ RIÊNG</span><h2>Nháp của bạn</h2><p>Tiếp tục sửa hoặc nhân bản để tạo món quà mới.</p></div>${buttonLink("/design/new", "Tự thiết kế")}</div>
      <div class="my-gifts" id="studio-drafts">${designs.length ? draftCards(designs) : "<p>Bạn chưa có bản nháp. Bắt đầu từ trang trống hoặc chọn một mẫu.</p>"}</div>
      ${nextOffset !== null ? `<button class="btn btn--outline" data-action="load-more-designs" data-offset="${Number(nextOffset)}">Xem thêm nháp</button>` : ''}
      <div class="dashboard-heading"><div><span class="eyebrow">BỘ SƯU TẬP CỦA TÔI</span><h2>Những điều bạn đã gửi.</h2></div><div class="dashboard-heading__actions"><a class="btn btn--outline" href="/favorites" data-link>${icon("heart", 17)} Mẫu yêu thích (${state.favorites.size})</a>${buttonLink("/explore", "Tạo quà từ mẫu")}</div></div>
      ${
        orders.some((o) => o.status === "paid")
          ? `<div class="dashboard-heading"><h2>Biên nhận thanh toán</h2></div><div class="my-gifts">${orders
              .filter((o) => o.status === "paid")
              .map(
                (o) =>
                  `<article class="my-gift"><div class="my-gift-detail"><strong>${e(o.templateTitle)}</strong><p>${Number(o.grossAmount).toLocaleString("vi-VN")} VND</p></div><a class="btn btn--outline" href="/payment-result/${e(o.id)}" data-link>Xem biên nhận</a></article>`,
              )
              .join("")}</div>`
          : ""
      }
      ${
        gifts.length
          ? `<div class="my-gifts">${gifts.map((g) => `<article class="my-gift"><div class="my-gift-art artwork artwork--${e(g.theme)}">${icon("gift", 40)}</div><div class="my-gift-detail"><span>GỬI TỚI ${e(g.recipientName).toLocaleUpperCase("vi")}</span><h3>${e(g.templateTitle)}</h3><p>${new Date(g.createdAt).toLocaleDateString("vi-VN")} · ${g.replyCount} lời hồi đáp</p></div><div class="my-gift-actions"><a href="/g/${e(g.slug)}" data-link class="btn btn--outline">Mở quà ${icon("arrow-up-right", 16)}</a><button class="icon-button" aria-label="Sao chép link" data-action="copy-link" data-value="${e(`${location.origin}/g/${g.slug}`)}">${icon("copy", 18)}</button></div></article>`).join("")}</div>`
          : `<div class="empty-state empty-state--panel">${icon("gift", 38)}<h3>Chưa có món quà nào</h3><p>Mọi kỷ niệm đẹp đều bắt đầu từ một hành động nhỏ.</p>${buttonLink("/explore", "Khám phá mẫu đầu tiên")}</div>`
      }
    </div></section>`;
  }

  return {
    livePreview,
    createPage,
    successPage,
    giftPage,
    renderReplies,
    dashboard,
    draftCards,
  };
}
