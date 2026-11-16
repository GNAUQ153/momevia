import test from 'node:test';
import assert from 'node:assert/strict';
import { filterTemplates, styleOptions, countLabel } from '../web/js/catalog-filter.js';

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
