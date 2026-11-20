import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JsonRepository } from '../../src/shared/storage.mjs';

function inTemporaryDirectory(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'momevia-storage-'));
  try {
    run(path.join(dir, 'test.json'), dir);
  } finally {
    mock.restoreAll();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function fileError(code) {
  return Object.assign(new Error(`Giả lập lỗi tệp ${code}`), { code });
}

test('Repository: thử lại EPERM rồi cập nhật JSON thành công', () => {
  inTemporaryDirectory((file) => {
    const repository = new JsonRepository(file);
    const renameOriginal = fs.renameSync;
    let attempts = 0;
    mock.method(fs, 'renameSync', (source, destination) => {
      attempts += 1;
      if (attempts < 3) throw fileError('EPERM');
      return renameOriginal(source, destination);
    });

    repository.insert({ id: 'a', name: 'Đã lưu' });
    assert.equal(attempts, 3);
    assert.equal(repository.get('a').name, 'Đã lưu');
  });
});

test('Repository: lỗi quyền truy cập kéo dài không làm mất dữ liệu cũ', () => {
  inTemporaryDirectory((file, dir) => {
    const repository = new JsonRepository(file);
    repository.insert({ id: 'a', name: 'Bản gốc' });
    const originalBytes = fs.readFileSync(file);
    let attempts = 0;
    mock.method(fs, 'renameSync', () => {
      attempts += 1;
      throw fileError('EACCES');
    });

    assert.throws(() => repository.update('a', { name: 'Không lưu' }), {
      code: 'EACCES',
    });
    assert.equal(attempts, 5);
    assert.deepEqual(fs.readFileSync(file), originalBytes);
    assert.deepEqual(fs.readdirSync(dir), ['test.json']);
  });
});

test('Repository: không thử lại khi lỗi không thể khắc phục bằng retry', () => {
  inTemporaryDirectory((file, dir) => {
    const repository = new JsonRepository(file);
    repository.insert({ id: 'a', name: 'Bản gốc' });
    let attempts = 0;
    mock.method(fs, 'renameSync', () => {
      attempts += 1;
      throw fileError('ENOSPC');
    });

    assert.throws(() => repository.insert({ id: 'b' }), { code: 'ENOSPC' });
    assert.equal(attempts, 1);
    assert.equal(repository.get('a').name, 'Bản gốc');
    assert.deepEqual(fs.readdirSync(dir), ['test.json']);
  });
});
