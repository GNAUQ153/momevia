import test from 'node:test';
import assert from 'node:assert/strict';
import { isExcludedSourcePath } from '../../scripts/release/policy.mjs';

test('Không đóng gói secret, bản sao dữ liệu và thông tin đăng nhập', () => {
  const unsafe = [
    'services/identity/data/users.json',
    'services/payments/.env.production',
    'web/.env.local',
    'web/cert/server.pem',
    'web/cert/server.key',
    'docs/credentials.json',
    'docs/service-account.prod.json',
    'ops/.aws/credentials',
    '.git/config',
    'database/export.sqlite3',
    'database/backup.sql.gz',
    'web/.npmrc',
    'tests/fixtures/id_ed25519',
    'tests/local/snapshot.json',
  ];
  for (const name of unsafe) assert.equal(isExcludedSourcePath(name), true, name);
});

test('Không chặn mã nguồn hợp lệ, migration, license và .env.example', () => {
  const valid = [
    '.env.example',
    'src/modules/identity/index.mjs',
    'database/migrations/005_payment_receipts.sql',
    'docs/licenses/MIT.txt',
    'web/js/vendor/qrcode.js',
    'web/assets/basic-templates/love-letter.svg',
    'scripts/release/verify.mjs',
  ];
  for (const name of valid) assert.equal(isExcludedSourcePath(name), false, name);
});
