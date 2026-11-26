import { loadConfig, runBackendLoad } from './backend-load.mjs';

try {
  const report = await runBackendLoad(loadConfig(process.env));
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
} catch {
  // Không xuất exception chứa URL, header hoặc cấu hình nhạy cảm.
  console.error('Không thể chạy benchmark. Kiểm tra xác nhận Local/QA, cổng và giới hạn trong docs/PHASE03_LOAD_TEST.md.');
  process.exitCode = 1;
}
