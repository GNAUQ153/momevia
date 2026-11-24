import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ANIMATED_ELEMENTS,ANIMATED_GROUPS,animatedElementCards} from '../../web/js/shared/canvas/animated-elements.js';
import {motionRow,validateMotions,motionTracks,numericFrame} from '../../web/js/shared/canvas/motion-stack.js';
import {createDocument} from '../../web/js/shared/canvas/presets.js';
import {validateDocument,publicDocument,duplicateDocument,canonicalStringify} from '../../web/js/shared/canvas/schema.js';
import {pinDocumentArtwork,materializeModels} from '../../web/js/shared/canvas/library-materialize.js';
import {builtinLibraryItems} from '../../src/modules/designs/library.seed.mjs';
import {createMotionRollout} from '../../src/modules/designs/motion-rollout.mjs';
import {previewRollout,validateRollout} from '../../src/modules/designs/library-rollout.mjs';
import {fabricView} from '../../web/js/features/canvas-editor/fabric-adapter.js';
import {styleFieldsFor,applyFabricStylePatch} from '../../web/js/features/canvas-editor/fabric-style-patch.js';
const legacy=JSON.parse(fs.readFileSync(new URL('../fixtures/motion-legacy-elements.json',import.meta.url)));
function docFor(model){const d=createDocument({presetId:'blank'});d.elements=[model];d.scenes[0].elementIds=[model.id];return pinDocumentArtwork(d);}
test('exact 50 unique IDs, ten per group, distinct original geometry and two independent rows',()=>{
 assert.equal(ANIMATED_ELEMENTS.length,50);assert.equal(new Set(ANIMATED_ELEMENTS.map(e=>e.id)).size,50);
 const geometry=new Set();for(let group=0;group<ANIMATED_GROUPS.length;group++){
  const cards=animatedElementCards(group);assert.equal(cards.length,10);
  for(const card of cards){const [e]=card.create();geometry.add(canonicalStringify(e.assembly));assert.equal(e.motions.rows.length,2);validateMotions(e.motions,e);
   const d=validateDocument(docFor(e)),pub=publicDocument(d);assert.equal(d.schemaVersion,4);assert.deepEqual(pub.elements[0].motions,e.motions);assert.deepEqual(pub.elements[0].assembly,e.assembly);assert.deepEqual(duplicateDocument(d).elements[0].motions,e.motions);
   const [a]=materializeModels([e]),[b]=materializeModels([e]);assert.notEqual(a.id,b.id);assert.deepEqual(a.assembly,e.assembly);
  }
 }assert.equal(geometry.size,50);
});
test('legacy six loops and A05 remain version 2 and byte identical through validation/publication',()=>{
 for(const r of legacy){const e=r.definition.elements[0],d=docFor(structuredClone(e));d.assets=structuredClone(r.definition.assets||[]);d.schemaVersion=d.registryVersion=2;
  assert.deepEqual(validateDocument(d).elements[0],e);assert.deepEqual(publicDocument(d).elements[0].effects,e.effects);
 }
 const e=structuredClone(legacy[0].definition.elements[0]);e.effects={emphasis:{id:'A05',speed:'normal'}};const d=docFor(e);assert.equal(d.schemaVersion,2);assert.equal(d.elements[0].effects.emphasis.id,'A05');
});
test('old heart can opt into spin without changing or replaying its existing heartbeat configuration',()=>{
 const e=structuredClone(legacy.find(r=>r.id==='natural-motion-heart').definition.elements[0]),before=structuredClone(e.effects);e.motions={version:1,enabled:true,rows:[motionRow('spin','opt-in-spin')]};
 const d=docFor(e);d.assets=structuredClone(legacy.find(r=>r.id==='natural-motion-heart').definition.assets);assert.equal(validateDocument(d).schemaVersion,4);assert.deepEqual(d.elements[0].effects,before);assert.equal(d.elements[0].motions.rows.length,1);
});
test('two and three rows coexist with surface and entrance; toggles preserve sibling rows and all-off is saved',()=>{
 const [e]=animatedElementCards(0)[0].create();e.motions.rows.push(motionRow('spin','third'));e.effects={surface:{id:'S01'},entrance:{id:'E01',speed:'normal'}};
 const d=docFor(e),sibling=canonicalStringify(e.motions.rows[1]);e.motions.rows[0].enabled=false;assert.equal(canonicalStringify(e.motions.rows[1]),sibling);e.motions.enabled=false;assert.equal(validateDocument(docFor(e)).elements[0].motions.enabled,false);assert.equal(publicDocument(d).elements[0].motions.rows.length,3);
});
test('numeric fields, unknown fields, URL injection, absent parts, duplicate rows and budget violations fail closed',()=>{
 const [original]=animatedElementCards(0)[0].create();
 for(const mutate of [e=>e.motions.rows.push(motionRow('pulse'),motionRow('spin')),e=>e.motions.rows[0].periodMs=Infinity,e=>e.motions.rows[0].periodMs=0,e=>e.motions.rows[0].target='missing',e=>e.motions.rows[1].id=e.motions.rows[0].id,e=>e.motions.rows[0].kind='javascript',e=>e.motions.rows[0].url='https://example.test',e=>e.motions.rows[0].tracks[0].frames[0].x=100,e=>e.assembly.parts[0].vector.paths[0].d='<script>',e=>e.assembly.parts[0].id='whole',e=>e.assembly.parts[0].parent=e.assembly.parts[1].id,e=>e.assembly.parts[0].clip={x:95,y:0,width:10,height:10},e=>e.assembly.parts[0].clip={cx:50,cy:50,rx:Infinity,ry:20},e=>e.motions.rows[0].tracks=Array.from({length:13},()=>structuredClone(e.motions.rows[0].tracks[0])),e=>e.assembly.parts[0].vector.paths[0].fill='url(https://bad.test)']){
  const e=structuredClone(original);mutate(e);assert.throws(()=>validateDocument(docFor(e)));
 }
 const d=docFor(original);d.schemaVersion=d.registryVersion=3;assert.throws(()=>validateDocument(d),/phiên bản 4/);
});
test('heart has original beat peak scales and independent eight second linear spin',()=>{
 const heart=builtinLibraryItems().find(r=>r.kind==='element'&&r.id==='natural-motion-heart').definition.elements[0];
 assert(!heart.effects?.emphasis);const [beat,spin]=heart.motions.rows;assert.equal(beat.periodMs,1800);assert.equal(spin.periodMs,8000);const f=motionTracks(beat)[0].frames;
 assert.equal(f.find(f=>f.at===.18).scaleX,1.055);assert.equal(f.find(f=>f.at===.48).scaleX,1.04);assert.match(numericFrame(motionTracks(spin)[0].frames.at(-1),spin).transform,/rotate\(360deg\)/);
});
test('new package accepts exactly 51 reviewed IDs and checks original fingerprints',()=>{
 const rows=builtinLibraryItems().filter(r=>!ANIMATED_ELEMENTS.some(e=>e.id===r.id));rows.splice(rows.findIndex(r=>r.id==='natural-motion-heart'),1,legacy.find(r=>r.id==='natural-motion-heart'));
 const bundle=createMotionRollout(rows);validateRollout(bundle);assert.equal(bundle.changes.length,51);assert(previewRollout(rows,bundle).canApply);
 for(const modify of [b=>b.changes.pop(),b=>b.changes[0].next.id='outside',b=>b.changes.at(-1).expectedFingerprint='bad']){const b=structuredClone(bundle);modify(b);assert.throws(()=>validateRollout(b));}
 const changed=structuredClone(rows);changed.find(r=>r.id==='natural-motion-heart').definition.title.vi='Admin changed';assert(!previewRollout(changed,bundle).canApply);
});
test('every artwork has a real accent binding and Fabric keeps the same assembly and motion rows',()=>{
 for(let g=0;g<5;g++)for(const card of animatedElementCards(g)){
  const [e]=card.create();assert(e.assembly.parts.some(p=>p.vector.paths.some(v=>v.fill==='color'||v.stroke==='color')),card.id);
  const d=docFor(e),view=fabricView(d,d.entrySceneId).elements[0];assert.deepEqual(view.assembly,e.assembly);assert.deepEqual(view.motions,e.motions);assert.deepEqual(styleFieldsFor(view),['color','opacity']);
  const patched=applyFabricStylePatch(d,d.entrySceneId,[{id:e.id,fields:{color:'#123456'}}]);assert.equal(patched.elements[0].props.color,'#123456');assert.deepEqual(patched.elements[0].assembly,e.assembly);
 }
});
test('only supported interactive controls accept rows; entrance and reaction stay in their own families',async()=>{
 const {createElement}=await import('../../web/js/shared/canvas/registry.js');
 for(const type of ['button','envelope','gift-box']){const e=createElement(type,{actions:[{on:'activate',type:'replay'}],motions:{version:1,enabled:true,rows:[motionRow('pulse','beat'),motionRow('spin','spin')]},effects:{...(type==='button'?{}:{surface:{id:'S01'}}),entrance:{id:'E01'},reaction:{id:type==='gift-box'?'R02':type==='envelope'?'R01':'R03'}}});assert.equal(validateDocument(docFor(e)).schemaVersion,4);}
 for(const type of ['text','reply','interaction'])assert.throws(()=>validateMotions({version:1,enabled:true,rows:[motionRow('spin')]},{type,props:{}}));
});
