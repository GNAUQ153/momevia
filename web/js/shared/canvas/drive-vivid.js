import {createElement} from './registry.js';
import {motionRow} from './motion-stack.js';
export const VIVID_THEMES={
 'garden-tea':{ink:'#174C3C',accent:'#B72E60',detail:'#E6AB27',paper:'#FFF7EB',scenes:['#174C3C','#FFE4DC','#204F42','#D4EACA','#19523E','#F8CEDB','#255D43','#FFF1DF','#123F34'],stickers:['tea-cup','flower','leaf']},
 'secret-santa-invitation':{ink:'#123E32',accent:'#AF2241',detail:'#DC9840',paper:'#FFF4DF',scenes:['#123E32','#F9DDB1','#123E32','#F9E9CA','#88283D','#CEE1C8','#123E32','#FFF4DF','#88283D'],stickers:['gift','ribbon-bow','star']},
 'midnight-soiree':{ink:'#111B3B',accent:'#8E2547',detail:'#F3C566',paper:'#FFF3DA',scenes:['#111B3B','#8E2547','#111B3B','#263360','#8E2547','#FFF3DA','#111B3B','#FFF3DA','#8E2547'],stickers:['crescent','sparkles','wax-seal']},
 'graduation-countdown':{ink:'#382046',accent:'#9F245B',detail:'#F0BE42',paper:'#FFF4DE',scenes:['#C82F60','#FFF4DE','#5E244C','#F5D472','#5E244C','#F1CCD9','#FFF4DE','#5E244C'],stickers:['sunburst','star','washi-tape']},
 'graduation-mixtape':{ink:'#342137',accent:'#9C2456',detail:'#1C8C8D',paper:'#FFF1DC',scenes:['#B92F68','#FFF1DC','#164E5B','#78234D','#F6CAD7','#167C82','#78234D','#FFF1DC','#78234D'],stickers:['film-camera','sparkles','star']},
 'the-last-chapter-v2':{ink:'#174C83',accent:'#B52E3D',detail:'#E7AE2F',paper:'#FFF4DB',scenes:['#174C83','#D8EAF5','#EDC65C','#174C83','#174C83','#F9D3CF','#174C83','#F3CD70','#FFF4DB','#174C83'],stickers:['star','ribbon-bow','paper-crane']},
};
const dark=color=>{const n=parseInt(color.slice(1),16);return .2126*(n>>16)+.7152*(n>>8&255)+.0722*(n&255)<135;};
// Authoring only. Saved sender colours and published snapshots are never rewritten.
export function vividDriveDocument(doc,id){
 const theme=VIVID_THEMES[id];if(!theme)return doc;
 for(const[index,scene]of doc.scenes.entries()){
  const background=theme.scenes[index]||theme.paper;scene.background.color=background;
  // Coloured stocks read crisply without a white cotton wash over the whole scene.
  if(scene.effects)delete scene.effects.surface;
  const models=doc.elements.filter(e=>scene.elementIds.includes(e.id));
  for(const e of models){
   if(e.type==='shape'&&e.props.kind.startsWith('garden-door-'))e.props.color=theme.ink;
   if(e.type==='text'){
    const centre={x:e.layout.x+e.layout.width/2,y:e.layout.y+e.layout.height/2};
    const paper=models.find(s=>s.type==='shape'&&s.props.kind==='rectangle'&&s.layout.width>100&&s.layout.height>100&&s.props.color&&s.layout.x<=centre.x&&s.layout.y<=centre.y&&s.layout.x+s.layout.width>=centre.x&&s.layout.y+s.layout.height>=centre.y&&!dark(s.props.color));
    e.props.color=paper?theme.ink:dark(background)?theme.paper:theme.ink;
   }
   if(e.type==='button'||e.type==='reply')e.props.color=e.type==='button'&&e.props.variant==='text'&&dark(background)?theme.paper:theme.accent;
   if(e.type==='interaction'&&e.props.inkColor!==undefined){e.props.inkColor=theme.ink;e.props.accentColor=theme.accent;e.props.detailColor=theme.detail;}
  }
  for(let j=0;j<2;j++){
   const sticker=createElement('sticker',{id:`${scene.id}-theme-sticker-${j}`,name:theme.stickers[(index+j)%theme.stickers.length],props:{stickerId:theme.stickers[(index+j)%theme.stickers.length],color:j?theme.detail:dark(background)?theme.detail:theme.accent},layout:{x:j?338:12,y:16,width:36,height:36,rotation:j?12:-12},opacity:.9});
   const row=motionRow('sway',`${sticker.id}-sway`);Object.assign(row,{amplitude:.2,periodMs:4400,iterations:2});sticker.motions={version:1,enabled:true,rows:[row]};
   doc.elements.push(sticker);scene.elementIds.push(sticker.id);
  }
 }
 return doc;
}
