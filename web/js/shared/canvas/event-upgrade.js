import { eventRecipe } from './event-recipes.js';
import { EVENT_MEDIA, REALISTIC_ARTWORK_LABEL } from './event-media.js';
import { createElement } from './registry.js';
import { eventMediaId } from './event-media.js';
// Applies only while creating the three new starting documents, never on read.
export function upgradeEventCard(id,doc,localize){
 const find=key=>doc.elements.find(e=>e.id===key), common=key=>localize(`interactive.${key}`);
 for(const s of doc.scenes)s.effects={surface:eventRecipe('cotton-paper-v2'),transition:{id:'T01',speed:'normal'}};
 for(const e of doc.elements){delete e.effects;if(e.type==='image')e.effects={surface:eventRecipe('paper-shadow-v2'),entrance:{id:'E02',speed:'normal',delay:150}};}
 const media=(key,art)=>{const e=find(key);if(e){e.props.assetId=eventMediaId(art);e.accessibility.label=REALISTIC_ARTWORK_LABEL;}};
 const insert=(scene,type,key,box,props,extra={})=>{const e=createElement(type,{id:key,name:common(key),layout:{x:box[0],y:box[1],width:box[2],height:box[3],rotation:0},props,...extra},localize);doc.elements.push(e);doc.scenes.find(s=>s.id===scene).elementIds.push(key);return e;};
 if(id==='hai-phong-bi'){
  media('event-photo-wedding-memory','envelope-memory');media('event-photo-wedding-wish','envelope-celebration');
  for(const [i,key]of ['event-photo-wedding-memory','event-photo-wedding-wish'].entries())find(key).effects={surface:eventRecipe('paper-shadow-v2'),entrance:eventRecipe('photo-arrive-v3',{speed:'normal',delay:i*150}),emphasis:eventRecipe('keepsake-sway-v1')};
  for(const key of ['open-memory','open-wish']){const e=find(key);e.type='envelope';e.props.preset='photo-caption-v3';e.props.color='#7757A2';e.effects={reaction:{id:'R01',speed:'normal'}};}
 }else if(id==='birthday-radiance'){
  media('event-photo-birthday','cake-unlit');media('event-photo-birthday-reply','cake-unlit');
  Object.assign(find('event-photo-birthday').layout,{y:325,height:225});
  Object.assign(find('name-ribbon').layout,{y:215,height:82});Object.assign(find('text-recipient').layout,{y:218,height:78});
  find('cover-note').visible=false;find('event-photo-birthday').effects={surface:eventRecipe('paper-shadow-v2'),entrance:{id:'E01',speed:'normal',delay:0}};
  const candle=insert('scene-cover','interaction','birthday-candle',[34,325,322,292],{kind:'light-a-candle',appearance:'cake-photo-v2',color:'#FFF8F0',entries:[{heading:common('light'),body:common('candleWish')}]});
  find('open-gift').layout.y=640;
  candle.effects={reaction:{id:'R04',speed:'normal'}};find('open-gift').props.label=common('continueSkip');find('open-gift').accessibility.label=common('continueSkip');
 }else{
  media('event-photo-graduation','cap-untasselled');media('event-photo-graduation-letter','cap-untasselled');
  find('event-photo-graduation').effects={surface:eventRecipe('paper-shadow-v2'),entrance:{id:'E01',speed:'normal',delay:0}};
  // A separate path layer: the cap and all type remain at rest.
  const tassel=insert('scene-cover','shape','graduation-tassel',[187,339,84,153],{kind:'graduation-tassel-v1',color:'#E9BA63',radius:0});
  tassel.artwork={paths:[{d:'M9 4C20 30 49 67 72 78L68 83C40 66 15 29 5 6Z',fill:'color'},{d:'M72 76L83 77L99 96L86 100L69 85Z',fill:'color'},{d:'M75 83L89 98M79 82L94 97',fill:'none',stroke:'#F8F1E6',strokeWidth:1}]};
  tassel.effects={surface:eventRecipe('paper-shadow-v2'),emphasis:eventRecipe('hanging-sway-v2')};
  const photo=find('event-photo-graduation'),anchor=EVENT_MEDIA[photo.props.assetId].anchors?.capButton||{x:.5,y:.37},fit=Math.min(photo.layout.width/1000,photo.layout.height/700);tassel.layout.x=Math.round((photo.layout.x+(photo.layout.width-1000*fit)/2+1000*fit*anchor.x-84*.09)*100)/100;tassel.layout.y=Math.round((photo.layout.y+(photo.layout.height-700*fit)/2+700*fit*anchor.y-153*.04)*100)/100;
  Object.assign(find('text-message').layout,{y:224,height:130});Object.assign(find('message-to').layout,{y:175,height:50});
  const letter=insert('scene-surprise','interaction','proud-letter',[28,379,334,215],{kind:'foldout-letter',appearance:'paper-fold-v2',color:'#F8F1E6',entries:[1,2,3].map(i=>({heading:common(`milestone${i}`),body:common(`proudFold${i}`)}))});
  letter.effects={surface:eventRecipe('cotton-paper-v2')};
  Object.assign(find('message-heading').layout,{y:95,height:80});Object.assign(find('message-from-label').layout,{y:625,height:30});Object.assign(find('text-sender').layout,{y:667,height:60});find('to-message').layout.y=760;
 }
 if(id==='hai-phong-bi'){for(const [key,y]of [['open-memory',300],['open-wish',511]])Object.assign(find(key).layout,{x:36,y,width:318,height:190});doc.scenes.find(s=>s.id==='scene-message').effects.ambience={id:'B02',speed:'normal',density:'sparse',loop:false};}
 if(id==='birthday-radiance')doc.scenes.find(s=>s.id==='scene-reply').effects.ambience={id:'B01',speed:'normal',density:'sparse',loop:false};
 if(id==='proud-of-you')doc.scenes.find(s=>s.id==='scene-reply').effects.ambience={id:'B03',speed:'slow',density:'sparse',loop:false};
 const used=new Set(doc.elements.filter(e=>e.type==='image').map(e=>e.props.assetId).filter(Boolean));doc.assets=[...used].map(assetId=>({assetId,kind:'image'}));
 const order=new Map(doc.scenes.flatMap((s,i)=>s.elementIds.map(key=>[key,i])));doc.elements.sort((a,b)=>order.get(a.id)-order.get(b.id)||a.layout.y-b.layout.y);
}
