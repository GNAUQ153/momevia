import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeStudioSearch, matchStudioItem, filterStudioEntries } from '../../web/js/features/studio/studio-space.js';

const entries = [
  { type: 'drafts', text: 'Thiệp Tết Nguyên đán cho mẹ' },
  { type: 'gifts', text: 'Đã gửi thiệp Giáng sinh tới Linh' },
  { type: 'orders', text: 'Biên nhận thanh toán Valentine' },
];

test('tìm kiếm tiếng Việt có dấu và không dấu', () => {
  assert.equal(normalizeStudioSearch('  ĐÃ GỬI  '), 'da gui');
  assert.equal(matchStudioItem('Thiệp Tết Nguyên đán', 'tet nguyen dan'), true);
});

test('từ khóa cách nhau nhiều khoảng trắng đều được khớp', () => {
  assert.equal(matchStudioItem('Món quà cho Người Thương', '  NGUOI   thuong '), true);
  assert.equal(matchStudioItem('Món quà cho người thương', 'mua hang'), false);
});

test('bộ lọc chỉ hiển thị đúng loại và không tạo dữ liệu mới', () => {
  const old = structuredClone(entries);
  assert.deepEqual(filterStudioEntries(entries, { type: 'gifts', query: 'giang sinh' }), [entries[1]]);
  assert.equal(filterStudioEntries(entries, { type: 'drafts' }).length, 1);
  assert.deepEqual(entries, old);
});

test('tìm kiếm trên tất cả các phần tử đã tải', () => {
  assert.equal(filterStudioEntries(entries, { type: 'all' }).length, 3);
  assert.equal(filterStudioEntries(entries, { query: 'valentine' }).length, 1);
  assert.equal(filterStudioEntries(entries, { query: 'khong co' }).length, 0);
});

test('component không thay đổi endpoint, role hay các action nghiệp vụ', () => {
  const source = readFileSync(new URL('../../web/js/features/studio/studio-space.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /fetch\(|api\.(post|delete|put)\(/);
  assert.match(source, /observer\.disconnect\(\)/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /matchStudioItem/);
});
