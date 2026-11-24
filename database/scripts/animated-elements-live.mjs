// Explicit local-library update. QA-only commands keep their original guards.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import {loadEnvironment} from '../../src/shared/config.mjs';
import {dataPath} from '../../src/shared/paths.mjs';
import {MySqlClient,resolveMysqlConfig} from '../../src/infrastructure/mysql/client.mjs';
import {CanvasLibraryService} from '../../src/modules/designs/library.service.mjs';
import {createMotionRollout,MOTION_ROLLOUT_IDS} from '../../src/modules/designs/motion-rollout.mjs';
import {previewRollout,applyRollout} from '../../src/modules/designs/library-rollout.mjs';
import {libraryFingerprint} from '../../src/modules/designs/library-live-review.mjs';

const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1],required=name=>{const v=option(name);if(!args.includes(name)||!v||v.startsWith('--'))throw new Error('Required '+name);return v;};
loadEnvironment();const cfg=resolveMysqlConfig();
if(!args.includes('--allow-local-live')||cfg.host!=='127.0.0.1'||cfg.host!==required('--host')||cfg.database!==required('--database')||cfg.port!==Number(required('--port')))throw new Error('Explicit matching local database authorization required');
const directory=path.resolve(required('--state-dir'));fs.mkdirSync(directory,{recursive:true});
const client=new MySqlClient(),service=new CanvasLibraryService(client),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const write=(name,value)=>fs.writeFileSync(path.join(directory,name),JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600}),read=name=>JSON.parse(fs.readFileSync(path.join(directory,name)));
async function snapshot(connection=client,database=cfg.database){
 const [names]=await connection.execute("SELECT table_name name FROM information_schema.tables WHERE table_schema=? AND table_type='BASE TABLE' ORDER BY table_name",[database]),result={};
 for(const {name}of names){if(!/^[A-Za-z0-9_]+$/.test(name))throw new Error('Unsafe table name');const [rows]=await connection.execute(`SELECT * FROM \`${database}\`.\`${name}\``);result[name]={count:rows.length,hash:libraryFingerprint(rows.map(libraryFingerprint).sort())};}
 return result;
}
function mediaBackup(){
 const media=[];for(const [kind,root]of [['canvas',dataPath('designs','assets')],['legacy',dataPath('gifts','images')]]){
  function walk(dir){if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isSymbolicLink())throw new Error('Media symlinks are not supported');if(entry.isDirectory())walk(file);else if(entry.isFile()){const relative=path.relative(root,file),bytes=fs.readFileSync(file),target=path.join(directory,'media',kind,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx',mode:0o600});if(sha(fs.readFileSync(target))!==sha(bytes))throw new Error('Media copy checksum mismatch');media.push({kind,root,relative,bytes:bytes.length,sha256:sha(bytes)});}}}walk(root);
 }return media;
}
function reviewBaseline(rows){
 const known=JSON.parse(fs.readFileSync(new URL('../updates/natural-motion-loop-20261123-v1.json',import.meta.url))).changes.find(c=>c.next.id==='natural-motion-heart').next;
 const actual=rows.find(r=>r.kind==='element'&&r.id===known.id),normalize=row=>{const d=structuredClone(row.definition);for(const e of d.elements)delete e.id;return libraryFingerprint(d);};
 if(!actual||normalize(actual)!==normalize(known))throw new Error('Heart differs from the reviewed legacy definition; preserve Admin changes and review separately');
 if(rows.some(r=>r.kind==='element'&&MOTION_ROLLOUT_IDS.includes(r.id)&&r.id!==known.id))throw new Error('New IDs already present; use the original prepared package for retry');
 const bundle=createMotionRollout(rows);let order=Math.max(...rows.map(r=>r.sortOrder))+1;
 for(const c of bundle.changes)if(!c.before)c.next.sortOrder=order++;
 const plan=previewRollout(rows,bundle);if(!plan.canApply)throw new Error(plan.dependencyError||'Baseline conflict');return bundle;
}
async function backupSql(before){
 const binary=path.resolve(required('--mysql-bin')),dump=path.join(binary,process.platform==='win32'?'mysqldump.exe':'mysqldump'),mysql=path.join(binary,process.platform==='win32'?'mysql.exe':'mysql'),credentials=path.join(directory,'.mysql-client.cnf');
 const quote=v=>'"'+String(v).replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('\n','\\n').replaceAll('\r','\\r')+'"';
 fs.writeFileSync(credentials,`[client]\nhost=${quote(cfg.host)}\nport=${cfg.port}\nuser=${quote(cfg.user)}\npassword=${quote(cfg.password)}\ndefault-character-set=utf8mb4\n`,{flag:'wx',mode:0o600});
 const run=(exe,parameters,input)=>{const r=spawnSync(exe,['--defaults-extra-file='+credentials,...parameters],{input,windowsHide:true,maxBuffer:256*1024*1024});if(r.status!==0){fs.writeFileSync(path.join(directory,'mysql-error-private.log'),r.stderr||Buffer.from('Command failed'));throw new Error('MySQL backup/restore command failed; see private log');}return r.stdout;};
 const common=['--single-transaction','--set-gtid-purged=OFF','--no-tablespaces','--hex-blob','--order-by-primary','--skip-comments','--skip-dump-date','--column-statistics=0'];
 let restore,created=false;
 try{
  const sql=run(dump,[...common,'--routines','--events','--triggers',cfg.database]);if(!sql.length||/^\s*(?:USE|CREATE DATABASE|DROP DATABASE)\b/im.test(sql.toString()))throw new Error('Dump must not select/create/drop a database');fs.writeFileSync(path.join(directory,'database.sql'),sql,{flag:'wx',mode:0o600});
  restore='momevia_canvas_qa_motion_restore_'+randomBytes(6).toString('hex');await client.execute(`CREATE DATABASE \`${restore}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);created=true;
  run(mysql,['--binary-mode=1','--database='+restore],sql);
  const restored=await snapshot(client,restore);if(libraryFingerprint(restored)!==libraryFingerprint(before))throw new Error('Restored rows differ from source backup');
  const dataArgs=[...common,'--no-create-info','--skip-triggers','--skip-add-locks'],original=run(dump,[...dataArgs,cfg.database]),copy=run(dump,[...dataArgs,restore]);if(sha(original)!==sha(copy))throw new Error('Exact restored SQL data differs');
  return {file:'database.sql',bytes:sql.length,sha256:sha(sql),restoreTest:{passed:true,database:restore,tables:Object.keys(restored).length,dataSha256:sha(copy)}};
 }finally{if(created&&restore&&/^momevia_canvas_qa_motion_restore_[a-f0-9]{12}$/.test(restore))await client.execute(`DROP DATABASE \`${restore}\``);fs.unlinkSync(credentials);}
}
try{
 if(args.includes('--prepare')){
  const rows=await service.rows();if(libraryFingerprint(rows)!==required('--expected-library-hash'))throw new Error('Library changed since review');const bundle=reviewBaseline(rows),tables=await client.withTransaction(tx=>snapshot(tx)),sql=await backupSql(tables),media=mediaBackup();
  const after=await snapshot();if(libraryFingerprint(after)!==libraryFingerprint(tables))throw new Error('Database changed during backup; no update authorized');
  const target={host:cfg.host,port:cfg.port,database:cfg.database};write('library-before.json',rows);write('bundle.json',bundle);write('tables-before.json',tables);
  const state={formatVersion:1,target,createdAt:new Date().toISOString(),libraryHash:libraryFingerprint(rows),bundleHash:libraryFingerprint(bundle),tables,sql,media};write('state.json',state);console.log(JSON.stringify({prepared:true,target,changes:51,backupBytes:sql.bytes,restoreVerified:sql.restoreTest.passed,mediaFiles:media.length,stateHash:libraryFingerprint(state)}));
 }else{
  const state=read('state.json'),target={host:cfg.host,port:cfg.port,database:cfg.database};if(libraryFingerprint(state)!==required('--expected-state-hash')||libraryFingerprint(state.target)!==libraryFingerprint(target))throw new Error('Wrong backup or reviewed state');if(sha(fs.readFileSync(path.join(directory,state.sql.file)))!==state.sql.sha256)throw new Error('SQL backup checksum mismatch');
  for(const item of state.media)if(sha(fs.readFileSync(path.join(directory,'media',item.kind,item.relative)))!==item.sha256||sha(fs.readFileSync(path.join(item.root,item.relative)))!==item.sha256)throw new Error('Media checksum mismatch');
  const bundle=read('bundle.json');if(libraryFingerprint(bundle)!==state.bundleHash)throw new Error('Prepared bundle changed');const rollback=args.includes('--rollback'),before=await snapshot(),rowsBefore=await service.rows(),plan=previewRollout(rowsBefore,bundle,{rollback});if(!plan.canApply)throw new Error(plan.dependencyError||'Library revision/fingerprint conflict');
  const result=args.includes('--apply')?await applyRollout(service,{role:'admin'},bundle,{rollback}):plan;if(result.conflict)throw new Error(result.conflict.message);
  const after=await snapshot();for(const [name,value]of Object.entries(before))if(!name.startsWith('canvas_library_')&&libraryFingerprint(value)!==libraryFingerprint(after[name]))throw new Error('Non-library table changed: '+name);
  const rows=await service.rows();for(const row of rowsBefore.filter(r=>!MOTION_ROLLOUT_IDS.includes(r.id)||r.kind!=='element'))if(libraryFingerprint(row)!==libraryFingerprint(rows.find(r=>r.kind===row.kind&&r.id===row.id)))throw new Error('Unrelated library item changed');
  const report={at:new Date().toISOString(),target,mode:args.includes('--apply')?'apply':'preview',canApply:plan.canApply,plannedReady:plan.actions.filter(a=>a.status==='ready').length,applied:result.applied?.length||0,unchanged:result.actions.filter(a=>a.status==='unchanged').length,rollback,rows:rows.length,elements:rows.filter(r=>r.kind==='element'&&r.status==='active').length,newIds:rows.filter(r=>r.kind==='element'&&r.status==='active'&&MOTION_ROLLOUT_IDS.includes(r.id)&&r.id!=='natural-motion-heart').map(r=>r.id),nonLibraryTablesUnchanged:Object.keys(before).filter(n=>!n.startsWith('canvas_library_')).length,existingMediaUnchanged:state.media.length,passed:true};write('result-'+Date.now()+'.json',report);console.log(JSON.stringify(report,null,2));
 }
}finally{await client.close();}
