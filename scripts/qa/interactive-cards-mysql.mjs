import { MySqlTemplatesRepository } from '../../src/modules/catalog/mysql.repositories.mjs';
import { CatalogService } from '../../src/modules/catalog/catalog.service.mjs';
import { templates } from '../../src/modules/catalog/seed.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync,spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';
import { MySqlClient } from '../../src/infrastructure/mysql/client.mjs';
import { CanvasLibraryService } from '../../src/modules/designs/library.service.mjs';
import { previewRollout,applyRollout } from '../../src/modules/designs/library-rollout.mjs';
import { canonicalStringify } from '../../web/js/shared/canvas/schema.js';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
const out=path.resolve('local/interactive-cards-20261122/mysql');fs.mkdirSync(out,{recursive:true});
const name='momevia-cards-qa-'+randomBytes(4).toString('hex'),password=randomBytes(24).toString('hex');
const docker=args=>{const r=spawnSync('docker',args,{encoding:'utf8',windowsHide:true});if(r.status)throw new Error(r.stderr);return r.stdout.trim();};
const summary=[];
let connection,client;
async function run(script,database,extra={}){
 const file=fs.openSync(path.join(out,path.basename(script)+'.log'),'w');
 const child=spawn(process.execPath,[script,...(script.endsWith('canvas-mysql-api.mjs')?['--browser']:[])],{stdio:['ignore',file,file],windowsHide:true,env:{...process.env,TEST_ACCOUNT_ENABLED:'false',BROWSER_CHANNEL:'chrome',CANVAS_QA_MYSQL_ISOLATED:'true',CANVAS_QA_MYSQL_DATABASE:database,CANVAS_QA_MYSQL_PORT:String(connection.config.port),CANVAS_QA_MYSQL_USER:'root',CANVAS_QA_MYSQL_PASSWORD:password,...extra}});
 const code=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});fs.closeSync(file);summary.push({script,database,code});console.log(`${code===0?'PASS':'FAIL'} ${script}`);
}
try{
 docker(['run','-d','--rm','--name',name,'-p','127.0.0.1::3306','-e','MYSQL_ROOT_PASSWORD='+password,'mysql:8.4']);
 const port=Number(docker(['port',name,'3306/tcp']).split(':').at(-1));
 for(let i=0;i<60;i++){try{connection=await mysql.createConnection({host:'127.0.0.1',port,user:'root',password,multipleStatements:true,timezone:'Z',dateStrings:true});break;}catch{await delay(1000);}}
 assert(connection,'Isolated MySQL startup');const [[version]]=await connection.query('SELECT VERSION() version');assert.match(version.version,/^8\.4\./);
 const suffix=randomBytes(4).toString('hex'),db=`momevia_canvas_qa_cards_${suffix}`;
 await connection.query(`CREATE DATABASE \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);await connection.changeUser({database:db});
 for(const file of fs.readdirSync('database/migrations').filter(n=>n.endsWith('.sql')).sort())await connection.query(fs.readFileSync('database/migrations/'+file,'utf8'));
 client=new MySqlClient({env:{MYSQL_HOST:'127.0.0.1',MYSQL_PORT:String(port),MYSQL_DATABASE:db,MYSQL_USER:'root',MYSQL_PASSWORD:password},createPool:()=>mysql.createPool({host:'127.0.0.1',port,user:'root',password,database:db,timezone:'Z',dateStrings:true})});
 const service=new CanvasLibraryService(client),old=JSON.parse(fs.readFileSync('local/interactive-cards-20261122/baseline/library.json'));
 for(const row of old)await connection.execute('INSERT INTO canvas_library_items(kind,id,revision,status,sort_order,definition) VALUES(?,?,?,?,?,?)',[row.kind,row.id,row.revision,row.status,row.sortOrder,JSON.stringify(row.definition)]);
 const catalogRepo=new MySqlTemplatesRepository(client),catalog=new CatalogService(catalogRepo,{});
 const {templates:oldCatalog}=await import(new URL('../../local/interactive-cards-20261122/baseline/src/modules/catalog/seed.mjs',import.meta.url));
 for(const template of oldCatalog)await catalogRepo.insert(template);await service.refresh();assert.equal((await catalogRepo.all()).length,25);const catalogBefore=await catalog.publicList();assert.equal(catalogBefore.length,25);
 const bundle=JSON.parse(fs.readFileSync('database/updates/interactive-cards-20261122-v1.json')),before=await service.rows();
 assert.equal(before.length,387);assert(previewRollout(before,bundle).canApply);
 const actor={role:'admin'};
 const first=await applyRollout(service,actor,bundle,{stopAfter:5});assert(first.interrupted);assert.equal(first.applied.length,5);
 const rest=await applyRollout(service,actor,bundle);assert(!rest.conflict);assert.equal((await service.rows()).length,415);
 assert.equal((await applyRollout(service,actor,bundle)).applied.length,0);
 for(const template of templates)if(!await catalogRepo.get(template.id))await catalogRepo.insert(template);
 assert.equal((await catalogRepo.all()).length,28);const catalogAfter=await catalog.publicList();assert.equal(catalogAfter.length,28);assert.deepEqual(catalogAfter.slice(0,3).map(t=>t.id),catalogBefore.slice(0,3).map(t=>t.id));
 // Concurrent Admin edit: conflict is scoped, and an approved revision restore
 // still writes a new history record rather than modifying a historical row.
 const row=(await service.rows()).find(r=>r.kind==='template'&&r.id==='proud-of-you');
 await service.put(actor,row.kind,row.id,{expectedRevision:row.revision,definition:{...row.definition,title:{vi:'Riêng Admin',en:'Admin custom'}},status:row.status,sortOrder:row.sortOrder});
 const blocked=previewRollout(await service.rows(),bundle,{rollback:true});assert(!blocked.canApply);assert.equal(blocked.actions.filter(a=>a.status==='conflict').length,1);
 await service.put(actor,row.kind,row.id,{expectedRevision:row.revision+1,definition:row.definition,status:row.status,sortOrder:row.sortOrder});
 const reviewed=structuredClone(bundle);const change=reviewed.changes.find(c=>c.next.kind===row.kind&&c.next.id===row.id);change.next.revision=row.revision+2;change.before.revision=row.revision+1;
 // The reviewed rollback is explicit about the exact new base revision.
 const rollback=await applyRollout(service,actor,reviewed,{rollback:true});assert(!rollback.conflict);assert(rollback.canApply);
 const after=await service.rows();for(const oldRow of old){const found=after.find(r=>r.kind===oldRow.kind&&r.id===oldRow.id);assert.equal(canonicalStringify(found.definition),canonicalStringify(oldRow.definition));assert.equal(found.status,oldRow.status);}
 assert.equal((await catalog.publicList()).length,25);
 const [[history]]=await connection.query('SELECT COUNT(*) n FROM canvas_library_history');assert(history.n>0);
 fs.writeFileSync(path.join(out,'rollout-report.json'),JSON.stringify({database:db,version:version.version,before:387,afterApply:415,interruptedAfter:5,rerunCreated:0,adminConflict:blocked.actions.filter(a=>a.status==='conflict').map(a=>a.key),rollbackRestored:old.length,historyRows:history.n,rolloutNewItemsDisabled:28,catalog:{beforeRows:25,beforePublic:25,afterRows:28,afterPublic:28,rollbackRows:28,rollbackPublic:25,beforeOrder:catalogBefore.map(t=>t.id),afterOrder:catalogAfter.map(t=>t.id),featuredBefore:catalogBefore.filter(t=>t.featured).map(t=>t.id),featuredAfter:catalogAfter.filter(t=>t.featured).map(t=>t.id)}},null,2));
 console.log('PASS real MySQL existing library: interruption, retry, Admin conflict, reviewed revision rollback, history');
 const adapter=`momevia_canvas_qa_adapter_${suffix}`;await connection.query(`CREATE DATABASE \`${adapter}\``);
 if(!process.argv.includes('--storage-only')&&!process.argv.includes('--rollout-only')&&!process.argv.includes('--api-only'))await run('tests/integration/canvas-mysql.mjs',adapter);
 if(!process.argv.includes('--rollout-only')&&!process.argv.includes('--api-only'))await run('tests/integration/canvas-storage-roundtrip.mjs',`momevia_canvas_qa_storage_${suffix}`,{CANVAS_TEMPLATE_FIDELITY:'true',CANVAS_ADMIN_DEEP_AUDIT:'true',BROWSER_ARTIFACT_DIR:path.join(out,'storage-browser')});
 if(!process.argv.includes('--storage-only')&&!process.argv.includes('--rollout-only'))await run('tests/integration/canvas-mysql-api.mjs',`momevia_canvas_qa_api_${suffix}`,{BROWSER_ARTIFACT_DIR:path.join(out,'api-browser')});
 if(summary.some(r=>r.code!==0))process.exitCode=1;
}catch(error){summary.push({failure:error.message,stack:error.stack});console.error(error.stack);process.exitCode=1;}
finally{fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2));await client?.close();await connection?.end();docker(['stop',name]);}
