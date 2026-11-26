import { marketingConnection, marketingShouldShowStatic } from './motion-preferences.js';
import { constructionTargetInViewport, createConstructionScheduler } from './construction-scheduler.js';

const colors = ['#7954dc', '#159ab3', '#df568a', '#dc9b24', '#28a47a', '#6381dc', '#e57544', '#b65ec7', '#559931', '#dc5771'];

export const constructionWorkerCount = 15;
const idleFlightDuration = 1000;

export function constructionTravelFrames(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const bend = Math.min(38, distance * 0.09);
  const controlX = (from.x + to.x) / 2 - (distance ? dy / distance * bend : 0);
  const controlY = (from.y + to.y) / 2 + (distance ? dx / distance * bend : 0);
  return Array.from({ length: 13 }, (_, index) => {
    const t = index / 12, rest = 1 - t;
    const x = rest * rest * from.x + 2 * rest * t * controlX + t * t * to.x;
    const y = rest * rest * from.y + 2 * rest * t * controlY + t * t * to.y;
    return { transform: `translate3d(${x}px, ${y}px, 0)`, opacity: 1, offset: t };
  });
}

export function createConstructionIdleLoop({ running, fly, interrupt }) {
  const loops = new Map();
  function claim(worker) {
    const state = loops.get(worker);
    if (!state) return;
    state.cancelled = true;
    loops.delete(worker);
    interrupt(worker);
  }
  function start(worker) {
    if (!running() || loops.has(worker)) return;
    const state = { cancelled: false };
    loops.set(worker, state);
    void Promise.resolve().then(async () => {
      while (running() && !state.cancelled) await fly(worker);
    }).catch(() => {}).finally(() => {
      if (loops.get(worker) === state) loops.delete(worker);
    });
  }
  function stop() {
    for (const worker of [...loops.keys()]) claim(worker);
  }
  return { start, claim, stop };
}

export async function wanderConstructionCursor(worker, { animate, width, height, top = 0, random = Math.random }) {
  if (!worker) return;
  const position = (x, y) => `translate3d(${x}px, ${y}px, 0)`;
  const frames = [{ transform: position(worker.x, worker.y), opacity: 1 }];
  const maxX = Math.max(12, width - 24), maxY = Math.max(12, height - 24);
  const minY = Math.min(top + 12, maxY);
  let x = worker.x, y = worker.y;
  for (let step = 0; step < 3; step++) {
    const angle = random() * Math.PI * 2;
    const distance = 45 + random() * 100;
    x = Math.max(12, Math.min(maxX, x + Math.cos(angle) * distance));
    y = Math.max(minY, Math.min(maxY, y + Math.sin(angle) * distance));
    frames.push({ transform: position(x, y), opacity: 1 });
  }
  await animate(worker.cursor, frames, { duration: idleFlightDuration, easing: 'linear' });
  worker.x = x;
  worker.y = y;
  worker.cursor.style.transform = position(x, y);
}

export function mountHomeConstruction(root, { signal, catalogPending = false } = {}) {
  const doc = root?.ownerDocument;
  const view = doc?.defaultView;
  const noop = { refresh() {}, dispose() {} };
  if (!view?.Element?.prototype.animate || signal?.aborted) return noop;
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedData = view.matchMedia('(prefers-reduced-data: reduce)');
  const connection = marketingConnection(view.navigator);
  const staticPreferred = () => marketingShouldShowStatic({
    reducedMotion: reduced.matches, reducedData: reducedData.matches, saveData: connection?.saveData,
  });
  if (staticPreferred() || doc.hidden) return noop;

  const lifetime = new AbortController();
  const options = { signal: lifetime.signal };
  const pending = new Set();
  const built = new WeakSet();
  const motions = new Set();
  const workers = [];
  let stopped = false;
  let disposed = false;
  let cancelScroll = null;
  let scrolling = null;
  let idleController = null;
  let scheduler = null;
  let awaitingCatalog = catalogPending;
  const overlay = doc.createElement('div');
  overlay.className = 'home-construction';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.inert = true;
  const running = () => !stopped && !disposed && !signal?.aborted;
  const find = selector => root.querySelector(selector);
  const select = (scope, selectors) => selectors.flatMap(selector => [...(scope?.querySelectorAll(selector) || [])]);
  const sectionLane = (section, selectors) => select(find(section), selectors);
  const cardLanes = () => [...root.querySelectorAll('.template-card--home:not([aria-hidden="true"])')].slice(0, 3)
    .map(card => [card, ...select(card, ['.template-card__visual', '.favorite-button', '.template-card__type', '.template-card__occasion', '.template-card__title', '.template-card__bottom'])]);
  const regions = [
    { lanes: () => [
      sectionLane('.open-me-hero', ['.mkt-hero__eyebrow', 'h1', '.hero__lead', '.mkt-actions > *', '.mkt-hero__benefits li', '.mkt-hero__scroll']),
      sectionLane('.open-me-hero', ['.open-me-stack', '.open-me-posters__stamp', '.mkt-stage__note', '.mkt-hero__cover', '.mkt-stage__reply', '.mkt-hero__rotation']),
    ] },
    { lanes: () => [
      sectionLane('.mkt-featured', ['.mkt-featured__heading h2', '.mkt-featured__heading .btn']),
      sectionLane('.mkt-featured', ['.mkt-occasion__link']),
    ] },
    { lanes: cardLanes },
    { lanes: () => [
      sectionLane('.mkt-journey', ['.mkt-journey__eyebrow', '.mkt-journey__heading h2', '.mkt-journey__heading p', '.mkt-journey__step', '.mkt-journey__footer .btn']),
      sectionLane('.mkt-journey', ['.mkt-journey__showcase', '.mkt-journey__scene', '.mkt-journey__postcard', '[data-mkt-panel="create"] h3', '[data-mkt-panel="create"] p']),
    ] },
    { lanes: () => [
      [...sectionLane('.mkt-how', ['h2']), ...[...(find('.mkt-how')?.querySelectorAll('.mkt-steps li') || [])].flatMap(step => select(step, [':scope > span', 'h3', 'p']))],
      sectionLane('.mkt-how', ['.mkt-example', '.mkt-example__editor h3', '.mkt-example__field strong', '.mkt-example__field p', '.mkt-example__recipient h3', '.mkt-example__letter span', '.mkt-example__letter p']),
    ] },
    { lanes: () => {
      const footer = doc.getElementById('site-footer');
      return [select(footer, ['#mkt-faq-title', '.mkt-faq__callout .btn']), select(footer, ['.mkt-faq__item'])];
    } },
    { lanes: () => {
      const footer = doc.getElementById('site-footer');
      return [select(footer, ['.footer-logo', '.footer-about p', '.footer-bottom']), ...[...(footer?.querySelectorAll('.footer-column') || [])].map(column => select(column, [':scope > *']))];
    } },
  ];

  const collectTargets = () => regions.flatMap(region => region.lanes().flat());

  function prepareTargets() {
    const targets = collectTargets();
    for (const target of targets) {
      if (built.has(target) || pending.has(target)) continue;
      pending.add(target);
      target.classList.add('home-construction-pending');
    }
    return targets;
  }

  function refresh(settings = {}) {
    if (!running()) return;
    if ('catalogReady' in settings) awaitingCatalog = !settings.catalogReady;
    prepareTargets();
    scheduler?.notify();
  }

  function reveal(target) {
    target.classList.remove('home-construction-pending');
    pending.delete(target);
  }

  function finish() {
    if (stopped) return;
    stopped = true;
    scheduler?.notify();
    idleController?.stop();
    cancelScroll?.();
    for (const animation of [...motions]) animation.cancel();
    for (const target of pending) target.classList.remove('home-construction-pending');
    pending.clear();
    overlay.remove();
    root.removeAttribute('data-home-construction-running');
    doc.body.classList.remove('is-home-constructing');
    root.dispatchEvent(new view.Event('home-construction:complete'));
  }

  function play(element, frames, settings, onCreated) {
    if (!running()) return Promise.reject(new Error('Construction stopped'));
    const animation = element.animate(frames, { fill: 'both', ...settings });
    motions.add(animation);
    onCreated?.(animation);
    return animation.finished.finally(() => {
      motions.delete(animation);
      animation.cancel();
    });
  }

  function scrollToY(top, duration = 800) {
    if (!running()) return Promise.resolve(false);
    if (scrolling) return scrolling;
    const start = view.scrollY;
    const maximum = Math.max(0, doc.documentElement.scrollHeight - view.innerHeight);
    const end = Math.max(0, Math.min(top, maximum));
    if (Math.abs(end - start) < 3) return Promise.resolve(false);
    const work = new Promise(resolve => {
      let frame = null;
      let started = null;
      const done = () => { if (frame !== null) view.cancelAnimationFrame(frame); cancelScroll = null; resolve(running()); };
      cancelScroll = done;
      const tick = now => {
        if (!running()) { done(); return; }
        started ??= now;
        const progress = Math.min((now - started) / duration, 1);
        const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
        view.scrollTo({ top: start + (end - start) * eased, behavior: 'instant' });
        syncViewport();
        if (progress === 1) done();
        else frame = view.requestAnimationFrame(tick);
      };
      frame = view.requestAnimationFrame(tick);
    });
    scrolling = work.finally(() => { scrolling = null; });
    return scrolling;
  }

  const headerOffset = () => (doc.getElementById('site-header')?.getBoundingClientRect().height || 80) + 24;

  function syncViewport() {
    for (const worker of workers) {
      if (!worker.documentSpace) continue;
      worker.element.style.transform = `translate3d(0, ${-view.scrollY}px, 0)`;
      if (worker.target?.isConnected) {
        const rect = worker.target.getBoundingClientRect();
        Object.assign(worker.frame.style, {
          left: `${Math.max(4, rect.left - 4)}px`, top: `${rect.top + view.scrollY - 4}px`,
          width: `${rect.width + 8}px`, height: `${rect.height + 8}px`,
        });
      }
    }
    scheduler?.notify();
  }

  function startIdle(index) {
    const worker = workerAt(index);
    if (worker.documentSpace) {
      worker.y -= view.scrollY;
      worker.documentSpace = false;
      worker.target = null;
      worker.element.style.transform = 'none';
      worker.cursor.style.transform = `translate3d(${worker.x}px, ${worker.y}px, 0)`;
    }
    idleController.start(worker);
  }

  function workerAt(index) {
    if (workers[index]) {
      return workers[index];
    }
    const element = doc.createElement('div');
    element.className = 'home-construction__worker';
    element.style.setProperty('--construction-color', colors[index % colors.length]);
    element.innerHTML = '<div class="home-construction__selection"><i></i><i></i><i></i><i></i></div><div class="home-construction__cursor"><svg viewBox="0 0 20 24" width="19" height="23"><path d="M2 2 17 14 10 15 7 22Z" fill="currentColor" stroke="white" stroke-width="1.5" stroke-linejoin="round"/></svg></div>';
    overlay.append(element);
    const worker = { element, frame: element.querySelector('.home-construction__selection'), cursor: element.querySelector('.home-construction__cursor'), x: view.innerWidth / 2, y: view.innerHeight * 0.3 };
    worker.frame.style.opacity = '0';
    worker.cursor.style.opacity = '1';
    worker.cursor.style.transform = `translate3d(${worker.x}px, ${worker.y}px, 0)`;
    workers[index] = worker;
    return worker;
  }

  async function build(target, index) {
    if (!running() || !target.isConnected || built.has(target)) return;
    if (target.closest('[hidden], dialog:not([open]), [inert]')) { reveal(target); return; }
    built.add(target);
    const rect = target.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) { reveal(target); return; }
    if (!running()) return;
    const worker = workerAt(index);
    idleController.claim(worker);
    if (!worker.documentSpace) worker.y += view.scrollY;
    worker.documentSpace = true;
    worker.target = target;
    worker.element.style.transform = `translate3d(0, ${-view.scrollY}px, 0)`;
    const { cursor, frame } = worker;
    const left = Math.max(4, rect.left - 4), top = rect.top + view.scrollY - 4;
    const width = Math.min(rect.width + 8, view.innerWidth - left - 4), height = rect.height + 8;
    const position = (x, y) => `translate3d(${x}px, ${y}px, 0)`;
    const distance = Math.hypot(left - worker.x, top - worker.y);
    await play(cursor, constructionTravelFrames(worker, { x: left, y: top }), {
      duration: Math.min(650, 240 + distance * 0.25), easing: 'cubic-bezier(.25,.5,.35,1)',
    });
    cursor.style.transform = position(left, top);
    cursor.style.opacity = '1';
    Object.assign(frame.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
    const isText = target.matches('h1, h2, h3, p, span, strong, .mkt-hero__eyebrow');
    const duration = isText ? Math.min(1600, 750 + (target.textContent?.length || 0) * 8) : 900;
    const steps = Math.max(12, Math.min(80, target.textContent?.length || 24));
    reveal(target);
    await Promise.all([
      play(frame, [
        { opacity: 0.85, clipPath: 'inset(-4px 100% 100% -4px)' },
        { opacity: 0.85, clipPath: 'inset(-4px)', offset: 0.8 },
        { opacity: 0.6, clipPath: 'inset(-4px)' },
      ], { duration }),
      play(cursor, [
        { transform: position(left, top) },
        { transform: position(left + width, top), offset: 0.45 },
        { transform: position(left + width, top + height) },
      ], { duration, easing: 'ease-in-out' }),
      play(target, [
        { opacity: 0, clipPath: isText ? 'inset(0 100% 0 0)' : 'inset(0 0 100% 0 round 8px)' },
        { opacity: 1, clipPath: 'inset(0)' },
      ], { duration, easing: isText ? `steps(${steps}, end)` : 'cubic-bezier(.2,.65,.3,1)' }),
    ]);
    worker.x = left + width;
    worker.y = top + height;
    cursor.style.transform = position(worker.x, worker.y);
    // Release the cursor immediately; the old selection fades while it starts flying.
    void play(frame, [{ opacity: 0.65 }, { opacity: 0 }], { duration: 200 }).catch(() => {});
    frame.style.opacity = '0';
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    finish();
    lifetime.abort();
    root.removeAttribute('data-home-construction');
    signal?.removeEventListener('abort', dispose);
  }

  root.setAttribute('data-home-construction', '');
  root.setAttribute('data-home-construction-running', '');
  doc.body.classList.add('is-home-constructing');
  doc.body.append(overlay);
  idleController = createConstructionIdleLoop({
    running,
    fly: worker => wanderConstructionCursor(worker, {
      width: view.innerWidth, height: view.innerHeight, top: headerOffset(),
      animate: (element, frames, settings) => {
        let current;
        return play(element, frames, settings, animation => {
          current = animation;
          worker.idleAnimation = animation;
        }).finally(() => {
          if (worker.idleAnimation === current) worker.idleAnimation = null;
        });
      },
    }),
    interrupt: worker => {
      const animation = worker.idleAnimation;
      if (!animation) return;
      // Hand over at the displayed position, so a task never teleports the cursor.
      const matrix = new view.DOMMatrixReadOnly(view.getComputedStyle(worker.cursor).transform);
      worker.x = matrix.m41;
      worker.y = matrix.m42;
      worker.cursor.style.transform = `translate3d(${worker.x}px, ${worker.y}px, 0)`;
      worker.idleAnimation = null;
      animation.cancel();
    },
  });
  scheduler = createConstructionScheduler({
    targets: prepareTargets, workerCount: constructionWorkerCount, running,
    available: target => {
      if (!target.isConnected || target.closest('[hidden], dialog:not([open]), [inert]')) return false;
      const rect = target.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < view.innerWidth;
    },
    visible: target => constructionTargetInViewport(target.getBoundingClientRect(), {
      width: view.innerWidth, height: view.innerHeight - 16, top: headerOffset() - 12,
    }),
    group: target => target.closest('.mkt-hero__intro, .mkt-hero__artwork, .mkt-occasion__links, .template-card--home, .mkt-journey__heading, .mkt-journey__steps, .mkt-journey__showcase, .mkt-steps, .mkt-example, .footer-column, .footer-about, .mkt-hero, .mkt-section, .home-footer-faq, .footer-grid') || target.parentElement,
    build, idle: startIdle, pendingContent: () => awaitingCatalog,
    advance: target => {
      const rect = target.getBoundingClientRect();
      const anchor = rect.bottom <= headerOffset() ? headerOffset() : Math.max(headerOffset(), view.innerHeight * 0.6);
      return scrollToY(view.scrollY + rect.top - anchor, 600);
    },
    complete: () => scrollToY(0, 1100),
  });
  for (let index = 0; index < constructionWorkerCount; index++) startIdle(index);
  refresh();
  // The tour owns scrolling until completion; clicking no longer skips the construction.
  const keepTourScroll = event => { if (running()) event.preventDefault(); };
  view.addEventListener('wheel', keepTourScroll, { ...options, passive: false });
  view.addEventListener('touchmove', keepTourScroll, { ...options, passive: false });
  view.addEventListener('scroll', syncViewport, { ...options, passive: true });
  view.addEventListener('resize', syncViewport, options);
  doc.addEventListener('keydown', event => {
    if (!running() || event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) event.preventDefault();
  }, options);
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) finish(); }, options);
  for (const media of [reduced, reducedData, connection]) media?.addEventListener('change', () => { if (staticPreferred()) finish(); }, options);
  signal?.addEventListener('abort', dispose, { once: true });
  void scrollToY(0).then(() => scheduler.run()).catch(() => {}).finally(finish);
  return { refresh, dispose };
}
