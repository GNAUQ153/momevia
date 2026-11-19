const localOnlyDocuments = new Set([
  'docs/UPDATE_V04.md',
  'docs/UPDATE_V05.md',
  'docs/archive/CODE_REVIEW_ARCHITECTURE_2026-11-16_initial.md',
]);

const generatedDirectories = new Set([
  'data', 'node_modules', 'local', 'playwright-report', 'test-results',
  'blob-report', 'coverage', '.nyc_output',
  '.git', '.svn', '.hg', '__pycache__', '.venv', 'venv',
]);

// Không đưa khóa riêng, thông tin xác thực và bản sao dữ liệu vận hành vào release.
// Kiểm tra tên/path; không dò nội dung người dùng hoặc tự sửa tệp bí mật.
const privateFiles = /^(?:\.npmrc|\.netrc|\.pypirc|\.aws|credentials(?:\.[^.]+)?\.json|service[-_]account(?:\.[^.]+)?\.json|id_(?:rsa|ed25519|ecdsa)(?:\.pub)?|authorized_keys|known_hosts)$/i;
const privateExtensions = /\.(?:pem|p12|pfx|key|kdbx|sqlite|sqlite3|db|bak|backup|dump)$/i;
const backupSuffix = /(?:\.(?:sql|json|jsonl|ndjson|csv))\.(?:gz|zip|bak|backup)$/i;

// Chính sách source/release độc lập với .gitignore. QR vendor đã build vẫn
// được đóng gói vì cần khi chạy; snapshot, báo cáo và tài liệu cũ thì không.
export function isExcludedSourcePath(relative) {
  const normalized = relative.replaceAll('\\', '/');
  if (localOnlyDocuments.has(normalized)) return true;
  return normalized.split('/').some(part => {
    const lower = part.toLowerCase();
    return generatedDirectories.has(lower)
      || lower === '.env' || (lower.startsWith('.env.') && lower !== '.env.example')
      || lower === '.eslintcache' || /^(thumbs\.db|desktop\.ini)$/i.test(lower)
      || /\.(?:log|tmp)$/.test(lower)
      || privateFiles.test(lower) || privateExtensions.test(lower) || backupSuffix.test(lower);
  });
}
