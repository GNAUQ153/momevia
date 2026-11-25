import test from 'node:test';
import assert from 'node:assert/strict';
import {isEditingRoute,isTaskRoute,overlapsContent,visibleCtaRatio,FLOATING_CREATE_URL,FLOATING_EXPLORE_URL,mountFloatingCta} from '../../web/js/ui/floating-cta.js';

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
  notifyFooter([{target:footer,isIntersecting:true}]);
  assert.equal(panel.hidden,true);assert.equal(hasDock,false);assert.equal(focused,true);assert.equal(footer.tabIndex,-1);
  notifyFooter([{target:footer,isIntersecting:false}]);assert.equal(panel.hidden,false);assert.equal(hasDock,true);
  for(const route of ['/design/new','/admin/library','/creator']){
   dock.sync(route);notifyFooter([{target:footer,isIntersecting:true}]);notifyFooter([{target:footer,isIntersecting:false}]);
   assert.equal(panel.hidden,true,route);assert.equal(hasDock,false,route);
  }
  dock.sync('/explore');assert.equal(panel.hidden,false);
  notifyFooter([{target:footer,isIntersecting:true}]);dock.sync('/');assert.equal(panel.hidden,true);
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

test('catalog CTA visibility includes sticky-header occlusion and the exact 50 percent boundary',()=>{
 const box=top=>({left:100,right:300,top,bottom:top+48,width:200,height:48});
 assert.equal(visibleCtaRatio(box(120),1200,800,80),1);
 assert(visibleCtaRatio(box(57),1200,800,80)>0.5);
 assert.equal(visibleCtaRatio(box(56),1200,800,80),0.5);
 assert(visibleCtaRatio(box(55),1200,800,80)<0.5);
 assert.equal(visibleCtaRatio(box(-100),1200,800,80),0);
 assert.equal(visibleCtaRatio(null,1200,800,80),1);
});

test('catalog has a single floating create action only after its top CTA becomes half hidden',()=>{
 const keys=['document','ResizeObserver','IntersectionObserver','requestAnimationFrame','getComputedStyle'];
 const saved=Object.fromEntries(keys.map(key=>[key,globalThis[key]]));
 let top=120,catalogClass=false;
 const exploreAction={hidden:false};
 const topCta={getBoundingClientRect:()=>({left:100,right:300,top,bottom:top+48,width:200,height:48})};
 const blocker={getBoundingClientRect:()=>({left:1000,right:1200,top:680,bottom:730,width:200,height:50})};
 const main={querySelector:selector=>selector==='[data-catalog-create-cta]'?topCta:null,querySelectorAll:()=>[blocker]};
 const panel={hidden:true,dataset:{},contains:()=>false,
  classList:{add(){},remove(){},toggle(name,value){if(name==='floating-cta--catalog')catalogClass=value;}},
  querySelector:selector=>selector==='[data-floating-action="explore"]'?exploreAction:null,
  getBoundingClientRect:()=>({left:1000,right:1248,top:650,bottom:718,width:248,height:68})};
 try{
  globalThis.document={documentElement:{clientWidth:1200,clientHeight:800},createElement:()=>panel,
   getElementById:id=>id==='main'?main:id==='site-header'?{getBoundingClientRect:()=>({bottom:80})}:null,
   body:{append(){},style:{setProperty(){}},classList:{toggle(){}}},addEventListener(){}};
  globalThis.ResizeObserver=class{observe(){}};
  globalThis.requestAnimationFrame=()=>1;
  globalThis.getComputedStyle=()=>({display:'block',visibility:'visible'});
  const dock=mountFloatingCta();dock.sync('/explore');
  assert.equal(panel.hidden,true);assert.equal(catalogClass,true);assert.equal(exploreAction.hidden,true);
  top=57;dock.sync('/explore');assert.equal(panel.hidden,true);
  top=56;dock.sync('/explore');assert.equal(panel.hidden,false,'Exactly half hidden activates the popup');
  top=-100;dock.sync('/explore/');assert.equal(panel.hidden,false,'Cards underneath do not override the CTA threshold');
  top=120;dock.sync('/explore');assert.equal(panel.hidden,true,'Scrolling back restores the inline CTA');
  dock.sync('/about');assert.equal(catalogClass,false);assert.equal(exploreAction.hidden,false);
 }finally{Object.assign(globalThis,saved);}
});

test('home CTA remains through content and FAQ, and follows the real footer after re-render',()=>{
 const keys=['document','ResizeObserver','IntersectionObserver','requestAnimationFrame','getComputedStyle'];
 const saved=Object.fromEntries(keys.map(key=>[key,globalThis[key]]));
 let notify,observed;
 const box=(top,height=50)=>({left:1000,right:1200,top,bottom:top+height,width:200,height});
 let grid={getBoundingClientRect:()=>box(900,200),focus(){}};
 const footer={querySelector:()=>grid,getBoundingClientRect:()=>box(500,700),focus(){}};
 const source={getBoundingClientRect:()=>box(-100),querySelectorAll:()=>[]};
 const control={getBoundingClientRect:()=>box(680)};
 const main={querySelector:selector=>selector.includes('.mkt-hero')?source:null,querySelectorAll:()=>[control]};
 const panel={hidden:true,dataset:{},contains:()=>false,querySelector:()=>null,querySelectorAll:()=>[],getBoundingClientRect:()=>box(650,122)};
 try{
  globalThis.document={documentElement:{clientHeight:800},createElement:()=>panel,
   getElementById:id=>id==='main'?main:id==='site-footer'?footer:null,
   body:{append(){},style:{setProperty(){}},classList:{toggle(){}}},addEventListener(){}};
  globalThis.ResizeObserver=class{observe(){}};
  globalThis.IntersectionObserver=class{constructor(callback){notify=callback;}observe(target){observed=target;}unobserve(){}};
  globalThis.requestAnimationFrame=()=>1;
  globalThis.getComputedStyle=()=>({visibility:'visible',display:'block'});
  const dock=mountFloatingCta();dock.sync('/');
  assert.equal(observed,grid,'Observe the logo/link grid rather than the FAQ wrapper');
  assert.equal(panel.hidden,false,'Content beneath the home CTA does not hide it');
  notify([{target:footer,isIntersecting:true}]);assert.equal(panel.hidden,false,'The FAQ wrapper is not the footer boundary');
  notify([{target:grid,isIntersecting:true}]);assert.equal(panel.hidden,true);
  const oldGrid=grid;grid={getBoundingClientRect:()=>box(1000,200),focus(){}};
  dock.sync('/');assert.equal(observed,grid);assert.equal(panel.hidden,false);
  notify([{target:oldGrid,isIntersecting:true}]);assert.equal(panel.hidden,false,'Ignore stale observer entries');
  dock.sync('/about');assert.equal(panel.hidden,true,'Other pages retain collision protection');
 }finally{Object.assign(globalThis,saved);}
});

test('template detail has one contextual purple CTA, follows the selected template and yields only to footer/dialog',()=>{
 const keys=['document','ResizeObserver','IntersectionObserver','requestAnimationFrame','getComputedStyle'];
 const saved=Object.fromEntries(keys.map(key=>[key,globalThis[key]]));
 let sourceUrl='/create/birthday?mode=quick&version=v1',dialogOpen=false,sourcePresent=true,single=false,notifyFooter;
 const box={left:900,right:1148,top:650,bottom:696,width:248,height:46};
 const create={href:FLOATING_CREATE_URL,getAttribute(){return this.href;},setAttribute(_key,value){this.href=value;}};
 const explore={hidden:false};
 const source={getAttribute:()=>sourceUrl};
 const main={querySelector:selector=>selector==='[data-template-create-cta]'?(sourcePresent?source:null):selector==='dialog[open]'&&dialogOpen?{}:null,
  querySelectorAll:()=>[{getBoundingClientRect:()=>box}]};
 const footer={getBoundingClientRect:()=>({...box,top:1000,bottom:1200,height:200})};
 const panel={hidden:true,dataset:{},contains:()=>false,getBoundingClientRect:()=>box,
  classList:{add(){},remove(){},toggle(_name,value){single=value;}},
  querySelector:selector=>selector==='[data-floating-action="create"]'?create:selector==='[data-floating-action="explore"]'?explore:null};
 try{
  globalThis.document={documentElement:{clientWidth:1200,clientHeight:800},createElement:()=>panel,
   getElementById:id=>id==='main'?main:id==='site-footer'?footer:null,
   body:{append(){},style:{setProperty(){}},classList:{toggle(){}}},addEventListener(){}};
  globalThis.ResizeObserver=class{observe(){}};
  globalThis.IntersectionObserver=class{constructor(callback){notifyFooter=callback;}observe(){}unobserve(){}};
  globalThis.requestAnimationFrame=()=>1;
  globalThis.getComputedStyle=()=>({visibility:'visible',display:'block'});
  const dock=mountFloatingCta();dock.sync('/template/birthday');
  assert.equal(panel.hidden,false,'Inline CTA and preview artwork do not suppress the detail popup');
  assert.equal(single,true);assert.equal(explore.hidden,true);assert.equal(create.href,sourceUrl);
  notifyFooter([{target:footer,isIntersecting:true}]);assert.equal(panel.hidden,true);
  notifyFooter([{target:footer,isIntersecting:false}]);assert.equal(panel.hidden,false);
  dialogOpen=true;dock.sync('/template/birthday');assert.equal(panel.hidden,true);
  dialogOpen=false;dock.sync('/template/birthday');assert.equal(panel.hidden,false);
  sourceUrl='/create/wedding?mode=quick&version=v2';dock.sync('/template/wedding/');
  assert.equal(create.href,sourceUrl);assert.equal(panel.hidden,false);
  sourcePresent=false;dock.sync('/template/missing');assert.equal(panel.hidden,true,'Loading/error content cannot create the previous template');
  dock.sync('/about');assert.equal(single,false);assert.equal(explore.hidden,false);assert.equal(create.href,FLOATING_CREATE_URL);
 }finally{Object.assign(globalThis,saved);}
});
