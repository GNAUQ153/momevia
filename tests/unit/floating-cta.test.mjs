import test from 'node:test';
import assert from 'node:assert/strict';
import {isEditingRoute,FLOATING_CREATE_URL,FLOATING_EXPLORE_URL,mountFloatingCta} from '../../web/js/ui/floating-cta.js';

test('floating actions stay on browsing pages and hide only for editing routes',()=>{
 for(const route of ['/','/explore','/template/a','/g/owned-gift','/studio','/creator','/admin','/login','/register','/policies/privacy'])assert.equal(isEditingRoute(route),false,route);
 for(const route of ['/design/new','/design/a','/design/a/','/create/template-id','/admin/library','/admin/library/'])assert.equal(isEditingRoute(route),true,route);
});
test('floating destinations are fixed and contain no gift, recipient or invite context',()=>{
 assert.equal(FLOATING_CREATE_URL,'/design/new');assert.equal(FLOATING_EXPLORE_URL,'/explore');
 for(const value of [FLOATING_CREATE_URL,FLOATING_EXPLORE_URL]){const url=new URL(value,'https://momevia.example');assert.equal(url.search,'');assert.equal(url.hash,'');assert.equal(url.origin,'https://momevia.example');}
});

test('floating dock reveals keyboard focus without moving a control during mouse or touch activation',()=>{
 const previousDocument=globalThis.document,previousObserver=globalThis.ResizeObserver,handlers=new Map(),scrolls=[];
 const panel={hidden:false,dataset:{},contains:()=>false,getBoundingClientRect:()=>({top:500,bottom:650,left:100,right:400,height:150})};
 const control={matches:()=>true,getBoundingClientRect:()=>({top:520,bottom:560,left:120,right:350}),scrollIntoView:options=>scrolls.push(options)};
 try{
  globalThis.document={createElement:()=>panel,body:{append(){},style:{setProperty(){}},classList:{toggle(){}}},addEventListener:(name,handler)=>handlers.set(name,handler)};
  globalThis.ResizeObserver=class{observe(){}};
  const dock=mountFloatingCta();dock.sync('/login');
  handlers.get('focusin')({target:control});assert.equal(scrolls.length,1,'Programmatic focus remains visible');
  for(const pointerType of ['mouse','touch']){handlers.get('pointerdown')({pointerType});handlers.get('focusin')({target:control});assert.equal(scrolls.length,1);handlers.get('click')({});}
  handlers.get('keydown')({key:'Tab'});handlers.get('focusin')({target:control});
  assert.deepEqual(scrolls,Array(2).fill({block:'center',inline:'nearest',behavior:'instant'}));
  handlers.get('pointerdown')({pointerType:'mouse'});handlers.get('focusin')({target:control});assert.equal(scrolls.length,2);
  handlers.get('pointercancel')({});handlers.get('focusin')({target:control});assert.equal(scrolls.length,3);
  dock.sync('/design/new');handlers.get('keydown')({key:'Tab'});handlers.get('focusin')({target:control});assert.equal(scrolls.length,3);
 }finally{globalThis.document=previousDocument;globalThis.ResizeObserver=previousObserver;}
});
