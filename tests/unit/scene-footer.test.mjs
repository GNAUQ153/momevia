import test from 'node:test';
import assert from 'node:assert/strict';
import {createBasicTemplate} from '../../web/js/shared/canvas/basic-templates.js';
import {duplicateDocument,validateDocument} from '../../web/js/shared/canvas/schema.js';
import {scenePresentation} from '../../web/js/shared/canvas/scene-presentation.js';
import {sceneFooterLayout,sceneFrameLayout,isSceneFooter} from '../../web/js/shared/canvas/scene-footer.js';
const garden=()=>createBasicTemplate({id:'garden-tea'});
test('reader frames stay the authored aspect at every width even without fixed navigation or with long content',()=>{
 const size={width:390,height:844},content=[{type:'reply',props:{},layout:{x:20,y:100,width:350,height:2000}}],before=structuredClone(content);
 for(const width of [220,320,390,600]){
  const frame=sceneFrameLayout(content,size,width/390);
  assert(Math.abs(frame.height-844*width/390)<1e-9);assert.equal(frame.bodyHeight,frame.height);assert.equal(frame.layouts.size,0);
 }
 assert.deepEqual(content,before);
});
test('all eight reading scenes share their frame, button geometry and primary color at each responsive width',()=>{
 const doc=duplicateDocument(garden());
 for(const width of [240,320,390,600]){
  let baseline;
  for(const scene of doc.scenes.slice(1)){
   const view=scenePresentation(doc,scene),nav=view.elements.filter(isSceneFooter);
   assert.equal(view.size.height,844);assert.equal(nav.length,2);
   assert.equal(nav.find(e=>e.props.variant==='filled').props.color,'#B72E60');
   const footer=sceneFooterLayout(view.elements,view.size,width/390);
   const boxes=[...footer.layouts.values()];
   assert.equal(boxes[0].y,boxes[1].y);assert.equal(boxes[0].height,boxes[1].height);
   assert(boxes.every(b=>b.width>=44&&b.height>=56));
   assert(boxes[0].x+boxes[0].width+7.99<=boxes[1].x);
   assert(footer.bodyHeight<boxes[0].y);
   const current=JSON.stringify({height:footer.height,bodyHeight:footer.bodyHeight,boxes});
   if(baseline)assert.equal(current,baseline,scene.id);else baseline=current;
  }
 }
});
test('a photo and long RSVP/message content cannot reposition the footer or change the frame',()=>{
 const doc=garden(),scene=doc.scenes[1],before=sceneFooterLayout(scenePresentation(doc,scene).elements,doc.artboard.baseSize);
 doc.elements.find(e=>e.id==='hero-photo').props.assetId='photo';doc.assets.push({assetId:'photo',kind:'image'});
 doc.elements.find(e=>e.id==='hero-welcome').props.text='Một lời mời dài. '.repeat(100);
 const after=sceneFooterLayout(scenePresentation(doc,scene).elements,doc.artboard.baseSize);
 assert.deepEqual(after,before);assert.doesNotThrow(()=>validateDocument(doc));
});
test('footer placement is opt-in and rejects invalid positions or an unusably crowded row',()=>{
 const doc=garden(),scene=doc.scenes[1],next=doc.elements.find(e=>e.id==='hero-next');
 assert.equal(sceneFooterLayout(doc.elements.filter(e=>doc.scenes[0].elementIds.includes(e.id)),doc.artboard.baseSize),null);
 next.props.placement='arbitrary-css';assert.throws(()=>validateDocument(doc));next.props.placement='footer';
 for(let i=0;i<3;i++){const e=structuredClone(next);e.id='extra-nav-'+i;doc.elements.push(e);scene.elementIds.push(e.id);}
 assert.throws(()=>validateDocument(doc),/tối đa 4/);
});
