import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {clientOutputFiles,readClientOutputFiles,pruneClientOutput} from '../../scripts/build/client-output.mjs';
const fixture=t=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'momevia-client-output-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return fs.realpathSync(root);};
test('client output retention includes dynamic chunks, both stylesheets and compressed copies',()=>{
  const files=clientOutputFiles({outputs:{'web/assets/app/app-A.js':{},'web/assets/app/chunks/editor-B.js':{}}},'<link href="/assets/app/styles-C.css" data-catalog-css="/assets/app/catalog-D.css">');
  for(const name of ['app-A.js','app-A.js.br','chunks/editor-B.js','chunks/editor-B.js.br','styles-C.css','catalog-D.css','catalog-D.css.br','index.html'])assert(files.has(name),name);
  assert(!clientOutputFiles({outputs:{'web/assets/app/../../outside.js':{}}}).has('../../outside.js'));
});
test('pruning retains current and preceding client versions and removes only obsolete outputs',t=>{
  const root=fixture(t);fs.mkdirSync(path.join(root,'chunks'));
  for(const name of ['index.html','QRCODE_LICENSE.txt','new.js','previous.js','obsolete.js','chunks/obsolete.js.br'])fs.writeFileSync(path.join(root,name),'fixture');
  const removed=pruneClientOutput(root,clientOutputFiles({outputs:{'web/assets/app/new.js':{}}}),new Set(['previous.js']));
  assert.equal(removed,2);for(const name of ['index.html','QRCODE_LICENSE.txt','new.js','previous.js'])assert(fs.existsSync(path.join(root,name)));
});
test('missing or malformed previous metadata does not trigger deletion',t=>{
  const root=fixture(t);fs.writeFileSync(path.join(root,'old.js'),'preserve');
  assert.equal(readClientOutputFiles(root),null);assert.equal(pruneClientOutput(root,new Set(),null),0);
  for(const value of ['{invalid',JSON.stringify({outputs:[]}),JSON.stringify({outputs:'invalid'}),JSON.stringify({outputs:{'outside/other.js':{}}})]){
    fs.writeFileSync(path.join(root,'metafile.json'),value);assert.equal(readClientOutputFiles(root),null);
  }
  assert(fs.existsSync(path.join(root,'old.js')));
});
test('client cleanup does not follow linked directories or files',t=>{
  const base=fixture(t),root=path.join(base,'output'),outside=path.join(base,'outside');fs.mkdirSync(root);fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'sentinel.txt'),'preserve');
  fs.symlinkSync(outside,path.join(root,'linked'),process.platform==='win32'?'junction':'dir');fs.writeFileSync(path.join(root,'obsolete.js'),'remove');
  assert.equal(pruneClientOutput(root,new Set(),new Set()),1);assert.equal(fs.readFileSync(path.join(outside,'sentinel.txt'),'utf8'),'preserve');
  assert.throws(()=>pruneClientOutput(path.join(root,'linked'),new Set(),new Set()),/real directory/);
});
