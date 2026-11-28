import test from 'node:test';
import assert from 'node:assert/strict';
import {playPaperTransition,sceneDirection} from '../../web/js/features/gift-runtime/scene-transition.js';
import {sceneTransition} from '../../web/js/features/gift-runtime/effects.js';

class Layer{
 constructor(body=false){this.body=body;this.children=[];this.dataset={};this.style={transformOrigin:'',backgroundColor:'#F6E7D5',height:'844px'};this.classList={add:()=>{}};}
 append(child){child.remove();child.parent=this;this.children.push(child);}
 remove(){if(this.parent)this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}
 querySelector(){return this.children.find(e=>e.body)||null;}
 setAttribute(){}
 hasAttribute(key){return key==='data-garden-opening'&&this.opening===true;}
}
function fixture(){
 const stage=new Layer(),incoming=new Layer(),previous=new Layer(),body=new Layer(true),oldBody=new Layer(true),next=new Layer(),oldNext=new Layer();
 stage.dataset={};stage.style.backgroundColor='#EAF0DF';stage.append(incoming);incoming.append(body);incoming.append(next);previous.append(oldBody);previous.append(oldNext);
 const runs=[],motion={enabled:()=>true,run(node,frames,options,signal,cleanup=()=>{}){
  return new Promise(resolve=>{const finish=()=>{cleanup();resolve();};runs.push({node,frames,options,finish});signal.addEventListener('abort',finish,{once:true});});
 }};
 return {stage,incoming,previous,body,oldBody,next,oldNext,runs,motion};
}
test('paper slide moves both content areas and blends the background while both footer controls stay still',async()=>{
 const f=fixture(),controller=new AbortController();
 const done=playPaperTransition(f.stage,f.incoming,f.previous,{id:'T07'},f.motion,controller.signal,1);
 assert.deepEqual(f.previous.children,[f.oldBody]);assert(f.incoming.children.includes(f.next));
 assert.deepEqual(f.runs.map(r=>r.node),[f.body,f.oldBody,f.stage]);
 assert.equal(f.runs[0].frames[0].transform,'translateX(28px)');assert.equal(f.runs[1].frames[1].transform,'translateX(-18px)');
 assert.equal(f.stage.style.height,'844px');assert.equal(f.stage.dataset.sceneDirection,'1');
 f.runs.forEach(r=>r.finish());await done;
 assert.deepEqual(f.stage.children,[f.incoming]);assert.equal(f.body.style.transformOrigin,'');assert.equal(f.stage.dataset.sceneTransition,undefined);
});
test('backward turns reverse direction and abort immediately releases outgoing layers and temporary origins',async()=>{
 const f=fixture(),controller=new AbortController();f.body.style.transformOrigin='40% 70%';
 const done=playPaperTransition(f.stage,f.incoming,f.previous,{id:'T08'},f.motion,controller.signal,-1);
 assert.match(f.runs[0].frames[0].transform,/translateX\(-16px\) rotateY\(6deg\)/);assert.equal(f.runs[0].options.duration,512);
 controller.abort();assert.deepEqual(f.stage.children,[f.incoming]);assert.equal(f.body.style.transformOrigin,'40% 70%');await done;
 assert.equal(f.stage.dataset.sceneTransition,undefined);
});
test('reduced motion skips transitions and scene order determines forward/backward direction',()=>{
 const f=fixture();assert.equal(playPaperTransition(f.stage,f.incoming,f.previous,{id:'T07'},{enabled:()=>false},new AbortController().signal),undefined);assert.equal(f.runs.length,0);
 const scenes=['a','b','c'].map(id=>({id}));assert.equal(sceneDirection(scenes,'a','c'),1);assert.equal(sceneDirection(scenes,'c','a'),-1);assert.equal(sceneDirection(scenes,'b','b'),1);
});
test('the first reveal after opening the garden doors only dissolves, without a second slide or turn',async()=>{
 const f=fixture(),controller=new AbortController();f.previous.opening=true;
 const done=sceneTransition(f.stage,f.incoming,f.previous,{id:'T08'},f.motion,controller.signal);
 assert.equal(f.runs.length,1);assert.deepEqual(f.runs[0].frames,[{opacity:1},{opacity:0}]);assert.equal(f.runs[0].options.duration,180);
 f.runs[0].finish();await done;
});
test('an administrator-authored transition definition keeps its pinned animation instead of being replaced by a builtin',async()=>{
 const f=fixture(),controller=new AbortController(),frames=[{opacity:.2},{opacity:1}];
 const preset={id:'T07',definition:{animation:{engine:'keyframes',duration:500,keyframes:frames}}};
 const done=sceneTransition(f.stage,f.incoming,f.previous,preset,f.motion,controller.signal);
 assert.equal(f.runs.length,1);assert.equal(f.runs[0].node,f.incoming);assert.deepEqual(f.runs[0].frames,frames);
 f.runs[0].finish();await done;
});
