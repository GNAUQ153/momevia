import test from 'node:test';
import assert from 'node:assert/strict';
import { paginateTemplates, filterTemplates, PAGE_SIZE } from '../web/js/catalog-filter.js';

// Kiểm tra số lượng và thứ tự mẫu khi số lượng dữ liệu tăng.
const templates = Array.from({ length: 23 }, (_, index) => ({
  id: `mau-${index + 1}`,
  title: `Mẫu ${index + 1}`,
  style: index < 12 ? 'Lãng mạn' : 'Tươi vui',
  price: index % 2 === 0 ? 0 : 59000,
}));

test('Mỗi trang tối đa 9 mẫu và giữ nguyên thứ tự', () => {
  assert.equal(PAGE_SIZE, 9);
  const first = paginateTemplates(templates, 1);
  const second = paginateTemplates(templates, 2);
  const third = paginateTemplates(templates, 3);
  assert.deepEqual([first.items.length, second.items.length, third.items.length], [9, 9, 5]);
  assert.equal(first.items[0].id, 'mau-1');
  assert.equal(second.items[0].id, 'mau-10');
  assert.equal(third.items.at(-1).id, 'mau-23');
  assert.deepEqual([first.from, first.to, first.total, first.totalPages], [1, 9, 23, 3]);
});

test('Phân trang sau khi lọc style và tìm kiếm', () => {
  const filtered = filterTemplates(templates, { style: 'Lãng mạn' });
  assert.equal(filtered.length, 12);
  const page2 = paginateTemplates(filtered, 2);
  assert.equal(page2.items.length, 3);
  assert.equal(page2.totalPages, 2);
  const none = paginateTemplates(filterTemplates(templates, { search: 'khong-ton-tai' }), 1);
  assert.deepEqual([none.items.length, none.from, none.to, none.total], [0, 0, 0, 0]);
});

test('Trang vượt giới hạn được đưa về trang hợp lệ', () => {
  assert.equal(paginateTemplates(templates, 999).page, 3);
  assert.equal(paginateTemplates(templates, -9).page, 1);
  assert.equal(paginateTemplates(templates, 'không hợp lệ').page, 1);
});

test('Có thể áp dụng phân trang cho danh sách yêu thích', () => {
  const favorites = templates.filter((_, index) => index % 2 === 0);
  assert.equal(paginateTemplates(favorites, 1).items.length, 9);
  assert.equal(paginateTemplates(favorites, 2).items.length, 3);
});
