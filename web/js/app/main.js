import { api, escapeHtml as e } from "../core/api.js";
import { icon } from "../ui/icons.js";
import { paginateTemplates } from "../features/catalog/filter.js";
import { legalPages, legalPage } from "../pages/policies.js";
import { giftQrDataUrl } from "../features/gifts/qr.js";
import { state } from "../core/state.js";
import { createComponents } from "../ui/components.js";
import { createLayout } from "../ui/layout.js";
import { createHomeViews } from "../pages/home.js";
import { createCatalogViews } from "../pages/catalog.js";
import { createGiftViews } from "../pages/gifts.js";
import { createCreatorViews } from "../pages/creator.js";
import { createAdminViews } from "../pages/admin.js";
import { createAuthViews } from "../pages/auth.js";
import { pricingPage } from '../pages/pricing.js';
import { createSystemViews } from "../pages/system.js";

const main = document.getElementById("main");
const modal = document.getElementById("modal-root");
const header = document.getElementById("site-header");
const footer = document.getElementById("site-footer");
let routeController = null,
  renderGeneration = 0,
  canvasCheckout = null;
let historyIndex = 0,
  activeUrl = location.pathname + location.search + location.hash,
  restoringHistory = false;
history.replaceState(
  { ...history.state, momeviaIndex: historyIndex },
  "",
  location.href,
);

const components = createComponents({ state });
const viewContext = { state, buttonLink, requireLogin, ...components };
const { refreshNav } = createLayout({ state, header, footer });
const { home, aboutPage } = createHomeViews(viewContext);
const {
  matchingTemplates,
  syncCatalogResults,
  explore,
  templateDetail,
  favoritesPage,
} = createCatalogViews(viewContext);
const { successPage, giftPage, renderReplies, dashboard, draftCards } =
  createGiftViews(viewContext);
const { creatorPage } = createCreatorViews(viewContext);
const { adminPage } = createAdminViews(viewContext);
const { authPage } = createAuthViews(viewContext);
const { errorPage, loadingPage } = createSystemViews(viewContext);

function buttonLink(path, label, style = "btn--dark", trailing = true) {
  return `<a class="btn ${style}" href="${path}" data-link>${label} ${trailing ? icon("arrow-up-right", 17) : ""}</a>`;
}
function navigate(path, { replace = false } = {}) {
  if (routeController?.beforeLeave && !routeController.beforeLeave())
    return false;
  if (replace) history.replaceState({ momeviaIndex: historyIndex }, "", path);
  else history.pushState({ momeviaIndex: ++historyIndex }, "", path);
  activeUrl = location.pathname + location.search + location.hash;
  window.scrollTo({ top: 0, behavior: "instant" });
  state.photoDataUrl = null;
  state.giftOpened = false;
  render();
}
function toast(message, type = "success") {
  const host = document.getElementById("toast-host");
  const item = document.createElement("div");
  item.className = `toast toast--${type}`;
  item.innerHTML = `${icon(type === "success" ? "check-circle" : "shield", 18)} <span>${e(message)}</span>`;
  host.replaceChildren(item);
  setTimeout(() => {
    if (item.parentNode) item.remove();
  }, 4800);
}
async function openCanvasCheckout(context) {
  const generation = renderGeneration;
  canvasCheckout = context;
  await context.flushSave();
  if (generation !== renderGeneration || canvasCheckout !== context) return;
  openModal(
    '<div class="support-modal"><h2>Quyền sử dụng mẫu</h2><p role="status">Đang tải phương thức thanh toán…</p></div>',
  );
  try {
    const { methods } = await api.get("/checkout/payments/methods");
    if (generation !== renderGeneration || canvasCheckout !== context) return;
    if (!methods.length) {
      openModal(
        '<div class="support-modal"><h2>Chưa có phương thức thanh toán</h2><p>Nháp đã lưu. Bạn có thể tiếp tục chỉnh sửa hoặc quay lại Studio. Chưa có giao dịch nào được tạo.</p></div>',
      );
      return;
    }
    const templateId = context.design.source.templateId;
    openModal(`<div class="support-modal"><h2>Mua quyền sử dụng mẫu</h2><p>${e(context.preflight.template?.title || templateId)} · Giá mẫu hiện tại: ${Number(context.preflight.template?.price || 0).toLocaleString("vi-VN")} VND.</p>
      <p>Giao dịch đang mở có thể giữ giá tại lúc tạo. Số tiền xác nhận lấy từ intent của máy chủ. Bạn sẽ quay lại xem nháp trước khi tự xuất bản.</p>
      ${methods.map((method) => `<button class="btn btn--outline btn--wide" data-action="start-payment" data-id="${e(templateId)}" data-method="${e(method.id)}">${e(method.label)}</button>`).join("")}</div>`);
  } catch (error) {
    if (generation !== renderGeneration || canvasCheckout !== context) return;
    openModal(
      `<div class="support-modal"><h2>Không tải được phương thức</h2><p role="alert">${e(error.message)}</p><button class="btn btn--outline" data-action="retry-canvas-payment">Thử lại</button></div>`,
    );
  }
}
function requireLogin(path) {
  if (state.user) return true;
  state.afterLogin = path;
  navigate("/login");
  return false;
}
async function render() {
  const generation = ++renderGeneration;
  closeModal();
  routeController?.dispose?.();
  routeController = null;
  canvasCheckout = null;
  document.body.classList.remove("is-designing", "is-playing-gift");
  refreshNav();
  main.innerHTML = loadingPage();
  try {
    const segments = location.pathname.split("/").filter(Boolean);
    const [route, id] = segments;
    if (!route) main.innerHTML = home();
    else if (route === "explore") main.innerHTML = explore();
    else if (route === "template") {
      const template = state.templates.find((t) => t.id === id);
      main.innerHTML = template
        ? templateDetail(template)
        : errorPage("Mẫu quà không tồn tại hoặc chưa được duyệt.");
      if (template && main.querySelector('[data-template-preview]')) {
        const { mountTemplatePreview } = await import('../features/catalog/template-preview.js');
        if (generation !== renderGeneration) return;
        routeController = mountTemplatePreview(main, template);
      }
    } else if (
      (route === "create" || route === "design") &&
      id &&
      segments.length === 2
    ) {
      if (!state.user) {
        requireLogin(location.pathname);
        return;
      }
      if (route === "create" && !state.templates.some((t) => t.id === id)) {
        main.innerHTML = errorPage("Mẫu quà không tồn tại.");
        return;
      }
      const { mountDesigner } = await import("../pages/designer.js");
      if (generation !== renderGeneration) return;
      document.body.classList.add("is-designing");
      routeController = mountDesigner(main, {
        id: route === "design" && id !== "new" ? id : null,
        templateId: route === "create" ? id : null,
        user: state.user,
        api,
        navigate,
        toast,
        onCheckout: openCanvasCheckout,
        onCreated: () => {
          activeUrl = location.pathname + location.search + location.hash;
          history.replaceState(
            { momeviaIndex: historyIndex },
            "",
            location.href,
          );
        },
      });
      await routeController.ready;
      if (generation !== renderGeneration) return;
    } else if (route === "g" && id) {
      const giftResponse = await api.get(`/gifts/gifts/${id}`);
      if (generation !== renderGeneration) return;
      if (giftResponse.gift.documentSnapshot) {
        document.body.classList.add("is-playing-gift");
        const { mountPlayer } =
          await import("../features/gift-runtime/index.js");
        if (generation !== renderGeneration) return;
        main.innerHTML = `<section class="section"><div class="container"><div id="canvas-public-player"></div><p class="recipient-disclaimer">Đường link có thể được chuyển tiếp. Mọi người có link đều xem được lời hồi đáp.</p><a href="/" data-link>Created with momevia.</a></div></section>`;
        const lifetime = new AbortController();
        const player = mountPlayer(
          document.getElementById("canvas-public-player"),
          {
            document: giftResponse.gift.documentSnapshot,
            runtimeVersion: giftResponse.gift.runtimeVersion,
            mode: "public",
            assetUrl: (assetId) =>
              `/api/gifts/gifts/${encodeURIComponent(id)}/assets/${encodeURIComponent(assetId)}`,
            replyAdapter: {
              send: async (body) =>
                (
                  await api.post(`/gifts/gifts/${id}/replies`, body, {
                    signal: lifetime.signal,
                  })
                ).reply,
              list: async () =>
                (
                  await api.get(`/gifts/gifts/${id}/replies`, {
                    signal: lifetime.signal,
                  })
                ).replies,
            },
          },
        );
        routeController = {
          dispose: () => {
            lifetime.abort();
            player.dispose();
          },
        };
      } else {
        const replyResponse = await api.get(`/gifts/gifts/${id}/replies`);
        if (generation !== renderGeneration) return;
        main.innerHTML = giftPage(giftResponse.gift, replyResponse.replies);
      }
    } else if (route === "payment-result" && id) {
      if (!state.user) {
        main.innerHTML = errorPage("Đăng nhập để xem giao dịch.");
      } else {
        const { payment } = await api.get(
          `/checkout/payments/orders/${encodeURIComponent(id)}`,
        );
        let receipt = null,
          receiptError = null,
          contexts = [],
          contextError = null,
          resumeContext = null;
        if (payment.status === "paid") {
          try {
            receipt = (
              await api.get(
                `/checkout/payments/orders/${encodeURIComponent(id)}/receipt`,
              )
            ).receipt;
          } catch (error) {
            receiptError = error.message;
          }
        }
        try {
          contexts = (
            await api.get(
              `/checkout/payments/orders/${encodeURIComponent(id)}/design-contexts`,
            )
          ).contexts;
          let contextId = null;
          try { contextId = sessionStorage.getItem(`momevia:checkout-context:${state.user.id || state.user.sub}:${id}`); } catch { /* Context list remains available. */ }
          if (contextId) resumeContext = (await api.get(`/checkout/payments/orders/${encodeURIComponent(id)}/design-contexts/${encodeURIComponent(contextId)}`)).context;
        } catch (error) {
          contextError = error.message;
        }
        if (generation !== renderGeneration) return;
        main.innerHTML = `<section class="section"><div class="container"><div class="success-card">
          <h1>${payment.status === "paid" ? "Thanh toán thành công" : "Đang xác nhận thanh toán"}</h1>
          <p>${payment.status === "paid" ? "Thanh toán đã được xác nhận. Quyền mẫu được kiểm tra lại khi xuất bản." : "Không dựa vào trang chuyển hướng để xác nhận. Nếu bạn đã chuyển tiền, hãy tải lại trang sau khi hệ thống nhận webhook."}</p>
          ${receipt ? `<div id="payment-receipt"><h2>Biên nhận ${e(receipt.receiptNo)}</h2><p>Mẫu: ${e(receipt.templateTitle)}</p><p>Số tiền: ${Number(receipt.amountVnd).toLocaleString("vi-VN")} VND</p><p>Phương thức: ${e(receipt.provider)}</p><p>Mã giao dịch: ${e(receipt.transactionReference)}</p><p>${e(receipt.testPayment ? "Thanh toán thử nghiệm — không thu tiền thật" : receipt.note)}</p></div><button class="btn btn--outline" data-action="print-receipt">In / Lưu PDF</button>` : `<p>Trạng thái: ${e(payment.status)}</p><button class="btn btn--outline" data-action="refresh-payment">Kiểm tra lại</button>`}
          ${receiptError ? `<p role="alert">Biên nhận chưa tải được: ${e(receiptError)}</p><button class="btn btn--outline" data-action="refresh-payment">Thử tải biên nhận</button>` : ""}
          ${resumeContext ? `<p><a class="btn btn--dark" href="${e(resumeContext.resumePath)}" data-link>Tiếp tục nháp vừa liên kết</a></p>${resumeContext.changed ? '<p>Nháp đã được chỉnh sửa ở phiên khác. Mở bản mới để xem trước và kiểm tra lại quyền.</p>' : ''}` : ''}
          ${
            contexts.length
              ? `<h2>Tiếp tục thiết kế</h2><p>Mở lại nháp để xem và kiểm tra quyền. Thanh toán không tự xuất bản.</p>${contexts
                  .filter((c) => c.available)
                  .map(
                    (c) =>
                      `<p><a class="btn btn--outline" href="${e(c.resumePath)}" data-link>${e(c.title)} · bản đã lưu r${Number(c.designRevision)}</a></p>`,
                  )
                  .join("")}`
              : ""
          }
          ${contextError ? `<p role="alert">Chưa tải được thiết kế liên quan: ${e(contextError)}</p>` : ""}
          <p>${buttonLink("/studio", "Về không gian của tôi")}</p>
        </div></div></section>`;
      }
    } else if (route === "success" && id) {
      const result = await api.get(`/gifts/gifts/${id}`);
      if (generation !== renderGeneration) return;
      main.innerHTML = successPage(result.gift);
    } else if (route === "studio") {
      if (!state.user) {
        main.innerHTML = errorPage("Đăng nhập để xem các món quà của bạn.");
        setTimeout(() => requireLogin("/studio"), 50);
      } else {
        const [gifts, orders, drafts] = await Promise.all([
          api.get("/gifts/gifts/mine"),
          api.get("/checkout/orders"),
          api.get("/designs/designs"),
        ]);
        if (generation !== renderGeneration) return;
        main.innerHTML = dashboard(gifts.gifts, orders.orders, drafts.designs, drafts.nextOffset);
      }
    } else if (route === "favorites") {
      if (!state.user) {
        main.innerHTML = errorPage("Đăng nhập để xem những mẫu bạn đã lưu.");
        setTimeout(() => requireLogin("/favorites"), 50);
      } else main.innerHTML = favoritesPage();
    } else if (route === "creator") {
      let templates = [];
      if (state.user && ["creator", "admin"].includes(state.user.role))
        templates = (await api.get("/catalog/creator/templates")).templates;
      if (generation !== renderGeneration) return;
      main.innerHTML = creatorPage(templates);
    } else if (route === "admin") {
      if (state.user?.role !== "admin")
        main.innerHTML = errorPage("Bạn cần quyền quản trị viên để truy cập.");
      else {
        const [pending, tickets] = await Promise.all([
          api.get("/catalog/admin/pending"),
          api.get("/support/admin/requests"),
        ]);
        if (generation !== renderGeneration) return;
        main.innerHTML = adminPage(pending.templates, tickets.requests);
      }
    } else if (route === "about") main.innerHTML = aboutPage();
    else if (route === 'pricing') main.innerHTML = pricingPage();
    else if (route === "login" || route === "register")
      main.innerHTML = authPage(route);
    else if (route === "policies" && legalPages[id])
      main.innerHTML = legalPage(id);
    else main.innerHTML = errorPage("Trang bạn yêu cầu không tồn tại.");
    const anchor = location.hash.slice(1);
    if (anchor)
      setTimeout(
        () =>
          document
            .getElementById(anchor)
            ?.scrollIntoView({ behavior: "smooth" }),
        30,
      );
    document.title =
      route === "explore"
        ? "Thư viện quà tặng — Momevia"
        : route === "favorites"
          ? "Mẫu yêu thích — Momevia"
          : route === "creator"
            ? "Creator Studio — Momevia"
            : route === "login"
              ? "Đăng nhập — Momevia"
              : route === "register"
                ? "Đăng ký — Momevia"
                : route === 'pricing' ? 'Bảng giá — Momevia' : route === "policies" && legalPages[id]
                  ? `${legalPages[id].title} — Momevia`
                  : "Momevia — Gửi một điều đáng nhớ";
  } catch (error) {
    if (generation !== renderGeneration || error.name === "AbortError") return;
    main.innerHTML = errorPage(error.message || "Lỗi không xác định.");
  }
}
function updatePreview() {
  const name = document.getElementById("recipientName");
  const sender = document.getElementById("senderName");
  const message = document.getElementById("gift-message");
  if (name && document.getElementById("preview-name"))
    document.getElementById("preview-name").textContent =
      name.value || "Người đặc biệt";
  if (sender && document.getElementById("preview-sender"))
    document.getElementById("preview-sender").textContent =
      `Từ ${sender.value || "một người thương"}`;
  if (message && document.getElementById("preview-message"))
    document.getElementById("preview-message").textContent =
      message.value || "Điều đẹp nhất là có bạn trong cuộc đời này.";
}
async function loadFavorites() {
  if (!state.user) {
    state.favorites = new Set();
    return;
  }
  const result = await api.get("/catalog/favorites");
  state.favorites = new Set(result.templateIds || []);
}
function syncFavoriteButtons() {
  document
    .querySelectorAll('[data-action="toggle-favorite"]')
    .forEach((button) => {
      const saved = state.favorites.has(button.dataset.id);
      button.classList.toggle("is-saved", saved);
      button.setAttribute("aria-pressed", String(saved));
      button.setAttribute(
        "aria-label",
        saved ? "Bỏ yêu thích" : "Lưu mẫu vào yêu thích",
      );
      button.title = saved ? "Bỏ yêu thích" : "Thêm vào yêu thích";
    });
}
async function saveFavorite(templateId, saved) {
  await api.post("/catalog/favorites", { templateId, saved });
  if (saved) state.favorites.add(templateId);
  else state.favorites.delete(templateId);
  syncFavoriteButtons();
}
let modalReturnFocus = null;
function closeModal() {
  const wasOpen = modal.hasChildNodes();
  modal.replaceChildren();
  document.body.classList.remove("no-scroll");
  main.inert = false;
  header.inert = false;
  footer.inert = false;
  canvasCheckout = null;
  if (wasOpen && modalReturnFocus?.isConnected) modalReturnFocus.focus();
  modalReturnFocus = null;
}
function openModal(content) {
  if (!modal.hasChildNodes()) modalReturnFocus = document.activeElement;
  modal.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><div class="dialog" role="dialog" aria-modal="true" aria-label="Hộp thoại"><button class="icon-button dialog-close" data-action="close-modal" aria-label="Đóng">${icon("close", 21)}</button>${content}</div></div>`;
  document.body.classList.add("no-scroll");
  main.inert = true;
  header.inert = true;
  footer.inert = true;
  (
    modal.querySelector("input:not([disabled])") ||
    modal.querySelector("button")
  )?.focus();
}
function openSupport() {
  const displayName = state.user?.name || "";
  const displayEmail = state.user?.email || "";
  openModal(`<div class="support-modal">
    <span class="eyebrow">TRUNG TÂM HỖ TRỢ</span>
    <h2>Chúng mình có thể giúp gì?</h2>
    <p>Gửi câu hỏi hoặc mô tả vấn đề bạn gặp phải. Yêu cầu sẽ được ghi nhận trong hệ thống.</p>
    <form id="support-form" class="support-form">
      <label class="field"><span>Họ tên</span><input name="name" required maxlength="60" value="${e(displayName)}" placeholder="Tên của bạn"/></label>
      <label class="field"><span>Email liên hệ</span><input type="email" name="email" required maxlength="254" value="${e(displayEmail)}" placeholder="ban@example.com"/></label>
      <label class="field"><span>Vấn đề cần hỗ trợ</span><select name="topic" required>
        <option value="Tài khoản">Tài khoản</option>
        <option value="Tạo và chia sẻ quà">Tạo và chia sẻ quà</option>
        <option value="Kho mẫu">Kho mẫu</option>
        <option value="Báo lỗi">Báo lỗi</option>
        <option value="Khác">Khác</option>
      </select></label>
      <label class="field"><span>Nội dung</span><textarea name="message" required minlength="15" maxlength="2000" rows="4" placeholder="Mô tả cụ thể để chúng mình hỗ trợ..."></textarea></label>
      <button type="submit" class="btn btn--dark btn--wide">Gửi yêu cầu ${icon("send", 17)}</button>
    </form>
    <p class="support-note">Vui lòng không gửi mật khẩu hoặc thông tin thanh toán nhạy cảm.</p>
  </div>`);
}
function openAccountMenu() {
  const menu = document.getElementById("account-menu");
  if (menu) menu.hidden = !menu.hidden;
}
async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    toast("Đã sao chép đường link vào bộ nhớ tạm.");
  } catch {
    const input = document.createElement("textarea");
    input.value = value;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
    toast("Đã sao chép đường link.");
  }
}
async function handleAction(action, element) {
  if (action === "login") return navigate("/login");
  if (action === "register") return navigate("/register");
  if (action === "support") return openSupport();
  if (action === "back-to-top") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  if (action === "toggle-favorite") {
    const templateId = element.dataset.id;
    if (!state.user) {
      state.pendingFavoriteId = templateId;
      state.afterLogin = location.pathname + location.hash;
      navigate("/login");
      return;
    }
    element.disabled = true;
    try {
      const saved = !state.favorites.has(templateId);
      await saveFavorite(templateId, saved);
      toast(saved ? "Đã lưu mẫu vào yêu thích." : "Đã bỏ mẫu khỏi yêu thích.");
      if (location.pathname === "/favorites") render();
    } finally {
      element.disabled = false;
    }
    return;
  }
  if (action === "demo-mode") {
    const demo = document.getElementById("auth-demo");
    if (demo) {
      demo.hidden = !demo.hidden;
      demo.querySelector("input")?.focus();
    }
    return;
  }
  if (action === "toggle-password") {
    const input = element.parentElement?.querySelector("input");
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
    const showing = input.type === "text";
    element.innerHTML = icon(showing ? "eye-off" : "eye", 19);
    element.setAttribute(
      "aria-label",
      showing ? "Ẩn mật khẩu" : "Hiện mật khẩu",
    );
    element.setAttribute("aria-pressed", String(showing));
    return;
  }
  if (action === "close-modal") return closeModal();
  if (action === "account-menu") return openAccountMenu();
  if (action === "toggle-menu") {
    const menu = document.getElementById("mobile-nav");
    menu.hidden = !menu.hidden;
    element.setAttribute("aria-expanded", String(!menu.hidden));
    return;
  }
  if (action === "logout") {
    if (routeController?.beforeLeave && !routeController.beforeLeave()) return;
    routeController?.dispose?.();
    routeController = null;
    await api.post("/auth/logout");
    state.user = null;
    state.favorites = new Set();
    toast("Bạn đã đăng xuất.");
    navigate("/");
    return;
  }
  if (action === "clear-filters") {
    state.catalogPage = 1;
    state.filter = "Tất cả";
    state.search = "";
    state.freeOnly = false;
    const search = document.getElementById("template-search");
    const style = document.getElementById("style-filter");
    const free = document.getElementById("free-filter");
    if (search) search.value = "";
    if (style) style.value = "Tất cả";
    if (free) free.checked = false;
    syncCatalogResults();
    return;
  }
  if (action === "set-page") {
    const page = Number(element.dataset.page);
    const list = element.dataset.list;
    if (list === "catalog" && Number.isInteger(page)) {
      const result = paginateTemplates(matchingTemplates(), page);
      if (state.catalogPage === result.page) return;
      state.catalogPage = result.page;
      syncCatalogResults();
      document
        .getElementById("catalog-range")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (list === "favorites" && Number.isInteger(page)) {
      const templates = state.templates.filter((item) =>
        state.favorites.has(item.id),
      );
      const result = paginateTemplates(templates, page);
      if (state.favoritePage === result.page) return;
      state.favoritePage = result.page;
      render().then(() =>
        document
          .querySelector(".dashboard-heading")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
    return;
  }
  if (action === "print-receipt") {
    window.print();
    return;
  }
  if (action === "payment-status") {
    closeModal();
    navigate(`/payment-result/${encodeURIComponent(element.dataset.id)}`);
    return;
  }
  if (action === "refresh-payment") {
    await render();
    return;
  }
  if (action === "retry-canvas-payment" && canvasCheckout)
    return openCanvasCheckout(canvasCheckout);
  if (action === "duplicate-design") {
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
  }
  if (action === 'load-more-designs') {
    const generation = renderGeneration; element.disabled = true;
    try {
      const result = await api.get(`/designs/designs?offset=${Number(element.dataset.offset)}`);
      if (generation !== renderGeneration) return;
      document.getElementById('studio-drafts').insertAdjacentHTML('beforeend', draftCards(result.designs));
      if (result.nextOffset === null) element.remove(); else element.dataset.offset = String(result.nextOffset);
    } finally { if (element.isConnected) element.disabled = false; }
    return;
  }
  if (action === "payment-options") {
    if (!requireLogin(location.pathname)) return;
    const { methods } = await api.get("/checkout/payments/methods");
    if (!methods.length)
      throw new Error("Phương thức thanh toán chưa được kích hoạt.");
    openModal(`<div class="support-modal"><h2>Chọn hình thức thanh toán</h2>
      <p>Số tiền được xác định bởi máy chủ. Không xác nhận bằng ảnh chụp chuyển khoản.</p>
      ${methods.map((m) => `<button class="btn btn--outline btn--wide" type="button" data-action="start-payment" data-id="${e(element.dataset.id)}" data-method="${e(m.id)}">${e(m.label)}</button>`).join("")}
    </div>`);
    return;
  }
  if (action === "start-payment") {
    const checkoutContext = canvasCheckout,
      checkoutGeneration = renderGeneration;
    const stillActive = () =>
      checkoutGeneration === renderGeneration &&
      canvasCheckout === checkoutContext &&
      element.isConnected;
    element.disabled = true;
    try {
      if (checkoutContext) await checkoutContext.flushSave();
      if (!stillActive()) return;
      const { payment } = await api.post("/checkout/payments/create", {
        templateId: element.dataset.id,
        method: element.dataset.method,
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
        throw new Error("Chưa tạo được đường dẫn thanh toán. Hãy thử lại.");
      const destination = new URL(payment.checkoutUrl);
      if (destination.protocol !== "https:")
        throw new Error("Đường dẫn thanh toán không an toàn.");
      if (element.dataset.method === "payos" && payment.qrPayload) {
        const qr = giftQrDataUrl(payment.qrPayload);
        openModal(`<div class="qr-modal"><h2>Quét VietQR để thanh toán</h2>
          <p>Số tiền đơn: ${Number(payment.amount).toLocaleString("vi-VN")} VND</p>
          <p>Dùng ứng dụng ngân hàng quét mã QR, giữ đúng số tiền và nội dung chuyển khoản.</p>
          <img class="qr-image" src="${e(qr)}" alt="Mã VietQR thanh toán"/>
          <p><a class="btn btn--outline btn--wide" href="${e(destination.href)}" target="_blank" rel="noopener noreferrer">Mở cổng payOS</a></p>
          <button class="btn btn--dark btn--wide" data-action="payment-status" data-id="${e(payment.orderId)}">Kiểm tra trạng thái đơn</button>
          <p>Chỉ xác nhận khi máy chủ nhận được webhook hợp lệ.</p>
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
  }
  if (action === "demo-buy") {
    if (!requireLogin(location.pathname)) return;
    const id = element.dataset.id;
    element.disabled = true;
    element.textContent = "Đang chuẩn bị bản dùng thử...";
    try {
      await api.post("/checkout/orders/demo-purchase", { templateId: id });
      toast("Đã kích hoạt mẫu dùng thử, không phát sinh thanh toán.");
      render();
    } catch (error) {
      element.disabled = false;
      toast(error.message, "error");
      render();
    }
    return;
  }
  if (action === "open-gift") {
    document.getElementById("recipient-card")?.classList.add("is-surprise");
    return;
  }
  if (action === "reveal-gift") {
    state.giftOpened = true;
    document.getElementById("recipient-card")?.classList.remove("is-surprise");
    document.getElementById("recipient-card")?.classList.add("is-open");
    return;
  }
  if (action === "copy-link") return copyText(element.dataset.value);
  if (action === "approve-template" || action === "reject-template") {
    const id = encodeURIComponent(element.dataset.id);
    if (action === "approve-template") {
      await api.post(`/catalog/admin/templates/${id}/approve`);
      toast("Đã duyệt mẫu thiết kế.");
      await loadTemplates();
      render();
    } else {
      openModal(
        `<div class="reject-modal"><span class="eyebrow">KIỂM DUYỆT NỘI DUNG</span><h2>Từ chối mẫu thiết kế</h2><p>Vui lòng cung cấp lý do để Creator biết cần chỉnh sửa điểm nào.</p><form id="reject-form" data-template-id="${e(id)}"><label class="field"><span>Lý do từ chối</span><textarea name="reason" rows="4" maxlength="250" required placeholder="Ví dụ: Cần bổ sung giấy phép sử dụng hình ảnh..."></textarea></label><button type="submit" class="btn btn--dark btn--wide">Xác nhận từ chối ${icon("arrow", 17)}</button></form></div>`,
      );
    }
    return;
  }
  if (action === "qr") {
    const link = element.dataset.value;
    const url = giftQrDataUrl(link);
    openModal(
      `<div class="qr-modal"><h2>Mã QR của món quà</h2><p>Người nhận chỉ cần quét mã để mở thiệp.</p><img class="qr-image" src="${e(url)}" alt="Mã QR mở món quà"/><button class="btn btn--outline btn--wide" data-action="copy-link" data-value="${e(link)}">${icon("copy", 17)} Sao chép link</button></div>`,
    );
    return;
  }
}

document.addEventListener("click", async (event) => {
  const actionEl = event.target.closest("[data-action]");
  if (actionEl && !actionEl.disabled) {
    // Chỉ đóng khi bấm trực tiếp vào nền modal, không chặn biểu mẫu và liên kết bên trong.
    if (
      actionEl.classList.contains("modal-backdrop") &&
      event.target !== actionEl
    )
      return;
    event.preventDefault();
    try {
      await handleAction(actionEl.dataset.action, actionEl);
    } catch (error) {
      toast(error.message || "Có lỗi xảy ra.", "error");
    }
    return;
  }
  const link = event.target.closest("a[data-link]");
  if (link) {
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey ||
      link.target === "_blank"
    )
      return;
    event.preventDefault();
    const path = new URL(link.href).pathname + new URL(link.href).hash;
    navigate(path);
  }
});
document.addEventListener("input", (event) => {
  if (event.target.id === "template-search") {
    state.search = event.target.value;
    state.catalogPage = 1;
    syncCatalogResults();
  }
  if (["recipientName", "senderName", "gift-message"].includes(event.target.id))
    updatePreview();
});
document.addEventListener("change", async (event) => {
  if (event.target.id === "style-filter") {
    state.filter = event.target.value;
    state.catalogPage = 1;
    syncCatalogResults();
    return;
  }
  if (event.target.id === "free-filter") {
    state.freeOnly = event.target.checked;
    state.catalogPage = 1;
    syncCatalogResults();
    return;
  }
  if (event.target.id !== "gift-photo") return;
  const file = event.target.files?.[0];
  if (!file) return;
  if (
    file.size > 2 * 1024 * 1024 ||
    !["image/png", "image/jpeg", "image/webp"].includes(file.type)
  ) {
    toast("Ảnh phải là PNG/JPG/WebP và nhỏ hơn 2 MB.", "error");
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    state.photoDataUrl = String(reader.result);
    const preview = document.getElementById("preview-photo");
    if (preview) {
      preview.hidden = false;
      preview.replaceChildren();
      const img = document.createElement("img");
      img.src = state.photoDataUrl;
      img.alt = "Ảnh xem trước";
      preview.appendChild(img);
    }
    document.querySelector(".photo-drop strong").textContent = file.name;
  };
  reader.readAsDataURL(file);
});
document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (
    ![
      "demo-login-form",
      "email-login-form",
      "register-form",
      "create-gift-form",
      "reply-form",
      "creator-template-form",
      "admin-login-form",
      "reject-form",
      "support-form",
    ].includes(form.id)
  )
    return;
  event.preventDefault();
  const submit = form.querySelector("[type=submit]");
  const inlineError = form.querySelector(".auth-inline-error");
  if (inlineError) {
    inlineError.hidden = true;
    inlineError.textContent = "";
  }
  if (submit) submit.disabled = true;
  try {
    const data = Object.fromEntries(new FormData(form));
    if (form.id === "register-form" || form.id === "email-login-form") {
      if (
        form.id === "register-form" &&
        data.password !== data.confirmPassword
      ) {
        throw new Error("Xác nhận mật khẩu không khớp.");
      }
      const endpoint =
        form.id === "register-form" ? "/auth/register" : "/auth/login";
      const result = await api.post(endpoint, data);
      state.user = result.user;
      await loadFavorites();
      if (state.pendingFavoriteId) {
        await saveFavorite(state.pendingFavoriteId, true);
        state.pendingFavoriteId = null;
      }
      toast(
        form.id === "register-form"
          ? "Tạo tài khoản thành công."
          : "Đăng nhập thành công.",
      );
      const target = state.afterLogin || "/studio";
      state.afterLogin = null;
      navigate(target);
    } else if (form.id === "demo-login-form") {
      let deviceId = localStorage.getItem("momevia-demo-device");
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem("momevia-demo-device", deviceId);
      }
      const result = await api.post("/auth/demo", {
        name: data.name,
        deviceId,
      });
      state.user = result.user;
      closeModal();
      toast(`Xin chào ${result.user.name}.`);
      const target = state.afterLogin || "/studio";
      state.afterLogin = null;
      navigate(target);
    } else if (form.id === "admin-login-form") {
      const result = await api.post("/auth/demo-admin", { code: data.code });
      state.user = result.user;
      toast("Đã đăng nhập quyền quản trị demo.");
      navigate("/admin");
    } else if (form.id === "create-gift-form") {
      const result = await api.post("/gifts/gifts", {
        ...data,
        templateId: form.dataset.templateId,
        photoDataUrl: state.photoDataUrl,
      });
      toast("Món quà đã được tạo thành công.");
      navigate(`/success/${result.gift.slug}`);
    } else if (form.id === "support-form") {
      const result = await api.post("/support/requests", data);
      openModal(`<div class="support-modal support-success">
        <span class="support-success__icon">${icon("check-circle", 38)}</span>
        <h2>Đã ghi nhận yêu cầu</h2>
        <p>Hãy lưu mã bên dưới để tiện đối chiếu khi liên hệ với đội ngũ hỗ trợ.</p>
        <div class="support-success__code"><strong>${e(result.ticket.code)}</strong>
          <button type="button" data-action="copy-link" data-value="${e(result.ticket.code)}" aria-label="Sao chép mã yêu cầu">${icon("copy", 18)} Sao chép</button></div>
        <p class="support-note">Yêu cầu đã được lưu vào hệ thống. Thời gian phản hồi chưa được xác định.</p>
      </div>`);
    } else if (form.id === "reply-form") {
      await api.post(`/gifts/gifts/${form.dataset.slug}/replies`, data);
      toast("Lời hồi đáp đã được gửi.");
      const response = await api.get(
        `/gifts/gifts/${form.dataset.slug}/replies`,
      );
      document.getElementById("reply-list").innerHTML = renderReplies(
        response.replies,
      );
      document.querySelector(".memory-container h3 span").textContent =
        `(${response.replies.length})`;
      form.querySelector("textarea").value = "";
    } else if (form.id === "creator-template-form") {
      await api.post("/catalog/creator/templates", {
        ...data,
        price: Number(data.price),
      });
      toast("Đã gửi mẫu cho quản trị viên kiểm duyệt.");
      render();
    } else if (form.id === "reject-form") {
      await api.post(
        `/catalog/admin/templates/${encodeURIComponent(form.dataset.templateId)}/reject`,
        { reason: data.reason },
      );
      closeModal();
      toast("Đã từ chối mẫu và ghi nhận lý do.");
      await loadTemplates();
      render();
    }
  } catch (error) {
    if (inlineError) {
      inlineError.textContent =
        error.message || "Không thể xử lý yêu cầu. Vui lòng thử lại.";
      inlineError.hidden = false;
      inlineError.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else toast(error.message || "Không xử lý được yêu cầu.", "error");
  } finally {
    if (submit) submit.disabled = false;
  }
});
document.addEventListener("keydown", (event) => {
  if (!modal.hasChildNodes()) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeModal();
  }
  if (event.key === "Tab") {
    const controls = [
      ...modal.querySelectorAll("button,input,textarea,select,a[href]"),
    ].filter((el) => !el.disabled && !el.hidden);
    const first = controls[0],
      last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
});
window.addEventListener("popstate", (event) => {
  if (restoringHistory) {
    restoringHistory = false;
    return;
  }
  const targetIndex = event.state?.momeviaIndex;
  if (routeController?.beforeLeave && !routeController.beforeLeave()) {
    if (Number.isInteger(targetIndex) && targetIndex !== historyIndex) {
      restoringHistory = true;
      history.go(historyIndex - targetIndex);
    } else history.pushState({ momeviaIndex: historyIndex }, "", activeUrl);
    return;
  }
  historyIndex = Number.isInteger(targetIndex) ? targetIndex : historyIndex;
  activeUrl = location.pathname + location.search + location.hash;
  render();
});
function updateScrollTools() {
  const button = document.getElementById("back-to-top");
  if (button) button.hidden = window.scrollY < 420;
}
window.addEventListener("scroll", updateScrollTools, { passive: true });
updateScrollTools();
async function loadTemplates() {
  const data = await api.get("/catalog/templates");
  state.templates = data.templates;
}
async function boot() {
  try {
    const [identity, providers] = await Promise.all([
      api.get("/auth/me"),
      api.get("/auth/providers"),
    ]);
    state.user = identity.user;
    state.providers = providers;
    await loadTemplates();
    await loadFavorites();
  } catch (error) {
    toast(error.message, "error");
  }
  await render();
}
boot();
