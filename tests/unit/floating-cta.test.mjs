import test from 'node:test';
import assert from 'node:assert/strict';
import {isEditingRoute,isTaskRoute,overlapsContent,FLOATING_CREATE_URL,FLOATING_EXPLORE_URL,mountFloatingCta} from '../../web/js/ui/floating-cta.js';

test('floating actions stay on browsing pages and hide only for editing routes',()=>{
 for(const route of ['/','/explore','/template/a','/g/owned-gift','/studio','/creator','/admin','/login','/register','/policies/privacy'])assert.equal(isEditingRoute(route),false,route);
 for(const route of ['/design/new','/design/a','/design/a/','/create/template-id','/admin/library','/admin/library/'])assert.equal(isEditingRoute(route),true,route);
});
test('floating destinations are fixed and contain no gift, recipient or invite context',()=>{
 assert.equal(FLOATING_CREATE_URL,'/design/new');assert.equal(FLOATING_EXPLORE_URL,'/explore');
 for(const value of [FLOATING_CREATE_URL,FLOATING_EXPLORE_URL]){const url=new URL(value,'https://momevia.example');assert.equal(url.search,'');assert.equal(url.hash,'');assert.equal(url.origin,'https://momevia.example');}
});

test('floating dock yields to keyboard focus without moving pointer targets',()=>{
 const previousDocument=globalThis.document,previousObserver=globalThis.ResizeObserver,previousFrame=globalThis.requestAnimationFrame,handlers=new Map(),scrolls=[];
 const panel={hidden:false,dataset:{},contains:()=>false,getBoundingClientRect:()=>({top:500,bottom:650,left:100,right:400,height:150,width:300})};
 const control={matches:()=>true,getBoundingClientRect:()=>({top:520,bottom:560,left:120,right:350,width:230,height:40}),scrollIntoView:options=>scrolls.push(options)};
 try{
  globalThis.document={createElement:()=>panel,getElementById:()=>null,body:{append(){},style:{setProperty(){}},classList:{toggle(){}}},addEventListener:(name,handler)=>handlers.set(name,handler)};
  globalThis.ResizeObserver=class{observe(){}};
  globalThis.requestAnimationFrame=()=>1;
  const dock=mountFloatingCta();dock.sync('/about');
  handlers.get('focusin')({target:control});assert.equal(panel.hidden,true,'Dock yields to the focused control');
  for(const pointerType of ['mouse','touch']){dock.sync('/about');handlers.get('pointerdown')({pointerType});handlers.get('focusin')({target:control});assert.equal(panel.hidden,false);handlers.get('click')({});}
  handlers.get('keydown')({key:'Tab'});handlers.get('focusin')({target:control});
  assert.equal(panel.hidden,true);assert.deepEqual(scrolls,[]);
  dock.sync('/about');handlers.get('pointerdown')({pointerType:'mouse'});handlers.get('focusin')({target:control});assert.equal(panel.hidden,false);
  handlers.get('pointercancel')({});handlers.get('focusin')({target:control});assert.equal(panel.hidden,true);
  dock.sync('/design/new');handlers.get('keydown')({key:'Tab'});handlers.get('focusin')({target:control});assert.deepEqual(scrolls,[]);
  dock.sync('/creator');assert.equal(panel.hidden,true,'Creator uses its own creation journey');
  dock.sync('/creator/');assert.equal(panel.hidden,true);
  dock.sync('/explore');assert.equal(panel.hidden,false,'Browsing pages retain the shared dock');
 }finally{globalThis.document=previousDocument;globalThis.ResizeObserver=previousObserver;globalThis.requestAnimationFrame=previousFrame;}
});

test('floating dock hides at the footer and returns on scroll without overriding route restrictions',()=>{
 const previousDocument=globalThis.document,previousResize=globalThis.ResizeObserver,previousIntersection=globalThis.IntersectionObserver;
 let notifyFooter,observed,hasDock=false,focused=false;
 const link={},footer={focus(options){assert.deepEqual(options,{preventScroll:true});focused=true;globalThis.document.activeElement=footer;}};
 const panel={dataset:{},contains:element=>element===link,getBoundingClientRect:()=>({height:122})};
 try{
  globalThis.document={activeElement:null,createElement:()=>panel,getElementById:id=>id==='site-footer'?footer:null,
   body:{append(){},style:{setProperty(){}},classList:{toggle(_name,value){hasDock=value;}}},addEventListener(){}};
  globalThis.ResizeObserver=class{observe(){}};
  globalThis.IntersectionObserver=class{constructor(callback){notifyFooter=callback;}observe(target){observed=target;}};
  const dock=mountFloatingCta();assert.equal(observed,footer);
  dock.sync('/');assert.equal(panel.hidden,false);assert.equal(hasDock,true);
  globalThis.document.activeElement=link;
  notifyFooter([{isIntersecting:true}]);
  assert.equal(panel.hidden,true);assert.equal(hasDock,false);assert.equal(focused,true);assert.equal(footer.tabIndex,-1);
  notifyFooter([{isIntersecting:false}]);assert.equal(panel.hidden,false);assert.equal(hasDock,true);
  for(const route of ['/design/new','/admin/library','/creator']){
   dock.sync(route);notifyFooter([{isIntersecting:true}]);notifyFooter([{isIntersecting:false}]);
   assert.equal(panel.hidden,true,route);assert.equal(hasDock,false,route);
  }
  dock.sync('/explore');assert.equal(panel.hidden,false);
  notifyFooter([{isIntersecting:true}]);dock.sync('/');assert.equal(panel.hidden,true);
 }finally{globalThis.document=previousDocument;globalThis.ResizeObserver=previousResize;globalThis.IntersectionObserver=previousIntersection;}
});

test('promotional actions stay out of account, workspace, payment and recipient flows',()=>{
 for(const route of ['/login','/register','/recover','/verify-email','/studio','/creator','/admin','/admin/payments','/g/gift','/success/gift','/payment-result/order'])assert.equal(isTaskRoute(route),true,route);
 for(const route of ['/','/about','/pricing','/explore','/template/a','/favorites','/policies/privacy'])assert.equal(isTaskRoute(route),false,route);
});

test('collision detection accounts for horizontal separation, hidden elements and a safe gap',()=>{
 const dock={left:100,right:400,top:500,bottom:650,width:300,height:150};
 assert.equal(overlapsContent(dock,{left:120,right:350,top:520,bottom:560,width:230,height:40}),true);
 assert.equal(overlapsContent(dock,{left:0,right:80,top:520,bottom:560,width:80,height:40}),false);
 assert.equal(overlapsContent(dock,{left:120,right:350,top:460,bottom:495,width:230,height:35}),true);
 assert.equal(overlapsContent(dock,{left:120,right:350,top:450,bottom:490,width:230,height:40}),false);
 assert.equal(overlapsContent({...dock,width:0,height:0},dock),false);
});
