import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Quét chuỗi giao diện bằng lexer nhẹ; bỏ qua comment, không chạy mã nguồn.
// Các chuỗi thuộc dữ liệu thiệp được cho phép có giải thích tường minh.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const auditedFile = 'web/js/pages/designer.js';
export const persistedCanvasCopy = new Set([
  'Nội dung kỷ niệm', // Nhận diện trường văn bản của mẫu cũ.
  'Chú thích ảnh', // Nhận diện slot của mẫu cũ.
  'Cảnh ${value.document.scenes.length + 1}', // Tên cảnh được ghi vào bản nháp.
  '${copy.name.slice(0, 85)} (bản sao)', // Hậu tố tên cảnh nhân bản là dữ liệu người dùng.
  'Món quà của tôi', // Giá trị mặc định của tiêu đề được lưu.
  'Lời chúc của bạn', // Giá trị mặc định của trường text được lưu.
]);
const viChars = /[À-ỹđĐ]/u;

export function readUiLiterals(source) {
  const found = [];
  let index = 0;
  let line = 1;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '/' && next === '/') {
      index += 2;
      while (index < source.length && source[index] !== '\n') index++;
      continue;
    }
    if (char === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        if (source[index] === '\n') line++;
        index++;
      }
      index += 2;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      const delimiter = char;
      const startLine = line;
      let value = '';
      index++;
      while (index < source.length) {
        const current = source[index++];
        if (current === '\n') line++;
        if (current === '\\' && index < source.length) {
          const escaped = source[index++];
          value += escaped;
          if (escaped === '\n') line++;
          continue;
        }
        if (current === delimiter) break;
        value += current;
      }
      if (viChars.test(value)) found.push({ line: startLine, value });
      continue;
    }
    if (char === '\n') line++;
    index++;
  }
  return found;
}

export function checkDesignerCopy(source) {
  return readUiLiterals(source).filter(item => !persistedCanvasCopy.has(item.value));
}

function walkJs(folder, output = []) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) walkJs(full, output);
    else if (entry.isFile() && entry.name.endsWith('.js')) output.push(full);
  }
  return output;
}

const current = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (current) {
  const mode = process.argv[2] || '--check';
  if (!['--check', '--report'].includes(mode)) {
    console.error('Usage: node scripts/quality/check-ui-i18n.mjs [--check|--report]');
    process.exitCode = 2;
  } else if (mode === '--check') {
    const violations = checkDesignerCopy(fs.readFileSync(path.join(root, auditedFile), 'utf8'));
    for (const { line, value } of violations) console.error(`${auditedFile}:${line}: chuỗi UI chưa dịch: ${JSON.stringify(value.slice(0, 100))}`);
    if (violations.length) process.exitCode = 1;
    else console.log('PASS Designer UI: không có chuỗi tiếng Việt mới ngoài 6 giá trị Canvas được lưu/đối chiếu.');
  } else {
    // Phạm vi toàn giao diện chỉ là danh sách ứng viên cần phân loại thủ công.
    // Không tự dịch tên thiệp, dữ liệu mẫu, từ khóa nghiệp vụ hay nội dung người dùng.
    const folders = ['web/js/pages', 'web/js/features/canvas-editor'];
    let total = 0;
    for (const folder of folders) {
      for (const file of walkJs(path.join(root, folder))) {
        const relative = path.relative(root, file).replaceAll('\\', '/');
        const matches = relative === auditedFile
          ? checkDesignerCopy(fs.readFileSync(file, 'utf8'))
          : readUiLiterals(fs.readFileSync(file, 'utf8'));
        if (!matches.length) continue;
        total += matches.length;
        console.log(`${relative}: ${matches.length} ứng viên`);
        for (const { line, value } of matches.slice(0, 3)) console.log(`  ${line}: ${JSON.stringify(value.slice(0, 90))}`);
      }
    }
    console.log(`Tổng ${total} ứng viên cần rà thủ công; không đồng nghĩa ${total} lỗi dịch.`);
  }
}
