import { currentLocale, message, setText, t } from '../../core/i18n.js';

export function eventMapUrl(venue) {
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', venue);
  return url.href;
}

const escapeIcs = value => String(value).replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/[,;]/g, char => `\\${char}`).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
const utc = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
// Chỉ dùng dữ liệu sự kiện đã được backend công bố, không đưa token nhận thiệp vào lịch.
export function eventCalendar(invitation, title, { now = Date.now(), uid = globalThis.crypto.randomUUID() } = {}) {
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//MOMEVIA//Invitation//EN','BEGIN:VEVENT',
    `UID:${escapeIcs(uid)}@momevia.io.vn`, `DTSTAMP:${utc(now)}`, `DTSTART:${utc(invitation.eventAt)}`,
    `SUMMARY:${escapeIcs(title)}`, `LOCATION:${escapeIcs(invitation.venue)}`,'END:VEVENT','END:VCALENDAR',''].join('\r\n');
}

export function eventRemaining(eventAt, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((Date.parse(eventAt) - now) / 1000));
  return [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
}

export function mountInvitationTools(root, invitation, { title, signal }) {
  if (!root || signal.aborted || !Number.isFinite(Date.parse(invitation.eventAt)) || !invitation.venue) return;
  const element = (tag, key) => {
    const item = document.createElement(tag);
    if (key) setText(item, message(key));
    return item;
  };
  root.className = 'gift-event-tools';
  const heading = element('h2', 'originals.eventDetails');
  const date = element('p');
  date.textContent = new Intl.DateTimeFormat(currentLocale(), { dateStyle: 'long', timeStyle: 'short', timeZone: invitation.timeZone }).format(new Date(invitation.eventAt));
  const venue = element('p');
  venue.textContent = invitation.venue;
  const countdown = element('p');
  countdown.className = 'gift-event-countdown';
  const update = () => {
    const [days, hours, minutes, seconds] = eventRemaining(invitation.eventAt);
    setText(countdown, message(days + hours + minutes + seconds ? 'originals.countdown' : 'originals.eventReached', { days, hours, minutes, seconds }));
  };
  update();
  const timer = setInterval(() => { if (!root.hidden && !document.hidden) update(); }, 1000);
  signal.addEventListener('abort', () => clearInterval(timer), { once: true });
  const maps = element('a', 'originals.map');
  maps.href = eventMapUrl(invitation.venue);
  maps.target = '_blank';
  maps.rel = 'noopener noreferrer';
  const save = element('button', 'originals.calendar');
  save.type = 'button';
  save.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([eventCalendar(invitation, title || t('originals.eventDetails'))], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'momevia-event.ics';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, { signal });
  root.replaceChildren(heading, date, venue, countdown, maps, save);
}
