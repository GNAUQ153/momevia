import {assetIds,validateDocument} from '../../shared/canvas/schema.js';
export const editableElement=(e,policy)=>Boolean(e&&!e.locked&&!policy?.lockedElements?.[e.id]&&policy?.kind!=='creator-template');
export function copyElements(document,ids,scope,policy){
 const selected=new Set(ids.filter(id=>editableElement(document.elements.find(e=>e.id===id),policy)));
 for(const id of [...selected])if(document.elements.some(e=>e.id===id+'-image'&&editableElement(e,policy)))selected.add(id+'-image');
 const models=document.elements.filter(e=>selected.has(e.id)),used=new Set(assetIds({elements:models}));
 return {scope,models:structuredClone(models),assets:structuredClone(document.assets.filter(a=>used.has(a.assetId)))};
}
export function pasteElements(document,sceneId,clipboard,scope,newId,offset=16){
 if(!clipboard||clipboard.scope!==scope||!clipboard.models.length)return {document,ids:[]};
 const next=structuredClone(document),scene=next.scenes.find(s=>s.id===sceneId);if(!scene)throw new Error('Missing paste scene');
 const ids=new Map(clipboard.models.map(e=>[e.id,newId()]));for(const e of clipboard.models)if(e.id.endsWith('-image')&&ids.has(e.id.slice(0,-6)))ids.set(e.id,ids.get(e.id.slice(0,-6))+'-image');
 const models=structuredClone(clipboard.models);for(const e of models){e.id=ids.get(e.id);e.layout.x+=offset;e.layout.y+=offset;}
 next.elements.push(...models);scene.elementIds.push(...models.map(e=>e.id));for(const a of clipboard.assets)if(!next.assets.some(r=>r.assetId===a.assetId))next.assets.push(a);
 return {document:validateDocument(next),ids:models.map(e=>e.id)};
}
export function removeElements(document,ids,policy){
 const copy=copyElements(document,ids,'remove',policy),remove=new Set(copy.models.map(e=>e.id)),next=structuredClone(document);
 next.elements=next.elements.filter(e=>!remove.has(e.id));for(const scene of next.scenes)scene.elementIds=scene.elementIds.filter(id=>!remove.has(id));return validateDocument(next);
}
