import {shadeHex} from './gift-volume.js';
import {studioCapSvg} from './studio-art.js';
import {objectDepth} from './object-construction.js';
import {reliefGradient} from './paper-relief.js';
const safe=id=>String(id).replace(/[^a-zA-Z0-9_-]/g,'-');
export function cameraDepthSvg(source,p,prefix){
 const id=safe(prefix),depth=objectDepth(p),d=depth/16,ink=p.inkColor||'#27394B',detail=p.detailColor||'#A8B9C9';
 const defs=`<defs>${reliefGradient(id+'-edge',shadeHex(detail,-.3),{depth})}<filter id="${id}-barrel"><feDropShadow dx="${2*d}" dy="${5*d}" stdDeviation="${2*d}" flood-color="#101929" flood-opacity=".32"/></filter></defs>`;
 let result=source.replace('</defs>',defs.replace(/^<defs>|<\/defs>$/g,'')+'</defs>');result=result.replace('<rect x="20"',`${depth?`<rect x="${15+5*d}" y="${12+6*d}" width="244" height="180" rx="35" fill="url(#${id}-edge)"/>`:''}<rect x="20"`);
 const start=result.indexOf('<circle cx="143"'),end=result.indexOf('<rect x="56"',start);if(start<0||end<0)throw Error('Camera body contract changed');const lens=result.slice(start,end);result=result.slice(0,start)+`<g class="gift-depth-camera-lens" ${depth?`filter="url(#${id}-barrel)"`:''}>${depth?`<circle cx="${140+4*d}" cy="${106+6*d}" r="54" fill="${shadeHex(ink,-.3)}"/><path d="M90 123Q140 180 192 123" fill="none" stroke="${detail}" stroke-width="${Math.max(.4,2*d)}"/>`:''}${lens}</g>`+result.slice(end);return result;
}
export function dimensionalCapSvg(p,prefix='cap'){
 const id=safe(prefix),depth=objectDepth(p),ink=p.inkColor||'#27394B',base=studioCapSvg(p,id+'-source'),edge=depth*.2;
 let art=base.replace('>',`>${depth?`<path d="M5 52L64 87l59-35" fill="none" stroke="${shadeHex(ink,-.5)}" stroke-width="${edge}" stroke-linejoin="round"/>`:''}`);
 if(depth){art=art.replace('>',`><defs>${reliefGradient(id+'-cloth',ink,{depth:depth*.5})}</defs>`).replaceAll(`fill="${ink}"`,`fill="url(#${id}-cloth)"`);}return art;
}
export function capUndersideSvg(p,prefix='under'){
 const id=safe(prefix),ink=p.inkColor||'#27394B',depth=objectDepth(p);return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" aria-hidden="true"><defs>${reliefGradient(id,shadeHex(ink,-.2),{depth})}</defs><path d="M5 50L64 15l59 35-59 35Z" fill="url(#${id})" stroke="${shadeHex(ink,.3)}" stroke-width="${Math.max(.5,depth*.16)}"/><path d="M30 68Q64 48 98 68V91Q64 114 30 91Z" fill="${shadeHex(ink,-.25)}"/><ellipse cx="64" cy="85" rx="30" ry="14" fill="${shadeHex(ink,-.55)}" stroke="${shadeHex(ink,.2)}" stroke-width="2"/></svg>`;
}
