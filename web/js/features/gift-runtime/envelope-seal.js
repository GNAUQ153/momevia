import {renderAssembly} from './motion-stack.js';
import {OBJECT_MEDIA,objectTint} from '../../shared/canvas/natural-objects.js';
let sequence=0;
export function envelopeSeal(p,assetUrl){
 const seal=document.createElement('span'),monogram=document.createElement('span');seal.className='gift-source-envelope-seal';seal.setAttribute('aria-hidden','true');
 const art=renderAssembly({version:2,parts:[{id:'seal',title:'Wax seal',anchor:{x:.5,y:.5},vector:{paths:[{d:'M0 0',fill:'none'}]},image:{mediaId:OBJECT_MEDIA.seal,x:0,y:0,width:100,height:100}}]},{assetId:p.sealAssetId},assetUrl),ns='http://www.w3.org/2000/svg',defs=document.createElementNS(ns,'defs'),filter=document.createElementNS(ns,'filter'),matrix=document.createElementNS(ns,'feColorMatrix'),id='source-envelope-seal-'+(++sequence),tint=objectTint(p.sealColor||'#D7B67C','seal');filter.id=id;filter.setAttribute('color-interpolation-filters','sRGB');matrix.setAttribute('type',tint.type);matrix.setAttribute('values',tint.values);filter.append(matrix);defs.append(filter);art.prepend(defs);for(const image of art.querySelectorAll('image'))image.setAttribute('filter',`url(#${id})`);monogram.className='gift-source-envelope-monogram';seal.append(art,monogram);return {seal,monogram};
}
