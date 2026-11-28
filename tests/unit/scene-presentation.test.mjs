import test from 'node:test';
import assert from 'node:assert/strict';
import {createBasicTemplate} from '../../web/js/shared/canvas/basic-templates.js';
import {duplicateDocument,validateDocument} from '../../web/js/shared/canvas/schema.js';
import {scenePresentation} from '../../web/js/shared/canvas/scene-presentation.js';
import {previewSvg} from '../../web/js/shared/canvas/cover-svg.js';

const garden=()=>createBasicTemplate({id:'garden-tea'});
test('an empty optional photo removes its block while preserving the card frame and navigation',()=>{
 const doc=garden(),before=structuredClone(doc),scene=doc.scenes[1],view=scenePresentation(doc,scene);
 assert.equal(view.size.height,844);
 assert(!view.elements.some(e=>['hero-photo','hero-photo-frame'].includes(e.id)));
 assert.equal(view.elements.find(e=>e.id==='hero-next').layout.y,764);
 assert.equal(view.elements.find(e=>e.id==='hero-welcome').layout.y,365);
 assert.deepEqual(doc,before);
 const svg=previewSvg(doc,scene.id,new Map(),{validationMode:'draft'});
 assert.match(svg,/viewBox="0 0 390 844"/);
 assert(!svg.includes('photo-hero-photo'));
});
test('adding a photo restores the authored frame and spacing; duplication preserves the relationship',()=>{
 const doc=garden(),photo=doc.elements.find(e=>e.id==='hero-photo');photo.props.assetId='private-portrait';doc.assets.push({assetId:'private-portrait',kind:'image'});
 const copy=duplicateDocument(doc),scene=copy.scenes[1],view=scenePresentation(copy,scene);
 assert.equal(view.size.height,844);
 const visible=view.elements.find(e=>e.type==='image'&&e.props.assetId==='private-portrait');
 assert(visible&&view.elements.some(e=>e.type==='shape'&&e.groupId===visible.groupId));
 assert.equal(view.elements.find(e=>e.type==='button'&&e.props.label==='Đọc lời mời').layout.y,764);
 assert.doesNotThrow(()=>validateDocument(copy));
});
test('older portrait placeholders keep their stored layout, and new appearance values are constrained',()=>{
 const doc=garden(),photo=doc.elements.find(e=>e.id==='hero-photo');photo.props.placeholder='portrait';
 assert.equal(scenePresentation(doc,doc.scenes[1]).size.height,844);
 const next=doc.elements.find(e=>e.id==='hero-next');next.props.variant='text';assert.doesNotThrow(()=>validateDocument(doc));
 next.props.variant='css';assert.throws(()=>validateDocument(doc));next.props.variant='filled';
 photo.props.placeholder='collapse';photo.props.optional=false;assert.throws(()=>validateDocument(doc));
});
