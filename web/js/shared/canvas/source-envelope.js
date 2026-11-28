import original from './envelope-source-data.js';
import {ENVELOPE_CLOSED,ENVELOPE_OPEN} from './envelope-source-frames.js';
import {sourceGiftDepth} from './source-gift.js';
import {shadeHex} from './gift-volume.js';
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const tint=(color,p)=>{const [r,g,b]=color,base=p.color||'#773447';if(Math.abs(r-g)<.03&&Math.abs(g-b)<.03)return rgb(p.paperColor||'#FFF2DB');if(r>.98)return rgb(shadeHex(base,g>.7?.2:.06));return rgb(shadeHex(base,-.2));};
export function sourceEnvelopeData(p){const data=structuredClone(original);const walk=n=>{if(!n||typeof n!=='object')return;if(n.ty==='fl'&&n.c?.a===0)n.c.k=[...tint(n.c.k,p),n.c.k[3]??1];for(const child of Object.values(n))if(child&&typeof child==='object')walk(child);};walk(data);return data;}
export function sourceEnvelopeFrame(p,prefix='source-envelope',open=false){
 let svg=(open?ENVELOPE_OPEN:ENVELOPE_CLOSED).replace(/viewBox="[^"]+"/,'viewBox="252 168 210 210"').replace(/\bwidth="[^"]+"/,'width="210"').replace(/\bheight="[^"]+"/,'height="210"');
 svg=svg.replace(/rgb\((\d+),(\d+),(\d+)\)/g,(_m,r,g,b)=>'rgb('+tint([r/255,g/255,b/255],p).map(c=>Math.round(c*255)).join(',')+')').replaceAll('__source_envelope_',String(prefix).replace(/[^a-zA-Z0-9_-]/g,'-')+'-');
 const depth=sourceGiftDepth(p,prefix);if(depth)svg=svg.replace('</defs>',depth.replace(/^<defs>|<\/defs>$/g,'')+'</defs>').replace('<g clip-path=',`<g filter="url(#${prefix}-depth)" clip-path=`);return svg;
}
