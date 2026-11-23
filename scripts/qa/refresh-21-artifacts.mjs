import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { templatePreviewDocument } from '../../web/js/shared/canvas/presets.js';
import { previewSvg } from '../../web/js/shared/canvas/cover-svg.js';
import { coverVariant, REFRESH_21 } from '../../web/js/shared/canvas/refresh-21-config.js';
import { serverText } from '../../src/shared/locale.mjs';
const out=path.resolve('docs/template-refresh-20261123');fs.mkdirSync(out,{recursive:true});
const ids=Object.keys(REFRESH_21);
for(const [label,sceneId] of [['covers',null],['wishes','scene-surprise'],['replies','scene-message']]) {
  const cols=7,width=label==='covers'?300:195,height=label==='covers'?254:422,header=32;
  const parts=[];
  for(const [i,id] of ids.entries()){
    let doc=templatePreviewDocument({id});if(!sceneId)doc=coverVariant(doc,'catalog');
    const svg=previewSvg(doc,sceneId||doc.entrySceneId);
    const png=await sharp(Buffer.from(svg)).resize(width,height).png().toBuffer();
    const x=i%cols*width,y=Math.floor(i/cols)*(height+header);
    const title=Buffer.from(`<svg width="${width}" height="${header}"><rect width="100%" height="100%" fill="#fff9ed"/><text x="9" y="21" font-family="Arial" font-size="12" fill="#263c32">${i+1}. ${id}</text></svg>`);
    parts.push({input:title,left:x,top:y},{input:png,left:x,top:y+header});
    fs.writeFileSync(path.join(out,`${id}-${label}.svg`),svg);
  }
  const target=path.join(out,`${label}.png`);
  await sharp({create:{width:cols*width,height:3*(height+header),channels:3,background:'#FFFAF0'}}).composite(parts).png().toFile(target);
  if(label==='covers'){
    const tiles=[];
    for(let i=0;i<ids.length;i++)tiles.push({input:await sharp(target).extract({left:i%cols*width,top:Math.floor(i/cols)*(height+header)+header,width,height}).png().toBuffer(),left:i%cols*width,top:Math.floor(i/cols)*height});
    const blind=await sharp({create:{width:cols*width,height:3*height,channels:3,background:'#fff'}}).composite(tiles).png().toBuffer();
    await sharp(blind).grayscale().png().toFile(path.join(out,'covers-grayscale.png'));
    for(let wave=1;wave<=4;wave++){
      const members=ids.filter(id=>REFRESH_21[id].wave===wave),columns=wave===1?4:3,parts=[];
      for(const [index,id]of members.entries())parts.push({input:await sharp(Buffer.from(previewSvg(coverVariant(templatePreviewDocument({id}),'catalog')))).resize(380,322).png().toBuffer(),left:index%columns*380,top:Math.floor(index/columns)*322});
      await sharp({create:{width:columns*380,height:Math.ceil(members.length/columns)*322,channels:3,background:'#fff'}}).composite(parts).png().toFile(path.join(out,`wave-${wave}-covers.png`));
    }
  }
}
for(const locale of ['vi','en']) {
 const parts=[];let i=0;
 for(const id of ids.filter(id=>/202[67]$/.test(id))){
  const doc=coverVariant(templatePreviewDocument({id},(key,params)=>serverText(locale,key,params)),'seasonal');
  parts.push({input:await sharp(Buffer.from(previewSvg(doc))).resize(268,320).png().toBuffer(),left:i++*268,top:0});
 }
 await sharp({create:{width:4*268,height:320,channels:3,background:'#fff'}}).composite(parts).png().toFile(path.join(out,`seasonal-${locale}.png`));
}
console.log('Rendered 63 scenes, catalog grayscale and seasonal VI/EN sheets.');
