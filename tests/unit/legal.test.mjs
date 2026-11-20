import test from 'node:test';
import assert from 'node:assert/strict';
import { legalPages, legalPage } from '../../web/js/pages/policies.js';
import { escapeHtml } from '../../web/js/shared/locale.js';

test('Bốn chính sách có đủ tiêu đề và nội dung', () => {
  assert.deepEqual(Object.keys(legalPages), ['general','payment','privacy','content']);
  for (const key of Object.keys(legalPages)) {
    const html = legalPage(key);
    assert(html.includes(escapeHtml(legalPages[key].title)));
    assert(html.includes('data-link'));
    assert(html.includes('Liên hệ hỗ trợ'));
  }
});
test('Chính sách thanh toán không tuyên bố thanh toán đã hoạt động', () => {
  assert(legalPage('payment').includes('chưa kích hoạt'));
});
