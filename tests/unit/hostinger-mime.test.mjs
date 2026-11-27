import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Hostinger mặc định trả .mjs là text/plain; .htaccess đặt nosniff nên trình duyệt
// từ chối chạy module. Thiếu dòng này thì Fabric Studio và đọc Excel người nhận đều hỏng.
test('Hostinger phục vụ .mjs đúng kiểu JavaScript khi bật nosniff', () => {
  const htaccess = fs.readFileSync(new URL('../../deploy/hostinger/.htaccess', import.meta.url), 'utf8');
  assert.match(htaccess, /^\s*AddType\s+text\/javascript\s+\.mjs\s*$/m);
  assert.match(htaccess, /X-Content-Type-Options "nosniff"/);
});
