import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { spawn,execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { startSfxFixture } from './sfx-fixture.mjs';
import { MySqlClient } from '../../src/infrastructure/mysql/client.mjs';
import { readCanvasSnapshot,planCanvasImport,applyCanvasImport,verifyCanvasImport } from '../../database/scripts/import-canvas-json.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),fixture=await startSfxFixture({sql:true,label:'storage'}),summary=[];
let client,restored;
try{
 const source=process.env.SFX_JSON_FIXTURE||fs.readdirSync(path.join(root,'local/sfx-qa')).filter(n=>n.startsWith('json-')).sort().reverse().map(n=>path.join(root,'local/sfx-qa',n)).find(dir=>fs.existsSync(path.join(dir,'results.json'))&&!JSON.parse(fs.readFileSync(path.join(dir,'results.json'))).checks.some(c=>c.result!=='PASS'));
 assert(source,'Run JSON SFX integration first.');
 const db='momevia_canvas_qa_sfx_import_'+randomBytes(4).toString('hex');await fixture.connection.query(`CREATE DATABASE \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);await fixture.connection.changeUser({database:db});
 for(const name of fs.readdirSync(path.join(root,'database/migrations')).filter(n=>n.endsWith('.sql')).sort())await fixture.connection.query(fs.readFileSync(path.join(root,'database/migrations',name),'utf8'));
 client=new MySqlClient({env:{...process.env,MYSQL_DATABASE:db}});
 const plan=planCanvasImport(readCanvasSnapshot(source));
 await assert.rejects(applyCanvasImport(plan,client,{label:'SFX failure injection',beforeCommit:async()=>{throw new Error('injected before import commit');}}),/injected/);
 const [[empty]]=await client.execute('SELECT COUNT(*) n FROM users');assert.equal(empty.n,0);
 await applyCanvasImport(plan,client,{label:'SFX JSON to isolated MySQL'});await verifyCanvasImport(plan,client);summary.push({name:'lossless v1/v2/v3 JSON to MySQL import; failed transaction rollback and successful retry',result:'PASS',counts:plan.counts});console.log('PASS JSON audio import, rollback, retry and exact read-back');
 const media=path.join(fixture.directory,'backup-source-media');fs.cpSync(path.join(source,'services/designs/data/assets'),media,{recursive:true});
 const backup=path.join(fixture.directory,'backup'),restoredDb=db+'_restored';
 const output=execFileSync(process.execPath,[path.join(root,'database/scripts/canvas-backup.mjs'),'--container',fixture.container,'--schema',db,'--restore-test',restoredDb,'--media-root',media,'--output',backup],{encoding:'utf8',windowsHide:true,env:{...process.env,CANVAS_QA_MYSQL_ISOLATED:'true',CANVAS_QA_MYSQL_PASSWORD:process.env.MYSQL_PASSWORD}});console.log(output.trim());summary.push({name:'MySQL full dump and separate-schema restore with WAV hash and table parity',result:'PASS'});
 fs.cpSync(path.join(backup,'restore-media'),path.join(fixture.directory,'services/designs/data/assets'),{recursive:true});process.env.MYSQL_DATABASE=restoredDb;
 const {createHttpApp}=await import(pathToFileURL(path.join(fixture.directory,'src/server/app.mjs')));
 const config={baseUrl:'http://127.0.0.1',jwtSecret:randomBytes(32).toString('hex'),internalKey:randomBytes(32).toString('hex'),demoEnabled:false,adminCode:'',giftTtlDays:365,testAccount:null};restored=await createHttpApp(config);await new Promise(r=>restored.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${restored.server.address().port}`;config.baseUrl=base;
 const session=JSON.parse(fs.readFileSync(path.join(source,'session-private.json'),'utf8')),response=await fetch(base+'/api/gifts/gifts/'+session.gift.slug);assert.equal(response.status,200);const publicGift=(await response.json()).gift,audioId=publicGift.documentSnapshot.elements.find(e=>e.sound?.kind==='audio').sound.assetId,mediaResponse=await fetch(`${base}/api/gifts/gifts/${session.gift.slug}/assets/${audioId}`);assert.equal(mediaResponse.status,200);assert.deepEqual(Buffer.from(await mediaResponse.arrayBuffer()),fs.readFileSync(path.join(source,'receiver-middle.wav')));summary.push({name:'fresh restored MySQL app serves the original gift and exact cut audio',result:'PASS'});console.log('PASS restored recipient audio HTTP bytes');
 for(const script of (process.argv.includes('--storage-only')?['canvas-storage-roundtrip.mjs']:['canvas-mysql.mjs','canvas-storage-roundtrip.mjs','canvas-mysql-api.mjs'])){
  const database='momevia_canvas_qa_sfx_'+randomBytes(5).toString('hex');if(script==='canvas-mysql.mjs')await fixture.connection.query(`CREATE DATABASE \`${database}\``);
  const log=path.join(fixture.directory,script+'.log'),fd=fs.openSync(log,'w'),env={...process.env,TEST_ACCOUNT_ENABLED:'false',BROWSER_CHANNEL:'chrome',CANVAS_QA_MYSQL_ISOLATED:'true',CANVAS_QA_MYSQL_DATABASE:database,CANVAS_QA_MYSQL_PORT:process.env.MYSQL_PORT,CANVAS_QA_MYSQL_USER:'root',CANVAS_QA_MYSQL_PASSWORD:process.env.MYSQL_PASSWORD,BROWSER_ARTIFACT_DIR:path.join(fixture.directory,script+'-artifacts')};
  const child=spawn(process.execPath,[path.join(root,'tests/integration',script),...(script==='canvas-mysql-api.mjs'?['--browser']:[])],{cwd:root,env,windowsHide:true,stdio:['ignore',fd,fd]});const code=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});fs.closeSync(fd);summary.push({name:script,result:code===0?'PASS':'FAIL',log});console.log(`${code===0?'PASS':'FAIL'} ${script}`);if(code)console.error(fs.readFileSync(log,'utf8').slice(-4500));
 }
 if(summary.some(r=>r.result!=='PASS'))process.exitCode=1;
}catch(error){console.error(error.stack);summary.push({result:'FAIL',error:error.stack});process.exitCode=1;}
finally{fs.writeFileSync(path.join(fixture.directory,'storage-results.json'),JSON.stringify(summary,null,2));if(restored){await new Promise(r=>restored.server.close(r));await restored.close();}await client?.close();await fixture.close();console.log('SFX_STORAGE_REPORT='+fixture.directory);}
