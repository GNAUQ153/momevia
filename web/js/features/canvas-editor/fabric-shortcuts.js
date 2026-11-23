import {isQuickbarTypingTarget} from './fabric-quickbar.js';
export function mountFabricShortcuts({dialog,canvas,fabric,canEdit,onCommand,getState,restoreState,refresh,onSave,onCloneStyle,signal}){
 let clipboard=[],busy=false,restoring=false;const history=[],future=[];
 const props=()=>[...new Set(['momeviaFillBinding',...canvas.getObjects().flatMap(o=>Object.keys(o).filter(k=>k.startsWith('momevia')))])];
 const selection=()=>canvas.getActiveObjects().filter(o=>canEdit(o.momeviaId));
 function state(){const objects=selection(),multiple=objects.length>1;if(multiple)canvas.discardActiveObject();const result={json:canvas.toObject(props()),meta:getState(),selected:objects.map(o=>o.momeviaId)};if(multiple)select(objects);return result;}
 function capture(){if(busy||restoring||signal.aborted)return;const next=state(),previous=history.at(-1);if(previous&&JSON.stringify([previous.json,previous.meta])===JSON.stringify([next.json,next.meta]))return;history.push(next);if(history.length>61)history.shift();future.length=0;}
 function select(objects){canvas.discardActiveObject();if(objects.length===1)canvas.setActiveObject(objects[0]);else if(objects.length)canvas.setActiveObject(new fabric.ActiveSelection(objects,{canvas}));canvas.requestRenderAll();}
 async function restore(next){
  restoring=true;try{canvas.discardActiveObject();await canvas.loadFromJSON(next.json,undefined,{signal});if(signal.aborted)return;restoreState(next.meta);select(canvas.getObjects().filter(o=>next.selected.includes(o.momeviaId)));refresh();}finally{restoring=false;}
 }
 async function run(event){
  if(event.defaultPrevented||busy||restoring||signal.aborted||event.isComposing||isQuickbarTypingTarget(event.target)||canvas.getActiveObject()?.isEditing)return;
  const chord=event.ctrlKey||event.metaKey,key=event.key.toLowerCase(),remove=['Delete','Backspace'].includes(event.key);
  const groupMove=!chord&&!event.altKey&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)&&selection().length>1;
  if(!remove&&!groupMove&&!(chord&&!event.altKey&&['c','x','v','d','a','z','y','s'].includes(key)))return;
  event.preventDefault();event.stopPropagation();busy=true;
  try{
   if(chord&&key==='s'){busy=false;onSave();return;}
   if(chord&&key==='z'){
    if(event.shiftKey){const next=future.pop();if(next){history.push(next);await restore(next);}}
    else if(history.length>1){future.push(history.pop());await restore(history.at(-1));}return;
   }
   if(chord&&key==='y'){const next=future.pop();if(next){history.push(next);await restore(next);}return;}
   if(chord&&key==='a'){select(canvas.getObjects().filter(o=>canEdit(o.momeviaId)));return;}
   const selected=selection();canvas.discardActiveObject();
   if(groupMove){const step=event.shiftKey?10:1;for(const object of selected){object.set({left:object.left+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0),top:object.top+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0)});object.setCoords();}select(selected);refresh();return;}
   if(chord&&['c','x'].includes(key)){
    for(const entry of clipboard)entry.object.dispose?.();clipboard=[];for(const object of selected){const copy=await object.clone(props());Object.assign(copy,Object.fromEntries(Object.entries(object).filter(([k])=>k.startsWith('momevia'))));clipboard.push({sourceId:object.momeviaId,object:copy,style:getState().styles.find(([id])=>id===object.momeviaId)?.[1]||[]});}
   }
   if(remove||(chord&&key==='x'))for(const object of selected){onCommand({type:'remove',id:object.momeviaId});canvas.remove(object);object.dispose?.();}
   if(chord&&['v','d'].includes(key)){
    const sources=key==='d'?selected.map(object=>({sourceId:object.momeviaId,object,style:getState().styles.find(([id])=>id===object.momeviaId)?.[1]||[]})):clipboard,added=[];
    for(const entry of sources){const copy=await entry.object.clone(props());if(signal.aborted){copy.dispose?.();return;}const id=globalThis.crypto.randomUUID();Object.assign(copy,Object.fromEntries(Object.entries(entry.object).filter(([k])=>k.startsWith('momevia'))));copy.momeviaId=id;copy.set({left:entry.object.left+16,top:entry.object.top+16});copy.setCoords();onCommand({type:'clone',sourceId:entry.sourceId,id});onCloneStyle(id,entry.style);canvas.add(copy);added.push(copy);}select(added);
   }else if(!remove&&key!=='x')select(selected);
   refresh();
  }finally{busy=false;capture();}
 }
 const handler=event=>{void run(event).catch(error=>{if(!signal.aborted)dialog.dispatchEvent(new CustomEvent('fabric-shortcut-error',{detail:error.message}));});};
 const changed=()=>capture(),clicked=event=>{if(event.target.closest('[data-editor-action^="fabric-layer-"],[data-editor-action^="fabric-batch-"]'))queueMicrotask(capture);};
 dialog.addEventListener('keydown',handler,{signal});dialog.addEventListener('click',clicked,{signal});canvas.on('object:modified',changed);capture();
 signal.addEventListener('abort',()=>{canvas.off('object:modified',changed);for(const e of clipboard)e.object.dispose?.();clipboard=[];},{once:true});
 return {capture,get busy(){return busy||restoring;}};
}
