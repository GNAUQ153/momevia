import {createHash}from'node:crypto';
import{canonicalStringify}from'../../../web/js/shared/canvas/schema.js';
import{driveElementCards}from'../../../web/js/shared/canvas/drive-elements.js';
import{DRIVE_TEMPLATE_META}from'../../../web/js/shared/canvas/drive-templates.js';
import{validateLibrary}from'./library.service.mjs';

const key=row=>`${row.kind}:${row.id}`;
export const driveFingerprint=row=>row?createHash('sha256').update(canonicalStringify(row)).digest('hex'):null;
export const DRIVE_LIBRARY_KEYS=Object.freeze([...driveElementCards().map(c=>'element:'+c.id),...['garden-tea',...DRIVE_TEMPLATE_META.map(t=>t.id)].map(id=>'template:'+id)]);
export const PAPER_LIBRARY_KEYS=Object.freeze(['element:foldout-letter','element:swipe-album','element:scratch-ticket','element:drive-tear-ticket',...['garden-tea',...DRIVE_TEMPLATE_META.map(t=>t.id)].map(id=>'template:'+id)]);
const bundleKeys=bundle=>bundle?.id==='tactile-paper-20261128-v1'?PAPER_LIBRARY_KEYS:bundle?.id==='drive-six-20261127-v1'?DRIVE_LIBRARY_KEYS:null;
const sameDefinition=(a,b)=>a&&b&&a.status===b.status&&canonicalStringify(a.definition)===canonicalStringify(b.definition);
// The reviewed export is explicit input. Never treat a current Admin row as an approved baseline.
export function buildDriveLibraryRollout(reviewed,desired,{scope='drive'}={}){
 if(!['drive','paper'].includes(scope))throw Error('Invalid rollout scope');const keys=scope==='paper'?PAPER_LIBRARY_KEYS:DRIVE_LIBRARY_KEYS;
 const changes=keys.map(id=>{
  const source=desired.find(r=>key(r)===id);if(!source)throw new Error('Missing reviewed Drive item '+id);
  const before=reviewed.find(r=>key(r)===id)||null;
  return {before:structuredClone(before),expectedFingerprint:driveFingerprint(before),next:{...structuredClone(source),revision:(before?.revision||0)+1,sortOrder:before?.sortOrder??source.sortOrder}};
 });return {formatVersion:1,id:scope==='paper'?'tactile-paper-20261128-v1':'drive-six-20261127-v1',changes};
}
function validateBundle(bundle){
 const keys=bundleKeys(bundle);if(bundle?.formatVersion!==1||!keys||bundle.changes?.length!==keys.length)throw new Error('Invalid Drive rollout scope');
 const seen=new Set();for(const c of bundle.changes){const id=key(c.next);if(!keys.includes(id)||seen.has(id)||c.before&&key(c.before)!==id||c.expectedFingerprint!==driveFingerprint(c.before)||c.next.revision!==(c.before?.revision||0)+1)throw new Error('Invalid reviewed Drive baseline');seen.add(id);}
}
export function planDriveLibraryRollout(rows,bundle,{rollback=false}={}){
 validateBundle(bundle);
 const changes=rollback?[...bundle.changes].reverse():bundle.changes;
 const actions=changes.map(c=>{
  const current=rows.find(r=>key(r)===key(c.next))||null;
  const expected=rollback?c.next:c.before;
  const target=rollback?{...c.next,revision:c.next.revision+1,...(c.before?{definition:c.before.definition,status:c.before.status,sortOrder:c.before.sortOrder}:{status:'disabled'})}:c.next;
  const status=driveFingerprint(current)===driveFingerprint(target)?'unchanged':!rollback&&sameDefinition(current,c.next)&&current.revision>=c.next.revision?'unchanged':driveFingerprint(current)===driveFingerprint(expected)?'ready':'conflict';
  return {key:key(c.next),status,current,target};
 });
 const proposed=structuredClone(rows);for(const a of actions)if(a.status==='ready'){const index=proposed.findIndex(r=>key(r)===a.key);if(index<0)proposed.push(a.target);else proposed[index]=a.target;}
 let dependencyError;try{validateLibrary(proposed);}catch(e){dependencyError=e.message;}
 return {canApply:!dependencyError&&!actions.some(a=>a.status==='conflict'),actions,dependencyError};
}
export async function applyDriveLibraryRollout(service,user,bundle,options={}){
 const preview=planDriveLibraryRollout(await service.rows(),bundle,options);if(!preview.canApply)return{...preview,applied:[]};
 const applied=[];for(const action of preview.actions){if(action.status!=='ready')continue;
  // Re-read before each write: a concurrent edit never becomes an implicit new baseline.
  const current=(await service.rows()).find(r=>key(r)===action.key)||null;if(driveFingerprint(current)!==driveFingerprint(action.current))return{canApply:false,applied,conflict:action.key};
  await service.put(user,action.target.kind,action.target.id,{expectedRevision:current?.revision||0,status:action.target.status,sortOrder:action.target.sortOrder,definition:action.target.definition});applied.push(action.key);
 }return{...preview,applied};
}
