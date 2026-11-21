import assert from 'node:assert/strict';
import test from 'node:test';
import { createCreatorViews, creatorReviewFeedback } from '../../web/js/pages/creator.js';

const template = versions => ({
  title: 'Mẫu sinh nhật', subtitle: 'Mô tả', creatorDesignId: 'demo-design', versions,
});

test('Chỉ phản hồi mới nhất cần sửa được đưa vào thông báo', () => {
  const versions = [
    { revision: 1, status: 'approved', reason: '' },
    { revision: 2, status: 'changes_requested', reason: 'Kiểm tra lại bố cục bìa.' },
  ];
  assert.deepEqual(creatorReviewFeedback([template(versions)]), [
    { title: 'Mẫu sinh nhật', reason: 'Kiểm tra lại bố cục bìa.' },
  ]);
  assert.deepEqual(creatorReviewFeedback([template([...versions, {
    revision: 3, status: 'approved', reason: '',
  }])]), []);
});

test('Trang Creator có thông báo riêng, điều hướng tới danh sách và escape dữ liệu', () => {
  const suspicious = template([{ revision: 2, status: 'changes_requested',
    reason: '<img src=x onerror=alert(1)>',
  }]);
  const html = createCreatorViews({ state: { user: { role: 'creator' } } }).creatorPage([suspicious]);
  assert.match(html, /role="status" aria-labelledby="creator-review-notice-title" data-creator-review-notice/);
  assert.match(html, /href="#creator-list"/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img src=x onerror=/);
});

test('Không tạo thông báo phản hồi trong trang Sender hoặc khi không có yêu cầu sửa', () => {
  const t = template([{ revision: 1, status: 'changes_requested', reason: 'Sửa màu.' }]);
  const sender = createCreatorViews({ state: { user: { role: 'sender' } } }).creatorPage([t]);
  const creator = createCreatorViews({ state: { user: { role: 'creator' } } }).creatorPage([template([
    { revision: 1, status: 'approved', reason: '' },
  ])]);
  assert.doesNotMatch(sender, /data-creator-review-notice/);
  assert.doesNotMatch(creator, /data-creator-review-notice/);
});
