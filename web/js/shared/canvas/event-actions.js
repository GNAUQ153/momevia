const escapeCalendar = value => String(value).replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/[,;]/g, '\\$&');
export const eventMapUrl = event => event?.venue?.trim()
  ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(event.venue) : null;
export function eventCalendar(event, title, now = Date.now()) {
  if (!event?.eventAt || !Number.isFinite(Date.parse(event.eventAt))) return null;
  const stamp = value => new Date(value).toISOString().replace(/[-:]|\.\d{3}/g, '');
  const identity = [event.eventAt, event.venue || '', title || ''].join('\0');
  let key = 2166136261;
  for (let i = 0; i < identity.length; i++) key = Math.imul(key ^ identity.charCodeAt(i), 16777619);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Momevia//Invitation//EN', 'BEGIN:VEVENT',
    `UID:${stamp(event.eventAt)}-${(key >>> 0).toString(16)}@momevia`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(event.eventAt)}`,
    `SUMMARY:${escapeCalendar(title)}`, `LOCATION:${escapeCalendar(event.venue || '')}`,
    'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
}
