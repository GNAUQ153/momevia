// Explicitly authorized live rollout. Existing QA-only commands retain their guards.
import fs from 'node:fs';
import path from 'node:path';
import {loadEnvironment} from '../../src/shared/config.mjs';
import {MySqlClient,resolveMysqlConfig} from '../../src/infrastructure/mysql/client.mjs';
import {CanvasLibraryService} from '../../src/modules/designs/library.service.mjs';
import {applyRollout,previewRollout} from '../../src/modules/designs/library-rollout.mjs';
import {reviewLiveBaseline,libraryFingerprint} from '../../src/modules/designs/library-live-review.mjs';
const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1],required=name=>{if(!args.includes(name)||!option(name)||option(name).startsWith('--'))throw new Error('Required '+name);return option(name);};
loadEnvironment();const cfg=resolveMysqlConfig();
if(cfg.database!==required('--database')||cfg.host!==required('--host')||cfg.port!==Number(required('--port')))throw new Error('Configured database does not match the explicitly named target');
const directory=path.resolve(required('--state-dir'));fs.mkdirSync(directory,{recursive:true});
const stateFile=path.join(directory,'state.json'),client=new MySqlClient(),service=new CanvasLibraryService(client);
const json=file=>JSON.parse(fs.readFileSync(path.join(directory,file)));
const write=(file,value)=>fs.writeFileSync(path.join(directory,file),JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
async function tableSnapshot(tx){
 const [names]=await tx.execute('SELECT table_name AS name FROM information_schema.tables WHERE table_schema=? AND table_type=\'BASE TABLE\' ORDER BY table_name',[cfg.database]);const tables={};
 for(const {name}of names){if(!/^[a-zA-Z0-9_]+$/.test(name))throw new Error('Unexpected table identifier');const [rows]=await tx.execute('SELECT * FROM `'+name+'`');const [create]=await tx.execute('SHOW CREATE TABLE `'+name+'`');tables[name]={create:create[0]['Create Table'],rows,hash:libraryFingerprint(rows.map(libraryFingerprint).sort())};}
 return tables;
}
try{
 if(args.includes('--prepare')){
  const rows=await service.rows();if(libraryFingerprint(rows)!==required('--expected-library-hash'))throw new Error('Library changed since read-only review');
  const motionOnly=args.includes('--motion');
  const natural=reviewLiveBaseline(rows,JSON.parse(fs.readFileSync(new URL('../updates/'+(motionOnly?'natural-motion-loop-20261123-v1':'template-refresh-natural-20261123-v2')+'.json',import.meta.url))));
  const proposed=rows.slice();for(const {next}of natural.changes){const i=proposed.findIndex(r=>r.kind===next.kind&&r.id===next.id);if(i<0)proposed.push(next);else proposed[i]=next;}
  const external=motionOnly?null:reviewLiveBaseline(proposed,JSON.parse(fs.readFileSync(new URL('../updates/natural-open-elements-20261123-v1.json',import.meta.url))));
  const tables=await client.withTransaction(tableSnapshot);
  write('database-before.json',{target:{host:cfg.host,port:cfg.port,database:cfg.database},tables});write('library-before.json',rows);write('natural.json',natural);if(external)write('external.json',external);
  const mediaRoot=path.resolve(process.cwd(),'services/designs/data/assets'),media=[];
  function copyMedia(dir){if(!fs.existsSync(dir))return;for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())copyMedia(file);else if(item.isFile()){const relative=path.relative(mediaRoot,file),target=path.join(directory,'media',relative);fs.mkdirSync(path.dirname(target),{recursive:true});const bytes=fs.readFileSync(file);fs.writeFileSync(target,bytes,{flag:'wx',mode:0o600});media.push({relative,sha256:libraryFingerprint([...bytes]),bytes:bytes.length});}}}
  copyMedia(mediaRoot);
  const state={target:{host:cfg.host,port:cfg.port,database:cfg.database},preparedAt:new Date().toISOString(),beforeLibraryHash:libraryFingerprint(rows),bundles:{'natural.json':libraryFingerprint(natural),...(external?{'external.json':libraryFingerprint(external)}:{})},businessTables:Object.fromEntries(Object.entries(tables).filter(([n])=>!n.startsWith('canvas_library_')).map(([n,t])=>[n,{hash:t.hash,count:t.rows.length}])),mediaRoot,media};write('state.json',state);
  console.log(JSON.stringify({prepared:true,target:state.target,libraryRows:rows.length,naturalChanges:natural.changes.length,externalChanges:external?.changes.length||0,backupTables:Object.keys(tables).length,mediaFiles:media.length,stateHash:libraryFingerprint(state)}));
 }else{
  const state=json('state.json');if(libraryFingerprint(state)!==required('--expected-state-hash'))throw new Error('Reviewed state changed');
  if(JSON.stringify(state.target)!==JSON.stringify({host:cfg.host,port:cfg.port,database:cfg.database}))throw new Error('Backup belongs to another target');
  const names=Object.keys(state.bundles);if(args.includes('--rollback'))names.reverse();
  const results=[];for(const name of names){const bundle=json(name);if(libraryFingerprint(bundle)!==state.bundles[name])throw new Error('Reviewed bundle changed');const rollback=args.includes('--rollback'),before=previewRollout(await service.rows(),bundle,{rollback});if(!before.canApply)throw new Error('Live conflict: '+name);const result=args.includes('--apply')?await applyRollout(service,{role:'admin'},bundle,{rollback}):before;if(result.conflict)throw new Error(JSON.stringify(result.conflict));results.push({name,canApply:result.canApply,applied:result.applied?.length||0,unchanged:result.actions.filter(a=>a.status==='unchanged').length});}
  const tables=await client.withTransaction(tableSnapshot);for(const [name,before]of Object.entries(state.businessTables))if(tables[name]?.hash!==before.hash)throw new Error('Non-library data changed: '+name);
  for(const item of state.media){const bytes=fs.readFileSync(path.join(state.mediaRoot,item.relative));if(libraryFingerprint([...bytes])!==item.sha256)throw new Error('Existing media changed');}
  const rows=await service.rows(),report={at:new Date().toISOString(),target:state.target,applied:args.includes('--apply'),rollback:args.includes('--rollback'),results,libraryRows:rows.length,businessTablesUnchanged:Object.keys(state.businessTables).length,existingMediaUnchanged:state.media.length,libraryHash:libraryFingerprint(rows),passed:true};
  fs.writeFileSync(path.join(directory,'result-'+Date.now()+'.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(report,null,2));
 }
}finally{await client.close();}
