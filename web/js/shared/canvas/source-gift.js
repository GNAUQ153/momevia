import original from './source-gift-data.js';
import {shadeHex} from './gift-volume.js';
import {closedGiftSvg,openGiftSvg} from './source-gift-frames.js';
export const SOURCE_GIFT_PRESET='lid-source-v6';
export const SOURCE_GIFT_CREDIT={creator:'Goodeisgn',url:'https://embed.lottiefiles.com/animation/107704',license:'https://lottiefiles.com/page/license'};
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
export function sourceGiftColor(color,p,layer=''){
 const [r,g,b]=color,body=p.color||'#2D6B53',gold=p.sealColor||'#C69A60',paper=p.paperColor||'#FFF3DC';
 if(b>r&&b>g)return rgb(body);
 if(r===0&&g===0&&b===0)return rgb(shadeHex(body,-.6));
 if(r>.98&&g>.85)return rgb(shadeHex(gold,.38));
 if(r>.94&&g>.7&&b<.3)return rgb(gold);
 if(r>.9&&g>.45&&g<.6)return rgb(layer==='box_body'?paper:shadeHex(gold,-.2));
 if(r>.9&&g<.4)return rgb('#C84757');
 if(g>.9&&r<.7)return rgb('#9ABD84');
 return color.slice(0,3);
}
export function sourceGiftData(p){
 const data=structuredClone(original);
 const visit=(node,layer)=>{if(!node||typeof node!=='object')return;if(['fl','st'].includes(node.ty)&&node.c?.a===0){const k=node.c.k;node.c.k=[...sourceGiftColor(k,p,layer),k[3]??1];}for(const value of Object.values(node))if(value&&typeof value==='object')visit(value,layer);};
 for(const layer of data.layers)visit(layer,layer.nm);
 return data;
}
export function sourceGiftFrame(p,prefix='source-gift',open=false){
 let svg=open?openGiftSvg:closedGiftSvg;
 // These are exported from this same reviewed animation, not a second drawing.
 svg=svg.replace(/rgb\((\d+),(\d+),(\d+)\)/g,(value,r,g,b)=>{const color=sourceGiftColor([r/255,g/255,b/255],p,Number(r)===251?'box_body':'');return 'rgb('+color.map(c=>Math.round(c*255)).join(',')+')';});
 svg=svg.replaceAll('__source_gift_',String(prefix).replace(/[^a-zA-Z0-9_-]/g,'-')+'-');const depth=sourceGiftDepth(p,prefix);if(depth){svg=svg.replace('</defs>',depth.replace(/^<defs>|<\/defs>$/g,'')+'</defs>').replace('<g clip-path=',`<g filter="url(#${prefix}-depth)" clip-path=`);}return svg;
}
export function sourceGiftDepth(p,prefix){
 const amount=p.objectDepth??8;if(!amount)return '';const d=amount/8,body=p.color||'#2D6B53';
 return `<defs><filter id="${prefix}-depth" x="-30%" y="-30%" width="160%" height="180%" color-interpolation-filters="sRGB"><feDropShadow dx="${d*.45}" dy="${d*.6}" stdDeviation="0" flood-color="${shadeHex(body,-.25)}"/><feDropShadow dx="${d*.7}" dy="${d*.9}" stdDeviation=".15" flood-color="${shadeHex(body,-.42)}"/><feDropShadow dx="0" dy="${d*2.8}" stdDeviation="${d*1.6}" flood-color="#061B17" flood-opacity=".22"/></filter></defs>`;
}
