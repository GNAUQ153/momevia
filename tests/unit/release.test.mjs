import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

test('Gói nguồn loại secret/data/dependency và phát hiện file bị sửa hoặc chèn thêm', () => {
  const tempRoot=fs.realpathSync(os.tmpdir());
  const fixture=fs.mkdtempSync(path.join(tempRoot,'momevia-package-'));
  const write=(relative,text='fixture')=>{
    const filename=path.join(fixture,relative);
    fs.mkdirSync(path.dirname(filename),{recursive:true});
    fs.writeFileSync(filename,text);
  };
  try {
    for(const dir of ['src','services','web','scripts','tests','docs','.github']) fs.mkdirSync(path.join(fixture,dir));
    for(const file of ['gateway.mjs','dev.mjs','start-local.bat','package-lock.json','README.md','CHANGELOG.md','.env.example','.gitignore','eslint.config.mjs']) write(file);
    write('package.json',JSON.stringify({version:'test'}));
    write('web/js/vendor/qrcode.js');
    const excludedFiles=['.env','.env.production','services/identity/data/users.json','services/identity/.env',
      'web/debug.log','web/cache.tmp','node_modules/example/index.js',
      'docs/UPDATE_V04.md','docs/UPDATE_V05.md','docs/archive/CODE_REVIEW_ARCHITECTURE_2026-11-16_initial.md',
      'docs/local/notes.md','docs/coverage/index.html','web/test-results/results.json',
      'docs/Thumbs.db','docs/.eslintcache'];
    for(const file of excludedFiles) write(file,'PRIVATE_SENTINEL');
    write('docs/ARCHITECTURE.md','shared architecture');
    write('docs/licenses/example-MIT.txt','shared license');
    const pack=fileURLToPath(new URL('../../scripts/release/package.mjs',import.meta.url));
    fs.mkdirSync(path.join(fixture,'scripts/release'),{recursive:true});
    fs.copyFileSync(pack,path.join(fixture,'scripts/release/package.mjs'));
    fs.copyFileSync(fileURLToPath(new URL('../../scripts/release/policy.mjs',import.meta.url)),path.join(fixture,'scripts/release/policy.mjs'));
    const result=spawnSync(process.execPath,['scripts/release/package.mjs'],{cwd:fixture,encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const release=path.join(fixture,'dist/release');
    const manifest=JSON.parse(fs.readFileSync(path.join(release,'release-manifest.json'),'utf8'));
    assert(manifest.files.some(entry=>entry.path==='.env.example'));
    assert(!JSON.stringify(manifest).includes('users.json'));
    for(const file of excludedFiles) assert(!fs.existsSync(path.join(release,file)),file);
    assert(fs.existsSync(path.join(release,'docs/ARCHITECTURE.md')));
    assert(fs.existsSync(path.join(release,'docs/licenses/example-MIT.txt')));
    assert(fs.existsSync(path.join(release,'web/js/vendor/qrcode.js')));
    const verify=fileURLToPath(new URL('../../scripts/release/verify.mjs',import.meta.url));
    const run=()=>spawnSync(process.execPath,[verify,release],{cwd:fixture,encoding:'utf8'});
    assert.equal(run().status,0);
    fs.writeFileSync(path.join(release,'.env'),'PRIVATE_SENTINEL');
    assert.notEqual(run().status,0);
    fs.unlinkSync(path.join(release,'.env'));
    // Kể cả manifest được thêm checksum đúng, tài liệu cũ vẫn bị cấm.
    const oldDoc='docs/UPDATE_V04.md';
    fs.writeFileSync(path.join(release,oldDoc),'legacy notes');
    fs.writeFileSync(path.join(release,'release-manifest.json'),JSON.stringify({
      ...manifest,files:[...manifest.files,{path:oldDoc,sha256:createHash('sha256').update('legacy notes').digest('hex')}],
    }));
    assert.notEqual(run().status,0);
    fs.unlinkSync(path.join(release,oldDoc));
    fs.writeFileSync(path.join(release,'release-manifest.json'),JSON.stringify(manifest));
    fs.appendFileSync(path.join(release,'gateway.mjs'),'tampered');
    assert.notEqual(run().status,0);
  } finally {
    if(path.dirname(path.resolve(fixture))!==tempRoot) throw new Error('Unsafe fixture path');
    fs.rmSync(fixture,{recursive:true,force:true});
  }
});
