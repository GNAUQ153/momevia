import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {materializeInsertionMedia} from '../../web/js/features/canvas-editor/natural-insert.js';
import {NATURAL_MEDIA_IDS} from '../../web/js/shared/canvas/natural-media.js';
import {EVENT_MEDIA,eventMediaUrl,NATURAL_ARTWORK_LABEL} from '../../web/js/shared/canvas/event-media.js';
import {createElement} from '../../web/js/shared/canvas/registry.js';
import {createDocument} from '../../web/js/shared/canvas/presets.js';
import {mapTemplateSlots} from '../../web/js/shared/canvas/template-slots.js';
import {builtinMedia} from '../../src/modules/designs/builtin-media.mjs';
const id=NATURAL_MEDIA_IDS['element-3d-heart'];
const bytes=()=>fs.readFileSync(new URL('../../web/assets/event-cards/'+EVENT_MEDIA[id].file,import.meta.url));
const model=()=>createElement('image',{id:'heart',props:{assetId:id,fit:'contain',radius:0},accessibility:{decorative:true,label:NATURAL_ARTWORK_LABEL}});
test('library insertion verifies bytes, deduplicates refs, preserves models and caches only per design',async()=>{
 const original=[model(),{...model(),id:'second'}],copy=structuredClone(original),uploads=[],cache=new Map();let reads=0;
 const options={namespace:'design-A',cache,fetchMedia:async url=>{assert.equal(url,eventMediaUrl(id));reads++;return new Response(bytes());},upload:async(blob,mutationId)=>{assert.equal(blob.type,'image/webp');uploads.push(mutationId);return{id:'private-asset',status:'ready'};}};
 const first=await materializeInsertionMedia(original,options);assert.deepEqual(original,copy);assert.equal(uploads.length,1);assert.deepEqual(first.assets,[{assetId:'private-asset',kind:'image'}]);assert(first.models.every(e=>e.props.assetId==='private-asset'));
 const second=await materializeInsertionMedia(original,options);assert.deepEqual(second.assets,first.assets);assert.equal(reads,1);
 await materializeInsertionMedia(original,{...options,cache:new Map()});assert.equal(uploads[1],uploads[0],'a lost ACK/reload uses the same upload mutation');
 await materializeInsertionMedia(original,{...options,namespace:'design-B'});assert.notEqual(uploads.at(-1),uploads[0],'asset identities cannot leak into another draft');
});
test('untrusted, preview-only, corrupt and aborted media never reaches upload',async()=>{
 let uploads=0,fetches=0;const options={fetchMedia:async()=>{fetches++;return new Response(new Uint8Array([0,1,2]));},upload:async()=>{uploads++;return{id:'bad',status:'ready'};}};
 for(const assetId of ['constructor','__proto__','https://bad.example/x.webp',Object.keys(EVENT_MEDIA).find(k=>EVENT_MEDIA[k].previewOnly)])await assert.rejects(materializeInsertionMedia([{...model(),props:{...model().props,assetId}}],options));
 assert.equal(fetches,0);await assert.rejects(materializeInsertionMedia([model()],options),/integrity/);assert.equal(uploads,0);
 const controller=new AbortController();controller.abort();await assert.rejects(materializeInsertionMedia([model()],{...options,signal:controller.signal}),e=>e.name==='AbortError');assert.equal(uploads,0);
 assert.equal(builtinMedia('constructor'),null);assert.equal(eventMediaUrl('__proto__'),undefined);
});
test('restyle changes verified default art but preserves replacements and reports extra stock graphics',()=>{
 const source=createDocument({template:{id:'sunny-wishes'}}),target=createDocument({template:{id:'confetti'}}),baseline=structuredClone(source),main=source.elements.find(e=>e.id==='cover-object-natural-art'),originalId=main.props.assetId;
 for(const e of source.elements)if(e.type==='image'&&e.props.assetId===originalId)e.props.assetId='private-default';source.assets=source.assets.map(a=>a.assetId===originalId?{...a,assetId:'private-default'}:a);
 const aliases={builtinAssetAliases:{'private-default':[originalId]}},result=mapTemplateSlots(source,baseline,target,aliases);assert.equal(result.document.elements.find(e=>e.id===main.id).props.assetId,target.elements.find(e=>e.id===main.id).props.assetId);
 main.props.assetId='private-personal';source.assets.push({assetId:'private-personal',kind:'image'});
 const replaced=mapTemplateSlots(source,baseline,target,aliases);assert.equal(replaced.document.elements.find(e=>e.id===main.id).props.assetId,'private-personal');assert(replaced.carried.includes('photo:'+main.id));
 assert.equal(replaced.document.elements.find(e=>e.id==='keepsake-natural-art').props.assetId,target.elements.find(e=>e.id==='keepsake-natural-art').props.assetId);
 const extra=model();extra.id='sender-added-heart';source.elements.push(extra);source.scenes[0].elementIds.push(extra.id);source.assets.push({assetId:id,kind:'image'});
 assert(mapTemplateSlots(source,baseline,target,aliases).missing.includes('photo:sender-added-heart'));
});
