import {EVENT_MEDIA} from './event-media.js';
import {VOLUME_GIFT_PRESET} from './gift-volume.js';
import {SOURCE_GIFT_PRESET} from './source-gift.js';
export const NATURAL_OPENINGS=[VOLUME_GIFT_PRESET,'wax-letter-natural-v3','lid-card-natural-v3',SOURCE_GIFT_PRESET];
export const DRIVE_OPENING_PRESETS=['lid-card-v1','wax-letter-v1','lid-card-v2','wax-letter-v2',...NATURAL_OPENINGS];
export const OBJECT_APPEARANCE='object-natural-v3';
export const DIPLOMA_MASK=[[0,70],[27,73],[30,70],[34,69],[38,75],[43,79],[48,79],[54,74],[57,77],[61,81],[100,81],[100,100],[0,100]];
export const OBJECT_MEDIA={gift:'event-natural-element-3d-gift-01eeafd96b34',bow:'event-natural-element-satin-bow-2f441b11b6ff',envelope:'event-envelope-memory-5d088ad5e0ab',seal:'event-natural-element-wax-seal-a410102a2d47',camera:'event-natural-element-3d-camera-aa8e4e48f261',cap:'event-cap-untasselled-9560aaee062c'};
export function naturalizeObject(model,localize,{previousPreset}={}){
 const p=model.props;
 if(model.type==='gift-box'&&p.preset?.startsWith('lid-')){
  const requestedPhoto=p.preset==='lid-card-natural-v3'&&previousPreset!==undefined,target=requestedPhoto?'lid-card-natural-v3':previousPreset!==undefined&&p.preset===VOLUME_GIFT_PRESET?VOLUME_GIFT_PRESET:SOURCE_GIFT_PRESET,image=requestedPhoto?OBJECT_MEDIA.gift:OBJECT_MEDIA.bow;
  Object.assign(p,{preset:target,assetId:(previousPreset??p.preset)===target?(p.assetId||image):image,cardText:p.cardText||localize('natural.cardText'),sealColor:p.sealColor||'#C69A60',paperColor:p.paperColor||'#FFF3DC',motionSpeed:'slow'});if(target===SOURCE_GIFT_PRESET){delete p.assetId;p.objectDepth??=8;}
 }
 else if(model.type==='envelope'&&p.preset?.startsWith('wax-letter'))Object.assign(p,{preset:NATURAL_OPENINGS[1],assetId:p.assetId||OBJECT_MEDIA.envelope,sealAssetId:p.sealAssetId||OBJECT_MEDIA.seal,cardText:p.cardText||localize('natural.cardText'),motionSpeed:'slow'});
 else if(model.type==='interaction'&&['camera-print','ribbon-diploma','cap-toss'].includes(p.kind))Object.assign(p,{appearance:OBJECT_APPEARANCE,objectAssetId:p.objectAssetId||OBJECT_MEDIA[p.kind==='camera-print'?'camera':'cap']});
 return model;
}
export function naturalizeDriveDocument(document,id,localize){
 for(const model of document.elements)naturalizeObject(model,localize);
 if(id==='secret-santa-invitation')for(const model of document.elements)if(model.props.preset===SOURCE_GIFT_PRESET)model.props.color='#2D6B53';
 if(['secret-santa-invitation','midnight-soiree','graduation-mixtape'].includes(id)){
  const cover=document.scenes.find(s=>s.id===document.entrySceneId),remove=new Set(cover.elementIds.filter(key=>key.startsWith(cover.id+'-theme-sticker-')));
  cover.elementIds=cover.elementIds.filter(key=>!remove.has(key));document.elements=document.elements.filter(e=>!remove.has(e.id));
 }
 return document;
}
export function addObjectAssets(document){
 for(const e of document.elements){const refs=NATURAL_OPENINGS.includes(e.props.preset)?[e.props.assetId,e.props.sealAssetId]:[e.props.objectAssetId];for(const id of refs)if(id&&EVENT_MEDIA[id]&&!document.assets.some(a=>a.assetId===id))document.assets.push({assetId:id,kind:'image'});}
 return document;
}
export function objectHue(color){const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255),[r,g,b]=rgb,max=Math.max(...rgb),min=Math.min(...rgb),d=max-min;if(!d)return 0;return Math.round(((max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4)*60+10)%360);}
export function objectTint(color,kind){
 if(kind==='gift')return{type:'hueRotate',values:String(objectHue(color))};
 const channels=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255);
 return{type:'matrix',values:channels.flatMap(c=>[.2126*.9*c,.7152*.9*c,.0722*.9*c,0,.4*c]).concat([0,0,0,1,0]).join(' ')};
}
export function naturalObjectFrame(p,width,height){
 const aspect=p.preset.startsWith('lid-')?1:700/490,w=Math.min(width,Math.max(1,height-44)*aspect),h=w/aspect;
 return{x:(width-w)/2,y:Math.max(0,(height-44-h)/2),width:w,height:h};
}
const blank={paths:[{d:'M0 0',fill:'none'}]};
// Same immutable pixels, same part masks in playback and generated covers.
export function naturalOpeningParts(p){
 const box=p.preset.startsWith('lid-card'),mediaId=OBJECT_MEDIA[box?'gift':'envelope'];
 const lid=box?'M0 0H100V42L78 53L51 42L26 35L0 36Z':'M3 25H97Q96 35 87 41L55 70Q50 73 46 70L12 40Q4 35 3 25Z';
 const body=box?'M0 35L26 34L51 41L78 52L100 41V100H0Z':`M0 25H100V100H0Z ${lid}`;
 return{version:2,parts:[{id:'body',title:'Body',anchor:{x:.5,y:.5},vector:blank,image:{mediaId,x:0,y:0,width:100,height:100},clip:{d:body}},{id:box?'lid':'flap',title:box?'Lid':'Flap',anchor:{x:.5,y:.26},vector:blank,image:{mediaId,x:0,y:0,width:100,height:100},clip:{d:lid}}]};
}
