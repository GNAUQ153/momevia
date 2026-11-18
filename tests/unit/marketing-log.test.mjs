import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Kiểm tra script cập nhật log idempotent, không cần thay file source đang làm việc.
test('Script ghi mục Unreleased một lần và không thay nội dung cũ', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'momevia-log-'));
  try {
    fs.mkdirSync(path.join(tmp, 'scripts', 'docs'), { recursive: true });
    fs.copyFileSync(new URL('../../scripts/docs/log-ui.mjs', import.meta.url), path.join(tmp, 'scripts', 'docs', 'log-ui.mjs'));
    fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
    const old = '## Unreleased — Old Release\r\n\r\n- Chức năng đang có.\r\n';
    fs.writeFileSync(path.join(tmp, 'CHANGELOG.md'), old);
    const command = path.join(tmp, 'scripts', 'docs', 'log-ui.mjs');
    const first = spawnSync(process.execPath, [command], { encoding: 'utf8' });
    assert.equal(first.status, 0, first.stderr);
    const once = fs.readFileSync(path.join(tmp, 'CHANGELOG.md'), 'utf8');
    assert.match(once, /Marketing UI & Payment Status/);
    assert(once.endsWith(old));
    const second = spawnSync(process.execPath, [command], { encoding: 'utf8' });
    assert.equal(second.status, 0, second.stderr);
    assert.equal(fs.readFileSync(path.join(tmp, 'CHANGELOG.md'), 'utf8'), once);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
