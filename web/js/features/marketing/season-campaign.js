import { message, setText, text } from '../../core/i18n.js';
import { canonicalText } from '../../shared/locale.js';
import { icon } from '../../ui/icons.js';
import { vietnamDay } from '../catalog/seasonal.js';

// Đây là lịch truyền thông, không phải ngày nghỉ lễ hay thời hạn của thiệp.
export function seasonCampaign(date = new Date()) {
  const day = vietnamDay(date);
  const monthDay = day.slice(5);
  if (monthDay >= '11-10' && monthDay <= '12-26') return 'christmas';
  if (monthDay >= '12-27' || monthDay <= '01-07') return 'newYear';
  if (monthDay >= '01-15' && monthDay <= '02-22') return 'tet';
  return 'everyday';
}

export function renderSeasonBanner(date = new Date()) {
  const campaign = seasonCampaign(date);
  const category = { christmas: 'christmas', newYear: 'newYear', tet: 'tet' }[campaign];
  const href = category ? '/explore?occasion=' + encodeURIComponent(canonicalText('templates.meta.category.' + category)) : '/explore';
  return `<div class="moments-season" data-campaign="${campaign}">
    <a href="${href}" data-link class="moments-season__link">${icon('sparkles', 18)}<span>${text('moments.season.' + campaign)}</span></a>
    <button type="button" class="moments-season__motion" data-season-toggle aria-pressed="false">
      ${icon('sparkles', 16)}<span data-season-label>${text('moments.motion.pause')}</span>
    </button>
  </div>`;
}

// CSS 3D và Web Animations dùng nội bộ; không gửi dữ liệu đến dịch vụ bên ngoài.
export function mountSeasonCampaign(root, { signal } = {}) {
  const hero = root?.querySelector('.moments-hero');
  if (!hero || signal?.aborted) return () => {};
  const doc = hero.ownerDocument;
  const view = doc.defaultView;
  const reduce = view.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedData = view.matchMedia('(prefers-reduced-data: reduce)');
  const connection = view.navigator.connection;
  const toggle = hero.querySelector('[data-season-toggle]');
  const label = hero.querySelector('[data-season-label]');
  const layer = doc.createElement('div');
  layer.className = 'moments-season-particles';
  layer.setAttribute('aria-hidden', 'true');
  layer.inert = true;
  // Số phần tử cố định; không chạy vòng lặp JavaScript để vẽ hạt.
  for (let index = 0; index < 12; index++) layer.append(doc.createElement('i'));
  hero.prepend(layer);
  let paused = false;
  let visible = true;
  const lifetime = new AbortController();
  const options = { signal: lifetime.signal };
  function sync() {
    const reduced = reduce.matches || reducedData.matches || Boolean(connection?.saveData);
    const still = paused || reduced || doc.hidden || !visible;
    toggle.disabled = reduced;
    hero.dataset.seasonStill = String(still);
    toggle.setAttribute('aria-pressed', String(paused));
    setText(label, message(reduced ? 'moments.motion.reduced' : paused ? 'moments.motion.resume' : 'moments.motion.pause'));
  }
  toggle.addEventListener('click', () => { paused = !paused; sync(); }, options);
  reduce.addEventListener('change', sync, options);
  reducedData.addEventListener('change', sync, options);
  connection?.addEventListener?.('change', sync, options);
  doc.addEventListener('visibilitychange', sync, options);
  const observer = view.IntersectionObserver ? new view.IntersectionObserver(entries => {
    visible = entries[0]?.isIntersecting ?? true;
    sync();
  }) : null;
  observer?.observe(hero);
  hero.dataset.season = seasonCampaign();
  sync();
  function dispose() {
    lifetime.abort();
    observer?.disconnect();
    layer.remove();
    delete hero.dataset.seasonStill;
  }
  signal?.addEventListener('abort', dispose, { once: true });
  return dispose;
}
