// Audit authored text/button pairs, including a full rectangular backing layer.
// Does not certify arbitrary sender edits, image backgrounds or system UI.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createDocument} from '../../web/js/shared/canvas/presets.js';
const ids=['hai-phong-bi','birthday-radiance','proud-of-you','loi-moi-ben-hien','cuon-phim-ngay-ay','ban-do-ngay-ra-truong'];
const luminance=hex=>hex.slice(1).match(/../g).map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
const grainWorst=hex=>'#'+hex.slice(1).match(/../g).map(n=>Math.round(parseInt(n,16)*.89).toString(16).padStart(2,'0')).join('');
const contains=(a,b)=>a.x<=b.x&&a.y<=b.y&&a.x+a.width>=b.x+b.width&&a.y+a.height>=b.y+b.height;
const results=[];
for(const locale of ['vi','en'])for(const id of ids){
 const document=createDocument({template:{id},locale}),pairs=[];
 for(const scene of document.scenes){
  const ordered=scene.elementIds.map(id=>document.elements.find(e=>e.id===id));
  for(const [index,e]of ordered.entries()){
   if(e.visible===false||!['text','button','envelope'].includes(e.type))continue;
   let background=scene.background.color,foreground=e.props.color||'#32243B',backing='scene';
   if(e.type==='text'){
    const layer=ordered.slice(0,index).findLast(a=>a.visible!==false&&a.type==='shape'&&a.props.kind==='rectangle'&&!a.layout.rotation&&contains(a.layout,e.layout));
    if(layer){background=layer.props.color;backing=layer.id;}
   }else {background=e.props.color||'#6136DF';foreground='#FFFFFF';backing='control';}
   const ratio=Math.min(contrast(foreground,background),backing==='scene'&&scene.effects?.surface?.id==='cotton-paper-v2'?contrast(foreground,grainWorst(background)):Infinity);
   assert(ratio>=4.5,`${id}/${locale}/${e.id}: ${ratio}`);
   pairs.push({sceneId:scene.id,elementId:e.id,foreground,background,backing,ratio});
  }
 }
 results.push({id,locale,minimum:Math.min(...pairs.map(p=>p.ratio)),pairs});
}
const out='local/interactive-cards-20261122/final/contrast-report.json';
fs.writeFileSync(out,JSON.stringify({scope:'Authored text and button/envelope labels against scene or full rectangular backing. Worst black grain at 11% included. Interaction internals, image backgrounds, sender edits and system UI require separate review.',threshold:4.5,results},null,2)+'\n');
console.log(`PASS ${results.length} template/locale sets; ${results.reduce((n,r)=>n+r.pairs.length,0)} authored color pairs ≥4.5:1`);
