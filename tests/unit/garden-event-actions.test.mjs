import test from 'node:test';
import assert from 'node:assert/strict';
import { eventCalendar, eventMapUrl } from '../../web/js/shared/canvas/event-actions.js';

const event = { eventAt: '2026-12-04T08:00:00.000Z', venue: 'Vườn Ngọc Lan, Thảo Điền' };
test('saved calendar uses the event instant and stable identities for different appointments', () => {
  const first = eventCalendar(event, 'Trà chiều', 0), again = eventCalendar(event, 'Trà chiều', 1000);
  const uid = data => data.split('\r\n').find(line => line.startsWith('UID:'));
  assert.match(first, /DTSTART:20261204T080000Z/);
  assert.equal(uid(first), uid(again));
  assert.notEqual(uid(first), uid(eventCalendar({ ...event, venue: 'Another garden' }, 'Trà chiều', 0)));
  assert.notEqual(uid(first), uid(eventCalendar(event, 'Another invitation', 0)));
});
test('calendar text cannot create additional fields through line breaks', () => {
  const data = eventCalendar({ ...event, venue: 'Garden\rATTACH:example\nEND:VEVENT' }, 'Tea, flowers; friends', 0);
  assert.doesNotMatch(data, /\r\nATTACH:/);
  assert.equal(data.split('END:VEVENT').length, 3, 'one escaped text occurrence and the real event ending');
  assert.match(data, /Garden\\nATTACH:example\\nEND:VEVENT/);
  assert.match(data, /SUMMARY:Tea\\, flowers\\; friends/);
  assert.equal(eventCalendar({ eventAt: 'invalid' }, 'Tea'), null);
});
test('directions keep user-provided venue text inside the map query', () => {
  const venue = 'Vườn xanh & hoa / phòng 2';
  const url = new URL(eventMapUrl({ venue }));
  assert.equal(url.origin, 'https://www.google.com');
  assert.equal(url.searchParams.get('query'), venue);
  assert.equal(eventMapUrl({ venue: '' }), null);
});
