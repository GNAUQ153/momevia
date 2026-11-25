import test from 'node:test';import assert from 'node:assert/strict';
import {builtinLibraryItems} from '../../src/modules/designs/library.seed.mjs';
import {validateAssembly,validateMotions} from '../../web/js/shared/canvas/motion-stack.js';
import {createDocument} from '../../web/js/shared/canvas/presets.js';
import {validateDocument,publicDocument,duplicateDocument} from '../../web/js/shared/canvas/schema.js';
import {pinDocumentArtwork} from '../../web/js/shared/canvas/library-materialize.js';
import {previewSvg} from '../../web/js/shared/canvas/cover-svg.js';
import {MOTION_REPAIR_IDS,createMotionRepairRollout} from '../../src/modules/designs/motion-repair-rollout.mjs';
import {validateRollout,previewRollout} from '../../src/modules/designs/library-rollout.mjs';
const rows=builtinLibraryItems(),icons=rows.filter(r=>r.kind==='element'&&MOTION_REPAIR_IDS.includes(r.id));
const documentFor=model=>{const d=createDocument({presetId:'blank'});d.elements=[structuredClone(model)];d.scenes[0].elementIds=[model.id];d.assets=model.type==='image'?[{assetId:model.props.assetId,kind:'image'}]:[];return pinDocumentArtwork(d);};
test('all 56 repaired definitions round-trip without rewriting authored joints and timing',()=>{
 assert.equal(icons.length,56);assert.equal(new Set(MOTION_REPAIR_IDS).size,56);
 for(const row of icons){const model=row.definition.elements[0],d=validateDocument(documentFor(model));assert.deepEqual(publicDocument(d).elements[0].motions,model.motions);assert.deepEqual(duplicateDocument(d).elements[0].assembly,model.assembly);assert(model.motions.rows.length>=1);if(row.id.startsWith('motion-'))assert.equal(model.motions.rows.length,2);}
});
test('v2 rejects topology changes, unknown pixels, unsafe paths, unsupported rest and follow fields',()=>{
 const original=icons.find(r=>r.id==='motion-sprouting-seed').definition.elements[0];
 for(const mutate of [m=>m.assembly.parts[0].poses[0].paths[0].d='M0 0L2 3',m=>m.assembly.parts[0].poses[0].paths[0].fill='#000000',m=>m.assembly.parts[0].rest={css:'url(https://bad.test)'},m=>m.assembly.parts[0].clip={d:'<svg/onload=alert(1)>'},m=>m.assembly.version=1]){const m=structuredClone(original);mutate(m);assert.throws(()=>validateDocument(documentFor(m)));}
 const raster=structuredClone(icons.find(r=>r.id==='natural-motion-ribbon').definition.elements[0]);raster.assembly.parts.find(p=>p.image).image.mediaId='https://bad.test/image.webp';assert.throws(()=>validateAssembly(raster.assembly));
 raster.assembly.parts.find(p=>p.image).image.mediaId='event-birthday-album-5190e92b69f2';assert.throws(()=>validateAssembly(raster.assembly));
 const pen=icons.find(r=>r.id==='motion-fountain-pen-signature').definition.elements[0];
 for(const mutate of [m=>m.motions.rows[0].tracks[0].follow.part='missing',m=>m.motions.rows[0].tracks[0].follow.tip.x=NaN,m=>m.motions.rows[0].tracks[0].follow.url='https://bad.test',m=>m.motions.rows[0].tracks[0].frames[1].progress=.9]){const m=structuredClone(pen);mutate(m);assert.throws(()=>validateMotions(m.motions,m));}
});
test('heart spin is opt-in; gift, paper and sand stop; their static poses remain complete',()=>{
 const icon=id=>icons.find(r=>r.id===id).definition.elements[0];
 assert.deepEqual(icon('natural-motion-heart').motions.rows.map(r=>r.enabled),[true,false]);
 for(const id of ['natural-motion-gift','natural-motion-paper','motion-pocket-hourglass'])for(const row of icon(id).motions.rows)assert.equal(row.iterations,1);
 assert.equal(icon('motion-pocket-hourglass').motions.rows[1].periodMs,9000);
 assert.equal(icon('motion-dew-on-leaf').assembly.parts.find(p=>p.id==='dew').rest.opacity,0);
 assert.equal(icon('motion-ballerina-music-box').assembly.parts.find(p=>p.id==='lid').rest.opacity,0);
});
test('SVG covers preserve parent hierarchy, path masks, invisible rest parts and original raster textures',()=>{
 for(const id of ['motion-cheering-glasses','motion-ballerina-music-box','natural-motion-ribbon']){const m=icons.find(r=>r.id===id).definition.elements[0],images=new Map([[m.props.assetId,{url:'data:image/png;base64,iVBORw0KGgo=',width:960,height:720}]]),svg=previewSvg(documentFor(m),undefined,images,{validationMode:'draft'});assert(!svg.includes('undefined'));assert(!svg.includes('NaN'));if(id==='motion-cheering-glasses')assert(svg.includes('<clipPath')&&svg.includes('<path d="M23 25'));if(id==='natural-motion-ribbon')assert(svg.includes('<image href="data:image/png;base64,'));}
});
test('56-item rollout is fingerprint guarded, idempotent and refuses partial or unrelated IDs',()=>{
 const bundle=createMotionRepairRollout(rows);validateRollout(bundle);assert.equal(bundle.changes.length,56);assert(previewRollout(rows,bundle).canApply);
 const changed=structuredClone(rows);changed.find(r=>r.kind==='element'&&r.id===MOTION_REPAIR_IDS[0]).definition.title.vi='Edited separately';assert(!previewRollout(changed,bundle).canApply);
 for(const mutate of [b=>b.changes.pop(),b=>b.changes[0].next.id='other',b=>b.changes[0].expectedFingerprint='wrong',b=>b.changes[1]=structuredClone(b.changes[0])]){const b=structuredClone(bundle);mutate(b);assert.throws(()=>validateRollout(b));}
 const applied=rows.map(row=>bundle.changes.find(c=>c.next.kind===row.kind&&c.next.id===row.id)?.next||row);assert(previewRollout(applied,bundle).actions.every(a=>a.status==='unchanged'));
});
