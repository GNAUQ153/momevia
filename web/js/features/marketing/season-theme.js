import { canonicalText } from '../../shared/locale.js';
import { vietnamDay } from '../catalog/seasonal.js';

export const seasonMotionEvent = 'momevia-season-motion';
export const seasonDateEvent = 'momevia-season-date';
const motionKey = 'momevia-season-motion';
const campaigns = [
  { id: 'valentine', from: '02-12', to: '02-15' },
  { id: 'christmas', from: '11-10', to: '12-26' },
  { id: 'newYear', from: '12-27', to: '01-07' },
  // Giai đoạn truyền thông Tết thay đổi theo năm âm lịch.
  { id: 'tet', from: '2027-01-15', to: '2027-02-22' },
];

export function seasonCampaign(date = new Date()) {
  const day = vietnamDay(date);
  for (const { id, from, to } of campaigns) {
    const value = from.length === 5 ? day.slice(5) : day;
    if (from <= to ? value >= from && value <= to : value >= from || value <= to) return id;
  }
  return 'everyday';
}

export function seasonCatalogUrl(campaign) {
  if (campaign === 'everyday') return '/explore';
  return '/explore?occasion=' + encodeURIComponent(canonicalText('templates.meta.category.' + campaign));
}

export function christmasCountdown(date) {
  const year = vietnamDay(date).slice(0, 4);
  const minutes = Math.max(0, Math.ceil((Date.parse(year + '-12-25T00:00:00+07:00') - date.getTime()) / 60000));
  return { days: Math.floor(minutes / 1440), hours: Math.floor(minutes / 60) % 24, minutes: minutes % 60 };
}

export function adventDay(date) {
  const day = vietnamDay(date).slice(5);
  if (day < '12-01') return 0;
  if (day > '12-24') return 24;
  return Number(day.slice(3));
}

let storedPause;
export function seasonPaused(view) {
  if (storedPause === undefined) {
    try { storedPause = view.localStorage.getItem(motionKey) === 'off'; }
    catch { storedPause = false; }
  }
  return storedPause;
}

export function setSeasonPaused(view, paused) {
  storedPause = paused;
  try { view.localStorage.setItem(motionKey, paused ? 'off' : 'on'); } catch { /* Lưu trong phiên nếu bộ nhớ bị chặn. */ }
  view.dispatchEvent(new view.Event(seasonMotionEvent));
}

export function watchSeasonMotion(view, callback, { signal } = {}) {
  const media = ['(prefers-reduced-motion: reduce)', '(prefers-reduced-data: reduce)'].map(query => view.matchMedia(query));
  const connection = view.navigator.connection;
  const options = { signal };
  const sync = () => callback({
    reduced: media.some(item => item.matches) || Boolean(connection?.saveData),
    paused: seasonPaused(view),
    hidden: view.document.hidden,
  });
  for (const item of media) item.addEventListener('change', sync, options);
  connection?.addEventListener?.('change', sync, options);
  view.document.addEventListener('visibilitychange', sync, options);
  view.addEventListener(seasonMotionEvent, sync, options);
  sync();
}

export function mountSeasonTheme(doc) {
  const view = doc.defaultView;
  const root = doc.documentElement;
  let day;
  function syncDate() {
    const now = new Date();
    const next = vietnamDay(now);
    if (day !== next) {
      day = next;
      root.dataset.festival = seasonCampaign(now);
      view.dispatchEvent(new view.Event(seasonDateEvent));
    }
  }
  view.addEventListener('storage', event => {
    if (event.key !== motionKey && event.key !== null) return;
    storedPause = undefined;
    view.dispatchEvent(new view.Event(seasonMotionEvent));
  });
  watchSeasonMotion(view, ({ paused, reduced, hidden }) => {
    root.dataset.festivalStill = String(paused || reduced || hidden);
    if (!hidden) syncDate();
  });
  view.setInterval(syncDate, 30000);
}
