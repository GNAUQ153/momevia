import {mountFloatingCta} from '../ui/floating-cta.js';
import { api, errorCopy, escapeHtml as e } from "../core/api.js";
import {takeCatalogBootstrap,rememberCatalogMetadata} from '../core/catalog-bootstrap.js';
import {mountCoverLoading} from '../core/cover-loading.js';
import {ensureFullStyles} from '../core/client-styles.js';
import { attr, initializeLocale, localeControl, message, onLocaleChange, setAttr, setText, t, text } from "../core/i18n.js";
import { clearAuthReturn, rememberAuthReturn, takeAuthReturn } from "../core/auth-return.js";
import { focusVisibleTarget, scrollBehavior } from "../core/motion.js";
import { icon } from "../ui/icons.js";
import { normalizeCardTypeFilter } from '../shared/card-type.js';
import { paginateTemplates } from "../features/catalog/filter.js";
import { legalPages, legalPage } from "../pages/policies.js";
import { submitReplyIntent } from "../features/gifts/reply-intent.js";
import { advanceRecipientStage } from "../features/gifts/recipient-journey.js";
import { mountInbox } from "../features/gifts/inbox.js";
import { supportTopics, topicForRequest, topicKey } from "../features/support/topics.js";
import { state } from "../core/state.js";
import { templateValue } from "../features/catalog/template-copy.js";
import { createComponents } from "../ui/components.js";
import { createLayout } from "../ui/layout.js";
import { createHomeViews, homeDemo, homeDemos } from "../pages/home.js";
import { mountMarketingMotion } from "../features/marketing/scene-motion.js";
import { mountHeroTemplates } from "../features/marketing/hero-templates.js";
import { mountTemplatePreview } from "../features/catalog/template-preview.js";
import { createCatalogViews } from "../pages/catalog.js";
import { pricingPage } from '../pages/pricing.js';
import { paymentMethodText, paymentReceipt, paymentStatusPanel } from "../pages/payment-status.js";
import { refundBuyerPanel, refundHistoryPanel, refundAdminPanel } from "../pages/refund-review.js";
import { createLatestRequest } from "../features/refund/latest-request.js";
import { recipientViralCta } from "../ui/recipient-viral.js";
import { createSystemViews } from "../pages/system.js";

const floatingCta=mountFloatingCta();
const main = document.getElementById("main");
mountCoverLoading(main);
const publicCatalogGet=endpoint=>(takeCatalogBootstrap(endpoint)?.catch(()=>api.get(endpoint))||api.get(endpoint)).then(rememberCatalogMetadata);
const modal = document.getElementById("modal-root");
const header = document.getElementById("site-header");
const footer = document.getElementById("site-footer");
let routeController = null,
  renderGeneration = 0,
  canvasCheckout = null,
  favoritesLoad = null,
  disposeInbox = null;
let adminPaymentOrders = [];
// Cursor chỉ tồn tại trong phiên Admin hiện tại; khi đổi bộ lọc phải làm lại từ trang đầu.
let refundQueue = { filter: 'active', cursors: [null], index: 0, nextCursor: null };
const refundQueueRequests = createLatestRequest();
async function loadAdminRefundQueue({ filter = refundQueue.filter, index = refundQueue.index, cursor = null } = {}) {
  if (state.user?.role !== 'admin' || location.pathname !== '/admin/payments') return false;
  const host = document.querySelector('.refund-review--admin');
  if (!host) return false;
  const feedback = host.querySelector('[data-refund-queue-feedback]');
  const query = new URLSearchParams({ filter, limit: '20' });
  if (cursor) query.set('cursor', cursor);
  host.setAttribute('aria-busy', 'true');
  if (feedback) setText(feedback, message('refund.queue.loading'));
  return refundQueueRequests.run(
    () => api.get(`/checkout/payments/admin/refund-queue?${query}`), {
      onSuccess({ page }) {
        if (!host.isConnected || location.pathname !== '/admin/payments' || state.user?.role !== 'admin') return;
        if (!page || !Array.isArray(page.requests)) throw new Error('Invalid refund queue response');
        const cursors = index === 0 ? [null] : [...refundQueue.cursors];
        if (index > 0) cursors[index] = cursor;
        refundQueue = { filter, cursors, index, nextCursor: page.nextCursor ?? null };
        host.outerHTML = refundAdminPanel(page.requests, {
          filter, nextCursor: refundQueue.nextCursor, hasPrev: index > 0,
        });
      },
      onError() {
        if (!host.isConnected) return;
        if (feedback) setText(feedback, message('refund.queue.loadFailed'));
        toast(message('refund.queue.loadFailed'), 'error');
      },
      onFinally() {
        if (host.isConnected) host.removeAttribute('aria-busy');
      },
    },
  );
}

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
const { home, featuredGifts, marketingFaq, aboutPage } = createHomeViews(viewContext);
const { refreshNav } = createLayout({ state, header, footer, homeClosing: marketingFaq });
const {
  matchingTemplates,
  syncCatalogResults,
  explore,
  templateDetail,
  favoritesPage,
} = createCatalogViews(viewContext);
let successPage,giftPage,renderReplies,dashboard,draftCards,studioDrafts,studioGifts,studioOrders,mountStudioSpace,giftViewsLoad;
function loadGiftViews(){return giftViewsLoad??=Promise.all([import('../pages/gifts.js'),import('../features/studio/studio-space.js')]).then(([gifts,studio])=>{
 ({successPage,giftPage,renderReplies,dashboard,draftCards,studioDrafts,studioGifts,studioOrders}=gifts.createGiftViews(viewContext));({mountStudioSpace}=studio);
}).catch(error=>{giftViewsLoad=null;throw error;});}
let creatorPage,adminPage,adminPaymentsPage,paymentReviewRows,paymentAuditRows,filterPendingReviews,
  adminExceptionsCsv,creatorSalesCsv,exportFileName,downloadCsvFile,roleViewsLoad;
function loadRoleViews(){
  return roleViewsLoad??=Promise.all([import('../pages/creator.js'),import('../pages/admin.js'),import('../pages/admin-payments.js'),import('../features/finance/export-csv.js')]).then(([creator,admin,payments,csv])=>{
    ({creatorPage}=creator.createCreatorViews(viewContext));({adminPage}=admin.createAdminViews(viewContext));
    ({adminPaymentsPage,paymentReviewRows,paymentAuditRows,filterPendingReviews}=payments);
    ({adminExceptionsCsv,creatorSalesCsv,exportFileName,downloadCsvFile}=csv);
  }).catch(error=>{roleViewsLoad=null;throw error;});
}
let authPage,recoveryPage,authViewsLoad;
function loadAuthViews(){return authViewsLoad??=import('../pages/auth.js').then(auth=>{({authPage,recoveryPage}=auth.createAuthViews(viewContext));}).catch(error=>{authViewsLoad=null;throw error;});}
const { errorPage, loadingPage } = createSystemViews(viewContext);

function updatePageMetadata() {
  const [route, id] = location.pathname.split("/").filter(Boolean);
  const routes = {
    explore: "catalog", favorites: "favorites", creator: "creator",
    login: "login", register: "register", pricing: "pricing",
    studio: "studio", about: "about", create: "design", design: "design", g: "gift",
    template: "template", success: "success", recover: "recover", "verify-email": "verify",
    "payment-result": "payment", admin: "admin",
  };
  const key = route === "admin" && id === "payments" ? "adminPayments" : Object.hasOwn(routes, route) ? routes[route] : null;
  const page = key ? t(`shell.pages.${key}`) : route === "policies" ? legalPages[id]?.title : null;
  document.title = page ? t("shell.meta.routeTitle", { page }) : t("shell.meta.homeTitle");
  setAttr(document.querySelector('meta[name="description"]'), 'content',
    message(route ? 'shell.meta.description' : 'shell.meta.homeDescription'));
}
onLocaleChange(updatePageMetadata);

function updatePageType(isHome) {
  const { dataset } = document.documentElement;
  const attributes = { type: 'software', radius: 'round', buttons: 'tonal' };
  for (const [key, value] of Object.entries(attributes)) {
    if (isHome) dataset[key] = value;
    else delete dataset[key];
  }
  for (const name of ["page-type", "site-kind"]) {
    const current = document.head.querySelector(`meta[name="${name}"]`);
    if (isHome && !current) {
      const meta = document.createElement("meta");
      meta.name = name;
      meta.content = "software";
      document.head.append(meta);
    } else if (!isHome) current?.remove();
  }
}

function loadAppFonts() {
  if (document.getElementById('app-fonts')) return;
  const fonts = document.createElement('link');
  fonts.id = 'app-fonts';
  fonts.rel = 'stylesheet';
  fonts.href = '/css/app-fonts.css';
  document.head.append(fonts);
}
onLocaleChange(() => {
  if (document.getElementById("template-search") && state.search.trim()) syncCatalogResults();
});

function buttonLink(path, label, style = "btn--dark", trailing = true) {
  return `<a class="btn ${style}" href="${path}" data-link>${label} ${trailing ? icon("arrow-up-right", 17) : ""}</a>`;
}
function navigate(path, { replace = false } = {}) {
  const target = new URL(path, location.origin);
  if (routeController?.beforeLeave && !routeController.beforeLeave())
    return false;
  const catalogReturn = location.pathname === '/explore' && target.pathname.startsWith('/template/')
    ? location.pathname + location.search : null;
  if (catalogReturn) history.replaceState({ ...history.state, catalogScrollY: window.scrollY }, '');
  if (replace) history.replaceState({ momeviaIndex: historyIndex, catalogReturn }, "", path);
  else history.pushState({ momeviaIndex: ++historyIndex, catalogReturn }, "", path);
  activeUrl = location.pathname + location.search + location.hash;
  window.scrollTo({ top: 0, behavior: "instant" });
  state.photoDataUrl = null;
  render();
}
function readCatalogUrl() {
  const query = new URLSearchParams(location.search);
  state.search = query.get('q') || '';
  state.cardType = normalizeCardTypeFilter(query.get('cardType'));
  const style = query.get('style');
  state.filter = state.templates.some(template => template.style === style) ? style : 'all';
  state.freeOnly = query.get('free') === '1';
  state.photoOnly = query.get('photo') === '1';
  state.occasion = query.get('occasion') || 'all';state.palette=query.get('palette') || 'all';
  state.catalogPage = Number(query.get('page')) || 1;
}
function commitCatalogFilters() {
  syncCatalogResults();
  const url = new URL(location.href);
  const options = {
    occasion:state.occasion==='all'?'':state.occasion,palette:state.palette==='all'?'':state.palette,
    cardType: state.cardType === 'all' ? '' : state.cardType,
    q: state.search, style: state.filter === 'all' ? '' : state.filter,
    free: state.freeOnly ? '1' : '', photo: state.photoOnly ? '1' : '',
    page: state.catalogPage > 1 ? state.catalogPage : '',
  };
  for (const [key, value] of Object.entries(options)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  activeUrl = url.pathname + url.search + url.hash;
  history.replaceState(history.state, '', activeUrl);
}
let toastTimer;
function toast(copy, type = "success") {
  const host = document.getElementById("toast-host");
  let item = host.firstElementChild;
  if (!item) {
    item = document.createElement("div");
    host.append(item);
  }
  const className = `toast toast--${type}`;
  if (item.className !== className) {
    item.className = className;
    item.innerHTML = `${icon(type === "success" ? "check-circle" : "shield", 18)} <span></span>`;
  }
  setText(item.querySelector("span"), copy);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => item.remove(), 4800);
}
async function openCanvasCheckout(context) {
  try { sessionStorage.setItem(checkoutDraftModeKey(context.design.id), context.mode); } catch { /* Optional cache. */ }
  const generation = renderGeneration;
  canvasCheckout = context;
  await context.flushSave();
  if (generation !== renderGeneration || canvasCheckout !== context) return;
  openModal(
    `<div class="support-modal"><h2>${text("payment.checkout.license")}</h2><p role="status">${text("payment.checkout.methodsLoading")}</p></div>`,
  );
  try {
    const { methods, demoPurchaseAvailable, repurchaseAvailable } = await api.get("/checkout/payments/methods");
    if (generation !== renderGeneration || canvasCheckout !== context) return;
    const templateId = context.design.source.templateId;
    if (!methods.length) {
      openModal(
        demoPurchaseAvailable
          ? `<div class="support-modal"><h2>${text("payment.checkout.demo")}</h2><p>${text("payment.checkout.demoHint")}</p><button class="btn btn--dark btn--wide" data-action="demo-buy" data-id="${e(templateId)}">${text("payment.checkout.demoButton")}</button></div>`
          : `<div class="support-modal"><h2>${text("payment.checkout.noMethods")}</h2><p>${text("payment.checkout.noMethodsHint")}</p></div>`,
      );
      return;
    }
    const previousOrderId = repurchaseAvailable
      ? (await api.get(`/checkout/payments/repurchase/${encodeURIComponent(templateId)}`)).previousOrderId : null;
    if (generation !== renderGeneration || canvasCheckout !== context) return;
    const template = state.templates.find(item => item.id === templateId) || context.preflight.template;
    const title = template?.title ? templateValue(template, "title") : templateId;
    const amount = { format: "currency", value: Number(context.preflight.template?.price || 0) };
    openModal(`<div class="support-modal"><h2>${previousOrderId ? text("payment.checkout.repurchase") : text("payment.checkout.purchase")}</h2><p>${text("payment.checkout.templatePrice", { title, amount })}</p>
      <p>${previousOrderId ? text("payment.checkout.repurchaseHint") : text("payment.checkout.priceHint")}</p>
      ${methods.map((method) => `<button class="btn btn--outline btn--wide" data-action="start-payment" data-id="${e(templateId)}" data-method="${e(method.id)}"${previousOrderId ? ` data-previous-order-id="${e(previousOrderId)}"` : ""}>${paymentMethodText(method)}</button>`).join("")}</div>`);
  } catch (error) {
    if (generation !== renderGeneration || canvasCheckout !== context) return;
    openModal(
      `<div class="support-modal"><h2>${text("payment.checkout.methodsError")}</h2><p role="alert">${e(error.message)}</p><button class="btn btn--outline" data-action="retry-canvas-payment">${text("common.actions.retry")}</button></div>`,
    );
  }
}
function requireLogin(path, favoriteId) {
  if (state.user) return true;
  rememberAuthReturn(path, favoriteId);
  navigate("/login");
  return false;
}

async function finishAuthentication(user, notice, { defaultTarget = "/studio" } = {}) {
  if (!user) return false;
  if (state.user !== user) setUser(user);
  const intent = takeAuthReturn();
  if (!intent && !defaultTarget) return false;
  const generation = renderGeneration;
  if (intent?.favoriteId) {
    await Promise.resolve(loadFavorites()).catch(() => {});
    if (state.user === user && !state.favorites.has(intent.favoriteId)) {
      await saveFavorite(intent.favoriteId, true).catch(error => {
        toast(errorCopy(error, message("system.error.action")), "error");
      });
    }
  }
  if (generation !== renderGeneration || state.user !== user) return true;
  if (notice) toast(notice);
  navigate(intent?.path || defaultTarget, { replace: true });
  return true;
}
function loadStudioSection(name, endpoint, view, signal) {
  const section = document.getElementById(`studio-${name}-section`);
  const label = { section: { format: 'message', key: `studio.sections.${name}` } };
  const load = async () => {
    section.innerHTML = `<p role="status">${text('studio.loading', label)}</p>`;
    try {
      const result = await api.get(endpoint, { signal });
      if (!signal.aborted) section.innerHTML = view(result);
    } catch {
      if (signal.aborted) return;
      section.innerHTML = `<p role="alert">${text('studio.loadFailed', label)}</p><button class="btn btn--outline" type="button">${text('common.actions.retry')}</button>`;
      section.querySelector("button").addEventListener("click", load, { once: true, signal });
    }
  };
  return load();
}
function mountHome() {
  const lifetime = new AbortController();
  const { signal } = lifetime;
  main.innerHTML = home({ catalogStatus: state.templates.length ? "ready" : "loading" });
  const intro = main.querySelector(".mkt-hero__intro");
  intro.addEventListener("pointerenter", event => {
    if (event.pointerType !== "mouse") return;
    const sheen = intro.getAnimations({ subtree: true }).find(animation => animation.animationName === "mkt-glass-sheen");
    if (sheen?.playState !== "finished") return;
    sheen.currentTime = sheen.effect.getTiming().delay;
    sheen.play();
  }, { signal });
  const disposeMarketingMotion = mountMarketingMotion(main, { signal });
  const rotation = mountHeroTemplates(main, homeDemos);
  const preview = mountTemplatePreview(main, homeDemo, { api, onOpen: loadAppFonts, getTemplate: () => rotation.template });
  const featured = main.querySelector('#home-featured-gifts');
  async function loadFeatured() {
    featured.innerHTML = featuredGifts('loading');
    try {
      await Promise.all([loadCatalog(), loadIdentity().then(loadFavorites, () => {})]);
      if (!signal.aborted) featured.innerHTML = featuredGifts('ready');
    } catch {
      if (!signal.aborted) featured.innerHTML = featuredGifts('error');
    }
  }
  featured.addEventListener('click', event => {
    if (event.target.closest('[data-home-catalog-retry]')) loadFeatured();
  }, { signal });
  loadFeatured();
  loadIdentity().then(() => {
    if (state.user && !signal.aborted) refreshNav();
  }, () => {});
  const moment = main.querySelector('[data-moment]');
  const momentHost = moment.parentNode;
  const preference = matchMedia("(prefers-reduced-motion: reduce)");
  const kitPromise = import('/assets/moments/moments.js');
  let momentWork = Promise.resolve(), version = 0;
  function syncMoment() {
    const request = ++version;
    momentWork = momentWork.then(async () => {
      const kit = await kitPromise;
      if (signal.aborted || request !== version) return;
      kit.unmountAll(momentHost);
      delete moment.dataset.momentStill;
      await kit.mount(moment);
      if (signal.aborted) kit.unmountAll(momentHost);
    }).catch(() => {});
  }
  syncMoment();
  const removeLocaleListener = onLocaleChange(syncMoment);
  preference.addEventListener("change", syncMoment, { signal });
  return { dispose() {
    lifetime.abort();
    disposeMarketingMotion();
    rotation.dispose();
    preview.dispose();
    removeLocaleListener();
    moment.__moment?.destroy?.();
  } };
}
async function render() {
  floatingCta.sync(location.pathname);
  const isHome = location.pathname === '/';
  const isAuth = /^\/(login|register|recover|verify-email)\/?$/.test(location.pathname);
  updatePageMetadata();
  updatePageType(isHome);
  if (!isHome) loadAppFonts();
  const generation = ++renderGeneration;
  closeModal();
  routeController?.dispose?.();
  routeController = null;
  canvasCheckout = null;
  document.body.classList.remove("is-designing", "is-playing-gift");
  document.body.classList.toggle("is-home", isHome);
  document.body.classList.toggle("is-auth", isAuth);
  // Bố cục tối chỉ áp dụng Login/Register; recovery giữ giao diện chung.
  document.body.classList.toggle("is-auth-entry", /^\/(login|register)\/?$/.test(location.pathname));
  document.documentElement.classList.toggle("m-enter", isHome);
  document.getElementById('announcement').hidden = location.pathname.startsWith('/g/');
  refreshNav();
  if (!isHome) main.innerHTML = loadingPage();
  try {
    const segments = location.pathname.split("/").filter(Boolean);
    const [route, id] = segments;
    if(!['explore','template','favorites'].includes(route)){await ensureFullStyles();if(generation!==renderGeneration)return;}
    if (["create", "design"].includes(route) || (route === "admin" && id === "library")) {
      try { await loadLibrary(); }
      catch { /* Designer reports and retries library failures on its own route. */ }
      if (generation !== renderGeneration) return;
    }
    let catalogFailed = false;
    if(['creator','admin'].includes(route)){await loadRoleViews();if(generation!==renderGeneration)return;}
    if(['studio','success'].includes(route)){await loadGiftViews();if(generation!==renderGeneration)return;}
    if(['login','register','recover','verify-email'].includes(route)){await loadAuthViews();if(generation!==renderGeneration)return;}
    if (route && route !== "g") {
      const results = await loadPageData(route);
      if (generation !== renderGeneration) return;
      refreshNav();
      const failure = results.find(result => result.status === "rejected");
      catalogFailed = route === 'explore' && results[1]?.status === 'rejected';
      if (failure && !catalogFailed) toast(failure.reason.message, "error");
    }
    if (!route) {
      try{await loadCatalog();}catch{/* Home retains its Catalog retry state. */}
      if(generation!==renderGeneration)return;
      routeController = mountHome();
    }
    else if (route === "explore") {
      readCatalogUrl();
      main.innerHTML = explore({ catalogFailed });
      const scrollPosition = history.state?.catalogScrollY;
      if (Number.isFinite(scrollPosition)) window.scrollTo({ top: scrollPosition, behavior: 'instant' });
    }
    else if (route === "template") {
      const { template } = await publicCatalogGet(`/catalog/templates/${encodeURIComponent(id)}`);
      if (generation !== renderGeneration) return;
      main.innerHTML = template
        ? templateDetail(template, { catalogReturn: history.state?.catalogReturn })
        : errorPage(message("catalog.detail.unavailable"));
      if (template && main.querySelector('[data-template-preview]')) {
        routeController = mountTemplatePreview(main, template, { api, autoOpen: new URLSearchParams(location.search).get('preview') === '1' });
      }
    } else if (
      (route === "create" || route === "design") &&
      id &&
      segments.length === 2
    ) {
      if (!state.user) {
        requireLogin(location.pathname + location.search);
        return;
      }
      const { mountDesigner } = await import("../pages/designer.js");
      if (generation !== renderGeneration) return;
      document.body.classList.add("is-designing");
      routeController = mountDesigner(main, {
        id: route === "design" && id !== "new" ? id : null,
        templateId: route === "create" ? id : null,
        templateVersionId: new URLSearchParams(location.search).get("version"),
        mode: new URLSearchParams(location.search).get("mode"),
        user: state.user,
        api,
        navigate,
        toast,
        onCheckout: openCanvasCheckout,
        onRouteReplace: () => {
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
      const lifetime = new AbortController();
      const giftEndpoint = `/gifts/gifts/${encodeURIComponent(id)}`;
      const invite = new URLSearchParams(location.search).get("invite");
      let query = invite ? `?invite=${encodeURIComponent(invite)}` : "";
      let repliesEndpoint;
      routeController = { dispose: () => lifetime.abort() };
      const closed = error => {
        if (error.status !== 410 || lifetime.signal.aborted) return;
        routeController?.dispose();
        document.body.classList.remove("is-playing-gift");
        closeModal();
        main.innerHTML = errorPage(errorCopy(error));
      };
      const initialReceipt = new URLSearchParams(location.search).get('r');
      if (initialReceipt) query += `${query ? '&' : '?'}r=${encodeURIComponent(initialReceipt)}`;
      let { gift } = await api.get(giftEndpoint + query, { signal: lifetime.signal });
      let gateTools;
      if (gift.recipientMode === 'self') {
        gateTools = await import('../features/gifts/recipient-gate.js');
        let receipt = initialReceipt || gateTools.recipientSession(id);
        if (gift.nameRequired && receipt) {
          try { ({ gift } = await api.get(giftEndpoint + query + `${query ? '&' : '?'}r=${encodeURIComponent(receipt)}`, { signal: lifetime.signal })); }
          catch (error) { if (error.status !== 403) throw error; receipt = ''; }
        }
        if (gift.nameRequired) {
          receipt = await gateTools.openRecipientGate(main, { slug: id, endpoint: `${giftEndpoint}/recipient${query}`, api, signal: lifetime.signal });
          query += `${query ? '&' : '?'}r=${encodeURIComponent(receipt)}`;
          ({ gift } = await api.get(giftEndpoint + query, { signal: lifetime.signal }));
        } else if (receipt && !initialReceipt) query += `${query ? '&' : '?'}r=${encodeURIComponent(receipt)}`;
      }
      repliesEndpoint = `${giftEndpoint}/replies${query}`;
      if (generation !== renderGeneration) return;
      const recheck = () => {
        if (document.visibilityState === "visible")
          api.get(`${giftEndpoint}/status${query}`, { signal: lifetime.signal }).catch(closed);
      };
      document.addEventListener("visibilitychange", recheck, { signal: lifetime.signal });
      const poll = setInterval(recheck, 15000);
      lifetime.signal.addEventListener("abort", () => clearInterval(poll), { once: true });
      if (gift.documentSnapshot) {
        document.body.classList.add("is-playing-gift");
        const { mountPlayer } =
          await import("../features/gift-runtime/index.js");
        if (generation !== renderGeneration) return;
        main.innerHTML = `<section class="section"><div class="container"><div class="recipient-preferences">${localeControl()}</div><div id="canvas-public-player"></div>${gift.rsvp ? '<div data-rsvp-host></div>' : ''}<p class="recipient-disclaimer">${text("gift.player.forwarded")}</p><button class="btn btn--outline" data-action="report-content" data-kind="gift" data-id="${e(id)}">${text("gift.player.report")}</button> ${recipientViralCta()}</div></section>`;
        const player = mountPlayer(
          document.getElementById("canvas-public-player"),
          {
            document: gift.documentSnapshot,
            runtimeVersion: gift.runtimeVersion,
            mode: "public",
            assetUrl: (assetId) =>
              `/api/gifts/gifts/${encodeURIComponent(id)}/assets/${encodeURIComponent(assetId)}${query}`,
            replyAdapter: {
              ...gift.replyPermissions, cardName: gift.recipientName,
              send: gift.replyPermissions.canSend ? async (reply) =>
                submitReplyIntent(`${id}:${gift.receiptId || 'manual'}`, reply, async body => (
                  await api.post(repliesEndpoint, body, {
                    signal: lifetime.signal,
                  }).catch(error => { closed(error); throw error; })
                ).reply) : null,
              list: gift.replyPermissions.canRead ? async () =>
                (
                  await api.get(repliesEndpoint, {
                    signal: lifetime.signal,
                  }).catch(error => { closed(error); throw error; })
                ).replies : null,
            },
          },
        );
        routeController = {
          dispose: () => {
            lifetime.abort();
            player.dispose();
          },
        };
        if (gift.rsvp) {
          const { mountRsvp } = await import('../features/gifts/rsvp.js');
          if (generation !== renderGeneration || lifetime.signal.aborted) return;
          mountRsvp(main.querySelector('[data-rsvp-host]'), gift.rsvp, {
            submit: async status => (await api.post(`${giftEndpoint}/rsvp${query}`, { status }, { signal: lifetime.signal })).rsvp,
            signal: lifetime.signal, onClosed: closed,
          });
        }
      } else {
        await loadGiftViews();if(generation!==renderGeneration)return;
        main.innerHTML = giftPage(gift);
        const replyForm = main.querySelector("#reply-form");
        const replyList = main.querySelector("#reply-list");
        if (replyForm) { replyForm.dataset.endpoint = repliesEndpoint; replyForm.dataset.replyScope = `${id}:${gift.receiptId || 'manual'}`; }
        if (replyList) api.get(repliesEndpoint, { signal: lifetime.signal })
          .then(({ replies }) => {
            if (!replyList.dataset.loaded) updateLegacyReplies(replyList, replies);
          })
          .catch(error => {
            closed(error);
            if (replyList.isConnected && !replyList.dataset.loaded)
              setText(replyList, message('gift.legacy.loadRepliesError'));
          });
      }
      if (gift.recipientMode === 'self') gateTools.addChangeRecipient(main, id, () => void render());
    } else if (route === "payment-result" && id) {
      if (!state.user) {
        main.innerHTML = errorPage(message("payment.checkout.login"));
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
        let refundRequest = null;
        let refundAvailable = false;
        if (payment.status === 'paid') {
          try {
            const response = await api.get(`/checkout/payments/orders/${encodeURIComponent(id)}/refund-request`);
            refundRequest = response.request;
            refundAvailable = true;
          } catch { /* Không coi lỗi API là danh sách yêu cầu rỗng. */ }
        }
        if (generation !== renderGeneration) return;
        main.innerHTML = `<section class="section"><div class="container"><div class="success-card">
          ${paymentStatusPanel(payment)}
          ${refundBuyerPanel(payment, refundRequest, refundAvailable)}
          ${receipt ? paymentReceipt(receipt) : ""}
          ${receiptError ? `<p role="alert">${text('payment.receipt.loadError', { error: receiptError })}</p><button class="btn btn--outline" data-action="refresh-payment">${text('payment.receipt.retry')}</button>` : ""}
          ${resumeContext ? `<p><a class="btn btn--dark" href="${e(checkoutDraftPath(resumeContext))}" data-link>${text('payment.context.resume')}</a></p>${resumeContext.changed ? `<p>${text('payment.context.changed')}</p>` : ''}` : ''}
          ${contexts.length
            ? `<h2>${text('payment.context.continue')}</h2><p>${text('payment.context.explain')}</p>${contexts
              .filter((c) => c.available)
              .map(
                (c) =>
                  `<p><a class="btn btn--outline" href="${e(checkoutDraftPath(c))}" data-link>${text('payment.context.revision', { title: c.title, revision: Number(c.designRevision) })}</a></p>`,
              )
              .join("")}`
            : ""
          }
          ${contextError ? `<p role="alert">${text('payment.context.loadError', { error: contextError })}</p>` : ""}
          <p>${buttonLink("/studio", text("auth.signedIn.studio"))}</p>
        </div></div></section>`;
      }
    } else if (route === "success" && id) {
      if (!requireLogin(location.pathname)) return;
      const result = await api.get(`/gifts/gifts/mine/${encodeURIComponent(id)}`);
      if (generation !== renderGeneration) return;
      main.innerHTML = successPage(result.gift);
      if (result.gift.recipientMode === 'list' && result.gift.status === 'active') {
        const { mountRecipientResults } = await import('../features/gifts/recipient-results.js');
        if (generation !== renderGeneration) return;
        await mountRecipientResults(main.querySelector('[data-recipient-results-host]'), result.gift.slug);
      }
    } else if (route === "studio") {
      if (!state.user) {
        requireLogin("/studio");
      } else {
        if (new URLSearchParams(location.search).get("login") === "success" &&
            await finishAuthentication(state.user, null, { defaultTarget: null })) return;
        const lifetime = new AbortController();
        main.innerHTML = dashboard();
        const disposeStudioSpace = mountStudioSpace(main);
        routeController = { dispose: () => { lifetime.abort(); disposeStudioSpace(); } };
        await Promise.all([
          loadStudioSection("drafts", "/designs/designs", studioDrafts, lifetime.signal),
          loadStudioSection("gifts", "/gifts/gifts/mine", studioGifts, lifetime.signal),
          loadStudioSection("orders", "/checkout/orders", studioOrders, lifetime.signal),
        ]);
        if (generation !== renderGeneration) return;
      }
    } else if (route === "favorites") {
      if (!state.user) {
        requireLogin("/favorites");
      } else main.innerHTML = favoritesPage();
    } else if (route === "creator") {
      let templates = [];
      let legacy = [];
      let statement = null;
      if (state.user && ["creator", "admin"].includes(state.user.role)) {
        const [current, previous, financeResult] = await Promise.all([
          api.get("/catalog/creator/workspaces"),
          api.get("/catalog/creator/templates"),
          api.get("/checkout/payments/creator/statement?limit=20").catch(() => null),
        ]);
        templates = current.templates;
        legacy = previous.templates;
        statement = financeResult?.statement || null;
      }
      if (generation !== renderGeneration) return;
      main.innerHTML = creatorPage(templates, legacy, statement);
    } else if (route === "admin") {
      if (state.user?.role !== "admin")
        main.innerHTML = errorPage(message("admin.access"));
      else if (id === "review" && segments.length === 4) {
        const endpoint = `/catalog/admin/templates/${encodeURIComponent(segments[2])}/versions/${encodeURIComponent(segments[3])}`;
        const [{ version }, { mountReview }] = await Promise.all([api.get(endpoint), import("../features/catalog/review.js")]);
        if (generation !== renderGeneration) return;
        routeController = mountReview(main, { version, endpoint, api, navigate });
      } else if ((id === 'library' || id === 'music-library') && segments.length === 2) {
        const { mountAdminLibrary } = await import('../features/admin-library/index.js');
        if (generation !== renderGeneration) return;
        routeController = mountAdminLibrary(main, { api, initialCategory: id === 'music-library' ? 'audio' : 'element' });
        await routeController.ready;
      } else if (id === "payments" && segments.length === 2) {
        refundQueue = { filter: 'active', cursors: [null], index: 0, nextCursor: null };
        const lifetime = new AbortController();
        routeController = { dispose: () => lifetime.abort() };
        try {
          const [{ orders }, financeResult, auditResult, refundResult] = await Promise.all([
            api.get("/checkout/payments/admin/review?limit=100", { signal: lifetime.signal }),
            api.get("/checkout/payments/admin/finance", { signal: lifetime.signal }).catch(() => null),
            api.get("/checkout/payments/admin/finance/exceptions?limit=50", { signal: lifetime.signal }).catch(() => null),
            api.get("/checkout/payments/admin/refund-queue?filter=active&limit=20", { signal: lifetime.signal }).catch(() => null),
          ]);
          if (generation !== renderGeneration) return;
          adminPaymentOrders = Array.isArray(orders) ? orders : [];
          refundQueue.nextCursor = refundResult?.page?.nextCursor || null;
          main.innerHTML = adminPaymentsPage(adminPaymentOrders, { finance: financeResult?.finance || null, audit: auditResult?.audit || null, refunds: refundResult?.page?.requests ?? null,
            refundPage: { filter: 'active', nextCursor: refundQueue.nextCursor } });
        } catch (error) {
          if (generation !== renderGeneration || error.name === "AbortError") return;
          adminPaymentOrders = [];
          main.innerHTML = adminPaymentsPage([], { error: message("admin.payments.loadError") });
        }
      } else {
        const [pending, tickets, versions] = await Promise.allSettled([
          api.get("/catalog/admin/pending"),
          api.get("/support/admin/requests"),
          api.get("/catalog/admin/version-queue"),
        ]);
        if (generation !== renderGeneration) return;
        main.innerHTML = adminPage(pending.value?.templates ?? null, tickets.value?.requests ?? null, state.user, versions.value?.queue ?? null);
      }
    } else if (route === "about") main.innerHTML = aboutPage();
    else if (route === 'pricing') main.innerHTML = pricingPage();
    else if (route === "recover" || route === "verify-email")
      main.innerHTML = recoveryPage({ verify: route === "verify-email", googleUnlinked: new URLSearchParams(location.search).get("google") === "unlinked" });
    else if (route === "login" || route === "register") {
      if (state.user && await finishAuthentication(state.user, null, { defaultTarget: null })) return;
      main.innerHTML = authPage(route);
    } else if (route === "policies" && legalPages[id])
      main.innerHTML = legalPage(id);
    else main.innerHTML = errorPage(message("system.error.notFound"));
    const anchor = location.hash.slice(1);
    if (anchor)
      setTimeout(
        () =>
          document
            .getElementById(anchor)
            ?.scrollIntoView({ behavior: scrollBehavior() }),
        30,
      );
  } catch (error) {
    if (generation !== renderGeneration || error.name === "AbortError") return;
    main.innerHTML = errorPage(errorCopy(error, message("system.error.unknown")));
  }
}
function updatePreview() {
  const name = document.getElementById("recipientName");
  const sender = document.getElementById("senderName");
  const greeting = document.getElementById("gift-message");
  if (name && document.getElementById("preview-name"))
    setText(document.getElementById("preview-name"), name.value || message('gift.builder.sampleRecipient'));
  if (sender && document.getElementById("preview-sender"))
    setText(document.getElementById("preview-sender"),
      sender.value ? message('gift.builder.previewFrom', { name: sender.value }) : message('gift.builder.sampleFrom'));
  if (greeting && document.getElementById("preview-message"))
    setText(document.getElementById("preview-message"), greeting.value || message('gift.builder.sampleGreeting'));
}
function setUser(user) {
  if (state.user !== user) {
    state.favorites = new Set();
    favoritesLoad = null;
  }
  state.user = user;
}
function loadFavorites() {
  const user = state.user;
  if (!user) return;
  return favoritesLoad ??= api.get("/catalog/favorites")
    .then(result => {
      if (state.user === user) state.favorites = new Set(result.templateIds || []);
    })
    .catch(error => {
      if (state.user === user) favoritesLoad = null;
      throw error;
    });
}
function updateLegacyReplies(list, replies) {
  if (!list?.isConnected) return;
  list.innerHTML = renderReplies(replies);
  list.dataset.loaded = "true";
  main.querySelector(".memory-container h3 span").textContent = `(${replies.length})`;
}
function syncFavoriteButtons() {
  document
    .querySelectorAll('[data-action="toggle-favorite"]')
    .forEach((button) => {
      const saved = state.favorites.has(button.dataset.id);
      button.classList.toggle("is-saved", saved);
      button.setAttribute("aria-pressed", String(saved));
      setAttr(
        button,
        "aria-label",
        message(saved ? "catalog.actions.unfavorite" : "catalog.actions.favorite"),
      );
      setAttr(button, "title", message(saved ? "catalog.actions.unfavorite" : "catalog.actions.addFavorite"));
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
  disposeInbox?.();
  disposeInbox = null;
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
function openModal(content, { showLocaleControl = true } = {}) {
  disposeInbox?.();
  disposeInbox = null;
  if (!modal.hasChildNodes()) modalReturnFocus = document.activeElement;
  modal.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><div class="dialog" role="dialog" aria-modal="true" ${attr("aria-label", "shell.dialog")}><button class="icon-button dialog-close" data-action="close-modal" ${attr("aria-label", "common.actions.close")}>${icon("close", 21)}</button>${showLocaleControl ? localeControl() : ""}${content}</div></div>`;
  const heading = modal.querySelector('.dialog h2');
  if (heading) {
    heading.id ||= 'site-dialog-title';
    modal.querySelector('.dialog').setAttribute('aria-labelledby', heading.id);
  }
  document.body.classList.add("no-scroll");
  main.inert = true;
  header.inert = true;
  footer.inert = true;
  (
    modal.querySelector('input:not([disabled], [type="hidden"])') ||
    modal.querySelector("button")
  )?.focus();
}
function openSupport(report) {
  const displayName = state.user?.name || "";
  const displayEmail = state.user?.email || "";
  openModal(`<div class="support-modal">
    <span class="eyebrow">${text('support.eyebrow')}</span>
    <h2>${text(report ? (report.kind === 'gift' ? 'gift.player.report' : 'catalog.detail.report') : 'support.title')}</h2>
    <p>${text('support.intro')}</p>
    <form id="support-form" class="support-form">
      ${report ? `<input type="hidden" name="reportKind" value="${e(report.kind)}"/><input type="hidden" name="reportId" value="${e(report.id)}"/><input type="hidden" name="invite" value="${e(report.kind === "gift" ? new URLSearchParams(location.search).get("invite") || "" : "")}"/>` : ''}
      <label class="field"><span>${text('support.name')}</span><input name="name" required maxlength="60" value="${e(displayName)}" ${attr('placeholder', 'gift.reply.name')}/></label>
      <label class="field"><span>${text('support.email')}</span><input type="email" name="email" required maxlength="254" value="${e(displayEmail)}" ${attr('placeholder', 'support.emailExample')}/></label>
      ${report ? '<input type="hidden" name="topic" value="report"/>' : `<label class="field"><span>${text('support.topic.label')}</span><select name="topic" required>
        ${supportTopics.map(id => `<option value="${id}">${text(topicKey(id))}</option>`).join('')}
      </select></label>`}
      <label class="field"><span>${text('support.body')}</span><textarea name="message" required minlength="15" maxlength="2000" rows="4" ${attr('placeholder', 'support.bodyHint')}></textarea></label>
      <button type="submit" class="btn btn--dark btn--wide">${text('support.send')} ${icon("send", 17)}</button>
    </form>
    <p class="support-note">${text('support.privacy')}</p>
  </div>`, { showLocaleControl: false });
}
function setAccountMenu(open, restoreFocus = false) {
  const menu = document.getElementById("account-menu");
  const trigger = header.querySelector('[data-action="account-menu"]');
  if (!menu || !trigger) return;
  menu.hidden = !open;
  trigger.setAttribute('aria-expanded', String(open));
  if (open) menu.querySelector('a,button')?.focus();
  else if (restoreFocus) trigger.focus();
}
function setMobileMenu(trigger, menu, open) {
  menu.hidden = !open;
  trigger.setAttribute("aria-expanded", String(open));
  setAttr(trigger, "aria-label", message(open ? "shell.nav.closeMenu" : "shell.nav.openMenu"));
}
// Khi rời breakpoint menu thu gọn, đóng menu và chuyển focus về nav desktop.
const desktopNavigation = window.matchMedia("(min-width: 1151px)");
desktopNavigation.addEventListener("change", ({ matches }) => {
  if (!matches) return;
  const menu = document.getElementById("mobile-nav");
  const trigger = header.querySelector('[data-action="toggle-menu"]');
  if (!menu || !trigger || menu.hidden) return;
  const focusWasInside = menu.contains(document.activeElement);
  setMobileMenu(trigger, menu, false);
  if (focusWasInside) header.querySelector('.nav-links a[aria-current="page"], .nav-links a')?.focus();
});

function checkoutDraftModeKey(designId) {
  return `momevia:checkout-mode:${state.user.id || state.user.sub}:${designId}`;
}
function checkoutDraftPath(context) {
  try {
    if (sessionStorage.getItem(checkoutDraftModeKey(context.designId)) === "quick") return `${context.resumePath}?mode=quick`;
  } catch { /* The saved draft is still available. */ }
  return context.resumePath;
}
async function copyText(trigger) {
  const { value } = trigger.dataset;
  try {
    await navigator.clipboard.writeText(value);
    toast(message("gift.share.copied"));
  } catch {
    if (!trigger.isConnected) return;
    const instruction = message("gift.share.manualCopy");
    let input = trigger.closest("[data-copy-container]")?.querySelector("[data-copy-value]");
    if (!input) {
      openModal(`<h2>${text('gift.share.manualCopyTitle')}</h2><p>${text(instruction.key)}</p><label class="field"><span>${text('gift.share.manualCopyField')}</span><input data-copy-value readonly value="${e(value)}"/></label>`);
      input = modal.querySelector("[data-copy-value]");
    } else {
      input.closest("[data-copy-fallback]")?.removeAttribute("hidden");
      toast(instruction, "error");
    }
    input.focus();
    input.select();
  }
}
async function handleAction(action, element) {
  if (action === 'creator-finance-export' || action === 'admin-finance-export') {
    const isAdmin = action === 'admin-finance-export';
    if (isAdmin ? state.user?.role !== 'admin' : !['creator', 'admin'].includes(state.user?.role)) return;
    element.disabled = true;
    try {
      // Luôn tải báo cáo mới, chỉ từ API đã xác thực; không nhận creatorId từ trình duyệt.
      const result = await api.get(isAdmin
        ? '/checkout/payments/admin/finance/exceptions?limit=100'
        : '/checkout/payments/creator/statement?limit=100');
      if (!element.isConnected) return;
      const report = isAdmin ? result.audit : result.statement;
      const records = isAdmin ? report?.records : report?.recent;
      if (!Array.isArray(records) || !records.length) return toast(message('finance.export.empty'));
      const csv = isAdmin ? adminExceptionsCsv(report) : creatorSalesCsv(report);
      const kind = isAdmin ? 'admin-exceptions' : 'creator-sales';
      downloadCsvFile(exportFileName(kind), csv);
    } catch {
      if (element.isConnected) toast(message('finance.export.error'), 'error');
    } finally {
      if (element.isConnected) element.disabled = false;
    }
    return;
  }
  if (action === 'admin-refund-next' || action === 'admin-refund-prev') {
    if (state.user?.role !== 'admin') return;
    const forward = action === 'admin-refund-next';
    if (forward && !refundQueue.nextCursor) return;
    if (!forward && refundQueue.index === 0) return;
    const index = refundQueue.index + (forward ? 1 : -1);
    const cursor = forward ? refundQueue.nextCursor : refundQueue.cursors[index];
    element.disabled = true;
    try {
      await loadAdminRefundQueue({ index, cursor });
    } finally { if (element.isConnected) element.disabled = false; }
    return;
  }
  if (action === 'admin-refund-move') {
    if (state.user?.role !== 'admin') return;
    const card = element.closest('[data-refund-item]');
    const status = card?.querySelector('[data-refund-next]')?.value;
    const note = card?.querySelector('[data-refund-note]')?.value.trim() || '';
    if (!status || note.length < 10) return toast(message('refund.admin.noteRequired'), 'error');
    element.disabled = true;
    try {
      await api.post(`/checkout/payments/admin/refund-requests/${encodeURIComponent(element.dataset.requestId)}/transition`, {
        expectedStatus: element.dataset.expectedStatus, status, note,
      });
      toast(message('refund.admin.updated'));
      await render();
    } finally { if (element.isConnected) element.disabled = false; }
    return;
  }
  if (action === 'admin-refund-history') {
    if (state.user?.role !== 'admin') return;
    element.disabled = true;
    try {
      const { events } = await api.get(`/checkout/payments/admin/refund-requests/${encodeURIComponent(element.dataset.requestId)}/history?limit=50`);
      if (element.isConnected) openModal(`<h2>${text('refund.admin.history')}</h2>${refundHistoryPanel(events)}`);
    } finally { if (element.isConnected) element.disabled = false; }
    return;
  }
  if (action === "admin-payment-refresh") return render();
  if (action === "admin-payment-audit") {
    const panel = element.closest(".payment-review-card")?.querySelector("[data-payment-audit]");
    if (!panel) return;
    panel.hidden = false;
    panel.innerHTML = `<p role="status">${text('admin.payments.auditLoading')}</p>`;
    element.disabled = true;
    try {
      const { attempts } = await api.get(`/checkout/payments/admin/orders/${encodeURIComponent(element.dataset.orderId)}/audit?limit=50`);
      if (panel.isConnected) panel.innerHTML = paymentAuditRows(attempts);
    } catch {
      if (panel.isConnected) panel.innerHTML = `<p role="alert">${text('admin.payments.auditError')}</p>`;
    } finally { if (element.isConnected) element.disabled = false; }
    return;
  }
  if (action === "retry-admin-queues") return render();
  if (action === "duplicate-template" || action === "withdraw-template") {
    const withdraw = action === "withdraw-template";
    if (withdraw && !window.confirm(t("creator.actions.confirmWithdraw"))) return;
    element.disabled = true;
    try {
      const body = withdraw ? {} : { mutationId: element.dataset.mutation || (element.dataset.mutation = crypto.randomUUID()) };
      const result = await api.post(`/catalog/creator/workspaces/${encodeURIComponent(element.dataset.id)}/${withdraw ? "withdraw" : "duplicate"}`, body);
      if (withdraw) return render();
      navigate(`/design/${encodeURIComponent(result.id)}`);
    } finally { element.disabled = false; }
    return;
  }
  if (action === "report-content") return openSupport({ kind: element.dataset.kind, id: element.dataset.id });
  if (action === "claim-report" || action === "resolve-report") {
    const claim = action === "claim-report";
    const resolution = claim ? null : window.prompt(t("admin.support.prompt"));
    if (!claim && !resolution?.trim()) return;
    await api.post(`/support/admin/requests/${encodeURIComponent(element.dataset.id)}/resolve`, { action: claim ? "claim" : "resolve", resolution });
    await render();
    return;
  }
  if (action === "login") return navigate("/login");
  if (action === "register") return navigate("/register");
  if (action === "support") return openSupport();
  if (action === "back-to-top") {
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
    return;
  }
  if (action === "toggle-favorite") {
    const templateId = element.dataset.id;
    if (!state.user) {
      requireLogin(location.pathname + location.search + location.hash, templateId);
      return;
    }
    element.disabled = true;
    try {
      const saved = !state.favorites.has(templateId);
      await saveFavorite(templateId, saved);
      toast(saved ? message("catalog.saved.added") : message("catalog.saved.removed"));
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
    setAttr(
      element,
      "aria-label",
      message(showing ? "auth.password.hide" : "auth.password.show"),
    );
    element.setAttribute("aria-pressed", String(showing));
    return;
  }
  if (action === "close-modal") return closeModal();
  if (action === "account-menu") {
    const menu = document.getElementById('mobile-nav');
    if (menu && !menu.hidden) setMobileMenu(header.querySelector('[data-action="toggle-menu"]'), menu, false);
    return setAccountMenu(element.getAttribute('aria-expanded') !== 'true');
  }
  if (action === "toggle-menu") {
    const menu = document.getElementById("mobile-nav");
    setAccountMenu(false);
    setMobileMenu(element, menu, menu.hidden);
    return;
  }
  if (action === "logout") {
    if (routeController?.beforeLeave && !routeController.beforeLeave()) return;
    routeController?.dispose?.();
    routeController = null;
    await api.post("/auth/logout");
    clearAuthReturn();
    setUser(null);
    toast(message("auth.logout.done"));
    navigate("/");
    return;
  }
  if (action === "filter-seasonal") {
    // Chỉ thay đổi bộ lọc phía client; không đưa link mời riêng tư vào URL.
    state.filter = "Lễ hội";
    state.search = "";
    state.catalogPage = 1;
    state.freeOnly = false;
    state.photoOnly = false;
    state.occasion=state.palette=state.cardType="all";
    for(const id of ["occasion-filter","palette-filter","card-type-filter"]){const control=document.getElementById(id);if(control)control.value="all";}
    const style = document.getElementById("style-filter");
    if (style) style.value = state.filter;
    const search = document.getElementById("template-search");
    if (search) search.value = "";
    const free = document.getElementById("free-filter");
    if (free) free.checked = false;
    const photo = document.getElementById("photo-filter");
    if (photo) photo.checked = false;
    commitCatalogFilters();
    document.getElementById("catalog-range")?.focus();
    return;
  }
  if (action === "retry-catalog") return render();
  if (action === "clear-filters") {
    state.catalogPage = 1;
    state.filter = "all";
    state.freeOnly = false;
    state.photoOnly = false;
    state.occasion=state.palette=state.cardType="all";
    for(const id of ["occasion-filter","palette-filter","card-type-filter"]){const control=document.getElementById(id);if(control)control.value="all";}
    const style = document.getElementById("style-filter");
    const free = document.getElementById("free-filter");
    const photo = document.getElementById("photo-filter");
    const search = document.getElementById("template-search");
    if (style) style.value = "all";
    if (free) free.checked = false;
    if (photo) photo.checked = false;
    if (search && element.hasAttribute('data-clear-search')) search.value = state.search = '';
    commitCatalogFilters();
    document.querySelector('.catalog-reset')?.focus();
    return;
  }
  if (action === "set-page") {
    const page = Number(element.dataset.page);
    const list = element.dataset.list;
    if (list === "catalog" && Number.isInteger(page)) {
      const result = paginateTemplates(matchingTemplates(), page);
      if (state.catalogPage === result.page) return;
      state.catalogPage = result.page;
      commitCatalogFilters();
      focusVisibleTarget(document.getElementById("catalog-range"), { block: "start" });
    } else if (list === "favorites" && Number.isInteger(page)) {
      const templates = state.templates.filter((item) =>
        state.favorites.has(item.id),
      );
      const result = paginateTemplates(templates, page);
      if (state.favoritePage === result.page) return;
      state.favoritePage = result.page;
      render().then(() => {
        if (location.pathname === "/favorites") focusVisibleTarget(document.getElementById("catalog-range"), { block: "start" });
      });
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
  if (action === "reconcile-payment") {
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
  }
  if (action === "refresh-payment") {
    await render();
    return;
  }
  if (action === "retry-canvas-payment" && canvasCheckout)
    return openCanvasCheckout(canvasCheckout);
  if (action === "archive-design" || action === "revoke-gift") {
    const archive = action === "archive-design";
    const confirmed = window.confirm(archive
      ? t("studio.drafts.confirmArchive")
      : t("studio.gifts.confirmRevoke"));
    if (!confirmed) return;
    const id = encodeURIComponent(element.dataset.id);
    await api.post(archive ? `/designs/designs/${id}/archive` : `/gifts/gifts/mine/${id}/revoke`);
    await render();
    return;
  }
  if (action === "archive-gift" || action === "restore-gift-list") {
    const archived = action === "archive-gift";
    if (archived && !window.confirm(t("studio.gifts.confirmArchive"))) return;
    element.disabled = true;
    try {
      await api.post(`/gifts/gifts/mine/${encodeURIComponent(element.dataset.id)}/archive`, { archived });
      await render();
    } finally { if (element.isConnected) element.disabled = false; }
    return;
  }
  if (action === "recipient-results") {
    openModal(`<div data-recipient-results-host></div>`);
    const { mountRecipientResults } = await import("../features/gifts/recipient-results.js");
    await mountRecipientResults(modal.querySelector("[data-recipient-results-host]"), element.dataset.id);
    return;
  }
  if (action === "gift-inbox") {
    const endpoint = `/gifts/gifts/mine/${encodeURIComponent(element.dataset.id)}/replies`;
    const { replies } = await api.get(endpoint);
    if (!element.isConnected) return;
    openModal(`<h2>${text('gift.inbox.title')}</h2><label class="inbox-filter"><input type="checkbox"/> ${text('gift.inbox.unread')}</label>
      <p class="inbox-status" role="status"></p><div class="reply-list"></div>`);
    disposeInbox = mountInbox(modal.querySelector(".dialog"), {
      replies, renderReplies,
      markRead: ids => api.post(endpoint + "/read", { ids }),
      onUnreadCount: count => {
        if (element.isConnected) setText(element.querySelector("[data-unread-count]"), count ? message('studio.gifts.unread', { count }) : '');
      },
    });
    return;
  }
  if (action === "regift") {
    element.disabled = true;
    try {
      const mutationId = element.dataset.mutation || (element.dataset.mutation = crypto.randomUUID());
      const { design } = await api.post(`/gifts/gifts/mine/${encodeURIComponent(element.dataset.id)}/regift`, { mutationId });
      if (element.isConnected) navigate(`/design/${encodeURIComponent(design.id)}${design.source.kind === "template" ? "?mode=quick" : ""}`);
    } finally {
      if (element.isConnected) element.disabled = false;
    }
    return;
  }
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
    const generation = renderGeneration;
    const { methods, repurchaseAvailable } = await api.get("/checkout/payments/methods");
    if (!methods.length)
      throw new Error(t("payment.checkout.unavailable"));
    const previousOrderId = repurchaseAvailable
      ? (await api.get(`/checkout/payments/repurchase/${encodeURIComponent(element.dataset.id)}`)).previousOrderId : null;
    if (generation !== renderGeneration || !element.isConnected) return;
    openModal(`<div class="support-modal"><h2>${previousOrderId ? text("payment.checkout.repurchase") : text("payment.checkout.choose")}</h2>
      <p>${previousOrderId ? text("payment.checkout.repurchaseHint") : text("payment.checkout.serverAmount")}</p>
      ${methods.map((m) => `<button class="btn btn--outline btn--wide" type="button" data-action="start-payment" data-id="${e(element.dataset.id)}" data-method="${e(m.id)}"${previousOrderId ? ` data-previous-order-id="${e(previousOrderId)}"` : ""}>${paymentMethodText(m)}</button>`).join("")}
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
  }
  if (action === "demo-buy") {
    if (!requireLogin(location.pathname + location.search)) return;
    const context = canvasCheckout;
    const id = element.dataset.id;
    element.disabled = true;
    setText(element, message("payment.checkout.demoLoading"));
    try {
      if (context) await context.flushSave();
      if (!element.isConnected || canvasCheckout !== context) return;
      await api.post("/checkout/orders/demo-purchase", { templateId: id });
      if (!element.isConnected || canvasCheckout !== context) return;
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
  }
  if (action === "open-gift" || action === "reveal-gift") {
    // Chỉ đổi trạng thái giao diện; nội dung và quyền quà vẫn do backend quyết định.
    advanceRecipientStage(
      document.getElementById("recipient-card"),
      action === "open-gift" ? "surprise" : "opened",
    );
    return;
  }
  if (action === "copy-link") return copyText(element);
  if (action === "share-gift") {
    try {
      await navigator.share({ url: element.dataset.value });
    } catch (error) {
      if (error.name !== "AbortError") await copyText(element);
    }
    return;
  }
  if (action === "approve-template" || action === "reject-template") {
    const id = encodeURIComponent(element.dataset.id);
    if (action === "approve-template") {
      await api.post(`/catalog/admin/templates/${id}/approve`);
      toast(message("admin.moderation.approved"));
      await loadTemplates();
      render();
    } else {
      openModal(
        `<div class="reject-modal"><span class="eyebrow">${text("admin.moderation.rejectionBadge")}</span><h2>${text("admin.moderation.rejectionTitle")}</h2><p>${text("admin.moderation.rejectionHint")}</p><form id="reject-form" data-template-id="${e(id)}"><label class="field"><span>${text("admin.moderation.rejectionReason")}</span><textarea name="reason" rows="4" maxlength="250" required ${attr("placeholder", "admin.moderation.rejectionExample")}></textarea></label><button type="submit" class="btn btn--dark btn--wide">${text("admin.moderation.confirmReject")} ${icon("arrow", 17)}</button></form></div>`,
      );
    }
    return;
  }
  if (action === "qr") {
    const link = element.dataset.value;
    const generation=renderGeneration,{giftQrDataUrl}=await import('../features/gifts/qr.js');
    if(generation!==renderGeneration||!element.isConnected)return;
    const url = giftQrDataUrl(link);
    openModal(
      `<div class="qr-modal" data-copy-container><h2>${text('gift.qr.title')}</h2><p>${text('gift.qr.hint')}</p><img class="qr-image" src="${e(url)}" ${attr('alt', 'gift.qr.alt')}/><a class="btn btn--dark btn--wide" href="${e(url)}" download="momevia-qr.gif">${text('gift.qr.download')}</a><button class="btn btn--outline btn--wide" data-action="copy-link" data-value="${e(link)}">${icon("copy", 17)} ${text('studio.gifts.copy')}</button><label class="field" data-copy-fallback hidden><span>${text('gift.share.link')}</span><input data-copy-value readonly value="${e(link)}"/></label></div>`,
    );
    return;
  }
}

document.addEventListener("click", async (event) => {
  if (!event.target.closest('#account-menu, [data-action="account-menu"]')) setAccountMenu(false);
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
      toast(errorCopy(error, message("system.error.action")), "error");
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
    const url = new URL(link.href);
    if (link.classList.contains("auth-back")) clearAuthReturn();
    navigate(url.pathname + url.search + url.hash);
  }
});
function updateAdminPaymentList() {
  if (location.pathname !== "/admin/payments") return;
  const host = document.getElementById("admin-payment-results");
  if (!host) return;
  const filters = {
    search: document.getElementById("admin-payment-search")?.value || "",
    provider: document.getElementById("admin-payment-provider")?.value || "all",
    outcome: document.getElementById("admin-payment-outcome")?.value || "all",
  };
  host.innerHTML = paymentReviewRows(adminPaymentOrders, filters);
  const count = document.getElementById("admin-payment-result-count");
  if (count) setText(count, message('admin.payments.count', { visible: filterPendingReviews(adminPaymentOrders, filters).length, total: adminPaymentOrders.length }));
}
document.addEventListener("input", (event) => {
  if (event.target.id === "admin-payment-search") updateAdminPaymentList();
  if (event.target.id === "template-search") {
    state.search = event.target.value;
    state.catalogPage = 1;
    commitCatalogFilters();
  }
  if (["recipientName", "senderName", "gift-message"].includes(event.target.id))
    updatePreview();
});
document.addEventListener("change", async (event) => {
  if (event.target.id === 'admin-refund-filter') {
    const filter = event.target.value;
    event.target.disabled = true;
    try {
      await loadAdminRefundQueue({ filter, index: 0 });
    } catch (error) {
      toast(errorCopy(error, message('refund.queue.loadFailed')), 'error');
    } finally { if (event.target.isConnected) event.target.disabled = false; }
    return;
  }
  if (["admin-payment-provider", "admin-payment-outcome"].includes(event.target.id)) {
    updateAdminPaymentList();
    return;
  }
  if (event.target.id === 'card-type-filter') {
    state.cardType = normalizeCardTypeFilter(event.target.value);
    state.catalogPage = 1;
    commitCatalogFilters();
    return;
  }
  if (["occasion-filter","palette-filter"].includes(event.target.id)) {state[event.target.id==="occasion-filter"?"occasion":"palette"]=event.target.value;state.catalogPage=1;commitCatalogFilters();return;}
  if (event.target.id === "style-filter") {
    state.filter = event.target.value;
    state.catalogPage = 1;
    commitCatalogFilters();
    return;
  }
  if (["free-filter", "photo-filter"].includes(event.target.id)) {
    state[event.target.id === "free-filter" ? "freeOnly" : "photoOnly"] = event.target.checked;
    state.catalogPage = 1;
    commitCatalogFilters();
    return;
  }
  if (event.target.id !== "gift-photo") return;
  const file = event.target.files?.[0];
  if (!file) return;
  if (
    file.size > 2 * 1024 * 1024 ||
    !["image/png", "image/jpeg", "image/webp"].includes(file.type)
  ) {
    toast(message("gift.builder.photoError"), "error");
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
      setAttr(img, 'alt', message('gift.builder.photoPreview'));
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
      "refund-request-form",
      "support-form",
      "recovery-request-form",
      "recovery-confirm-form",
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
    if (form.id === 'refund-request-form') {
      await api.post(`/checkout/payments/orders/${encodeURIComponent(form.dataset.orderId)}/refund-request`, {
        reasonCode: data.reasonCode,
        detail: String(data.detail || '').trim(),
      });
      toast(message('refund.buyer.received'));
      await render();
    } else if (form.id === "recovery-request-form" || form.id === "recovery-confirm-form") {
      const verify = form.dataset.verify === "true";
      const requestCode = form.id === "recovery-request-form";
      const result = await api.post(`/auth/${verify ? "verify-email" : "recover"}/${requestCode ? "request" : "confirm"}`, data);
      if (!form.isConnected) return;
      if (requestCode) {
        const confirm = document.getElementById("recovery-confirm-form");
        if (!verify) confirm.elements.email.value = data.email.trim();
        confirm.hidden = false;
        setText(document.getElementById("recovery-notice"), message(verify ? "auth.verify.checkMail" : "auth.recovery.checkMail"));
        confirm.elements.code.focus();
      } else {
        await finishAuthentication(result.user, message(verify ? "auth.verify.flash" : "auth.recovery.flash"));
      }
    } else if (form.id === "register-form" || form.id === "email-login-form") {
      if (
        form.id === "register-form" &&
        data.password !== data.confirmPassword
      ) {
        throw new Error(t("auth.password.mismatch"));
      }
      const endpoint =
        form.id === "register-form" ? "/auth/register" : "/auth/login";
      const result = await api.post(endpoint, data);
      await finishAuthentication(result.user,
        form.id === "register-form"
          ? message("auth.register.done")
          : message("auth.login.done"),
      );
    } else if (form.id === "demo-login-form") {
      let deviceId = crypto.randomUUID();
      try {
        deviceId = localStorage.getItem("momevia-demo-device") || deviceId;
        localStorage.setItem("momevia-demo-device", deviceId);
      } catch { /* A demo session can start without a persistent device ID. */ }
      const result = await api.post("/auth/demo", {
        name: data.name,
        deviceId,
      });
      closeModal();
      await finishAuthentication(result.user, message('auth.demo.greeting', { name: result.user.name }));
    } else if (form.id === "admin-login-form") {
      const result = await api.post("/auth/demo-admin", { code: data.code });
      setUser(result.user);
      toast(message("auth.demo.admin"));
      navigate("/admin");
    } else if (form.id === "create-gift-form") {
      const result = await api.post("/gifts/gifts", {
        ...data,
        templateId: form.dataset.templateId,
        photoDataUrl: state.photoDataUrl,
      });
      toast(message("gift.builder.success"));
      navigate(`/success/${result.gift.slug}`);
    } else if (form.id === "support-form") {
      const result = await api.post("/support/requests", { ...data, topic: topicForRequest(data.topic) });
      openModal(`<div class="support-modal support-success">
        <span class="support-success__icon">${icon("check-circle", 38)}</span>
        <h2>${text('support.success.title')}</h2>
        <p>${text('support.success.keepCode')}</p>
        <div class="support-success__code"><strong>${e(result.ticket.code)}</strong>
          <button type="button" data-action="copy-link" data-value="${e(result.ticket.code)}" ${attr('aria-label', 'support.success.copyCode')}>${icon("copy", 18)} ${text('gift.share.copy')}</button></div>
        <p class="support-note">${text('support.success.note')}</p>
      </div>`, { showLocaleControl: false });
    } else if (form.id === "reply-form") {
      try {
        await submitReplyIntent(form.dataset.replyScope || form.dataset.slug, data, body => api.post(form.dataset.endpoint, body));
        const list = form.isConnected ? main.querySelector("#reply-list") : null;
        if (list) updateLegacyReplies(list, (await api.get(form.dataset.endpoint)).replies);
      } catch (error) {
        if (error.status === 410 && form.isConnected) await render();
        throw error;
      }
      toast(message("gift.legacy.replySent"));
      form.querySelector("textarea").value = "";
    } else if (form.id === "creator-template-form") {
      const mutation = form.dataset.mutation || (form.dataset.mutation = crypto.randomUUID());
      const result = await api.post("/catalog/creator/workspaces", { ...data, mutationId: mutation });
      navigate(`/design/${encodeURIComponent(result.id)}`);
    } else if (form.id === "reject-form") {
      await api.post(
        `/catalog/admin/templates/${encodeURIComponent(form.dataset.templateId)}/reject`,
        { reason: data.reason },
      );
      closeModal();
      toast(message("admin.moderation.rejected"));
      await loadTemplates();
      render();
    }
  } catch (error) {
    if (inlineError) {
      setText(inlineError, errorCopy(error, message("system.error.submit")));
      inlineError.hidden = false;
      inlineError.scrollIntoView({ behavior: scrollBehavior(), block: "nearest" });
    } else toast(errorCopy(error, message("system.error.request")), "error");
  } finally {
    if (submit) submit.disabled = false;
  }
});
document.addEventListener("keydown", (event) => {
  if (!modal.hasChildNodes()) {
    if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    const account = document.getElementById('account-menu');
    if (account && !account.hidden) return setAccountMenu(false, true);
    const menu = document.getElementById("mobile-nav");
    if (menu && !menu.hidden) {
      const trigger = header.querySelector('[data-action="toggle-menu"]');
      setMobileMenu(trigger, menu, false);
      trigger.focus();
    }
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    closeModal();
  }
  if (event.key === "Tab") {
    const controls = [
      ...modal.querySelectorAll('button,input:not([type="hidden"]),textarea,select,a[href]'),
    ].filter((el) => !el.disabled && el.getClientRects().length);
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
  const data = await publicCatalogGet("/catalog/templates");
  state.templates = data.templates;
}
function loadOnce(load) {
  let pending;
  return () => pending ??= load().catch(error => {
    pending = null;
    throw error;
  });
}
const loadIdentity = loadOnce(async () => setUser((await api.get("/auth/me")).user));
const loadProviders = loadOnce(async () => { state.providers = await api.get("/auth/providers"); });
const loadCatalog = loadOnce(loadTemplates);
const loadLibrary = loadOnce(async () => {
  const { loadCanvasLibrary } = await import('../features/canvas-editor/library-client.js');
  await loadCanvasLibrary(api, document.documentElement.lang);
});
const catalogRoutes = new Set(["explore", "favorites"]);
const favoriteRoutes = new Set(["explore", "template", "favorites", "studio"]);
function loadPageData(route) {
  const identity = loadIdentity();
  const loads = [identity];
  if (catalogRoutes.has(route)) loads.push(state.user && route === "explore" ? loadTemplates() : loadCatalog());
  if (favoriteRoutes.has(route)) loads.push(identity.then(loadFavorites, () => { }));
  if (["login", "register", "recover", "verify-email", "studio"].includes(route)) loads.push(loadProviders());
  return Promise.allSettled(loads);
}
await initializeLocale();
render();
