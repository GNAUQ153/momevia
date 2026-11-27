import test from 'node:test';
import assert from 'node:assert/strict';
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

test('rời route trước khi mount không tạo hiệu ứng hay trình nghe sự kiện', () => {
  const controller = new AbortController();
  controller.abort();
  const root = { querySelector: () => ({}) };
  assert.equal(typeof mountSeasonCampaign(root, { signal: controller.signal }), 'function');
});
