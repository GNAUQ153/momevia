import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {isExcludedSourcePath} from '../../scripts/release/policy.mjs';

test('release excludes generated QA artifacts while retaining product media and regression fixtures',()=>{
  for(const file of ['web/assets/template-natural-qa/index.html','web/assets/template-refresh-qa/result.json','docs/animated-elements-50/static/heart.png','docs/motion-56-20261125/review.html','docs/template-refresh-natural-20261123/gallery.png','docs/event-cards/index.html','docs/interactive-cards-20261122/result.json','docs/evidence/video.webm','scripts/qa/local-session.mjs'])assert(isExcludedSourcePath(file),file);
  for(const file of ['web/assets/event-cards/natural-v4/heart.webp','tests/fixtures/motion-legacy-elements.json','tests/browser/motion-stack.mjs','docs/MOTION_REPAIR_56.md'])assert.equal(isExcludedSourcePath(file),false,file);
});

test('Gói nguồn loại secret/data/dependency và phát hiện file bị sửa hoặc chèn thêm', () => {
  const tempRoot = fs.realpathSync(os.tmpdir());
  const fixture = fs.mkdtempSync(path.join(tempRoot, 'momevia-package-'));
  const write = (relative, text = 'fixture') => {
    const filename = path.join(fixture, relative);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, text);
  };
  try {
    for (const dir of ['src', 'services', 'web', 'scripts', 'tests', 'docs', '.github']) fs.mkdirSync(path.join(fixture, dir));
    for (const file of ['gateway.mjs', 'dev.mjs', 'start-local.bat', 'package-lock.json', 'README.md', 'CHANGELOG.md', '.env.example', '.gitignore', 'eslint.config.mjs']) write(file);
    write('package.json', JSON.stringify({ version: 'test' }));
    write('web/js/vendor/qrcode.js');
    write('deploy/https/Caddyfile', '{$MOMEVIA_DOMAIN} { reverse_proxy 127.0.0.1:4100 }');
    write('deploy/https/momevia.service', '[Service]\nExecStart=/usr/bin/node /opt/momevia/dev.mjs');
    // The release allowlist also includes MySQL schema and tooling.
    write('database/compose.yml', 'services: {}\n');
    write('database/verify.sql', 'SELECT 1;\n');
    const migrationBaseline = 'database/migration-baseline.json';
    const baselineContents = '{"formatVersion":1,"migrations":[]}\n';
    write(migrationBaseline, baselineContents);
    write('database/private-export.json', 'PRIVATE_SENTINEL');
    // Chỉ đóng gói bundle update được duyệt; không gom cả thư mục updates.
    write('database/updates/interactive-cards-20261122-v1.json', '{"formatVersion":1,"changes":[]}\n');
    // Dữ liệu mẫu phục vụ kiểm thử các bundle thư viện mới.
    write('database/updates/template-refresh-natural-20261123-v2.json', '{"formatVersion":1,"changes":[]}\n');
    write('database/updates/natural-motion-loop-20261123-v1.json', '{"formatVersion":1,"changes":[]}\n');
    write('database/updates/natural-open-elements-20261123-v1.json', '{"formatVersion":1,"changes":[]}\n');
    write('database/updates/private-export.json', 'PRIVATE_SENTINEL');
    write('database/migrations/001_initial.sql', '-- schema fixture\n');
    write('database/migrations/003_identity_catalog.sql', '-- v0.9 fixture\n');
    write('database/migrations/004_gifts_checkout.sql', '-- v1.0 fixture\n');
    write('database/migrations/005_payment_receipts.sql', '-- v1.1 fixture\n');
    write('database/scripts/import-gifts-checkout.mjs', '// v1.0 import fixture\n');
    write('database/scripts/import-identity-catalog.mjs', '// v0.9 import fixture\n');
    write('database/scripts/prepare-import.mjs', '// import fixture\n');
    const excludedFiles = ['.env', '.env.production', 'services/identity/data/users.json', 'services/identity/.env',
      'web/debug.log', 'web/cache.tmp', 'node_modules/example/index.js',
      'docs/UPDATE_V04.md', 'docs/UPDATE_V05.md', 'docs/archive/CODE_REVIEW_ARCHITECTURE_2026-11-16_initial.md',
      'docs/local/notes.md', 'docs/coverage/index.html', 'web/test-results/results.json',
      'docs/Thumbs.db', 'docs/.eslintcache',
      'web/.npmrc', 'services/secrets/server.pem', 'services/secrets/server.key',
      'deploy/https/privkey.pem', 'deploy/https/server.key',
      'docs/credentials.json', 'docs/service-account.prod.json', 'database/backup.sql.gz',
      'web/.git/config'];
    for (const file of excludedFiles) write(file, 'PRIVATE_SENTINEL');
    write('docs/ARCHITECTURE.md', 'shared architecture');
    write('docs/licenses/example-MIT.txt', 'shared license');
    const pack = fileURLToPath(new URL('../../scripts/release/package.mjs', import.meta.url));
    fs.mkdirSync(path.join(fixture, 'scripts/release'), { recursive: true });
    fs.copyFileSync(pack, path.join(fixture, 'scripts/release/package.mjs'));
    fs.copyFileSync(fileURLToPath(new URL('../../scripts/release/policy.mjs', import.meta.url)), path.join(fixture, 'scripts/release/policy.mjs'));
    const result = spawnSync(process.execPath, ['scripts/release/package.mjs'], { cwd: fixture, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const release = path.join(fixture, 'dist/release');
    const manifest = JSON.parse(fs.readFileSync(path.join(release, 'release-manifest.json'), 'utf8'));
    assert(manifest.files.some(entry => entry.path === '.env.example'));
    assert(!JSON.stringify(manifest).includes('users.json'));
    for (const file of excludedFiles) assert(!fs.existsSync(path.join(release, file)), file);
    assert(fs.existsSync(path.join(release, 'docs/ARCHITECTURE.md')));
    assert(fs.existsSync(path.join(release, 'docs/licenses/example-MIT.txt')));
    assert(fs.existsSync(path.join(release, 'web/js/vendor/qrcode.js')));
    assert(fs.existsSync(path.join(release, 'deploy/https/Caddyfile')));
    assert(fs.existsSync(path.join(release, 'deploy/https/momevia.service')));
    assert(fs.existsSync(path.join(release, 'database/compose.yml')));
    // Baseline là dữ liệu schema bắt buộc, không phải dữ liệu vận hành.
    assert.equal(fs.readFileSync(path.join(release, migrationBaseline), 'utf8'), baselineContents);
    assert.deepEqual(manifest.files.find(entry => entry.path === migrationBaseline), {
      path: migrationBaseline, sha256: createHash('sha256').update(baselineContents).digest('hex'),
    });
    assert(!fs.existsSync(path.join(release, 'database/private-export.json')));
    assert(!manifest.files.some(entry => entry.path === 'database/private-export.json'));
    const updateBundle = 'database/updates/interactive-cards-20261122-v1.json';
    assert(fs.existsSync(path.join(release, updateBundle)), 'Thiếu bundle rollout trong gói phát hành');
    assert(manifest.files.some(entry => entry.path === updateBundle), 'Bundle rollout không có trong manifest');
    assert.equal(fs.readFileSync(path.join(release, updateBundle), 'utf8'), '{"formatVersion":1,"changes":[]}\n');
    assert(!fs.existsSync(path.join(release, 'database/updates/private-export.json')), 'Không đóng gói file update ngoài allowlist');
    assert(fs.existsSync(path.join(release, 'database/migrations/001_initial.sql')));
    assert(fs.existsSync(path.join(release, 'database/migrations/003_identity_catalog.sql')));
    assert(fs.existsSync(path.join(release, 'database/migrations/004_gifts_checkout.sql')));
    assert(fs.existsSync(path.join(release, 'database/migrations/005_payment_receipts.sql')));
    assert(fs.existsSync(path.join(release, 'database/scripts/import-gifts-checkout.mjs')));
    assert(fs.existsSync(path.join(release, 'database/scripts/import-identity-catalog.mjs')));
    assert(fs.existsSync(path.join(release, 'database/scripts/prepare-import.mjs')));
    const verify = fileURLToPath(new URL('../../scripts/release/verify.mjs', import.meta.url));
    const run = () => spawnSync(process.execPath, [verify, release], { cwd: fixture, encoding: 'utf8' });
    assert.equal(run().status, 0);
    fs.writeFileSync(path.join(release, '.env'), 'PRIVATE_SENTINEL');
    assert.notEqual(run().status, 0);
    fs.unlinkSync(path.join(release, '.env'));
    // Không được bỏ qua tệp ẩn trong thư mục node_modules của release.
    const hidden = path.join(release, 'node_modules/hidden.js');
    fs.mkdirSync(path.dirname(hidden), { recursive: true });
    fs.writeFileSync(hidden, 'PRIVATE_SENTINEL');
    assert.notEqual(run().status, 0);
    fs.rmSync(path.join(release, 'node_modules'), { recursive: true, force: true });
    // Cả thư mục dữ liệu rỗng cũng bị từ chối vì không nằm trong release allowlist.
    const privateDirectory = path.join(release, 'services/identity/data');
    fs.mkdirSync(privateDirectory, { recursive: true });
    assert.notEqual(run().status, 0);
    fs.rmSync(privateDirectory, { recursive: true, force: true });
    // Kể cả manifest được thêm checksum đúng, tài liệu cũ vẫn bị cấm.
    const oldDoc = 'docs/UPDATE_V04.md';
    fs.writeFileSync(path.join(release, oldDoc), 'legacy notes');
    fs.writeFileSync(path.join(release, 'release-manifest.json'), JSON.stringify({
      ...manifest, files: [...manifest.files, { path: oldDoc, sha256: createHash('sha256').update('legacy notes').digest('hex') }],
    }));
    assert.notEqual(run().status, 0);
    fs.unlinkSync(path.join(release, oldDoc));
    fs.writeFileSync(path.join(release, 'release-manifest.json'), JSON.stringify(manifest));
    fs.appendFileSync(path.join(release, 'gateway.mjs'), 'tampered');
    assert.notEqual(run().status, 0);
  } finally {
    if (path.dirname(path.resolve(fixture)) !== tempRoot) throw new Error('Unsafe fixture path');
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
