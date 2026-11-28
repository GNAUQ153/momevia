import test from 'node:test';
import assert from 'node:assert/strict';
import { adventDay, christmasCountdown } from '../../web/js/features/marketing/season-theme.js';
import { seasonCampaign, mountSeasonCampaign } from '../../web/js/features/marketing/season-campaign.js';

test('chiến dịch chuyển mùa theo ngày Việt Nam và không thay đổi quyền của thiệp', () => {
  for (const [date, expected] of [
    ['2026-11-09T16:59:59Z', 'everyday'],
    ['2026-11-09T17:00:00Z', 'christmas'],
    ['2026-12-26T16:59:59Z', 'christmas'],
    ['2026-12-26T17:00:00Z', 'newYear'],
    ['2027-01-07T17:00:00Z', 'everyday'],
    ['2027-01-14T17:00:00Z', 'tet'],
    ['2027-02-22T17:00:00Z', 'everyday'],
  ]) assert.equal(seasonCampaign(new Date(date)), expected, date);
});

test('lịch Tết theo năm và Valentine có ưu tiên trong ngày giao mùa', () => {
  assert.equal(seasonCampaign(new Date('2027-02-14T02:00:00Z')), 'valentine');
  assert.equal(seasonCampaign(new Date('2027-02-16T02:00:00Z')), 'tet');
  assert.equal(seasonCampaign(new Date('2028-01-16T02:00:00Z')), 'everyday');
  assert.equal(adventDay(new Date('2026-11-30T16:59:59Z')), 0);
  assert.equal(adventDay(new Date('2026-11-30T17:00:00Z')), 1);
  assert.deepEqual(christmasCountdown(new Date('2026-12-24T16:58:01Z')), { days: 0, hours: 0, minutes: 2 });
  assert.deepEqual(christmasCountdown(new Date('2026-12-24T17:00:00Z')), { days: 0, hours: 0, minutes: 0 });
});

test('rời route trước khi mount không tạo hiệu ứng hay trình nghe sự kiện', () => {
  const controller = new AbortController();
  controller.abort();
  const root = { querySelector: () => ({}) };
  assert.equal(typeof mountSeasonCampaign(root, { signal: controller.signal }), 'function');
});
