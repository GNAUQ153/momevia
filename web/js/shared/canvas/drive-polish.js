import {softenElement} from './drive-soft.js';
import {eventRecipe} from './event-recipes.js';
import {motionRow} from './motion-stack.js';
import {localVideoModels} from './local-video.js';
import {vividDriveDocument} from './drive-vivid.js';

const backgrounds={
 'secret-santa-invitation':['#183E35','#FFF3DC','#F8ECD9','#EAF0E6','#FAEFD9','#F1E5DC','#F3E0C9','#FFF6E5','#E6EEE7'],
 'midnight-soiree':['#141B32','#FFF2DB','#F3E8DD','#E9E8F0','#FBF0DB','#EEE2E7','#F2E6D2','#FFF2DB','#E3E1EB'],
 'graduation-countdown':['#F4E6E8','#FFF4E9','#F1E6EA','#F8EDDA','#F5E5E8','#E8EBEF','#FFF5E5','#EDE4EB'],
 'graduation-mixtape':['#D8A8BE','#FFF3E4','#E9E8EE','#F8EBE3','#EBE4EA','#F3E5D7','#E6EBF0','#FFF4E8','#E6E7ED'],
 'the-last-chapter-v2':['#EEF3F6','#EAF1F5','#F5EAD8','#FFF1DC','#E9EFF5','#F7E8E2','#EEF1E8','#F7EEDB','#EEF3F6','#E8EDF3'],
};
// Applied only when authoring a new document; stored gifts keep their v1 props.
export function polishDriveDocument(doc,id,palette,localize){
 const p={...palette,detail:palette.detail||'#E8D4A8'};
 for(const[index,scene]of doc.scenes.entries()){
  if(backgrounds[id]?.[index])scene.background.color=backgrounds[id][index];
  scene.effects??={};if(index>0){scene.effects.transition={...(scene.effects.transition||{id:'T07'}),speed:'slow'};scene.effects.surface=eventRecipe('cotton-paper-v2');}
  if(index===0&&!scene.effects.ambience)scene.effects.ambience=eventRecipe('porch-sun-v1',{density:'sparse',loop:false});
 }
 for(const e of doc.elements){
  softenElement(e,p);
  if(e.props.kind==='cap-toss')e.effects={...e.effects,reaction:{id:'R03',speed:'slow'}};
  if(e.type==='text'&&e.accessibility.role==='heading')e.effects={...e.effects,entrance:{id:'E02',speed:'slow',delay:0}};
  if(e.type==='image'&&e.props.optional)e.effects={...e.effects,entrance:eventRecipe('photo-arrive-v3')};
  if(e.type==='image'&&e.accessibility.decorative&&doc.scenes.slice(1).some(s=>s.elementIds.includes(e.id)))e.opacity=Math.min(e.opacity??1,.3);
  if(e.type==='shape'&&e.props.kind==='rectangle'&&!e.artwork&&e.layout.width>100&&e.layout.height>100)e.effects={...e.effects,surface:eventRecipe('paper-shadow-v2')};
 }
 const sprig=doc.elements.find(e=>e.id.includes('pine')&&!e.motions&&e.type==='shape');
 if(sprig){const row=motionRow('sway','drive-sprig-sway-v2');Object.assign(row,{amplitude:.18,periodMs:5200,iterations:2});sprig.motions={version:1,enabled:true,rows:[row]};}
 const scene=doc.scenes.find(s=>s.id===(id==='the-last-chapter-v2'?'scene-outro':'scene-message'));
 if(scene){
  const [video]=localVideoModels(localize);video.id='optional-video';video.name=localize('video.title');video.props.color=p.paper;Object.assign(video.layout,{x:28,y:id==='the-last-chapter-v2'?450:425,width:334,height:id==='the-last-chapter-v2'?250:280});
  doc.elements.push(video);scene.elementIds.push(video.id);
  for(const e of doc.elements.filter(e=>scene.elementIds.includes(e.id))){
   if(e.type==='text'&&e.props.textBinding==='message'){e.layout.y=id==='garden-tea'?320:240;e.layout.height=id==='garden-tea'?110:150;}
   if(e.type==='sound-button'){e.layout.y=720;e.layout.height=44;}
   if(id==='the-last-chapter-v2'&&e.id==='outro-message'){e.layout.y=320;e.layout.height=104;}
   if(id==='the-last-chapter-v2'&&e.id==='outro-sender'){e.layout.y=715;e.layout.height=45;}
  }
  if(scene.flow)scene.flow.region.height=260;
 }
 return vividDriveDocument(doc,id);
}
