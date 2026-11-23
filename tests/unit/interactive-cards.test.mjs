import { validateAnimation } from '../../web/js/shared/canvas/library-contract.js';
import { applyRecipeSurface } from '../../web/js/features/gift-runtime/recipe-runtime.js';
import { createMotion } from '../../web/js/features/gift-runtime/effects.js';
import { templates } from '../../src/modules/catalog/seed.mjs';
import { publicTemplate } from '../../src/modules/catalog/catalog.service.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash,randomUUID } from 'node:crypto';
import { createDocument,templatePreviewDocument } from '../../web/js/shared/canvas/presets.js';
import { validateDocument,publicDocument,canonicalStringify,duplicateDocument } from '../../web/js/shared/canvas/schema.js';
import { createElement } from '../../web/js/shared/canvas/registry.js';
import { effectsFor } from '../../web/js/shared/canvas/effects.js';
import { eventRecipe } from '../../web/js/shared/canvas/event-recipes.js';
import { semanticSlots,mapTemplateSlots,RESTYLE_PAIRS,captureSemanticRoles } from '../../web/js/shared/canvas/template-slots.js';
import { serverText } from '../../src/shared/locale.mjs';
import { previewRollout,applyRollout } from '../../src/modules/designs/library-rollout.mjs';
import { JsonDesignRepository } from '../../src/modules/designs/json.repository.mjs';
import { materializeBuiltinMedia } from '../../src/modules/designs/builtin-media.mjs';
import os from 'node:os';
import path from 'node:path';
const ids=['hai-phong-bi','birthday-radiance','proud-of-you','loi-moi-ben-hien','cuon-phim-ngay-ay','ban-do-ngay-ra-truong'];
test('six complete bilingual originals validate; private slots stay empty and names are real bindings',()=>{
 for(const id of ids)for(const locale of ['vi','en']){
  const localize=(key,params)=>serverText(locale,key,params),d=createDocument({template:{id},localize});
  assert.deepEqual(createDocument({template:{id},localize}),d);assert.equal(new Set(d.elements.map(e=>e.id)).size,d.elements.length);
  assert(d.elements.some(e=>e.props.textBinding==='recipientName'));assert(d.elements.some(e=>e.props.textBinding==='message'));
  for(const e of d.elements.filter(e=>e.props.photos))assert(e.props.photos.every(p=>p.assetId===null&&p.caption===''));
  for(const b of Object.values(d.bindings))b.value='Một tên tiếng Việt dài, cùng một lời nhắn đầy đủ.';
  assert.doesNotThrow(()=>validateDocument(d,{mode:'publish'}));assert.deepEqual(publicDocument(d).bindings,d.bindings);assert.deepEqual(publicDocument(d).scenes,d.scenes);assert(publicDocument(d).elements.every(e=>!Object.hasOwn(e,'name')));
  assert.doesNotThrow(()=>templatePreviewDocument({id},localize));
  assert(d.scenes.every(s=>!s.effects?.celebrations&&!s.effects?.ambience?.loop));
 }
 const wedding=createDocument({template:{id:ids[0]}}),[a,b]=['open-memory','open-wish'].map(id=>wedding.elements.find(e=>e.id===id));
 assert.equal(a.type,'envelope');assert.equal(a.effects.reaction.id,'R01');assert.equal(a.layout.width,b.layout.width);assert.equal(a.layout.height,b.layout.height);
 const birthday=createDocument({template:{id:ids[1]}}),c=birthday.elements.find(e=>e.props.kind==='light-a-candle');assert.equal(c.effects.reaction.id,'R04');assert.equal(c.props.appearance,'cake-photo-v2');
 const proud=createDocument({template:{id:ids[2]}});assert.equal(proud.elements.find(e=>e.id==='proud-letter').props.entries.length,3);assert.equal(proud.elements.find(e=>e.id==='graduation-tassel').type,'shape');
});
test('recipes use permitted targets, pin v1, and reject misplaced builtins and unsafe options',()=>{
 const image=createElement('image'),line=createElement('line'),candle=createElement('interaction',{props:{kind:'light-a-candle',entries:[{heading:'Light',body:'Wish'}]}});
 assert(effectsFor('entrance',image).some(([id])=>id==='photo-settle-v1'));assert(!effectsFor('reaction',image).some(([id])=>id==='R01'));
 assert(effectsFor('entrance',line).some(([id])=>id==='E04'));assert(!effectsFor('reaction',image).some(([id])=>id==='R04'));assert(effectsFor('reaction',candle).some(([id])=>id==='R04'));
 const a=eventRecipe('photo-settle-v1');assert.equal(a.definition.animation.duration,380);assert.equal(a.definition.animation.iterations,1);
 const b=eventRecipe('porch-sun-v1');assert.equal(b.definition.animation.count,8);assert.equal(b.definition.animation.drift,-40);assert.equal(b.loop,false);
 const d=createDocument({template:{id:'birthday-radiance'}});d.elements.find(e=>e.id==='birthday-candle').props.appearance='url(evil)';assert.throws(()=>validateDocument(d));
});
test('semantic maps preserve empty text and bindings, report unmapped personal content and preserve originals',()=>{
 for(const [id,targets]of Object.entries(RESTYLE_PAIRS)){
  const source=createDocument({template:{id}}),original=structuredClone(source),target=createDocument({template:{id:targets[0]}});
  source.bindings.recipientName.value='Tên thử';source.elements.find(e=>e.id==='cover-title').props.text='';
  const custom=createElement('text',{id:'personal-note',props:{text:'Nội dung riêng'}});source.elements.push(custom);source.scenes[0].elementIds.push(custom.id);
  const before=canonicalStringify(source),mapped=mapTemplateSlots(source,original,target);
  assert.equal(mapped.document.bindings.recipientName.value,'Tên thử');assert.equal(mapped.document.elements.find(e=>e.id==='cover-title').props.text,'');assert(mapped.missing.includes('text:personal-note'));
  assert.equal(canonicalStringify(source),before);assert(semanticSlots(target).every(s=>!s.role.includes('scene-')));
 }
});
test('library rollout detects customization, supports interruption, idempotent rerun and revision rollback',async()=>{
 const bundle=JSON.parse(fs.readFileSync(new URL('../../database/updates/interactive-cards-20261122-v1.json',import.meta.url)));
 const pinned=JSON.parse(fs.readFileSync(new URL('../fixtures/refresh-21-before.json',import.meta.url)));
 // Exercise this historical rollout against its original compositions. New
 // compositions correctly depend on effects this old package would disable.
 const baseline=structuredClone(pinned);
 const old=baseline.filter(r=>!bundle.changes.some(c=>c.next.kind===r.kind&&c.next.id===r.id));old.push(...bundle.changes.flatMap(c=>c.before?[c.before]:[]));
 const rows=structuredClone(old),history=[];
 const service={rows:async()=>structuredClone(rows),put:async(user,kind,id,input)=>{const i=rows.findIndex(r=>r.kind===kind&&r.id===id),current=rows[i];assert.equal(current?.revision||0,input.expectedRevision);if(current)history.push(current);const next={kind,id,revision:input.expectedRevision+1,status:input.status,sortOrder:input.sortOrder,definition:input.definition};if(i<0)rows.push(next);else rows[i]=next;}};
 assert(previewRollout(rows,bundle).canApply);
 const conflict=structuredClone(rows);conflict.find(r=>r.kind==='template'&&r.id==='proud-of-you').definition.title.vi='Admin custom';assert.equal(previewRollout(conflict,bundle).canApply,false);
 assert((await applyRollout(service,{role:'admin'},bundle,{stopAfter:3})).interrupted);
 assert(!(await applyRollout(service,{role:'admin'},bundle)).conflict);assert.equal((await applyRollout(service,{role:'admin'},bundle)).applied.length,0);
 const reverted=await applyRollout(service,{role:'admin'},bundle,{rollback:true});assert(!reverted.conflict);assert.equal((await applyRollout(service,{role:'admin'},bundle,{rollback:true})).applied.length,0);
 for(const change of bundle.changes){const row=rows.find(r=>r.id===change.next.id&&r.kind===change.next.kind);assert.equal(row.revision,change.next.revision+1);if(change.before)assert.deepEqual(row.definition,change.before.definition);else assert.equal(row.status,'disabled');}
 assert(history.length>0);
});
test('new draft CAS is checked inside the JSON commit, retry preserves one result',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'momevia-restyle-unit-')),repo=new JsonDesignRepository(path.join(directory,'data.json'));
 const owner='qa',source={id:randomUUID(),ownerId:owner,revision:1,documentHash:'a',document:{assets:[]}},target={...source,id:randomUUID()};
 await repo.create(owner,randomUUID(),'s',source);
 await assert.rejects(repo.create(owner,randomUUID(),'t',target,[],{id:source.id,expectedRevision:2,expectedDocumentHash:'a'}),e=>e.code==='REVISION_CONFLICT');
 const mutation=randomUUID(),first=await repo.create(owner,mutation,'t',target,[],{id:source.id,expectedRevision:1,expectedDocumentHash:'a'});
 await repo.archive(owner,source.id);assert.equal((await repo.create(owner,mutation,'t',target,[],{id:source.id,expectedRevision:1,expectedDocumentHash:'a'})).design.id,first.design.id);
 assert.equal(Object.keys(repo.read().designs).length,2);
});
test('all shipped original artwork bytes match their immutable rights manifest',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../../web/assets/event-cards/originals-v2/manifest.json',import.meta.url)));
 for(const m of Object.values(manifest)){const bytes=fs.readFileSync(new URL('../../web/assets/event-cards/'+m.file,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),m.sha256);assert(bytes.length<200000);assert.match(m.rights,/distribute/);}
});
test('builtin materialization remaps image and interaction photo references together',()=>{
 const document=createDocument({template:{id:'cuon-phim-ngay-ay'}}),original=document.assets[0].assetId;
 document.elements.find(e=>e.id==='event-album').props.photos[0].assetId=original;
 const mediaRoot=fs.mkdtempSync(path.join(os.tmpdir(),'momevia-media-remap-'));
 const assets=materializeBuiltinMedia(document,{ownerId:randomUUID(),designId:randomUUID(),mediaRoot,createdAt:new Date().toISOString()});
 assert.equal(assets.length,1);assert.notEqual(document.assets[0].assetId,original);assert.equal(document.elements.find(e=>e.id==='cover-art').props.assetId,assets[0].id);assert.equal(document.elements.find(e=>e.id==='event-album').props.photos[0].assetId,assets[0].id);
});

test('semantic roles survive draft duplication without matching names, coordinates or order',()=>{
 const source=createDocument({template:{id:'sunny-wishes'}}),roles=captureSemanticRoles(source);
 const custom=structuredClone(source);custom.elements.find(e=>e.id==='cover-title').props.text='Personal headline';
 const copy=duplicateDocument(custom),ids=new Map(custom.elements.map((e,i)=>[e.id,copy.elements[i].id]));
 const persisted=captureSemanticRoles(custom,roles,ids),mapped=mapTemplateSlots(copy,source,createDocument({template:{id:'confetti'}}),{sourceRoles:persisted});
 assert.deepEqual(mapped.missing,[]);assert.equal(mapped.document.elements.find(e=>e.id==='cover-title').props.text,'Personal headline');assert.notEqual(copy.elements.find(e=>e.props.text==='Personal headline').id,'cover-title');
});

test('all six public palette projections describe their actual cover backgrounds',()=>{
 for(const id of ids){const document=createDocument({template:{id}}),view=publicTemplate(templates.find(t=>t.id===id));assert.equal(view.paletteColors[0],document.scenes[0].background.color,id);assert(view.paletteLabel);}
});

test('physical surfaces have bounded declarative parameters, restore cleanly and expose scene paper',()=>{
 assert(effectsFor('surface',null).some(([id])=>id==='cotton-paper-v2'));
 for(const styles of [{shadowMode:'url(https://invalid.test)'},{texture:'url(https://invalid.test)'},{shadowOpacity:2},{shadowX:10000},{blur:100}])assert.throws(()=>validateAnimation({engine:'surface',styles},'surface'));
 assert.throws(()=>validateAnimation({engine:'keyframes',composite:'script',duration:600,keyframes:[{},{}]},'entrance'));
 const node={style:{filter:'contrast(1)',backgroundImage:'',backgroundSize:'',boxShadow:'',color:'',backgroundColor:'',borderColor:'',borderWidth:'',borderRadius:'',borderStyle:''}};
 applyRecipeSurface(node,eventRecipe('paper-shadow-v2'));assert.match(node.style.filter,/drop-shadow/);applyRecipeSurface(node,null);assert.equal(node.style.filter,'contrast(1)');
 applyRecipeSurface(node,eventRecipe('cotton-paper-v2'));assert.match(node.style.backgroundImage,/data:image/);applyRecipeSurface(node,null);assert.equal(node.style.backgroundImage,'');
});
test('motion pauses/resumes without restarting and abort releases a paused animation',async()=>{
 let finish,plays=0,pauses=0,cancels=0;const animation={finished:new Promise(resolve=>{finish=resolve;}),pause(){pauses++;},play(){plays++;},cancel(){cancels++;finish();}};
 const motion=createMotion(()=>true),controller=new AbortController(),done=motion.run({animate:()=>animation},[{},{}],{duration:600},controller.signal);
 motion.pause();assert.equal(pauses,1);motion.resume();assert.equal(plays,1);motion.pause();controller.abort();await done;assert(cancels>=1);motion.resume();assert.equal(plays,1);
});
