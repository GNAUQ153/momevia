import { attr, text } from '../core/i18n.js';
import { icon } from './icons.js';

export const FLOATING_CREATE_URL = '/design/new';
export const FLOATING_EXPLORE_URL = '/explore';
export const isEditingRoute = pathname => /^\/(?:design|create)\/[^/]+\/?$/.test(pathname) || /^\/admin\/library\/?$/.test(pathname);
export const isTaskRoute = pathname => isEditingRoute(pathname) || /^\/(?:login|register|recover|verify-email|creator|studio|admin|g|success|payment-result)(?:\/|$)/.test(pathname);

// Preserve a small gap around actual controls and text.
export const overlapsContent = (overlay, content, gap = 8) => overlay.width > 0 && overlay.height > 0 &&
  content.width > 0 && content.height > 0 && content.left < overlay.right + gap &&
  content.right > overlay.left - gap && content.top < overlay.bottom + gap && content.bottom > overlay.top - gap;

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
  let routeHidden = true, toolsRouteHidden = false, footerInView = false, queued = false, dirty = true;
  let content = [];

  const measure = () => {
    const height = panel.getBoundingClientRect().height;
    if (height > 0) document.body.style.setProperty('--floating-cta-height', `${Math.ceil(height)}px`);
  };
  const hide = (element, hidden) => {
    if (!element) return;
    if (hidden && element.contains(document.activeElement)) {
      const target = footerInView ? footer : main;
      if (target) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
    }
    element.hidden = hidden;
  };
  const syncVisibility = () => {
    const dialogOpen = Boolean(modal?.hasChildNodes());
    const disabled = footerInView || dialogOpen;
    // Probe fixed overlays synchronously, then settle visibility before painting.
    // Changing visibility never changes document padding or scroll position.
    panel.hidden = routeHidden || disabled;
    document.body.classList.toggle('has-floating-cta', !panel.hidden);
    if (dirty) { content = main ? [...main.querySelectorAll(contentSelector)] : []; dirty = false; }
    const boxes = content.flatMap(element => {
      const box = element.getBoundingClientRect();
      if (!box.width || !box.height || box.bottom <= 0 || box.top >= document.documentElement.clientHeight) return [];
      const style = getComputedStyle(element);
      return style.visibility === 'hidden' || style.display === 'none' ? [] : [box];
    });
    if (!panel.hidden) {
      measure();
      const box = panel.getBoundingClientRect();
      hide(panel, boxes.some(contentBox => overlapsContent(box, contentBox)));
    } else hide(panel, true);
    document.body.classList.toggle('has-floating-cta', !panel.hidden);
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
    const observer = new IntersectionObserver(([entry]) => {
      footerInView = entry.isIntersecting;
      syncVisibility();
    }, { threshold: 0 });
    observer.observe(footer);
  }
  if (typeof MutationObserver === 'function') {
    const observer = new MutationObserver(() => { dirty = true; schedule(); });
    if (main) observer.observe(main, { childList: true, subtree: true });
    if (modal) observer.observe(modal, { childList: true, subtree: true });
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
    if (pointerActivation || panel.hidden || panel.contains(control) || !control.matches?.('input,textarea,select,button,a[href]')) return;
    if (overlapsContent(panel.getBoundingClientRect(), control.getBoundingClientRect(), 12)) {
      hide(panel, true);
      document.body.classList.toggle('has-floating-cta', false);
      schedule();
    }
  });
  return { sync(pathname) {
    routeHidden = isTaskRoute(pathname);
    toolsRouteHidden = isEditingRoute(pathname) || /^\/(?:login|register|recover|verify-email|creator|g)(?:\/|$)/.test(pathname);
    dirty = true;
    syncVisibility();
    if (main) schedule();
  } };
}
