import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {spawnSync,spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import mysql from 'mysql2/promise';
import {MySqlClient} from '../../src/infrastructure/mysql/client.mjs';
import {CanvasLibraryService} from '../../src/modules/designs/library.service.mjs';
import {applyRollout,previewRollout} from '../../src/modules/designs/library-rollout.mjs';
import {canonicalStringify} from '../../web/js/shared/canvas/schema.js';
const name='momevia-natural-qa-'+randomBytes(4).toString('hex'),password=randomBytes(24).toString('hex');
const out=path.resolve('docs/template-refresh-natural-20261123/mysql');fs.mkdirSync(out,{recursive:true});
const report={cases:[]},original=JSON.parse(fs.readFileSync('tests/fixtures/refresh-21-before.json')),vector=JSON.parse(fs.readFileSync('database/updates/template-refresh-21-20261123-v1.json'));
const docker=args=>{const r=spawnSync('docker',args,{encoding:'utf8',windowsHide:true});if(r.status)throw new Error(r.stderr);return r.stdout.trim();};
let connection,client;
try{
 docker(['run','-d','--rm','--name',name,'-p','127.0.0.1::3306','-e','MYSQL_ROOT_PASSWORD='+password,'mysql:8.4']);
 const port=Number(docker(['port',name,'3306/tcp']).split(':').at(-1));
 for(let i=0;i<60;i++){try{connection=await mysql.createConnection({host:'127.0.0.1',port,user:'root',password,multipleStatements:true,timezone:'Z',dateStrings:true});break;}catch{await delay(1000);}}
 assert(connection);const [[version]]=await connection.query('SELECT VERSION() version');report.version=version.version;assert.match(version.version,/^8\.4\./);
 for(const fromVector of [false,true]){
  const db='momevia_canvas_qa_natural_'+randomBytes(4).toString('hex');
  await connection.query(`CREATE DATABASE \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);await connection.changeUser({database:db});
  for(const file of fs.readdirSync('database/migrations').filter(f=>f.endsWith('.sql')).sort())await connection.query(fs.readFileSync('database/migrations/'+file,'utf8'));
  client=new MySqlClient({env:{MYSQL_HOST:'127.0.0.1',MYSQL_PORT:String(port),MYSQL_DATABASE:db,MYSQL_USER:'root',MYSQL_PASSWORD:password},createPool:()=>mysql.createPool({host:'127.0.0.1',port,user:'root',password,database:db,timezone:'Z',dateStrings:true})});
  const service=new CanvasLibraryService(client),actor={role:'admin'};await service.ready();assert.equal((await service.rows()).length,480);
  const before=structuredClone(original);if(fromVector)for(const {next}of vector.changes){const i=before.findIndex(r=>r.kind===next.kind&&r.id===next.id);if(i<0)before.push(next);else before[i]=next;}
  const bundle=JSON.parse(fs.readFileSync('database/updates/template-refresh-natural-20261123-v2'+(fromVector?'-from-vector-v1':'')+'.json'));assert.equal(bundle.changes.length,75);
  await connection.execute('DELETE FROM canvas_library_items');
  for(const r of before)await connection.execute('INSERT INTO canvas_library_items(kind,id,revision,status,sort_order,definition)VALUES(?,?,?,?,?,?)',[r.kind,r.id,r.revision,r.status,r.sortOrder,JSON.stringify(r.definition)]);
  assert(previewRollout(await service.rows(),bundle).canApply);
  const prior=before.find(r=>r.kind==='template'&&r.id==='afterglow');
  await service.put(actor,'template',prior.id,{expectedRevision:prior.revision,definition:{...prior.definition,title:{vi:'Admin tự sửa',en:'Admin customization'}}});
  assert(!previewRollout(await service.rows(),bundle).canApply);const frozen=canonicalStringify(await service.rows());assert.equal((await applyRollout(service,actor,bundle)).applied.length,0);assert.equal(canonicalStringify(await service.rows()),frozen);
  await service.ready();assert.equal((await service.rows()).find(r=>r.kind==='template'&&r.id===prior.id).definition.title.en,'Admin customization');
  await assert.rejects(service.put(actor,'template',prior.id,{expectedRevision:prior.revision,definition:prior.definition}),e=>e.code==='LIBRARY_REVISION_CONFLICT');
  await service.put(actor,'template',prior.id,{expectedRevision:prior.revision+1,definition:prior.definition,status:prior.status,sortOrder:prior.sortOrder});
  const change=bundle.changes.find(c=>c.next.kind==='template'&&c.next.id===prior.id);change.before=(await service.rows()).find(r=>r.kind==='template'&&r.id===prior.id);change.expectedRevision=change.before.revision;change.expectedFingerprint=createHash('sha256').update(canonicalStringify(change.before)).digest('hex');change.next.revision=change.before.revision+1;
  const partial=await applyRollout(service,actor,bundle,{stopAfter:7});assert(partial.interrupted);assert.equal(partial.applied.length,7);
  const resumed=await applyRollout(service,actor,bundle);assert(resumed.canApply&&!resumed.conflict);assert.equal(resumed.applied.length,68);assert.equal((await applyRollout(service,actor,bundle)).applied.length,0);
  const applied=await service.rows();assert.equal(applied.length,468);
  const controls=before.filter(r=>!bundle.changes.some(c=>c.next.kind===r.kind&&c.next.id===r.id));for(const row of controls)assert.deepEqual(applied.find(r=>r.kind===row.kind&&r.id===row.id),row);
  let covers=0;for(const c of bundle.changes.filter(c=>c.next.kind==='template'))for(const locale of ['vi','en'])for(const variant of ['portrait','catalog','seasonal']){const svg=await service.cover(c.next.id,locale,variant);assert.match(svg,/<svg/);assert.match(svg,/data:image\/webp;base64,/);covers++;}
  const rollback=await applyRollout(service,actor,bundle,{rollback:true});assert(rollback.canApply&&!rollback.conflict);assert.equal(rollback.applied.length,75);assert.equal((await applyRollout(service,actor,bundle,{rollback:true})).applied.length,0);
  const restored=await service.rows();for(const r of before){const got=restored.find(v=>v.kind===r.kind&&v.id===r.id);assert.equal(canonicalStringify(got.definition),canonicalStringify(r.definition));assert.equal(got.status,r.status);}
  const newRows=bundle.changes.filter(c=>!c.before);assert.equal(newRows.length,fromVector?30:51);for(const c of newRows)assert.equal(restored.find(r=>r.kind===c.next.kind&&r.id===c.next.id).status,'disabled');
  const [[history]]=await connection.query('SELECT COUNT(*) n FROM canvas_library_history');assert.equal(history.n,bundle.changes.filter(c=>c.before).length+75+2);
  const external=JSON.parse(fs.readFileSync('database/updates/natural-open-elements-20261123-v1.json'));
  assert.equal((await applyRollout(service,actor,external,{stopAfter:5})).applied.length,5);
  assert.equal((await applyRollout(service,actor,external)).applied.length,7);
  assert.equal((await applyRollout(service,actor,external)).applied.length,0);
  for(const c of external.changes)assert.equal((await service.rows()).find(r=>r.id===c.next.id).status,'active');
  assert.equal((await applyRollout(service,actor,external,{rollback:true})).applied.length,12);
  assert.equal((await applyRollout(service,actor,external,{rollback:true})).applied.length,0);
  report.cases.push({source:fromVector?'vector-v1':'original',database:db,emptySeed:480,before:before.length,changed:75,adminConflict:true,staleRevision:true,interrupted:7,resumed:68,rerun:0,rollback:75,newRowsDisabled:newRows.length,untouchedRows:controls.length,covers,historyRows:history.n,openElements:{interrupted:5,resumed:7,rerun:0,rollback:12,passed:true},passed:true});
  await client.close();client=null;console.log('PASS natural MySQL '+(fromVector?'vector-v1':'original'));
 }
 if(!process.argv.includes('--rollout-only')){
  const log=fs.openSync(path.join(out,'api.log'),'w');const child=spawn(process.execPath,['tests/integration/canvas-mysql-api.mjs','--browser'],{stdio:['ignore',log,log],windowsHide:true,env:{...process.env,TEST_ACCOUNT_ENABLED:'false',BROWSER_CHANNEL:'chrome',CANVAS_QA_MYSQL_ISOLATED:'true',CANVAS_QA_MYSQL_DATABASE:'momevia_canvas_qa_natural_api_'+randomBytes(4).toString('hex'),CANVAS_QA_MYSQL_PORT:String(port),CANVAS_QA_MYSQL_USER:'root',CANVAS_QA_MYSQL_PASSWORD:password}});
  const code=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});fs.closeSync(log);assert.equal(code,0,'real MySQL API/browser');report.cases.push({apiBrowser:true,passed:true});
 }
 report.passed=true;
}catch(error){report.failure={message:error.message,stack:error.stack};console.error(error.stack);process.exitCode=1;}
finally{await client?.close();await connection?.end();try{docker(['stop',name]);}catch{}fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
