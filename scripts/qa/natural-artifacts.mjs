import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {chromium} from 'playwright';
import {REFRESH_21} from '../../web/js/shared/canvas/refresh-21-config.js';
import {catalog} from '../../web/js/features/canvas-editor/library.js';
import {createDocument} from '../../web/js/shared/canvas/presets.js';
import {previewSvg} from '../../web/js/shared/canvas/cover-svg.js';
import {photoSlots} from '../../web/js/shared/canvas/interactions.js';
import {builtinCoverResources} from '../../src/modules/designs/builtin-media.mjs';
const base='http://127.0.0.1:4121',out=path.resolve('docs/template-refresh-natural-20261123'),ids=Object.keys(REFRESH_21),resources=builtinCoverResources();
fs.mkdirSync(path.join(out,'covers'),{recursive:true});fs.mkdirSync(path.join(out,'elements'),{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage();
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
async function capture(svg,width,height,file){
 await page.setViewportSize({width,height});await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{display:block;width:100%;height:100%}</style>${svg}`);
 await page.evaluate(async()=>{await globalThis.document.fonts.ready;await Promise.all([...globalThis.document.querySelectorAll('image')].map(i=>new Promise((resolve,reject)=>{const img=new globalThis.Image();img.onload=resolve;img.onerror=reject;img.src=i.getAttribute('href')||i.getAttribute('xlink:href');})));});
 await page.screenshot({path:file});
}
async function sheet(files,target,width,height,columns=7,titles=true){
 const header=titles?28:0,parts=[];
 for(const [i,file]of files.entries()){
  const left=i%columns*width,top=Math.floor(i/columns)*(height+header);
  parts.push({input:await sharp(file).resize(width,height,{fit:'fill'}).png().toBuffer(),left,top:top+header});
  if(titles)parts.push({input:Buffer.from(`<svg width="${width}" height="28"><rect width="100%" height="100%" fill="#f7f2e9"/><text x="8" y="19" font-family="Arial" font-size="11" fill="#273c32">${escape(path.basename(file).replace('.png',''))}</text></svg>`),left,top});
 }
 await sharp({create:{width:columns*width,height:Math.ceil(files.length/columns)*(height+header),channels:3,background:'#f7f2e9'}}).composite(parts).png().toFile(path.join(out,target));
}
try{
 for(const id of ids){const r=await fetch(`${base}/assets/basic-templates/${id}-catalog.svg?v=9`);assert(r.ok);await capture(await r.text(),380,322,path.join(out,'covers',id+'.png'));}
 const covers=ids.map(id=>path.join(out,'covers',id+'.png'));
 await sheet(covers,'covers.png',380,322);
 for(const [name,index]of [['wishes',1],['replies',2]])await sheet(ids.map(id=>path.join(out,'browser',`${id}-${index}.png`)),name+'.png',195,422);
 await sheet(covers,'covers-blind.png',380,322,7,false);await sharp(path.join(out,'covers-blind.png')).grayscale().png().toFile(path.join(out,'covers-grayscale.png'));
 for(let wave=1;wave<=4;wave++)await sheet(ids.filter(id=>REFRESH_21[id].wave===wave).map(id=>path.join(out,'covers',id+'.png')),`wave-${wave}.png`,380,322,wave===1?4:3);
 for(const locale of ['vi','en']){
  const seasonal=[];
  for(const id of ids.filter(id=>/202[67]$/.test(id))){const r=await fetch(`${base}/assets/basic-templates/${locale==='en'?'en/':''}${id}-seasonal.svg?v=9`);assert(r.ok);const file=path.join(out,'covers',`${id}-${locale}-seasonal.png`);await capture(await r.text(),268,320,file);seasonal.push(file);}
  await sheet(seasonal,`seasonal-${locale}.png`,268,320,4,false);
 }
 const cards=catalog.flatMap(g=>g.items).filter(c=>c.id.startsWith('natural-'));
 for(const card of cards){
  const doc=createDocument();doc.elements=card.create();doc.scenes[0].elementIds=doc.elements.map(e=>e.id);doc.scenes[0].background.color='#EEE9E0';doc.artboard.baseSize={width:390,height:390};
  const box={left:Math.min(...doc.elements.map(e=>e.layout.x)),top:Math.min(...doc.elements.map(e=>e.layout.y)),right:Math.max(...doc.elements.map(e=>e.layout.x+e.layout.width)),bottom:Math.max(...doc.elements.map(e=>e.layout.y+e.layout.height))};
  const scale=Math.min(330/(box.right-box.left),330/(box.bottom-box.top));
  for(const e of doc.elements){e.layout={...e.layout,x:30+(e.layout.x-box.left)*scale,y:30+(e.layout.y-box.top)*scale,width:e.layout.width*scale,height:e.layout.height*scale};for(const slot of photoSlots(e))if(slot.assetId&&!doc.assets.some(a=>a.assetId===slot.assetId))doc.assets.push({assetId:slot.assetId,kind:'image'});}
  doc.schemaVersion=doc.registryVersion=2;
  await capture(previewSvg(doc,doc.entrySceneId,resources.images,{serifWoff2:resources.serifWoff2,validationMode:'draft'}),200,200,path.join(out,'elements',card.id+'.png'));
 }
 await sheet(cards.map(c=>path.join(out,'elements',c.id+'.png')),'natural-elements.png',200,200,8);
 console.log(`PASS Chrome captures: 21 catalog covers, 63 recipient scenes, eight seasonal variants, ${cards.length} natural elements. No librsvg/WebP substitution.`);
}finally{await browser.close();}
