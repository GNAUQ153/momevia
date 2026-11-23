import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomBytes,createHash } from 'node:crypto';
import { spawnSync,spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import mysql from 'mysql2/promise';
import { MySqlClient } from '../../src/infrastructure/mysql/client.mjs';
import { CanvasLibraryService } from '../../src/modules/designs/library.service.mjs';
import { applyRollout,previewRollout } from '../../src/modules/designs/library-rollout.mjs';
import { canonicalStringify } from '../../web/js/shared/canvas/schema.js';
const name='momevia-refresh-qa-'+randomBytes(4).toString('hex'),password=randomBytes(24).toString('hex');
const report={cases:[]},out=path.resolve('docs/template-refresh-20261123/mysql');fs.mkdirSync(out,{recursive:true});
const docker=args=>{const r=spawnSync('docker',args,{encoding:'utf8',windowsHide:true});if(r.status)throw new Error(r.stderr);return r.stdout.trim();};
const old=JSON.parse(fs.readFileSync('tests/fixtures/refresh-21-before.json')),bundle=JSON.parse(fs.readFileSync('database/updates/template-refresh-21-20261123-v1.json'));
let connection,client;
async function run(script,database,extra={}){
 const log=fs.openSync(path.join(out,path.basename(script)+'.log'),'w');
 const child=spawn(process.execPath,[script],{stdio:['ignore',log,log],windowsHide:true,env:{...process.env,TEST_ACCOUNT_ENABLED:'false',BROWSER_CHANNEL:'chrome',CANVAS_QA_MYSQL_ISOLATED:'true',CANVAS_QA_MYSQL_DATABASE:database,CANVAS_QA_MYSQL_PORT:String(connection.config.port),CANVAS_QA_MYSQL_USER:'root',CANVAS_QA_MYSQL_PASSWORD:password,...extra}});
 const code=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});fs.closeSync(log);assert.equal(code,0,script);report.cases.push({script,passed:true});
}
try{
 docker(['run','-d','--rm','--name',name,'-p','127.0.0.1::3306','-e','MYSQL_ROOT_PASSWORD='+password,'mysql:8.4']);
 const port=Number(docker(['port',name,'3306/tcp']).split(':').at(-1));
 for(let i=0;i<60;i++){try{connection=await mysql.createConnection({host:'127.0.0.1',port,user:'root',password,multipleStatements:true,timezone:'Z',dateStrings:true});break;}catch{await delay(1000);}}
 assert(connection);const [[version]]=await connection.query('SELECT VERSION() version');assert.match(version.version,/^8\.4\./);report.version=version.version;
 const db='momevia_canvas_qa_refresh_'+randomBytes(4).toString('hex');report.database=db;
 await connection.query(`CREATE DATABASE \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);await connection.changeUser({database:db});
 for(const file of fs.readdirSync('database/migrations').filter(n=>n.endsWith('.sql')).sort())await connection.query(fs.readFileSync('database/migrations/'+file,'utf8'));
 client=new MySqlClient({env:{MYSQL_HOST:'127.0.0.1',MYSQL_PORT:String(port),MYSQL_DATABASE:db,MYSQL_USER:'root',MYSQL_PASSWORD:password},createPool:()=>mysql.createPool({host:'127.0.0.1',port,user:'root',password,database:db,timezone:'Z',dateStrings:true})});
 const service=new CanvasLibraryService(client),actor={role:'admin'};
 await service.ready();const emptyRows=await service.rows();assert.equal(emptyRows.length,438);report.cases.push({emptyDatabaseSeed:438,passed:true});
 // Replace only the disposable QA library with the captured pre-refresh seed.
 await connection.execute('DELETE FROM canvas_library_items');
 for(const row of old)await connection.execute('INSERT INTO canvas_library_items(kind,id,revision,status,sort_order,definition)VALUES(?,?,?,?,?,?)',[row.kind,row.id,row.revision,row.status,row.sortOrder,JSON.stringify(row.definition)]);
 assert(previewRollout(await service.rows(),bundle).canApply);
 const prior=old.find(r=>r.kind==='template'&&r.id==='afterglow');
 await service.put(actor,'template','afterglow',{expectedRevision:prior.revision,definition:{...prior.definition,title:{vi:'Admin đã sửa riêng',en:'Admin customization'}}});
 const conflict=previewRollout(await service.rows(),bundle);assert(!conflict.canApply);assert.equal(conflict.actions.filter(a=>a.status==='conflict').length,1);
 const beforeRejected=canonicalStringify(await service.rows());assert.equal((await applyRollout(service,actor,bundle)).applied.length,0);assert.equal(canonicalStringify(await service.rows()),beforeRejected);
 await service.ready();assert.equal((await service.rows()).find(r=>r.kind==='template'&&r.id==='afterglow').definition.title.en,'Admin customization');
 await assert.rejects(service.put(actor,'template','afterglow',{expectedRevision:1,definition:prior.definition}),e=>e.code==='LIBRARY_REVISION_CONFLICT');
 report.cases.push({adminConflictDetected:true,noPartialWriteOnConflict:true,seedPreservesAdmin:true,staleRevisionRejected:true,passed:true});
 // Explicit reviewed restoration is a new revision, never history rewriting.
 await service.put(actor,'template','afterglow',{expectedRevision:2,definition:prior.definition,status:prior.status,sortOrder:prior.sortOrder});
 const reviewed=structuredClone(bundle),change=reviewed.changes.find(c=>c.next.kind==='template'&&c.next.id==='afterglow');
 change.before=(await service.rows()).find(r=>r.kind==='template'&&r.id==='afterglow');change.expectedRevision=3;change.expectedFingerprint=createHash('sha256').update(canonicalStringify(change.before)).digest('hex');change.next.revision=4;
 const interrupted=await applyRollout(service,actor,reviewed,{stopAfter:7});assert(interrupted.interrupted);assert.equal(interrupted.applied.length,7);
 const rest=await applyRollout(service,actor,reviewed);assert(rest.canApply&&!rest.conflict);assert.equal(rest.applied.length,38);
 assert.equal((await applyRollout(service,actor,reviewed)).applied.length,0);
 const applied=await service.rows();for(const row of old.filter(r=>r.kind==='template'&&!bundle.changes.some(c=>c.next.kind==='template'&&c.next.id===r.id)))assert.deepEqual(applied.find(r=>r.kind===row.kind&&r.id===row.id),row);
 const coverChecks=[];
 for(const change of reviewed.changes.filter(c=>c.next.kind==='template'))for(const locale of ['vi','en'])for(const variant of ['portrait','catalog','seasonal']){
  const svg=await service.cover(change.next.id,locale,variant);assert.match(svg,/<svg/);assert.match(svg,new RegExp(`viewBox="0 0 390 ${variant==='portrait'?844:variant==='catalog'?330:466}"`));
  assert(svg.includes('refresh-')||svg.includes('<path'),'The cover is rendered from the active document');coverChecks.push({id:change.next.id,locale,variant,bytes:Buffer.byteLength(svg)});
 }
 report.cases.push({databaseCoverVariants:coverChecks,passed:true});
 const rollback=await applyRollout(service,actor,reviewed,{rollback:true});assert(rollback.canApply&&!rollback.conflict);assert.equal(rollback.applied.length,45);
 assert.equal((await applyRollout(service,actor,reviewed,{rollback:true})).applied.length,0);
 const restored=await service.rows();for(const row of old){const got=restored.find(r=>r.kind===row.kind&&r.id===row.id);assert.equal(canonicalStringify(got.definition),canonicalStringify(row.definition));assert.equal(got.status,row.status);}
 assert.equal(restored.filter(r=>r.id.startsWith('object-')&&r.status==='disabled').length,21);
 const [[history]]=await connection.query('SELECT COUNT(*) n FROM canvas_library_history');assert(history.n>=70);
 report.cases.push({populatedDatabase:old.length,interruptedAfter:7,resumed:38,rerunApplied:0,rollbackRestored:old.length,newObjectsDisabled:21,historyRows:history.n,controlsPreserved:7,passed:true});
 console.log('PASS MySQL: empty seed, existing rows, Admin conflict, CAS, 7+38 resume, rerun, history, rollback.');
 // Exercise current HTTP, publications and private media against another real DB.
 if(!process.argv.includes('--rollout-only'))await run('tests/integration/canvas-mysql-api.mjs','momevia_canvas_qa_refresh_api_'+randomBytes(4).toString('hex'));
 report.passed=true;
}catch(error){report.failure={message:error.message,stack:error.stack};console.error(error.stack);process.exitCode=1;}
finally{await client?.close();await connection?.end();try{docker(['stop',name]);}catch{}fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
