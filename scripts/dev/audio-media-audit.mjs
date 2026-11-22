// Conservative maintenance: metadata-backed media is always retained, including
// archived, expired, revoked and historical versions. Only old untracked bytes
// can be quarantined, offline, after scanning every supplied snapshot.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { MySqlClient } from '../../src/infrastructure/mysql/client.mjs';
const wav=/^[0-9a-f-]{36}\.wav$/;
const checksum=bytes=>createHash('sha256').update(bytes).digest('hex');
export function auditAudioMedia({mediaRoot,assets=[],snapshots=[],now=Date.now()}){
 const root=fs.realpathSync(mediaRoot);if(!fs.statSync(root).isDirectory()||root===path.parse(root).root)throw new Error('Explicit media directory required.');
 const ids=new Set(),keys=new Set(),visited=new Set();
 const scan=value=>{
  if(!value||typeof value!=='object'||visited.has(value))return;visited.add(value);
  for(const [key,item]of Object.entries(value)){if(['assetId','id'].includes(key)&&typeof item==='string')ids.add(item);if(key==='storageKey'&&typeof item==='string')keys.add(item);scan(item);}
 };
 for(const snapshot of snapshots)scan(snapshot);
 for(const asset of assets){ids.add(asset.id);keys.add(asset.storageKey);}
 const files=fs.readdirSync(root).filter(name=>wav.test(name)).map(name=>{
  const filename=path.join(root,name),stat=fs.lstatSync(filename);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('Linked media cannot be audited.');
  const referenced=keys.has(name)||ids.has(name.slice(0,-4)),oldEnough=now-stat.mtimeMs>=7*86400000;
  return {name,bytes:stat.size,sha256:checksum(fs.readFileSync(filename)),mtimeMs:stat.mtimeMs,referenced,quarantineCandidate:!referenced&&oldEnough};
 });
 return {root,createdAt:now,policy:'retain all metadata and references; quarantine only untracked WAV older than seven days',files};
}
export function quarantineAudioOrphans(plan,{offline=false}={}){
 if(!offline)throw new Error('Stop all writers and specify offline maintenance.');
 const root=fs.realpathSync(plan.root),dataRoot=path.dirname(root),target=path.join(dataRoot,'audio-orphan-quarantine');
 if(root!==plan.root||root===path.parse(root).root)throw new Error('Media root changed.');
 if(dataRoot===path.parse(dataRoot).root||fs.realpathSync(dataRoot)!==dataRoot)throw new Error('Unsafe data directory.');
 fs.mkdirSync(target,{recursive:true});if(fs.lstatSync(target).isSymbolicLink()||fs.realpathSync(target)!==target)throw new Error('Unsafe quarantine directory.');
 const moved=[];
 for(const entry of plan.files.filter(f=>f.quarantineCandidate)){
  if(!wav.test(entry.name)||entry.referenced)throw new Error('Unexpected quarantine member.');
  const source=path.resolve(root,entry.name),destination=path.resolve(target,entry.name);
  if(path.dirname(source)!==root||path.dirname(destination)!==target)throw new Error('Quarantine path escapes media directory.');
  const stat=fs.lstatSync(source);if(stat.isSymbolicLink()||!stat.isFile()||stat.mtimeMs!==entry.mtimeMs||stat.size!==entry.bytes||checksum(fs.readFileSync(source))!==entry.sha256)throw new Error('Media changed since audit; restart maintenance.');
  if(fs.existsSync(destination))throw new Error('Quarantine destination already exists.');fs.renameSync(source,destination);moved.push(entry.name);
 }
 return {moved,quarantineDirectory:target};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),value=name=>args[args.indexOf(name)+1];
 if(!args.includes('--source'))throw new Error('Provide --source pointing to the explicit designs data directory.');
 const source=path.resolve(value('--source'));let assets,snapshots;
 if(args.includes('--mysql')){
  const client=new MySqlClient();
  try{
   [assets]=await client.execute('SELECT id,storage_key AS storageKey FROM design_assets');snapshots=[];
   for(const [table,column]of [['designs','document'],['design_versions','document'],['gifts','payload'],['templates','payload']]){
    const [rows]=await client.execute(`SELECT ${column} value FROM ${table}`);for(const r of rows)snapshots.push(typeof r.value==='string'?JSON.parse(r.value):r.value);
   }
  }finally{await client.close();}
 }else{const state=JSON.parse(fs.readFileSync(path.join(source,'canvas.json'),'utf8'));assets=Object.values(state.assets);snapshots=[state];}
 const plan=auditAudioMedia({mediaRoot:path.join(source,'assets'),assets,snapshots});
 const result=args.includes('--quarantine')?quarantineAudioOrphans(plan,{offline:args.includes('--offline')}):plan;
 console.log(JSON.stringify(result,null,2));
}
