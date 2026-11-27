import fs from 'node:fs';
import path from 'node:path';
import { builtinLibraryItems } from '../../src/modules/designs/library.seed.mjs';
import { ORIGINAL_IDS } from '../../web/js/shared/canvas/originals-data.js';

// Chỉ tạo tệp đề xuất; không đọc cấu hình, kết nối MySQL hay sửa dữ liệu đang chạy.
// expectedRevision=1 dành cho mẫu hệ thống chưa được Admin chỉnh sửa.
const directory = path.resolve('dist/originals-update');
fs.mkdirSync(directory, { recursive: true });
const rows = builtinLibraryItems().filter(row => row.kind === 'template' && ORIGINAL_IDS.includes(row.id));
if (rows.length !== 16) throw new Error('Bộ cập nhật phải có đúng 16 mẫu.');
for (const row of rows) {
  fs.writeFileSync(path.join(directory, row.id + '.json'), JSON.stringify({
    kind: row.kind,
    id: row.id,
    expectedRevision: 1,
    definition: row.definition,
  }, null, 2) + '\n', 'utf8');
}
console.log('Đã tạo 16 đề xuất trong dist/originals-update; chưa áp dụng vào cơ sở dữ liệu.');
