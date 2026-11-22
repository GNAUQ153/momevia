import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Các stylesheet đã được chuẩn hóa, mở rộng danh sách sau từng đợt rà soát.
export const monitoredStylesheets = Object.freeze([
  'admin-library.css',
  'template-library.css',
  'editor-conflict-review.css',
  'editor-recovery-center.css',
  'gift-runtime.css',
  'editor.css',
  'upgrade.css',
]);

/**
 * Bộ phân tích cú pháp nhẹ, không thay thế parser CSS của trình duyệt.
 * Kiểm tra mã viết dồn dòng và khai báo lặp trong cùng rule; cho phép selector
 * lặp qua nhiều media query vì cascade có thể là chủ ý thiết kế.
 */
export function auditCssStyle(source, filename = 'stylesheet.css') {
  const errors = [];
  const stack = [];
  const lineSemicolons = new Map();
  const lineOpenBraces = new Set();
  let buffer = '';
  let line = 1;
  let parens = 0;
  let brackets = 0;
  let quote = '';
  let comment = false;
  let declarationCount = 0;

  const pushError = (lineNumber, message) => errors.push(`${filename}:${lineNumber}: ${message}`);
  function readDeclaration() {
    const block = stack.at(-1);
    const value = buffer.trim();
    buffer = '';
    if (!value || block?.kind !== 'rule') return;
    const match = /^([\w-]+)\s*:/.exec(value);
    if (!match) {
      pushError(line, `khai báo CSS không hợp lệ: ${value.slice(0, 48)}`);
      return;
    }
    const name = match[1].toLowerCase();
    if (block.properties.has(name)) pushError(line, `thuộc tính ${name} trùng trong cùng rule`);
    block.properties.add(name);
    declarationCount++;
  }

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (comment) {
      if (ch === '*' && next === '/') { comment = false; i++; }
      else if (ch === '\n') line++;
      continue;
    }
    if (quote) {
      buffer += ch;
      if (ch === '\\' && i + 1 < source.length) buffer += source[++i];
      else if (ch === quote) quote = '';
      if (ch === '\n') line++;
      continue;
    }
    if (ch === '/' && next === '*') { comment = true; i++; continue; }
    if (ch === '"' || ch === "'") { quote = ch; buffer += ch; continue; }
    if (ch === '(') { parens++; buffer += ch; continue; }
    if (ch === ')') { parens--; buffer += ch; continue; }
    if (ch === '[') { brackets++; buffer += ch; continue; }
    if (ch === ']') { brackets--; buffer += ch; continue; }
    if (!parens && !brackets && ch === '{') {
      const selector = buffer.trim();
      if (!selector) pushError(line, 'thiếu selector hoặc at-rule');
      stack.push({ kind: selector.startsWith('@') ? 'group' : 'rule', properties: new Set() });
      lineOpenBraces.add(line);
      buffer = '';
      continue;
    }
    if (!parens && !brackets && ch === ';') {
      if (stack.at(-1)?.kind === 'rule') {
        lineSemicolons.set(line, (lineSemicolons.get(line) || 0) + 1);
        readDeclaration();
      } else buffer = '';
      continue;
    }
    if (!parens && !brackets && ch === '}') {
      if (!stack.length) pushError(line, 'dấu đóng ngoặc CSS không khớp');
      else {
        if (buffer.trim() && stack.at(-1).kind === 'rule') pushError(line, 'thiếu dấu chấm phẩy cuối khai báo');
        stack.pop();
      }
      buffer = '';
      continue;
    }
    if (ch === '\n') line++;
    buffer += ch;
  }
  if (stack.length || quote || comment || parens || brackets) pushError(line, 'CSS chưa đóng đầy đủ dấu ngoặc, chuỗi hoặc comment');
  for (const [lineNumber, count] of lineSemicolons) {
    if (count > 1) pushError(lineNumber, `${count} khai báo CSS trên một dòng`);
    if (lineOpenBraces.has(lineNumber)) pushError(lineNumber, 'selector và khai báo CSS viết chung một dòng');
  }
  return { errors, declarationCount, ruleCount: [...source.matchAll(/\{/g)].length };
}

export function auditMonitoredCss(root) {
  const results = [];
  for (const name of monitoredStylesheets) {
    const location = join(root, 'web', 'css', name);
    const source = readFileSync(location, 'utf8');
    results.push({ file: name, ...auditCssStyle(source, name) });
  }
  return results;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const project = join(fileURLToPath(new URL('../../', import.meta.url)));
  const results = auditMonitoredCss(project);
  for (const entry of results) for (const error of entry.errors) console.error(error);
  const count = results.reduce((sum, item) => sum + item.declarationCount, 0);
  const failures = results.reduce((sum, item) => sum + item.errors.length, 0);
  if (failures) process.exitCode = 1;
  else console.log(`PASS CSS style: ${results.length} files, ${count} declarations; no compact rules or duplicate properties.`);
}
