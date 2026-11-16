import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('Gói nguồn loại secret/data/dependency và phát hiện file bị sửa hoặc chèn thêm', () => {
  const tempRoot=fs.realpathSync(os.tmpdir());
  const fixture=fs.mkdtempSync(path.join(tempRoot,'momevia-package-'));
  const write=(relative,text='fixture')=>{
    const filename=path.join(fixture,relative);
    fs.mkdirSync(path.dirname(filename),{recursive:true});
    fs.writeFileSync(filename,text);
  };
  try {
    for(const dir of ['services','web','scripts','tests','docs','.github']) fs.mkdirSync(path.join(fixture,dir));
    for(const file of ['gateway.mjs','dev.mjs','start-local.bat','package-lock.json','README.md','CHANGELOG.md','.env.example','.gitignore']) write(file);
    write('package.json',JSON.stringify({version:'test'}));
    write('web/js/vendor/qrcode.js');
    for(const file of ['.env','.env.production','services/identity/data/users.json','services/identity/.env','web/debug.log','web/cache.tmp','node_modules/example/index.js']) write(file,'PRIVATE_SENTINEL');
    const pack=fileURLToPath(new URL('../scripts/package-release.mjs',import.meta.url));
    fs.copyFileSync(pack,path.join(fixture,'scripts/package-release.mjs'));
    const result=spawnSync(process.execPath,['scripts/package-release.mjs'],{cwd:fixture,encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const release=path.join(fixture,'dist/release');
    const manifest=JSON.parse(fs.readFileSync(path.join(release,'release-manifest.json'),'utf8'));
    assert(manifest.files.some(entry=>entry.path==='.env.example'));
    assert(!JSON.stringify(manifest).includes('users.json'));
    const verify=fileURLToPath(new URL('../scripts/verify-release.mjs',import.meta.url));
    const run=()=>spawnSync(process.execPath,[verify,release],{cwd:fixture,encoding:'utf8'});
    assert.equal(run().status,0);
    fs.writeFileSync(path.join(release,'.env'),'PRIVATE_SENTINEL');
    assert.notEqual(run().status,0);
    fs.unlinkSync(path.join(release,'.env'));
    fs.appendFileSync(path.join(release,'gateway.mjs'),'tampered');
    assert.notEqual(run().status,0);
  } finally {
    if(path.dirname(path.resolve(fixture))!==tempRoot) throw new Error('Unsafe fixture path');
    fs.rmSync(fixture,{recursive:true,force:true});
  }
});
