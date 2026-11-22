import { createElement } from './registry.js';
import { validateDocument } from './schema.js';
import { eventMediaId, REALISTIC_ARTWORK_LABEL } from './event-media.js';
import { eventRecipe } from './event-recipes.js';

export const INTERACTIVE_TEMPLATE_IDS = ['loi-moi-ben-hien','cuon-phim-ngay-ay','ban-do-ngay-ra-truong'];
const palettes = {
 'loi-moi-ben-hien': ['#F8F1E6','#263C32','#59705B','#AA5744','porch'],
 'cuon-phim-ngay-ay': ['#F6EBD9','#352B30','#825943','#DEA99C','film-box'],
 'ban-do-ngay-ra-truong': ['#E6EFF1','#21394C','#375B6A','#E9BA63','journey-map'],
};
export function createInteractiveTemplate(id, localize) {
 if (!palettes[id]) return null;
 const [paper,ink,accent,detail,art] = palettes[id], c=key=>localize(`templates.${id}.${key}`), common=key=>localize(`interactive.${key}`);
 const doc={schemaVersion:2,registryVersion:2,artboard:{baseSize:{width:390,height:844},layoutMode:'responsive-scene',safeInsets:{top:24,right:24,bottom:24,left:24}},entrySceneId:'scene-cover',bindings:Object.fromEntries(['recipientName','senderName','message'].map(k=>[k,{type:'text',value:''}])),assets:[],elements:[],scenes:[],responsive:{textOverflow:'expand-flow',sceneOverflow:'scroll',desktop:{maxContentWidth:600,align:'center'}}};
 const scene=(key,label)=>{doc.scenes.push({id:key,name:label,background:{kind:'solid',color:paper},elementIds:[],effects:{surface:eventRecipe('cotton-paper-v2'),transition:{id:'T01',speed:'normal'}}});return key;};
 const add=(at,type,key,box,props={},extra={})=>{const e=createElement(type,{id:key,name:props.text || props.label || (props.kind && type==='interaction' ? localize(`gift.interactions.kind.${props.kind}`) : localize(`editor.element.${type}`)),layout:{x:box[0],y:box[1],width:box[2],height:box[3],rotation:0},props,...extra},localize);e.name=e.name.slice(0,100);doc.elements.push(e);doc.scenes.find(s=>s.id===at).elementIds.push(key);return e;};
 const text=(at,key,value,y,h=90,size=21)=>add(at,'text',key,[34,y,322,h],{text:value,color:ink,fontToken:'body',fontSize:size,align:'left',lineHeight:1.5});
 const heading=(at,key,value,y=54)=>{const e=text(at,key,value,y,110,32);e.props.fontToken='serif';e.accessibility={role:'heading',level:1};return e;};
 const binding=(at,key,name,y,h=80)=>{const e=add(at,'text',key,[34,y,322,h],{textBinding:name,color:ink,fontToken:'body',fontSize:22,align:'left',lineHeight:1.5});e.name=localize(`editor.binding.${name}`);return e;};
 const go=(at,key,value,to,y=735)=>add(at,'button',key,[34,y,322,64],{label:value,color:accent},{actions:[{on:'activate',type:'goToScene',targetSceneId:to}]});
 const album=(at,next)=>{
  heading(at,'album-heading',common('album'));text(at,'album-story',c('albumStory'),180,120);
  add(at,'interaction','event-album',[26,330,338,300],{kind:'swipe-album',color:paper,optional:true,autoplay:false,photos:Array.from({length:3},(_,i)=>({id:`event-photo-slot-${i+1}`,assetId:null,alt:'',caption:'',focalPoint:{x:.5,y:.5}}))});
  go(at,'album-next',common('continue'),next);
 };
 const reply=()=>{const at=scene('scene-reply',common('reply'));heading(at,'reply-heading',common('reply'));binding(at,'text-message','message',165,190);binding(at,'text-sender','senderName',375,60);add(at,'reply','reply-card',[24,465,342,260],{title:common('reply'),submitLabel:localize('templates.copy.sendReply')});go(at,'back-cover',common('back'),'scene-cover',755);};
 const cover=scene('scene-cover',common('cover'));
 text(cover,'cover-kicker',c('kicker'),32,34,15);heading(cover,'cover-title',c('headline'),92);binding(cover,'text-recipient','recipientName',230,94);
 const assetId=eventMediaId(art);doc.assets.push({assetId,kind:'image'});
 add(cover,'image','cover-art',[14,352,362,254],{assetId,fit:'contain',radius:0},{accessibility:{decorative:true,label:REALISTIC_ARTWORK_LABEL},effects:{surface:eventRecipe('paper-shadow-v2'),entrance:eventRecipe('photo-arrive-v3',{speed:'normal'}),...(id!=='ban-do-ngay-ra-truong'?{emphasis:eventRecipe('keepsake-sway-v1')}: {})}});
 text(cover,'cover-note',c('note'),640,65,18);
 if(id==='loi-moi-ben-hien') {
  doc.scenes[0].effects.ambience=eventRecipe('porch-sun-v1');
  go(cover,'open-gift',common('timePlace'),'scene-details');
  let at=scene('scene-details',common('timePlace'));heading(at,'details-heading',common('timePlace'));
  text(at,'event-date',common('datePrompt'),200,90);text(at,'event-location',common('placePrompt'),325,150);text(at,'event-note',c('detailsNote'),530,100);go(at,'details-next',common('schedule'),'scene-schedule');
  at=scene('scene-schedule',common('schedule'));heading(at,'schedule-heading',common('schedule'));
  for(let i=0;i<2;i++){
   const y=205+i*245;
   add(at,'line',`event-${i+1}-rule`,[34,y,322,2],{color:detail,strokeWidth:2});
   text(at,`event-${i+1}-time`,common('timePrompt'),y+18,46,20);
   text(at,`event-${i+1}-activity`,common(`activity${i+1}`),y+76,56,23);
   text(at,`event-${i+1}-address`,common('addressPrompt'),y+144,90,18);
  }
  go(at,'schedule-next',common('album'),'scene-album',755);at=scene('scene-album',common('album'));album(at,'scene-reply');reply();
 } else if(id==='cuon-phim-ngay-ay') {
  go(cover,'open-gift',common('memories'),'scene-album');const at=scene('scene-album',common('memories'));album(at,'scene-present');
  for(let side=0;side<2;side++)for(let i=0;i<8;i++)add(at,'shape',`film-perf-${side}-${i}`,[side?372:7,330+i*35,10,18],{kind:'rectangle',color:accent,radius:2});
  const present=scene('scene-present',c('present'));heading(present,'present-heading',c('present'));text(present,'present-story',c('presentStory'),210,230);go(present,'present-next',common('continue'),'scene-reply');reply();
 } else {
  const points=[[93,490],[194,426],[289,528]];
  for(let i=0;i<2;i++){const [x1,y1]=points[i],[x2,y2]=points[i+1],len=Math.hypot(x2-x1,y2-y1),angle=Math.atan2(y2-y1,x2-x1)*180/Math.PI;const path=add(cover,'line',`cover-route-${i+1}`,[Math.round(((x1+x2-len)/2)*100)/100,Math.round(((y1+y2)/2)*100)/100,Math.round(len*100)/100,3],{color:accent,strokeWidth:3});path.layout.rotation=Math.round(angle*100)/100;path.effects={entrance:{id:'E04',speed:'normal',delay:300}};}
  for(const [i,[x,y]]of points.entries())add(cover,'shape',`cover-marker-${i+1}`,[x-9,y-9,18,18],{kind:'ellipse',color:detail,strokeColor:ink,strokeWidth:2},{effects:{entrance:{id:'E01',speed:'normal',delay:300},surface:eventRecipe('paper-shadow-v2')}});
  go(cover,'open-gift',common('explore'),'scene-milestone-1');
  for(let i=0;i<3;i++){
   const at=scene(`scene-milestone-${i+1}`,common(`milestone${i+1}`));heading(at,`milestone-${i+1}-title`,common(`milestone${i+1}`));
   const path=add(at,'line',`milestone-${i+1}-path`,[34,210,322,4],{color:accent,strokeWidth:4});path.effects={entrance:{id:'E04',speed:'normal',delay:0}};
   add(at,'shape',`milestone-${i+1}-dot`,[34+i*135,195,28,28],{kind:'ellipse',color:detail});text(at,`milestone-${i+1}-body`,c(`milestone${i+1}Body`),285,300);
   go(at,`milestone-${i+1}-next`,common('continue'),i===2?'scene-reply':`scene-milestone-${i+2}`);
  }
  reply();
 }
 return validateDocument(doc);
}
