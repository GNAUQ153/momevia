import {assetIds,validateDocument} from '../../shared/canvas/schema.js';
export const editableElement=(e,policy)=>Boolean(e&&!e.locked&&!policy?.lockedElements?.[e.id]&&policy?.kind!=='creator-template');
export const copiedElementId=(sourceId,newId)=>sourceId==='reply-object-paper'||sourceId.startsWith('reply-object-paper-')?'reply-object-paper-'+newId():newId();
export function editableSelection(elements, ids, policy) {
 const selected = new Set(ids);
 const groups = new Set(elements.filter(item => item.groupId && selected.has(item.id)).map(item => item.groupId));
 const protectedGroups = new Set(elements.filter(item => item.groupId && !editableElement(item, policy)).map(item => item.groupId));
 return elements.filter(item => (selected.has(item.id) || groups.has(item.groupId)) &&
   !protectedGroups.has(item.groupId) && editableElement(item, policy));
}
export function copyElements(document,ids,scope,policy){
 const selected=editableSelection(document.elements,ids,policy).map(item=>item.id);
 const models=editableSelection(document.elements,[...selected,...selected.map(id=>id+'-image')],policy);
 const copied=new Set(models.map(e=>e.id)),used=new Set(assetIds({elements:models}));
 const order=document.scenes.flatMap(scene=>scene.elementIds.filter(id=>copied.has(id)));
 return {scope,models:structuredClone(models),order,assets:structuredClone(document.assets.filter(a=>used.has(a.assetId)))};
}
export function pasteElements(document,sceneId,clipboard,scope,newId,offset=16){
 if(!clipboard||clipboard.scope!==scope||!clipboard.models.length)return {document,ids:[]};
 const next=structuredClone(document),scene=next.scenes.find(s=>s.id===sceneId);if(!scene)throw new Error('Missing paste scene');
 const ids=new Map(clipboard.models.map(e=>[e.id,copiedElementId(e.id,newId)]));for(const e of clipboard.models)if(e.id.endsWith('-image')&&ids.has(e.id.slice(0,-6)))ids.set(e.id,ids.get(e.id.slice(0,-6))+'-image');
 const models=structuredClone(clipboard.models);for(const e of models){e.id=ids.get(e.id);if(e.groupId)e.groupId=ids.get(e.groupId);e.layout.x+=offset;e.layout.y+=offset;}
 next.elements.push(...models);scene.elementIds.push(...(clipboard.order||[...ids.keys()]).map(id=>ids.get(id)));for(const a of clipboard.assets)if(!next.assets.some(r=>r.assetId===a.assetId))next.assets.push(a);
 return {document:validateDocument(next),ids:models.map(e=>e.id)};
}
export function removeElements(document,ids,policy){
 const copy=copyElements(document,ids,'remove',policy),remove=new Set(copy.models.map(e=>e.id)),next=structuredClone(document);
 next.elements=next.elements.filter(e=>!remove.has(e.id));for(const scene of next.scenes)scene.elementIds=scene.elementIds.filter(id=>!remove.has(id));return validateDocument(next);
}
