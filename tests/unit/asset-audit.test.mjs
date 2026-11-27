import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { summarizeAssets, auditFontManifest, runAssetAudit } from '../../scripts/quality/audit-assets.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const entry = (file, value) => ({ file: `web/assets/${file}`, bytes: Buffer.byteLength(value), sha256: hash(value) });

test('Audit thống kê bản sao theo nội dung thay vì tên hoặc kích thước', () => {
  const report = summarizeAssets([entry('music/a.mp3', 'abc'), entry('sfx/b.mp3', 'abc'), entry('sfx/c.mp3', 'xyz')]);
  assert.equal(report.files, 3);
  assert.equal(report.bytes, 9);
  assert.equal(report.duplicateGroups, 1);
  assert.equal(report.repeatedBytes, 3);
  assert.deepEqual(report.duplicates[0].files, ['web/assets/music/a.mp3', 'web/assets/sfx/b.mp3']);
});

test('Font audit phát hiện file thiếu, sai checksum và font ngoài manifest', () => {
  const fonts = [{ file: 'a.woff2', bytes: 3, sha256: hash('abc') }, { file: 'b.woff2', bytes: 3, sha256: hash('abc') }];
  const report = auditFontManifest({ fonts }, [entry('fonts/app/a.woff2', 'xyz'), entry('fonts/app/c.woff2', 'abc')]);
  assert.deepEqual(report.issues.map(item => item.reason), ['manifest-mismatch', 'missing', 'not-in-manifest']);
  assert.throws(() => auditFontManifest({ fonts: [{ file: '../outside.woff2' }] }, []), /Invalid/);
  assert.throws(() => auditFontManifest({ fonts: [fonts[0], fonts[0]] }, []), /duplicate/);
});

test('Audit chỉ đọc tài nguyên nguồn, không đọc build output và tệp riêng tư', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'momevia-assets-'));
  try {
    for (const dir of ['fonts/app', 'app', 'music']) fs.mkdirSync(path.join(root, 'web/assets', dir), { recursive: true });
    const write = (name, value) => fs.writeFileSync(path.join(root, 'web/assets', name), value);
    write('fonts/app/a.woff2', 'abc');
    write('fonts/app/manifest.json', JSON.stringify({ fonts: [{ file: 'a.woff2', bytes: 3, sha256: hash('abc') }] }));
    write('music/a.mp3', 'abc');
    write('app/bundle.js', 'ignored');
    write('music/.env', 'ignored');
    const report = runAssetAudit(root);
    assert.equal(report.files, 3);
    assert.equal(report.repeatedBytes, 3);
    assert.deepEqual(report.fontManifest, { checked: 1, issues: [] });
    assert.equal(fs.readFileSync(path.join(root, 'web/assets/music/a.mp3'), 'utf8'), 'abc');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
