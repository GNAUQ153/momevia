import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,createElement} from '../../web/js/shared/canvas/index.js';
import {copyElements,pasteElements,removeElements,copiedElementId} from '../../web/js/features/canvas-editor/clipboard.js';
import {applyFabricCommands,applyFabricWorkspacePatch} from '../../web/js/features/canvas-editor/fabric-workspace.js';
function sample(){const doc=createDocument();doc.schemaVersion=doc.registryVersion=2;doc.elements=[createElement('shape',{id:'photo-window'}),createElement('image',{id:'photo-window-image',props:{assetId:'owned-photo'}}),createElement('text',{id:'protected',props:{text:'Locked'}})];doc.assets=[{assetId:'owned-photo',kind:'image'}];doc.scenes[0].elementIds=doc.elements.map(e=>e.id);return doc;}
test('clipboard duplicates complete frames with new IDs and shared owned media without mutating originals',()=>{
 const doc=sample(),before=structuredClone(doc),clip=copyElements(doc,['photo-window'],'owner:design',{});assert.equal(clip.models.length,2);let n=0;
 const result=pasteElements(doc,doc.entrySceneId,clip,'owner:design',()=>`copy-${++n}`);assert.equal(result.ids.length,2);assert(result.ids.includes(result.ids[0]+'-image'));assert.deepEqual(result.document.assets,doc.assets);assert.deepEqual(doc,before);
 const cut=removeElements(doc,['photo-window'],{});assert.equal(cut.elements.length,1);assert.equal(pasteElements(cut,cut.entrySceneId,clip,'owner:design',()=>`new-${++n}`).document.elements.length,3);
});
test('clipboard does not cross design scopes or bypass protected or Creator layers',()=>{
 const doc=sample(),policy={lockedElements:{protected:true}};
 const clip=copyElements(doc,['protected','photo-window'],'A',policy);assert(!clip.models.some(e=>e.id==='protected'));
 assert.equal(pasteElements(doc,doc.entrySceneId,clip,'B',()=> 'new').ids.length,0);assert(removeElements(doc,['protected'],policy).elements.some(e=>e.id==='protected'));
 assert.equal(copyElements(doc,doc.scenes[0].elementIds,'A',{kind:'creator-template'}).models.length,0);
});
test('copied stationery retains its reply-paper role without giving stock decorations that role',()=>{
 assert.equal(copiedElementId('reply-object-paper',()=> 'new-id'),'reply-object-paper-new-id');assert.equal(copiedElementId('reply-object-paper-old',()=> 'new-id'),'reply-object-paper-new-id');assert.equal(copiedElementId('stock-heart',()=> 'new-id'),'new-id');
});
test('Fabric structural keyboard commands preserve assets and enforce policy before applying',()=>{
 const doc=sample(),commands=[{type:'clone',sourceId:'photo-window-image',id:'clone-photo'},{type:'remove',id:'photo-window-image'},{type:'clone',sourceId:'photo-window-image',id:'pasted-photo'}];
 const next=applyFabricCommands(doc,doc.entrySceneId,commands);assert.deepEqual(next.assets,doc.assets);assert(next.elements.some(e=>e.id==='pasted-photo'));
 assert.throws(()=>applyFabricCommands(doc,doc.entrySceneId,[{type:'remove',id:'protected'}],{lockedElements:{protected:true}}));
 assert.throws(()=>applyFabricCommands(doc,doc.entrySceneId,[{type:'clone',sourceId:'protected',id:'unlocked'}],{kind:'creator-template'}));
 assert.throws(()=>applyFabricCommands(doc,doc.entrySceneId,[{type:'clone',sourceId:'protected',id:'protected'}]));
 const result=applyFabricWorkspacePatch(doc,doc.entrySceneId,{commands,order:next.scenes[0].elementIds,visibility:{},layouts:[],styles:[]});assert.deepEqual(result,next);
});
