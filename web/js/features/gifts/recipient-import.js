import { RECIPIENT_LIMIT, validRecipientName } from '../../shared/recipient-naming.js';

export function parseRecipientCsv(input) {
  const rows = []; let cells = [], cell = '', quoted = false, ended = false, line = 1, start = 1;
  const source = input.replace(/^\ufeff/, '');
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; ended = true; }
      else { cell += c; if (c === '\n') line++; }
    } else if (c === '"' && !cell && !ended) quoted = true;
    else if (c === ',') { cells.push(cell); cell = ''; ended = false; }
    else if (c === '\n' || c === '\r') {
      cells.push(cell); rows.push({ row: start, cells }); cells = []; cell = ''; ended = false;
      if (c === '\r' && source[i + 1] === '\n') i++;
      line++; start = line;
    } else if (ended || c === '"') throw new Error('recipient.error.csv');
    else cell += c;
    if (rows.length > RECIPIENT_LIMIT + 1) throw new Error('recipient.error.rows');
  }
  if (quoted) throw new Error('recipient.error.csv');
  if (cell || cells.length || ended) rows.push({ row: start, cells: [...cells, cell] });
  return rows;
}
export function recipientRowsPreview(rows) {
  const column = rows[0]?.cells.findIndex(cell => typeof cell === 'string' && cell.trim() === 'Tên người nhận');
  if (column === undefined || column < 0 || rows[0].cells.filter(c => c === 'Tên người nhận').length !== 1) throw new Error('recipient.error.header');
  if (rows.length < 2 || rows.length > RECIPIENT_LIMIT + 1) throw new Error('recipient.error.rows');
  const names = [], errors = [];
  for (const item of rows.slice(1)) {
    const name = item.cells[column];
    if (!validRecipientName(name)) errors.push({ row: item.row, key: 'recipient.error.name' });
    else names.push({ row: item.row, name: name.trim().normalize('NFC') });
  }
  return { names, errors };
}
export async function readRecipientFile(file) {
  if (!file || file.size > 1024 * 1024 || !/\.(xlsx|csv)$/i.test(file.name)) throw new Error('recipient.error.file');
  const bytes = await file.arrayBuffer();
  if (/\.csv$/i.test(file.name)) {
    let source;
    try { source = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new Error('recipient.error.utf8'); }
    return recipientRowsPreview(parseRecipientCsv(source));
  }
  // Check central directory before decompression to bound ZIP expansion.
  const data = new DataView(bytes); let total = 0, entries = 0;
  for (let i = 0; i + 46 <= data.byteLength; i++) {
    if (data.getUint32(i, true) !== 0x02014b50) continue;
    entries++; total += data.getUint32(i + 24, true);
    if (total > 8 * 1024 * 1024 || entries > 200) throw new Error('recipient.error.file');
    i += 45 + data.getUint16(i + 28, true) + data.getUint16(i + 30, true) + data.getUint16(i + 32, true);
  }
  if (!entries) throw new Error('recipient.error.file');
  const { default: readExcel } = await import('../../vendor/recipient-xlsx.mjs');
  const rows = await readExcel(bytes, { trim: false });
  return recipientRowsPreview(rows.map((cells, index) => ({ row: index + 1, cells })));
}
