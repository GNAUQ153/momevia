import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { builtinLibraryItems } from '../../src/modules/designs/library.seed.mjs';
import { REFRESH_21,coverVariant } from '../../web/js/shared/canvas/refresh-21-config.js';
import { canonicalStringify,validateDocument,duplicateDocument } from '../../web/js/shared/canvas/schema.js';
import { insertPhotoFrame,framePhoto,isPhotoFrame,basicTemplateDefinition } from '../../web/js/shared/canvas/basic-templates.js';
import { templatePreviewDocument } from '../../web/js/shared/canvas/presets.js';
import { validateRollout,previewRollout } from '../../src/modules/designs/library-rollout.mjs';
import { fabricView } from '../../web/js/features/canvas-editor/fabric-adapter.js';
import {EVENT_MEDIA,NATURAL_ARTWORK_LABEL} from '../../web/js/shared/canvas/event-media.js';
const personalPhotos=doc=>doc.elements.filter(e=>e.type==='image'&&!(e.accessibility.decorative&&e.accessibility.label===NATURAL_ARTWORK_LABEL));
const before=JSON.parse(fs.readFileSync(new URL('../fixtures/refresh-21-before.json',import.meta.url))),current=builtinLibraryItems();
test('21 designs have distinct scenes; control documents retain all fields outside reviewed text spacing',()=>{
 assert.equal(Object.keys(REFRESH_21).length,21);
 const signatures=[new Set(),new Set(),new Set()];
 // Garden Tea was added after this frozen 21-design rollout and has its own regression suite.
 for(const row of current.filter(r=>r.kind==='template' && r.id!=='garden-tea')){
  if(!REFRESH_21[row.id]){
   const original=before.find(r=>r.kind==='template'&&r.id===row.id).definition.documents;
   const expected=structuredClone(original);
   for(const doc of Object.values(expected)) {
    const reply=doc.elements.find(e=>e.type==='reply');
    if(reply) reply.props.color=basicTemplateDefinition(row.id).button;
   }
   if(['birthday-radiance','hai-phong-bi','proud-of-you'].includes(row.id))for(const doc of Object.values(expected)){
    const find=id=>doc.elements.find(e=>e.id===id);
    Object.assign(find('time-heading').layout,{y:55,height:162});find('time-heading').props.fontSize=29;
    Object.assign(find('time-intro').layout,{y:235,height:66});
    find('event-countdown').layout.y=326;find('event-elapsed').layout.y=506;
    if(row.id==='hai-phong-bi'){
     find('text-message').layout.height=320;find('text-message').props.fontSize=19;
     find('message-from-label').layout.y=506;find('text-sender').layout.y=544;
     Object.assign(find('wish-back').layout,{y:644,height:64});
     Object.assign(find('wish-to-time').layout,{y:735,height:64});
    }
   }
   assert.deepEqual(row.definition.documents,expected,row.id);
   continue;
  }
  for(const [locale,doc]of Object.entries(row.definition.documents)){
   assert.equal(doc.scenes.length,3);assert(doc.assets.length>0,'natural artwork is real immutable media');assert(doc.assets.every(ref=>Object.hasOwn(EVENT_MEDIA,ref.assetId)&&!EVENT_MEDIA[ref.assetId].previewOnly));assert.equal(personalPhotos(doc).length,0);assert.doesNotThrow(()=>validateDocument(doc));
   assert.equal(doc.elements.filter(isPhotoFrame).length,['polaroid','mot-ky-niem'].includes(row.id)?1:0);
   for(const [i,scene]of doc.scenes.entries()){
    const nodes=doc.elements.filter(e=>scene.elementIds.includes(e.id));
    if(locale==='vi')signatures[i].add(canonicalStringify(nodes.map(e=>({type:e.type,layout:e.layout,...(e.type==='image'?{asset:e.props.assetId}:{}),...(e.artwork?{paths:e.artwork.paths.map(p=>p.d)}:{})}))));
    if(i<2){const control=nodes.find(e=>e.actions?.some(a=>a.targetSceneId===doc.scenes[i+1].id));assert(control?.accessibility.label.trim());}
    else assert(nodes.some(e=>e.type==='reply'));
   }
   const copy=duplicateDocument(doc);assert.doesNotThrow(()=>validateDocument(copy));
   assert.deepEqual(copy.elements.filter(e=>e.artwork).map(e=>e.artwork),doc.elements.filter(e=>e.artwork).map(e=>e.artwork));
  }
 }
 for(const signaturesOfScene of signatures)assert.equal(signaturesOfScene.size,21);
});
test('cover variants select the pinned document, preserve paths and work after an Admin document edit',()=>{
 const doc=templatePreviewDocument({id:'afterglow'}),original=structuredClone(doc),part=doc.elements.find(e=>e.id==='cover-object-natural-art');part.props.focalPoint={x:.2,y:.7};
 for(const variant of ['catalog','seasonal']){
  const cover=coverVariant(doc,variant);validateDocument(cover,{mode:'publish',requiredBindings:[]});
  assert.deepEqual(cover.elements.find(e=>e.id===part.id).props,part.props);
  assert.equal(cover.elements.some(e=>['text','button'].includes(e.type)),false);
  assert.equal(cover.artboard.baseSize.height,variant==='catalog'?330:466);
 }
 assert.equal(doc.artboard.baseSize.height,844);assert.deepEqual(doc.elements.map(e=>e.layout),original.elements.map(e=>e.layout));
 const old=before.find(r=>r.kind==='template'&&r.id==='afterglow').definition.documents.vi;assert.equal(coverVariant(old,'catalog'),old,'old gifts and documents do not acquire a new cover composition');
});
test('both optional photo frames retain geometry and crop after duplication and replacing an existing photo',()=>{
 for(const id of ['polaroid','mot-ky-niem']){
  const doc=duplicateDocument(templatePreviewDocument({id})),frame=doc.elements.find(isPhotoFrame);
  const once=insertPhotoFrame(doc,'photo-one',frame.id),photo=framePhoto(once,frame);photo.props.focalPoint={x:.1,y:.9};
  const twice=insertPhotoFrame(once,'photo-two',frame.id),next=framePhoto(twice,frame);
  assert.equal(personalPhotos(twice).length,1);assert.deepEqual(next.layout,frame.layout);assert.deepEqual(next.props.focalPoint,{x:.1,y:.9});
  const ids=twice.scenes.find(s=>s.elementIds.includes(frame.id)).elementIds;assert(ids.indexOf(next.id)>ids.indexOf(frame.id));assert.doesNotThrow(()=>validateDocument(twice));
 }
});
test('Fabric receives pinned vector, surface and scene texture without mutating documents',()=>{
 for(const id of Object.keys(REFRESH_21)){
  const doc=templatePreviewDocument({id}),snapshot=canonicalStringify(doc),view=fabricView(doc,doc.entrySceneId);
  assert(view.effects.surface.definition.animation.styles.texture);
  for(const node of doc.elements.filter(e=>doc.scenes[0].elementIds.includes(e.id))){const model=view.elements.find(e=>e.id===node.id);assert.deepEqual(model.artwork,node.artwork);assert.deepEqual(model.effects,node.effects);}
  assert.equal(canonicalStringify(doc),snapshot);
 }
});
test('the refresh package requires exact revisions and fingerprints and forbids out-of-scope mutations',()=>{
 const bundle=JSON.parse(fs.readFileSync(new URL('../../database/updates/template-refresh-natural-20261123-v2.json',import.meta.url)));assert.equal(bundle.changes.length,75);validateRollout(bundle);
 const rows=current.filter(r=>!bundle.changes.some(c=>c.next.kind===r.kind&&c.next.id===r.id));rows.push(...bundle.changes.flatMap(c=>c.before?[c.before]:[]));assert(previewRollout(rows,bundle).canApply);
 const edited=structuredClone(rows);edited.find(r=>r.kind==='template'&&r.id==='afterglow').definition.title.vi='Admin';assert(!previewRollout(edited,bundle).canApply);
 for(const field of ['expectedRevision','expectedFingerprint']){const bad=structuredClone(bundle);delete bad.changes[0][field];assert.throws(()=>validateRollout(bad));}
 const bad=structuredClone(bundle);bad.changes[0].next.id='birthday-radiance';assert.throws(()=>validateRollout(bad),/scope/);
});
