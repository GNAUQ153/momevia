import { CANDLE_SKINS } from '../../../web/js/shared/canvas/candle-skins.js';
import { builtinMedia } from './builtin-media.mjs';
import { createHash } from 'node:crypto';
import { canonicalStringify } from '../../../web/js/shared/canvas/schema.js';
import { validateLibrary } from './library.service.mjs';
import { REFRESH_21 } from '../../../web/js/shared/canvas/refresh-21-config.js';
import {NATURAL_ELEMENT_SPECS,NATURAL_COMPOSITION_IDS} from '../../../web/js/shared/canvas/natural-elements.js';
const fingerprint=row=>createHash('sha256').update(canonicalStringify(row)).digest('hex');
const key=row=>`${row.kind}:${row.id}`;
const state=row=>row?{status:row.status,sortOrder:row.sortOrder,definition:row.definition}:null;
export function validateRollout(bundle){
 const refresh=bundle?.id==='template-refresh-21-20261123-v1';
 const natural=['template-refresh-natural-20261123-v2','template-refresh-natural-20261123-v2-from-vector-v1'].includes(bundle?.id);
 const external=bundle?.id==='natural-open-elements-20261123-v1';
 const motion=bundle?.id==='natural-motion-loop-20261123-v1';
 if(bundle?.formatVersion!==1 || (!refresh&&!natural&&!external&&!motion&&bundle.id!=='interactive-cards-20261122-v1') || !Array.isArray(bundle.changes) || bundle.changes.length>(motion?6:external?12:natural?75:refresh?45:32))throw new Error('Unsupported library update');
 const naturalIds=new Set([...NATURAL_ELEMENT_SPECS.map(s=>'natural-'+s[0]),...NATURAL_COMPOSITION_IDS]);
 if(motion)for(const change of bundle.changes){
  if(change.next.kind!=='element'||!NATURAL_ELEMENT_SPECS.some(s=>s[1]==='animation'&&change.next.id==='natural-'+s[0]))throw new Error('Unreviewed motion element');
  if(!change.before||change.expectedRevision!==change.before.revision||change.expectedFingerprint!==fingerprint(change.before))throw new Error('Motion baseline fingerprint required');
 }
 if(external)for(const change of bundle.changes){
  if(change.next.kind!=='element'||!change.next.id.startsWith('natural-open-')||!naturalIds.has(change.next.id))throw new Error('Unreviewed external element');
  if(change.expectedRevision!==(change.before?.revision||0)||change.expectedFingerprint!==(change.before?fingerprint(change.before):null))throw new Error('External element baseline fingerprint required');
 }
 if(refresh||natural)for(const change of bundle.changes){
  const {kind,id}=change.next;
  if(!(kind==='template'&&Object.hasOwn(REFRESH_21,id)||kind==='element'&&(['flowers','leaves','stars'].includes(id)||id.startsWith('object-')&&Object.hasOwn(REFRESH_21,id.slice(7))||natural&&naturalIds.has(id))||natural&&['animation','effect'].includes(kind)&&id==='paper-unfold-natural-v1'))throw new Error('Refresh update outside the reviewed 21-template scope');
  if(change.expectedRevision!==(change.before?.revision||0))throw new Error('Refresh expectedRevision required');
  if(change.expectedFingerprint!==(change.before?fingerprint(change.before):null))throw new Error('Refresh baseline fingerprint required');
 }
 const keys=new Set();for(const change of bundle.changes){if(keys.has(key(change.next)))throw new Error('Duplicate library change');keys.add(key(change.next));if(change.before && key(change.before)!==key(change.next))throw new Error('Library identity changed');if(change.next.revision!==(change.before?.revision||0)+1)throw new Error('Invalid update revision');}
 for(const {next} of bundle.changes) if(next.kind==='template') for(const doc of Object.values(next.definition.documents)) for(const ref of doc.assets){const media=builtinMedia(ref.assetId);if(!media || media.previewOnly)throw new Error('Update requires distributable immutable artwork');}
 for(const {next} of bundle.changes)if(next.kind==='template')for(const doc of Object.values(next.definition.documents))for(const element of doc.elements){const skin=CANDLE_SKINS[element.props.appearance];if(skin&&(!builtinMedia(skin.bodyId)||!builtinMedia(skin.flameId)))throw new Error('Candle skin dependencies unavailable');}
 return bundle;
}
export function previewRollout(rows,bundle,{rollback=false}={}){
 validateRollout(bundle);
 const items=rollback?bundle.changes.slice().reverse():bundle.changes;
 const actions=items.map(change=>{
  const current=rows.find(r=>key(r)===key(change.next));
  const expected=rollback?change.next:change.before;
  const target=rollback?{...change.next,revision:change.next.revision+1,...(change.before?state(change.before):{status:'disabled'})}:change.next;
  const completed=current && fingerprint(current)===fingerprint(target);
  const matches=expected?current && fingerprint(current)===fingerprint(expected):!current;
  return {key:key(change.next),status:completed?'unchanged':matches?'ready':'conflict',current:current||null,expected,target};
 });
 const proposed=rows.slice();for(const a of actions.filter(a=>a.status==='ready')){const i=proposed.findIndex(r=>key(r)===a.key);if(i<0)proposed.push(a.target);else proposed[i]=a.target;}
 let dependencyError;try{validateLibrary(proposed);}catch(error){dependencyError=error.message;}
 return {bundleId:bundle.id,rollback,actions,dependencyError,canApply:!dependencyError&&!actions.some(a=>a.status==='conflict')};
}
export async function applyRollout(service,user,bundle,{rollback=false,stopAfter=Infinity}={}){
 const preview=previewRollout(await service.rows(),bundle,{rollback});
 if(!preview.canApply)return {...preview,applied:[]};
 const applied=[];
 for(const action of preview.actions){
  if(action.status!=='ready')continue;
  if(applied.length>=stopAfter)return {...preview,applied,interrupted:true};
  try{
   // put locks the dependency graph, validates it again, uses CAS, and writes history.
   await service.put(user,action.target.kind,action.target.id,{expectedRevision:action.expected?.revision||0,...state(action.target)});
   applied.push(action.key);
  }catch(error){return {...preview,applied,conflict:{key:action.key,code:error.code,message:error.message}};}
 }
 return {...preview,applied,interrupted:false};
}
