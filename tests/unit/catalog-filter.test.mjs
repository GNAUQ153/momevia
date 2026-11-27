import test from 'node:test';
import assert from 'node:assert/strict';
import { activeCatalogFilters, clearCatalogFilter, filterTemplates, styleOptions, countLabel, paginateTemplates, PAGE_SIZE } from '../../web/js/features/catalog/filter.js';

const templates = [
  { id: 'a', title: 'Love', subtitle: 'Hi', style: 'Lãng mạn', creator: 'A', price: 59000 },
  { id: 'b', title: 'Bright', subtitle: 'Ngày vui', style: 'Tươi vui', creator: 'B', price: 0 },
  { id: 'c', title: 'Sweet', subtitle: 'Sinh nhật', style: 'Lãng mạn', creator: 'C', price: 0 },
  { id: 'd', title: 'Cloud', subtitle: '', style: 'Kỳ ảo', creator: 'D', price: 39000 },
];

test('Danh sách style tự sinh và đếm đúng', () => {
  assert.deepEqual(styleOptions(templates), [
    { style: 'Kỳ ảo', count: 1 },
    { style: 'Lãng mạn', count: 2 },
    { style: 'Tươi vui', count: 1 }
  ]);
});
test('Lọc theo phong cách và số lượng tương ứng', () => {
  assert.deepEqual(filterTemplates(templates, {style:'Lãng mạn'}).map(t=>t.id), ['a','c']);
  assert.equal(countLabel(2), '2 mẫu phù hợp');
});
test('Kết hợp lọc miễn phí và phong cách', () => {
  assert.deepEqual(filterTemplates(templates, {style:'Lãng mạn',freeOnly:true}).map(t=>t.id), ['c']);
});
test('Tìm kiếm không phân biệt chữ hoa và có từ phong cách', () => {
  assert.deepEqual(filterTemplates(templates, {search:'TƯƠI VUI'}).map(t=>t.id), ['b']);
  assert.deepEqual(filterTemplates(templates, {search:'ngày vui'}).map(t=>t.id), ['b']);
});
test('Không có kết quả và dữ liệu style có thể mở rộng', () => {
  assert.equal(filterTemplates(templates, {search:'không có'}).length, 0);
  const expanded = [...templates, {id:'e',style:'Tân cổ điển',title:'New',price:0}];
  assert.equal(styleOptions(expanded).some(s => s.style === 'Tân cổ điển'), true);
});

test('Tìm dịp gồm đ/Đ, kết hợp miễn phí và khung ảnh, giữ nguyên dấu của kết quả', () => {
  const category = 'Đầy tháng';
  const rows = [0, 1, 2].map(index => ({ id: index, title: 'Kỷ niệm', category, price: index === 2 ? 39000 : 0,
    personalization: { photoFrames: index === 0 ? 0 : 1 } }));
  for (const search of ['day thang', 'ĐẦY THÁNG'])
    assert.deepEqual(filterTemplates(rows, { search, freeOnly: true, photoOnly: true }), [rows[1]]);
  assert.equal(rows[1].category, 'Đầy tháng');
});

// Kiểm tra số lượng và thứ tự mẫu khi số lượng dữ liệu tăng.
const paginationTemplates = Array.from({ length: 23 }, (_, index) => ({
  id: `mau-${index + 1}`,
  title: `Mẫu ${index + 1}`,
  style: index < 12 ? 'Lãng mạn' : 'Tươi vui',
  price: index % 2 === 0 ? 0 : 59000,
}));

test('Mỗi trang tối đa 9 mẫu và giữ nguyên thứ tự', () => {
  assert.equal(PAGE_SIZE, 9);
  const first = paginateTemplates(paginationTemplates, 1);
  const second = paginateTemplates(paginationTemplates, 2);
  const third = paginateTemplates(paginationTemplates, 3);
  assert.deepEqual([first.items.length, second.items.length, third.items.length], [9, 9, 5]);
  assert.equal(first.items[0].id, 'mau-1');
  assert.equal(second.items[0].id, 'mau-10');
  assert.equal(third.items.at(-1).id, 'mau-23');
  assert.deepEqual([first.from, first.to, first.total, first.totalPages], [1, 9, 23, 3]);
});

test('Phân trang sau khi lọc style và tìm kiếm', () => {
  const filtered = filterTemplates(paginationTemplates, { style: 'Lãng mạn' });
  assert.equal(filtered.length, 12);
  const page2 = paginateTemplates(filtered, 2);
  assert.equal(page2.items.length, 3);
  assert.equal(page2.totalPages, 2);
  const none = paginateTemplates(filterTemplates(paginationTemplates, { search: 'khong-ton-tai' }), 1);
  assert.deepEqual([none.items.length, none.from, none.to, none.total], [0, 0, 0, 0]);
});

test('Trang vượt giới hạn được đưa về trang hợp lệ', () => {
  assert.equal(paginateTemplates(paginationTemplates, 999).page, 3);
  assert.equal(paginateTemplates(paginationTemplates, -9).page, 1);
  assert.equal(paginateTemplates(paginationTemplates, 'không hợp lệ').page, 1);
});

test('Có thể áp dụng phân trang cho danh sách yêu thích', () => {
  const favorites = paginationTemplates.filter((_, index) => index % 2 === 0);
  assert.equal(paginateTemplates(favorites, 1).items.length, 9);
  assert.equal(paginateTemplates(favorites, 2).items.length, 3);
});

const selected = () => ({
  search: 'sinh nhật', cardType: 'invitation', filter: 'Lãng mạn',
  occasion: 'Sinh nhật', palette: 'pink', freeOnly: true, photoOnly: true, catalogPage: 3,
});

test('Nhận biết đủ bảy điều kiện và bỏ qua giá trị mặc định', () => {
  assert.deepEqual(activeCatalogFilters(selected()), ['search', 'cardType', 'filter', 'occasion', 'palette', 'freeOnly', 'photoOnly']);
  assert.deepEqual(activeCatalogFilters({ search: '   ', filter: 'all', freeOnly: false }), []);
});

test('Xóa từng điều kiện độc lập và luôn quay lại trang đầu', () => {
  const resets = { search: '', cardType: 'all', filter: 'all', occasion: 'all', palette: 'all', freeOnly: false, photoOnly: false };
  for (const [key, value] of Object.entries(resets)) {
    const state = selected();
    const before = { ...state };
    assert.equal(clearCatalogFilter(state, key).value, value);
    assert.deepEqual(state, { ...before, [key]: value, catalogPage: 1 });
    assert(!activeCatalogFilters(state).includes(key));
  }
});

test('Không chấp nhận tên điều kiện tùy ý hoặc thay đổi trạng thái không liên quan', () => {
  const state = selected();
  const before = { ...state };
  for (const key of ['__proto__', 'constructor', 'catalogPage', 'user', 'price', undefined]) {
    assert.equal(clearCatalogFilter(state, key), null);
  }
  assert.deepEqual(state, before);
  assert.equal(clearCatalogFilter({ filter: 'all', catalogPage: 2 }, 'filter'), null);
});
