#!/usr/bin/env node
// So sánh hai báo cáo local v2, không kết nối mạng và không thay đổi code ứng dụng.
import fs from 'node:fs';
import { compareMarketingSummaries } from './marketing-metrics.mjs';

const paths = process.argv.slice(2);
if (paths.length !== 2) {
  console.error('Cách dùng: node scripts/quality/compare-marketing.mjs <before.json> <after.json>');
  process.exit(2);
}
function readReport(filename) {
  const report = JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (report?.kind !== 'local-lab' || report.schemaVersion !== 2 || !Array.isArray(report.summaries)) {
    throw new Error(`Báo cáo ${filename} chưa phải định dạng local-lab v2.`);
  }
  return report;
}

const [before, after] = paths.map(readReport);
const changes = compareMarketingSummaries(before.summaries, after.summaries);
if (!changes.length) {
  console.error('Hai báo cáo không có cặp VI/EN + viewport + kích thước trùng nhau.');
  process.exitCode = 1;
}
for (const group of changes) {
  const metrics = ['lcpMs', 'fcpMs', 'cls', 'overflowPx'].map(key => {
    const item = group.changes[key];
    if (!item) return `${key}=N/A`;
    const percent = item.percent === null ? 'N/A' : `${item.percent > 0 ? '+' : ''}${item.percent}%`;
    return `${key} ${item.before} → ${item.after} (${percent})`;
  });
  console.log(`${group.locale} ${group.viewport}: ${metrics.join(' | ')}`);
}
console.log('Chú ý: delta của lab là số liệu tham khảo, không chứng minh thay đổi Core Web Vitals thực tế.');
