import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSecrets } from '../../src/shared/config.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const valid = { NODE_ENV:'production', JWT_SECRET:'a'.repeat(64), INTERNAL_SERVICE_KEY:'b'.repeat(64) };
test('Mọi service phải có hai khóa riêng đủ dài; production từ chối khóa mẫu', () => {
  assert.doesNotThrow(() => validateSecrets(valid));
  for (const env of [{}, {...valid,JWT_SECRET:''}, {...valid,INTERNAL_SERVICE_KEY:'short'},
    {...valid,JWT_SECRET:'unsafe-local-secret-only'.repeat(2)},
    {...valid,INTERNAL_SERVICE_KEY:'dev-internal-only-change-to-a-random-secret'},
    {...valid,JWT_SECRET:valid.INTERNAL_SERVICE_KEY}]) {
    assert.throws(() => validateSecrets(env));
  }
});

test('Chạy service trực tiếp vẫn từ chối thiếu secret trước khi tạo dữ liệu', () => {
  const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'momevia-config-'));
  try {
    const result=spawnSync(process.execPath,[fileURLToPath(new URL('../../services/identity/server.mjs',import.meta.url))],{
      cwd:fixture,encoding:'utf8',timeout:5000,
      env:{...process.env,NODE_ENV:'production',JWT_SECRET:'',INTERNAL_SERVICE_KEY:''},
    });
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/JWT_SECRET/);
    assert.equal(fs.existsSync(path.join(fixture,'services')),false);
  } finally {
    if(path.dirname(path.resolve(fixture))!==fs.realpathSync(os.tmpdir())) throw new Error('Unsafe fixture path');
    fs.rmSync(fixture,{recursive:true,force:true});
  }
});
