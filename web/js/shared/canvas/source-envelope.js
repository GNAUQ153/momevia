import original from './envelope-source-data.js';
import {ENVELOPE_CLOSED,ENVELOPE_OPEN} from './envelope-source-frames.js';
import {sourceGiftDepth} from './source-gift.js';
import {shadeHex} from './gift-volume.js';
import {paperReliefEnabled,reliefGradient,reliefColors,envelopeReliefDepth} from './paper-relief.js';
import {physicalPaper,foldedEnvelopeSvg} from './physical-paper.js';
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const tint=(color,p)=>{const [r,g,b]=color,base=p.color||'#773447';if(Math.abs(r-g)<.03&&Math.abs(g-b)<.03)return rgb(p.paperColor||'#FFF2DB');if(r>.98)return rgb(shadeHex(base,g>.7?.2:.06));return rgb(shadeHex(base,-.2));};
export function sourceEnvelopeData(p){
 const data=structuredClone(original),relief=paperReliefEnabled(p);
 if(relief){const letter=data.layers.find(l=>l.nm==='Layer 5 Outlines');letter.shapes=letter.shapes.filter(g=>g.nm==='Group 8');}
 const walk=n=>{if(!n||typeof n!=='object')return;if(n.ty==='fl'&&n.c?.a===0){const color=tint(n.c.k,p);if(relief){const hex='#'+color.map(c=>Math.round(c*255).toString(16).padStart(2,'0')).join(''),paint=reliefColors(hex,(p.objectDepth??8)*(hex.toUpperCase()===(p.paperColor||'#FFF2DB').toUpperCase()?.5:1));delete n.c;Object.assign(n,{ty:'gf',t:1,s:{a:0,k:[-86,-60]},e:{a:0,k:[86,85]},g:{p:3,k:{a:0,k:[0,...rgb(paint.light),.42,...color,1,...rgb(paint.dark)]}}});}else n.c.k=[...color,n.c.k[3]??1];}for(const child of Object.values(n))if(child&&typeof child==='object')walk(child);};walk(data);return data;
}
export function sourceEnvelopeFrame(p,prefix='source-envelope',open=false){
 if(physicalPaper(p))return foldedEnvelopeSvg(p,prefix,open);
 let svg=(open?ENVELOPE_OPEN:ENVELOPE_CLOSED).replace(/viewBox="[^"]+"/,'viewBox="252 168 210 210"').replace(/\bwidth="[^"]+"/,'width="210"').replace(/\bheight="[^"]+"/,'height="210"');
 const relief=paperReliefEnabled(p);if(relief)svg=svg.replace(/<path\b(?=[^>]*fill="rgb\(219,219,219\)")[^>]*><\/path>/g,'');
 svg=svg.replace(/rgb\((\d+),(\d+),(\d+)\)/g,(_m,r,g,b)=>'rgb('+tint([r/255,g/255,b/255],p).map(c=>Math.round(c*255)).join(',')+')').replaceAll('__source_envelope_',String(prefix).replace(/[^a-zA-Z0-9_-]/g,'-')+'-');
 if(relief){const paints=new Map();svg=svg.replace(/fill="rgb\((\d+),(\d+),(\d+)\)"/g,(_m,r,g,b)=>{const color='#'+[r,g,b].map(c=>Number(c).toString(16).padStart(2,'0')).join('');if(!paints.has(color))paints.set(color,prefix+'-material-'+paints.size);return `fill="url(#${paints.get(color)})"`;});svg=svg.replace('</defs>',[...paints].map(([color,id])=>reliefGradient(id,color,{depth:(p.objectDepth??8)*(color.toUpperCase()===(p.paperColor||'#FFF2DB').toUpperCase()?.5:1)})).join('')+'</defs>');}
 const depth=relief?envelopeReliefDepth(p,prefix):sourceGiftDepth(p,prefix);if(depth)svg=svg.replace('</defs>',depth.replace(/^<defs>|<\/defs>$/g,'')+'</defs>').replace('<g clip-path=',`<g filter="url(#${prefix}-depth)" clip-path=`);return svg;
}
