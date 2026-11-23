import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const directory=path.resolve('web/assets/event-cards/natural-v4'),raw=path.resolve('local/natural-v2/originals');
fs.mkdirSync(directory,{recursive:true});fs.mkdirSync(raw,{recursive:true});
const manifestFile=path.join(directory,'manifest.json'),prior=fs.existsSync(manifestFile)?JSON.parse(fs.readFileSync(manifestFile)):{media:{},ids:{}};
const media={...prior.media},ids={...prior.ids};
async function frameAperture(bytes){
 const {data,info}=await sharp(bytes).ensureAlpha().resize({width:256,height:256,fit:'inside'}).raw().toBuffer({resolveWithObject:true}),w=info.width,h=info.height,seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let best=null;
 for(let start=0;start<w*h;start++){
  if(seen[start]||data[start*4+3]>=32)continue;let head=0,tail=1,minX=w,minY=h,maxX=0,maxY=0,border=false;queue[0]=start;seen[start]=1;
  while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);if(!x||!y||x===w-1||y===h-1)border=true;
   for(const q of [x?p-1:-1,x<w-1?p+1:-1,y?p-w:-1,y<h-1?p+w:-1])if(q>=0&&!seen[q]&&data[q*4+3]<32){seen[q]=1;queue[tail++]=q;}
  }
  if(!border&&tail>w*h*.03&&(!best||tail>best.area))best={area:tail,x:minX/w,y:minY/h,width:(maxX-minX+1)/w,height:(maxY-minY+1)/h};
 }
 if(!best)throw new Error('The photo frame needs a measurable transparent aperture');delete best.area;return best;
}
for(const spec of JSON.parse(fs.readFileSync('local/natural-v2/inputs.json','utf8'))){
 const bytes=fs.readFileSync(spec.source),sourceHash=createHash('sha256').update(bytes).digest('hex');
 const cached=media[ids[spec.id]];
 if(cached?.sourceHash===sourceHash&&cached.cover&&cached.thumbnail&&[cached,cached.cover,cached.thumbnail].every(item=>{
  const file=path.resolve('web/assets/event-cards',item.file);return fs.existsSync(file)&&createHash('sha256').update(fs.readFileSync(file)).digest('hex')===item.sha256;
 })){console.log(`${spec.id}: verified immutable cached asset`);continue;}
 fs.copyFileSync(spec.source,path.join(raw,`${spec.id}-${sourceHash.slice(0,12)}.png`));
 const encoded=await sharp(bytes).resize({width:960,height:800,fit:'inside',withoutEnlargement:true}).webp({quality:86,alphaQuality:100,effort:6}).toBuffer();
 const dimensions=await sharp(encoded).metadata(),sha256=createHash('sha256').update(encoded).digest('hex'),file=`${spec.id}-${sha256.slice(0,12)}.webp`,id=`event-natural-${spec.id}-${sha256.slice(0,12)}`;
 fs.writeFileSync(path.join(directory,file),encoded);ids[spec.id]=id;
 const variants={};
 for(const [variant,width,quality]of [['cover',640,84],['thumbnail',192,82]]){
  const part=await sharp(bytes).resize({width,height:Math.round(width*.9),fit:'inside',withoutEnlargement:true}).webp({quality,alphaQuality:100,effort:6}).toBuffer(),info=await sharp(part).metadata(),digest=createHash('sha256').update(part).digest('hex'),name=`${spec.id}-${variant}-${digest.slice(0,12)}.webp`;
  fs.writeFileSync(path.join(directory,name),part);variants[variant]={file:'natural-v4/'+name,sha256:digest,width:info.width,height:info.height,bytes:part.length};
 }
 media[id]={file:'natural-v4/'+file,sha256,width:dimensions.width,height:dimensions.height,bytes:encoded.length,version:4,role:'distributable-decoration',kind:spec.kind||'object',visualKind:spec.visualKind||'photos',source:spec.sourceURL||'Original generated artwork made specifically for Momevia with the built-in image generator, 2026-11-23',rights:spec.license?`${spec.author}; ${spec.license}; redistribution with gifts permitted`:'Original Momevia asset; distribution with gifts permitted; no Canva asset copied',...(spec.license?{license:spec.license,author:spec.author,repository:spec.repository,commit:spec.commit}:{}),...(spec.id==='mot-ky-niem'?{aperture:await frameAperture(bytes)}:{}),sourceHash,prompt:spec.prompt,fit:'contain',...variants};
 console.log(`${spec.id}: ${encoded.length} bytes, ${dimensions.width}×${dimensions.height}, alpha ${dimensions.hasAlpha}`);
}
fs.writeFileSync(manifestFile,JSON.stringify({media,ids},null,2)+'\n');
fs.writeFileSync('web/js/shared/canvas/natural-media.js',`// Immutable natural Originals v4. Keep old hashes when adding a replacement.\nexport const NATURAL_MEDIA=${JSON.stringify(media,null,2)};\nexport const NATURAL_MEDIA_IDS=${JSON.stringify(ids,null,2)};\n`);
