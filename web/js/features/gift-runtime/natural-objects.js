import {renderAssembly} from './motion-stack.js';
import {naturalOpeningParts,objectTint,OBJECT_MEDIA} from '../../shared/canvas/natural-objects.js';
import {t} from '../../core/i18n.js';
import {renderGiftVolume} from './gift-volume.js';
import {VOLUME_GIFT_PRESET,shadeHex} from '../../shared/canvas/gift-volume.js';
const ns='http://www.w3.org/2000/svg';
let sequence=0;
function tint(svg,color,kind){
 const filter=document.createElementNS(ns,'filter'),matrix=document.createElementNS(ns,'feColorMatrix');filter.id='object-tint-'+(++sequence);filter.setAttribute('color-interpolation-filters','sRGB');
 const settings=objectTint(color,kind);matrix.setAttribute('type',settings.type);matrix.setAttribute('values',settings.values);
 filter.append(matrix);const defs=document.createElementNS(ns,'defs');defs.append(filter);svg.prepend(defs);
 for(const image of svg.querySelectorAll('image'))image.setAttribute('filter',`url(#${filter.id})`);
}
const span=(className,text)=>{const el=document.createElement('span');el.className=className;el.setAttribute('aria-hidden','true');if(text)el.textContent=text;return el;};
export function decorateNaturalOpening(node,p,{assetUrl,signal,mode}){
 const box=p.preset.startsWith('lid-'),volume=p.preset===VOLUME_GIFT_PRESET,color=p.color||(box?'#183E35':'#773447');node.classList.add('gift-drive-opening','gift-object-opening',box?'gift-object-box':'gift-object-envelope');
 node.style.setProperty('--drive-radius',(p.cornerRadius??8)+'px');node.style.setProperty('--drive-paper-color',p.paperColor||'#FFF3DC');node.style.setProperty('--drive-object-ink',color);node.style.setProperty('--drive-object-label','#FFF3DC');
 const art=span('gift-object-art');
 const frame=span('gift-object-parts'),card=span('gift-drive-sliding-card gift-object-card',p.cardText||t('natural.cardText'));
 if(volume){
   node.classList.add('gift-object-volume');node.style.setProperty('--cube-ribbon',p.sealColor||'#C69A60');node.style.setProperty('--cube-side',shadeHex(p.color||'#183E35',-.18));node.style.setProperty('--cube-inside',shadeHex(p.color||'#183E35',-.55));node.style.setProperty('--cube-top-color',shadeHex(p.color||'#183E35',.15));
   const bow=renderAssembly({version:2,parts:[{id:'bow',title:'Satin bow',anchor:{x:.5,y:.5},vector:{paths:[{d:'M0 0',fill:'none'}]},image:{mediaId:OBJECT_MEDIA.bow,x:0,y:0,width:100,height:100}}]},{assetId:p.assetId},assetUrl);tint(bow,p.sealColor||'#C69A60','seal');frame.append(renderGiftVolume(card,bow));
 }else{
   const parts=naturalOpeningParts(p);if(box){node.classList.add('gift-object-legacy-photo');parts.parts=[{...parts.parts[0],clip:undefined}];}
   const svg=renderAssembly(parts,p,assetUrl);tint(svg,color,box?'gift':'envelope');art.append(svg);frame.append(card,art);
 }
 node.replaceChildren(frame);
 if(!box){const seal=span('gift-object-seal gift-drive-bow'),sealArt=renderAssembly({version:2,parts:[{id:'seal',title:'Seal',anchor:{x:.5,y:.5},vector:{paths:[{d:'M0 0',fill:'none'}]},image:{mediaId:OBJECT_MEDIA.seal,x:0,y:0,width:100,height:100}}]},{assetId:p.sealAssetId},assetUrl);tint(sealArt,p.sealColor||'#D7B67C','seal');seal.append(sealArt,span('gift-object-monogram',p.label));frame.append(seal);}
 node.append(span('gift-drive-opening-label',t('drive.openNow')));
 node.updateNaturalCopy=props=>{card.textContent=props.cardText||t('natural.cardText');const mark=node.querySelector('.gift-object-monogram');if(mark)mark.textContent=props.label;node.querySelector('.gift-drive-opening-label').textContent=t('drive.openNow');};
 if(['preview','public'].includes(mode)){
  let start;node.style.touchAction='none';node.addEventListener('pointerdown',e=>{start={id:e.pointerId,x:e.clientX,y:e.clientY};},{signal});
  node.addEventListener('pointerup',e=>{if(start?.id===e.pointerId&&(start.y-e.clientY>45||Math.abs(start.x-e.clientX)>60)){e.preventDefault();node.click();}start=null;},{signal});
  for(const type of['pointercancel','lostpointercapture'])node.addEventListener(type,()=>{start=null;},{signal});
 }
}
