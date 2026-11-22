import { eventRecipe } from './event-recipes.js';
import { createElement } from './registry.js';
// Independent editable layers. Document order is reading order; insertion may
// separately change scene.elementIds for stacking. No decorative layer focuses.
const layer=(type,id,box,props,more={})=>createElement(type,{id,layout:{x:box[0],y:box[1],width:box[2],height:box[3],rotation:0},props,...more});
const txt=(id,text,y,height=60)=>layer('text',id,[12,y,306,height],{text,fontSize:20,color:'#263C32',lineHeight:1.5});
export function eventCluster(id, t){
 const c=key=>t(`interactive.${key}`), key=part=>`${id}-${part}`;
 if(id==='shadow-contact')return [layer('shape',key('shadow'),[0,0,300,28],{kind:'ellipse',color:'#352B30'},{opacity:.18,effects:{surface:eventRecipe('contact-shadow-v1')}})];
 if(id==='layered-paper')return [layer('shape',key('back'),[7,14,306,210],{kind:'rectangle',color:'#E9DDC9',radius:3},{effects:{surface:eventRecipe('paper-shadow-v2')}}),layer('shape',key('middle'),[3,7,306,210],{kind:'rectangle',color:'#F1E7D5',radius:3}),layer('shape',key('front'),[0,0,306,210],{kind:'rectangle',color:'#FFF9EE',radius:3},{effects:{surface:eventRecipe('cotton-paper-v2')}})];
 if(id==='raised-photo')return [layer('shape',key('paper'),[0,0,330,284],{kind:'rectangle',color:'#FFFAF0',radius:3},{effects:{surface:eventRecipe('paper-shadow-v2')}}),layer('image',key('photo'),[13,13,304,200],{assetId:null,optional:true,radius:1},{effects:{surface:eventRecipe('paper-shadow-v2')}}),txt(key('caption'),c('photo-caption'),227)];
 if(id==='photo-caption')return [layer('shape',key('paper'),[0,0,330,290],{kind:'rectangle',color:'#F8F1E6',radius:3}),layer('image',key('photo'),[12,12,306,190],{assetId:null,optional:true,radius:0}),txt(key('caption'),c(id),220)];
 if(id==='time-place-card')return [txt(key('time'),c('datePrompt'),0),txt(key('place'),c('placePrompt'),80,120)];
 if(id==='program-row')return [txt(key('time'),c('timePrompt'),0),txt(key('activity'),c('activity1'),65),txt(key('address'),c('addressPrompt'),140,110),layer('line',key('rule'),[12,270,306,2],{color:'#AA5744',strokeWidth:2})];
 if(id==='equal-envelopes')return [0,1].map(i=>layer('envelope',key(String(i)),[0,i*190,320,150],{label:c(i?'reply':'memories'),color:i?'#AA5744':'#59705B'},{effects:{reaction:{id:'R01',speed:'normal'}}}));
 if(id==='folded-letter')return [layer('interaction',key('folds'),[0,0,334,230],{kind:'foldout-letter',appearance:'paper-fold-v2',color:'#F8F1E6',entries:[1,2,3].map(i=>({heading:c(`milestone${i}`),body:c(`proudFold${i}`)}))})];
 if(id==='journey-board')return [layer('line',key('path'),[12,0,306,4],{color:'#375B6A',strokeWidth:4},{effects:{entrance:{id:'E04',speed:'normal',delay:0}}}),...[1,2,3].flatMap((i)=>[txt(key(`title-${i}`),c(`milestone${i}`),35+(i-1)*125,40),txt(key(`body-${i}`),c(`proudFold${i}`),80+(i-1)*125,60)])];
 throw new Error('Unknown event composition');
}
export const EVENT_CLUSTER_IDS=['photo-caption','time-place-card','program-row','equal-envelopes','folded-letter','journey-board','shadow-contact','layered-paper','raised-photo'];
