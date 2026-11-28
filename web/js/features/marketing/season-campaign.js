import { attr, message, setText, text } from '../../core/i18n.js';
import { icon } from '../../ui/icons.js';
import { vietnamDay } from '../catalog/seasonal.js';
import {
  adventDay, christmasCountdown, seasonCampaign, seasonCatalogUrl, seasonDateEvent,
  setSeasonPaused, watchSeasonMotion,
} from './season-theme.js';

export { seasonCampaign };

export function renderSeasonBanner(date = new Date()) {
  const season = seasonCampaign(date);
  return `<div class="moments-season">
    <div class="festival-banner-copy">
      <a href="${seasonCatalogUrl(season)}" data-link data-season-link class="moments-season__link">${icon('sparkles', 18)}<span data-season-title>${text('moments.season.' + season)}</span></a>
      <span class="festival-countdown" data-season-countdown ${season === 'christmas' ? '' : 'hidden'}></span>
    </div>
    <button type="button" class="moments-season__motion" data-season-toggle aria-pressed="false">
      ${icon('pause', 16)}<span data-season-label>${text('moments.motion.pause')}</span>
    </button>
  </div>`;
}

export function renderChristmasTree() {
  return `<button type="button" class="festival-tree" data-festival-tree aria-pressed="false" hidden
      ${attr('aria-label', 'festival.tree')} ${attr('title', 'festival.tree')}>
    <span class="festival-tree__art" aria-hidden="true"><i></i></span>
    <span>${text('festival.tree')}</span>
  </button>`;
}

export function renderAdvent() {
  return `<details class="festival-advent" data-festival-advent hidden>
    <summary>${icon('calendar', 19)} ${text('festival.advent.title')}</summary>
    <p>${text('festival.advent.intro')}</p>
    <div class="festival-advent__grid">${Array.from({ length: 24 }, (_, index) =>
      `<button type="button" data-advent-day="${index + 1}" ${attr('aria-label', 'festival.advent.door', { day: index + 1 })} aria-pressed="false" disabled>${index + 1}</button>`).join('')}</div>
    <p data-advent-result role="status"></p>
    <a data-link href="${seasonCatalogUrl('christmas')}">${text('festival.collection')}</a>
  </details>`;
}

export function mountSeasonCampaign(root, { signal } = {}) {
  const hero = root?.querySelector('.moments-hero');
  if (!hero || signal?.aborted) return () => {};
  const doc = hero.ownerDocument;
  const view = doc.defaultView;
  const lifetime = new AbortController();
  const options = { signal: lifetime.signal };
  const toggle = hero.querySelector('[data-season-toggle]');
  const label = hero.querySelector('[data-season-label]');
  const link = hero.querySelector('[data-season-link]');
  const title = hero.querySelector('[data-season-title]');
  const countdown = hero.querySelector('[data-season-countdown]');
  const tree = hero.querySelector('[data-festival-tree]');
  const advent = root.querySelector('[data-festival-advent]');
  const doors = [...advent.querySelectorAll('[data-advent-day]')];
  let preferences;
  let visible = !view.IntersectionObserver;
  let layer;
  let loading;
  const compact = view.matchMedia('(max-width: 680px)');
  const canAnimate = () => preferences && !preferences.reduced && !preferences.paused &&
    !preferences.hidden && visible && hero.dataset.season !== 'everyday';

  function syncMotion() {
    if (!preferences) return;
    const { reduced, paused } = preferences;
    hero.dataset.seasonStill = String(!canAnimate());
    toggle.disabled = reduced;
    toggle.setAttribute('aria-pressed', String(paused));
    setText(label, message(reduced ? 'moments.motion.reduced' : paused ? 'moments.motion.resume' : 'moments.motion.pause'));
    if (!canAnimate() || layer || loading) return;
    loading = import('./season-particles.js').then(({ createSeasonParticles }) => {
      if (lifetime.signal.aborted || !canAnimate()) return;
      layer = createSeasonParticles(doc, compact.matches);
      hero.prepend(layer);
    }).catch(() => {}).finally(() => { loading = null; });
  }

  function syncDate() {
    const now = new Date();
    const campaign = seasonCampaign(now);
    hero.dataset.season = campaign;
    link.href = seasonCatalogUrl(campaign);
    setText(title, message('moments.season.' + campaign));
    const christmas = campaign === 'christmas';
    toggle.hidden = campaign === 'everyday';
    countdown.hidden = tree.hidden = advent.hidden = !christmas;
    if (christmas) {
      const time = christmasCountdown(now);
      const day = adventDay(now);
      const year = vietnamDay(now).slice(0, 4);
      const count = time.days + time.hours + time.minutes;
      setText(countdown, message(count ? 'festival.countdown' : 'festival.arrived', count ? time : undefined));
      for (const door of doors) {
        const number = Number(door.dataset.adventDay);
        door.disabled = number > day;
        try {
          door.dataset.opened = String(view.localStorage.getItem(`momevia-advent-${year}-${number}`) === 'open');
        } catch { /* Vẫn có thể mở ô khi bộ nhớ bị chặn. */ }
      }
    }
    syncMotion();
  }

  toggle.addEventListener('click', () => setSeasonPaused(view, !preferences.paused), options);
  tree.addEventListener('click', () => {
    tree.setAttribute('aria-pressed', String(tree.getAttribute('aria-pressed') !== 'true'));
  }, options);
  advent.addEventListener('click', event => {
    const door = event.target.closest('[data-advent-day]');
    if (!door || door.disabled) return;
    const day = Number(door.dataset.adventDay);
    const year = vietnamDay().slice(0, 4);
    try { view.localStorage.setItem(`momevia-advent-${year}-${day}`, 'open'); } catch { /* Chỉ giữ trong DOM. */ }
    for (const item of doors) item.setAttribute('aria-pressed', String(item === door));
    door.dataset.opened = 'true';
    setText(advent.querySelector('[data-advent-result]'), message('festival.advent.idea.' + ((day - 1) % 6 + 1), { day }));
  }, options);
  compact.addEventListener('change', () => {
    layer?.remove();
    layer = null;
    syncMotion();
  }, options);
  view.addEventListener(seasonDateEvent, syncDate, options);
  const observer = view.IntersectionObserver ? new view.IntersectionObserver(entries => {
    visible = entries[0]?.isIntersecting ?? true;
    syncMotion();
  }) : null;
  observer?.observe(hero);
  syncDate();
  watchSeasonMotion(view, value => { preferences = value; syncMotion(); }, options);
  const timer = view.setInterval(() => { if (!doc.hidden) syncDate(); }, 30000);
  function dispose() {
    lifetime.abort();
    view.clearInterval(timer);
    observer?.disconnect();
    layer?.remove();
    signal?.removeEventListener('abort', dispose);
  }
  signal?.addEventListener('abort', dispose, { once: true });
  return dispose;
}
