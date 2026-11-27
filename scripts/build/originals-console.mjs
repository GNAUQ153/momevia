// Tạo script dán vào Console trình duyệt (đăng nhập Admin) để cập nhật 16 mẫu Originals
// trên thư viện MySQL production qua API Admin có sẵn (CAS revision + lịch sử).
// Chạy: node scripts/build/originals-update.mjs && node scripts/build/originals-console.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ORIGINAL_IDS } from '../../web/js/shared/canvas/originals-data.js';

const directory = path.resolve('dist/originals-update');
const proposals = ORIGINAL_IDS.map(id => {
  const row = JSON.parse(fs.readFileSync(path.join(directory, id + '.json'), 'utf8'));
  return { id: row.id, definition: row.definition };
});

// Phần chạy trong trình duyệt: chỉ dùng fetch cùng tên miền với phiên Admin hiện tại.
const runner = async PROPOSALS => {
  const canon = value => value === null || typeof value !== 'object' ? JSON.stringify(value)
    : Array.isArray(value) ? '[' + value.map(canon).join(',') + ']'
      : '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canon(value[k])).join(',') + '}';
  const api = async (url, options = {}) => {
    const response = await fetch('/api' + url, { credentials: 'same-origin', ...options, headers: { 'content-type': 'application/json' } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body?.error?.message || body?.message || 'HTTP ' + response.status), { status: response.status });
    return body;
  };
  const download = (name, text) => {
    const link = globalThis.document.createElement('a');
    link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    link.download = name;
    link.click();
  };
  const { library } = await api('/designs/admin/library');
  const current = new Map(library.items.filter(row => row.kind === 'template').map(row => [row.id, row]));
  const backup = PROPOSALS.map(p => current.get(p.id)).filter(Boolean);
  download('momevia-originals-sao-luu-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json', JSON.stringify(backup, null, 2));
  const results = [];
  for (const proposal of PROPOSALS) {
    const row = current.get(proposal.id);
    if (!row) { results.push({ mau: proposal.id, ketQua: 'BỎ QUA: chưa có trong DB' }); continue; }
    if (canon(row.definition) === canon(proposal.definition)) { results.push({ mau: proposal.id, ketQua: 'Đã là bản mới' }); continue; }
    if (row.revision !== 1) { results.push({ mau: proposal.id, ketQua: 'BỎ QUA: Admin đã chỉnh (revision ' + row.revision + ')' }); continue; }
    try {
      await api('/designs/admin/library/template/' + encodeURIComponent(proposal.id), {
        method: 'POST',
        body: JSON.stringify({ expectedRevision: row.revision, status: row.status, sortOrder: row.sortOrder, definition: proposal.definition }),
      });
      results.push({ mau: proposal.id, ketQua: 'ĐÃ CẬP NHẬT (revision 1 → 2)' });
    } catch (error) {
      results.push({ mau: proposal.id, ketQua: 'LỖI: ' + error.message });
    }
  }
  console.table(results);
  return results;
};

const script = '// Momevia - cập nhật 16 mẫu Originals. Dán vào Console khi đang đăng nhập Admin trên momevia.io.vn.\n' +
  '(' + runner.toString() + ')(' + JSON.stringify(proposals) + ');\n';
const output = path.join(directory, 'cap-nhat-16-mau.js');
fs.writeFileSync(output, script, 'utf8');
console.log('Đã tạo ' + output + ' (' + Math.round(script.length / 1024) + ' KB).');
