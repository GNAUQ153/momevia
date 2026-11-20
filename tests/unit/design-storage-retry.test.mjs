import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JsonDesignRepository } from '../../src/modules/designs/json.repository.mjs';

function fixture(t, fault = () => {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'momevia-canvas-retry-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const filename = path.join(dir, 'canvas.json');
  return { dir, filename, repo: new JsonDesignRepository(filename, { fault }) };
}

function ioError(code) {
  return Object.assign(new Error(`Mô phỏng lỗi hệ thống ${code}`), { code });
}

test('Canvas: EPERM tạm thời được thử lại và commit đúng một lần', t => {
  let commits = 0;
  const { repo, dir } = fixture(t, phase => { if (phase === 'afterCommit') commits += 1; });
  const initialCommits = commits;
  const originalRename = fs.renameSync;
  let attempts = 0;
  t.mock.method(fs, 'renameSync', (source, target) => {
    attempts += 1;
    if (attempts < 3) throw ioError('EPERM');
    return originalRename(source, target);
  });
  const next = repo.read();
  next.contexts['test-key'] = { value: 'Đã lưu' };
  repo.write(next);
  assert.equal(attempts, 3);
  assert.equal(commits, initialCommits + 1);
  assert.equal(repo.read().contexts['test-key'].value, 'Đã lưu');
  assert.deepEqual(fs.readdirSync(dir), ['canvas.json']);
});

test('Canvas: EACCES kéo dài giữ nguyên dữ liệu chính và để lại bản tạm phục hồi', t => {
  let commits = 0;
  const { repo, filename, dir } = fixture(t, phase => { if (phase === 'afterCommit') commits += 1; });
  const originalBytes = fs.readFileSync(filename);
  const initialCommits = commits;
  let attempts = 0;
  t.mock.method(fs, 'renameSync', () => {
    attempts += 1;
    throw ioError('EACCES');
  });
  const next = repo.read();
  next.contexts['test-key'] = { value: 'Chưa commit' };
  assert.throws(() => repo.write(next), { code: 'EACCES' });
  assert.equal(attempts, 5);
  assert.equal(commits, initialCommits);
  assert.deepEqual(fs.readFileSync(filename), originalBytes);
  const files = fs.readdirSync(dir);
  assert.equal(files.filter(name => name.endsWith('.tmp')).length, 1);
  assert.deepEqual(repo.read().contexts, {});
});

test('Canvas: ENOSPC không retry và không cập nhật dữ liệu chính', t => {
  const { repo, filename } = fixture(t);
  const originalBytes = fs.readFileSync(filename);
  let attempts = 0;
  t.mock.method(fs, 'renameSync', () => {
    attempts += 1;
    throw ioError('ENOSPC');
  });
  assert.throws(() => repo.write(repo.read()), { code: 'ENOSPC' });
  assert.equal(attempts, 1);
  assert.deepEqual(fs.readFileSync(filename), originalBytes);
});
