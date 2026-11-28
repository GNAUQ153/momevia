import {shadeHex} from './gift-volume.js';
import {paperReliefEnabled,reliefGradient} from './paper-relief.js';
export const PHYSICAL_PAPER='physical-v2';
export const physicalPaper=p=>p.paperConstruction===PHYSICAL_PAPER;
export const physicalDepth=p=>paperReliefEnabled(p)?p.objectDepth??8:0;
const safe=id=>String(id).replace(/[^a-zA-Z0-9_-]/g,'-');
const wrap=(body,viewBox='0 0 320 320')=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100%" height="100%" aria-hidden="true">${body}</svg>`;
export function foldedEnvelopeParts(p,prefix){
 const id=safe(prefix),color=p.color||'#773447',paper=p.paperColor||'#FFF2DB',depth=physicalDepth(p),edge=depth*.36,cut=shadeHex(paper,-.14),dark=shadeHex(color,-.32),defs=`<defs>${reliefGradient(id+'-front',color,{depth})}${reliefGradient(id+'-left',shadeHex(color,-.12),{depth})}${reliefGradient(id+'-right',shadeHex(color,.04),{depth})}${reliefGradient(id+'-inside',shadeHex(paper,-.06),{depth:depth*.4})}</defs>`;
 const back=wrap(`${defs}<rect x="${38+edge}" y="${146+edge}" width="244" height="152" rx="3" fill="${cut}"/><path d="M282 146l${edge} ${edge}v149q0 3-3 3H41l-3-${edge}Z" fill="${cut}"/><rect x="38" y="146" width="244" height="152" rx="3" fill="${dark}"/><rect x="40" y="148" width="240" height="148" rx="2" fill="url(#${id}-inside)"/><path d="M40 148h240" fill="none" stroke="${paper}" stroke-width="1"/>${depth?`<path d="M${39+edge} ${299+edge*.4}h241M284 150v147" fill="none" stroke="${shadeHex(paper,-.04)}" stroke-width=".6"/>`:''}`);
 const front=wrap(`${defs}<path d="M38 146l132 90L38 298Z" fill="url(#${id}-left)"/><path d="M282 146l-132 90 132 62Z" fill="url(#${id}-right)"/><path d="M38 298l110-84q12-9 24 0l110 84Z" fill="url(#${id}-front)"/><path d="M39 297l109-83q12-9 24 0l109 83" fill="none" stroke="${dark}" stroke-width="1.3" stroke-opacity=".4"/><path d="M40 297l108-82q12-9 24 0l108 82" fill="none" stroke="${paper}" stroke-width=".65" stroke-opacity="${depth?.45:0}"/>`);
 const outline='M1 1H243L135 90Q122 101 109 90Z',flap=wrap(`${defs}<path d="${outline}" fill="url(#${id}-front)" stroke="${cut}" stroke-width="${depth?1.5:.5}"/>`,'0 0 244 100'),inside=wrap(`${defs}<path d="${outline}" fill="url(#${id}-inside)" stroke="${cut}" stroke-width="${depth?1.5:.5}"/><path d="M8 3h228" stroke="${paper}" stroke-width="1"/>`,'0 0 244 100');
 const ns=(svg,part)=>svg.replaceAll(id+'-',id+'-'+part+'-');return {back:ns(back,'back'),front:ns(front,'front'),flap:ns(flap,'flap'),inside:ns(inside,'inside'),edge};
}
export function foldedEnvelopeSvg(p,prefix='folded',open=false){
 const parts=foldedEnvelopeParts(p,prefix),inner=svg=>svg.replace(/^<svg[^>]*>|<\/svg>$/g,''),paper=p.paperColor||'#FFF2DB';return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="210" height="210" aria-hidden="true">${inner(parts.back)}${open?`<g transform="translate(38 146) scale(1 -1)">${inner(parts.inside)}</g>`:''}<rect x="57" y="${open?75:150}" width="206" height="140" rx="3" fill="${paper}" stroke="${shadeHex(paper,-.18)}" stroke-width="1"/>${inner(parts.front)}${open?'':`<g transform="translate(38 146)">${inner(parts.flap)}</g>`}</svg>`;
}
export function paperCoilSvg(p,prefix='coil'){
 const id=safe(prefix),paper=p.color||'#FFF8E8',depth=physicalDepth(p),edge=shadeHex(paper,depth?-.2:0);return wrap(`<defs>${reliefGradient(id,paper,{roll:true,depth:depth*.65})}</defs><circle cx="18" cy="18" r="17.5" fill="url(#${id})" stroke="${edge}" stroke-width=".8"/><path d="M18 2C40 2 39 33 18 33C0 33 1 6 18 6C32 6 32 29 18 29C5 29 5 10 18 10C27 10 27 25 18 25C10 25 11 14 18 14C22 14 22 21 18 21" fill="none" stroke="${edge}" stroke-width=".7"/>`,'0 0 36 36');
}
export function cylinderPaint(p,index,count=16){
 const base=p.color||'#FFF8E8',depth=physicalDepth(p)/16,angle=index*2*Math.PI/count,amount=(Math.cos(angle-.6)*.15-.08)*depth;return shadeHex(base,amount);
}
export function physicalDiplomaSvg(p,prefix='diploma',bow=''){
 const id=safe(prefix),paper=p.color||'#FFF8E8',depth=physicalDepth(p),accent=p.accentColor||'#B52E3D';return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 190" width="240" height="190" aria-hidden="true"><defs>${reliefGradient(id,paper,{roll:true,depth:depth*.6})}${reliefGradient(id+'-ribbon',accent,{depth})}</defs><ellipse cx="110" cy="116" rx="96" ry="5" fill="#3D2D1922"/><rect x="13" y="80" width="194" height="34" rx="14" fill="url(#${id})" stroke="${shadeHex(paper,-.2)}" stroke-width=".6"/><svg x="188" y="80" width="19" height="34" viewBox="0 0 36 36" preserveAspectRatio="none">${paperCoilSvg(p,id+'-end').replace(/^<svg[^>]*>|<\/svg>$/g,'')}</svg><rect x="102" y="80" width="16" height="34" rx="2" fill="url(#${id}-ribbon)"/><g transform="translate(73 56) scale(.58)">${bow}</g></svg>`;
}
