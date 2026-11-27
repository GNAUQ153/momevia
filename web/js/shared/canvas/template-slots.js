import { signatureTemplateIds } from './signature/templates.js';
import { ORIGINAL_IDS } from './originals-data.js';
// Semantic role IDs are independent of locale, scene order, position and name.
import {EVENT_ARTWORK_LABEL,ORIGINAL_ARTWORK_LABEL,REALISTIC_ARTWORK_LABEL,NATURAL_ARTWORK_LABEL} from './event-media.js';
import {canonicalStringify} from './schema.js';
// This pilot opens only the two birthday paper compositions with the same graph.
export {RESTYLE_PAIRS} from './restyle-pairs.js';
export const SEMANTIC_TEMPLATE_IDS=['sunny-wishes','confetti','hai-phong-bi','birthday-radiance','proud-of-you','loi-moi-ben-hien','cuon-phim-ngay-ay','ban-do-ngay-ra-truong', ...ORIGINAL_IDS, ...signatureTemplateIds];
export function captureSemanticRoles(doc, previous = {}, remap = new Map()) {
 const inverse=new Map(Object.entries(previous).map(([role,id])=>[id,role]));
 return Object.fromEntries(doc.elements.map(e=>[inverse.get(e.id)||e.id,remap.get(e.id)||e.id]));
}
export function semanticSlots(doc, elementRoles = {}) {
 const roleFor=new Map(Object.entries(elementRoles).map(([role,id])=>[id,role]));
 const slots=Object.keys(doc.bindings).map(key=>({role:`binding:${key}`,kind:'binding',key}));
 for(const e of doc.elements){
  const role=roleFor.get(e.id)||e.id;
  if(e.type==='text' && !e.props.textBinding)slots.push({role:`text:${role}`,kind:'text',elementId:e.id});
  if(e.type==='image')slots.push({role:`photo:${role}`,kind:'image',elementId:e.id});
  if(['button','envelope','gift-box'].includes(e.type))slots.push({role:`label:${role}`,kind:'label',elementId:e.id});
  if(e.type==='interaction'){
   for(const [i,p] of (e.props.photos||[]).entries())slots.push({role:`album:${role}:${p.id}`,kind:'photo',elementId:e.id,index:i,photoId:p.id});
   for(const [i] of (e.props.entries||[]).entries())slots.push({role:`entry:${role}:${i}`,kind:'entry',elementId:e.id,index:i});
   if(e.props.kind==='event-countdown')slots.push({role:`clock:${role}`,kind:'clock',elementId:e.id});
  }
 }
 return slots;
}
const find=(doc,s)=>s.kind==='binding'?doc.bindings[s.key]:doc.elements.find(e=>e.id===s.elementId);
export function mapTemplateSlots(source, sourceDefault, target, { sourceRoles = {},builtinAssetAliases={} } = {}) {
 const result=structuredClone(target), from=semanticSlots(source,sourceRoles), available=new Map(semanticSlots(result).map(s=>[s.role,s])), defaults=new Map(semanticSlots(sourceDefault).map(s=>[s.role,s]));
 const carried=[],missing=[];
 for(const slot of from){
  const s=find(source,slot),d=defaults.get(slot.role),original=d&&find(sourceDefault,d),to=available.get(slot.role);
  if(slot.kind==='image'&&original?.type==='image'&&original.accessibility.decorative&&[EVENT_ARTWORK_LABEL,ORIGINAL_ARTWORK_LABEL,REALISTIC_ARTWORK_LABEL,NATURAL_ARTWORK_LABEL].includes(original.accessibility.label)){
   const alias=builtinAssetAliases[s.props.assetId],assetId=Array.isArray(alias)?alias.includes(original.props.assetId)?original.props.assetId:s.props.assetId:alias||s.props.assetId;
   const normalized={...s.props,assetId};
   if(canonicalStringify(normalized)===canonicalStringify(original.props)&&s.accessibility.decorative&&s.accessibility.label===original.accessibility.label)continue;
  }
  const value=slot.kind==='binding'?s.value:slot.kind==='text'?s.props.text:slot.kind==='label'?s.props.label:slot.kind==='image'?s.props:slot.kind==='photo'?s.props.photos[slot.index]:slot.kind==='entry'?s.props.entries[slot.index]:{eventAt:s.props.eventAt,timeZone:s.props.timeZone,clockMode:s.props.clockMode};
  const baseline=slot.kind==='binding'?'':slot.kind==='text'?original?.props.text:slot.kind==='label'?original?.props.label:slot.kind==='image'?original?.props:slot.kind==='photo'?original?.props.photos[slot.index]:slot.kind==='entry'?original?.props.entries[slot.index]:original&&{eventAt:original.props.eventAt,timeZone:original.props.timeZone,clockMode:original.props.clockMode};
  if(!to){if(JSON.stringify(value)!==JSON.stringify(baseline))missing.push(slot.role);continue;}
  const dest=find(result,to);
  if(slot.kind==='binding')dest.value=s.value;
  else if(slot.kind==='text')dest.props.text=s.props.text;
  else if(slot.kind==='label'){dest.props.label=s.props.label;dest.accessibility.label=s.props.label;}
  else if(slot.kind==='image'){Object.assign(dest.props,structuredClone(s.props));dest.accessibility=structuredClone(s.accessibility);}
  else if(slot.kind==='photo')Object.assign(dest.props.photos[to.index],structuredClone(s.props.photos[slot.index]),{id:to.photoId});
  else if(slot.kind==='entry')dest.props.entries[to.index]=structuredClone(s.props.entries[slot.index]);
  else Object.assign(dest.props,value);
  carried.push(slot.role);
 }
 const refs=new Set(result.elements.flatMap(e=>e.type==='image'?[e.props.assetId]:e.props.photos?.map(p=>p.assetId)||[]).filter(Boolean));
 result.assets=[...refs].map(assetId=>({assetId,kind:'image'}));
 return {document:result,carried,missing};
}
