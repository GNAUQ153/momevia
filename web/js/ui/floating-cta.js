import { attr, text } from '../core/i18n.js';
import { icon } from './icons.js';
import { createHeroCtaMotion } from './hero-cta-motion.js';
import { createCtaExitMotion } from './cta-exit-motion.js';

export const FLOATING_CREATE_URL = '/design/new';
export const FLOATING_EXPLORE_URL = '/explore';
export const isEditingRoute = pathname => /^\/(?:design|create)\/[^/]+\/?$/.test(pathname) || /^\/admin\/library\/?$/.test(pathname);
export const isTaskRoute = pathname => isEditingRoute(pathname) || /^\/(?:login|register|recover|verify-email|creator|studio|admin|g|success|payment-result)(?:\/|$)/.test(pathname);

// Preserve a small gap around actual controls and text.
export const overlapsContent = (overlay, content, gap = 8) => overlay.width > 0 && overlay.height > 0 &&
  content.width > 0 && content.height > 0 && content.left < overlay.right + gap &&
  content.right > overlay.left - gap && content.top < overlay.bottom + gap && content.bottom > overlay.top - gap;

export function visibleCtaRatio(box, width, height, headerBottom = 0) {
  if (!box?.width || !box.height) return 1;
  const visibleWidth = Math.max(0, Math.min(box.right, width) - Math.max(box.left, 0));
  const visibleHeight = Math.max(0, Math.min(box.bottom, height) - Math.max(box.top, headerBottom));
  return Math.min(1, visibleWidth * visibleHeight / (box.width * box.height));
}

const contentSelector = 'a,button,input,textarea,select,summary,p,h1,h2,h3,li,img,[role="status"],[role="alert"],.template-card';

// Promotional actions yield to page content, task flows, dialogs and the footer.
export function mountFloatingCta() {
  const panel = document.createElement('aside');
  panel.className = 'floating-cta';
  panel.dataset.floatingCta = '';
  panel.hidden = true;
  panel.innerHTML = `<nav ${attr('aria-label', 'floatingCta.label')}>
    <a class="floating-cta__create" href="${FLOATING_CREATE_URL}" data-link data-floating-action="create" referrerpolicy="no-referrer">${icon('pencil', 18)}<span>${text('floatingCta.create')}</span></a>
    <a class="floating-cta__explore" href="${FLOATING_EXPLORE_URL}" data-link data-floating-action="explore" referrerpolicy="no-referrer">${icon('layers', 18)}<span>${text('floatingCta.explore')}</span></a>
  </nav>`;
  document.body.append(panel);
  const main = document.getElementById('main');
  const footer = document.getElementById('site-footer');
  const modal = document.getElementById('modal-root');
  const tools = document.querySelector?.('.site-tools');
  const exploreAction = panel.querySelector?.('[data-floating-action="explore"]');
  const createAction = panel.querySelector?.('[data-floating-action="create"]');
  const heroMotion = createHeroCtaMotion(panel);
  const exitMotion = createCtaExitMotion(panel);
  let routeHidden = true, toolsRouteHidden = false, footerInView = false, queued = false, dirty = true, home = false, pricing = false, catalog = false, detail = false;
  let heroActions = null, catalogCreate = null;
  let content = [];
  let footerTarget = null, footerObserver = null;

  const refreshFooterTarget = () => {
    const target = footer?.querySelector?.('.footer-grid') || footer;
    if (target === footerTarget) return;
    if (footerTarget) footerObserver?.unobserve(footerTarget);
    footerTarget = target;
    const box = target?.getBoundingClientRect?.();
    footerInView = Boolean(box?.width && box.height && box.top < document.documentElement.clientHeight && box.bottom > 0);
    if (target) footerObserver?.observe(target);
  };

  const measure = () => {
    const height = panel.getBoundingClientRect().height;
    if (height > 0) document.body.style.setProperty('--floating-cta-height', `${Math.ceil(height)}px`);
  };
  const hide = (element, hidden) => {
    if (!element) return;
    if (hidden && element.contains(document.activeElement)) {
      const target = footerInView ? (footerTarget || footer) : main;
      if (target) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
    }
    if (element === panel) {
      if (hidden) { heroMotion.sync(false); exitMotion.sync(false); }
      else { exitMotion.sync(true, { animate: !heroMotion.willTravel() }); heroMotion.sync(true); }
    } else element.hidden = hidden;
  };
  const syncVisibility = () => {
    const previousHidden = panel.hidden;
    if (dirty) refreshFooterTarget();
    const dialogOpen = Boolean(modal?.hasChildNodes() || main?.querySelector('dialog[open]'));
    if (dirty) heroActions = home ? main?.querySelector('.mkt-hero .mkt-actions') : null;
    if (dirty) catalogCreate = catalog ? main?.querySelector('[data-catalog-create-cta]') : null;
    const templateCreate = detail ? main?.querySelector('[data-template-create-cta]') : null;
    const createUrl = templateCreate?.getAttribute('href') || FLOATING_CREATE_URL;
    if (createAction && createAction.getAttribute('href') !== createUrl) createAction.setAttribute('href', createUrl);
    const headerBottom = document.getElementById('site-header')?.getBoundingClientRect().bottom || 0;
    const heroPassed = heroMotion.prepare(heroActions, headerBottom);
    const pricingIntro = pricing ? main?.querySelector('.pricing-intro')?.getBoundingClientRect() : null;
    const pricingPassed = pricingIntro && pricingIntro.bottom <= headerBottom + 8;
    const catalogPassed = catalogCreate && visibleCtaRatio(catalogCreate.getBoundingClientRect(), document.documentElement.clientWidth, document.documentElement.clientHeight, headerBottom) <= 0.5;
    const disabled = footerInView || dialogOpen || (home && main && !heroPassed) || (pricing && main && !pricingPassed) || (catalog && main && !catalogPassed) || (detail && !templateCreate);
    // Probe fixed overlays synchronously, then settle visibility before painting.
    // Changing visibility never changes document padding or scroll position.
    const eligible = !(routeHidden || disabled);
    if (eligible) panel.hidden = false;
    document.body.classList.toggle('has-floating-cta', eligible);
    if (dirty) { content = main ? [...main.querySelectorAll(contentSelector)] : []; dirty = false; }
    const boxes = content.flatMap(element => {
      const box = element.getBoundingClientRect();
      if (!box.width || !box.height || box.bottom <= 0 || box.top >= document.documentElement.clientHeight) return [];
      const style = getComputedStyle(element);
      return style.visibility === 'hidden' || style.display === 'none' ? [] : [box];
    });
    let desiredVisible = eligible;
    if (desiredVisible) {
      measure();
      const box = panel.getBoundingClientRect();
      desiredVisible = home || pricing || catalog || detail || !boxes.some(contentBox => overlapsContent(box, contentBox));
    }
    panel.hidden = previousHidden;
    hide(panel, !desiredVisible);
    document.body.classList.toggle('has-floating-cta', desiredVisible);
    if (tools) {
      tools.hidden = toolsRouteHidden || disabled;
      const box = tools.getBoundingClientRect();
      hide(tools, tools.hidden || boxes.some(contentBox => overlapsContent(box, contentBox)));
    }
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; syncVisibility(); });
  };
  const resize = new ResizeObserver(schedule);
  resize.observe(panel);
  if (main) resize.observe(main);
  if (footer) resize.observe(footer);
  if (footer && typeof IntersectionObserver === 'function') {
    footerObserver = new IntersectionObserver(entries => {
      const entry = entries.find(item => item.target === footerTarget);
      if (!entry) return;
      footerInView = entry.isIntersecting;
      syncVisibility();
    }, { threshold: 0 });
    refreshFooterTarget();
  }
  if (typeof MutationObserver === 'function') {
    const observer = new MutationObserver(() => { dirty = true; schedule(); });
    if (main) observer.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
    if (modal) observer.observe(modal, { childList: true, subtree: true });
    if (footer) observer.observe(footer, { childList: true, subtree: true });
  }
  document.addEventListener('scroll', schedule, { capture: true, passive: true });
  document.addEventListener('load', schedule, true);
  globalThis.addEventListener?.('resize', schedule, { passive: true });

  let pointerActivation = false;
  document.addEventListener('pointerdown', () => { pointerActivation = true; }, true);
  for (const name of ['click', 'pointercancel', 'keydown']) document.addEventListener(name, () => { pointerActivation = false; }, true);
  document.addEventListener('focusin', event => {
    // Keep pointer targets stationary between pointerdown and pointerup.
    const control = event.target;
    if (home || pricing || catalog || detail || pointerActivation || panel.hidden || panel.contains(control) || !control.matches?.('input,textarea,select,button,a[href]')) return;
    if (overlapsContent(panel.getBoundingClientRect(), control.getBoundingClientRect(), 12)) {
      hide(panel, true);
      document.body.classList.toggle('has-floating-cta', false);
      schedule();
    }
  });
  return { sync(pathname) {
    home = pathname === '/';
    pricing = /^\/pricing\/?$/.test(pathname);
    catalog = /^\/explore\/?$/.test(pathname);
    detail = /^\/template\/[^/]+\/?$/.test(pathname);
    panel.classList?.toggle('floating-cta--catalog', catalog || detail);
    if (exploreAction) exploreAction.hidden = catalog || detail;
    routeHidden = isTaskRoute(pathname);
    toolsRouteHidden = isEditingRoute(pathname) || /^\/(?:login|register|recover|verify-email|creator|g)(?:\/|$)/.test(pathname);
    dirty = true;
    syncVisibility();
    if (main) schedule();
  } };
}
