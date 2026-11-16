const localOnlyDocuments = new Set([
  'docs/UPDATE_V04.md',
  'docs/UPDATE_V05.md',
  'docs/archive/CODE_REVIEW_ARCHITECTURE_2026-11-16_initial.md',
]);

const generatedDirectories = new Set([
  'data', 'node_modules', 'local', 'playwright-report', 'test-results',
  'blob-report', 'coverage', '.nyc_output',
]);

// Chính sách source/release độc lập với .gitignore. QR vendor đã build vẫn
// được đóng gói vì cần khi chạy; snapshot, báo cáo và tài liệu cũ thì không.
export function isExcludedSourcePath(relative) {
  const normalized = relative.replaceAll('\\', '/');
  if (localOnlyDocuments.has(normalized)) return true;
  return normalized.split('/').some(part => generatedDirectories.has(part)
    || part === '.env' || (part.startsWith('.env.') && part !== '.env.example')
    || part === '.eslintcache' || /^(thumbs\.db|desktop\.ini)$/i.test(part)
    || /\.(log|tmp)$/.test(part));
}
