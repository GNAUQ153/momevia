import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {canvasError,uuid} from './errors.mjs';

export const LOCAL_VIDEO_LIMITS=Object.freeze({bytes:128*1024*1024,seconds:120,width:1920,height:1080});
export const localVideoEnabled=(env=process.env)=>env.LOCAL_VIDEO_QA_ENABLED==='true'&&env.NODE_ENV!=='production'&&(env.DESIGNS_STORAGE||'json')==='json'&&(env.GIFTS_STORAGE||'json')==='json';
export function requireLocalVideo(req){
 const ip=req?.socket?.remoteAddress;
 if(!localVideoEnabled()||(req&&!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip)))throw canvasError(403,'LOCAL_VIDEO_ONLY','Video chỉ được dùng trong bản local đã bật tính năng.');
}
// Bounded EBML metadata parser. No decoder process, remote URL or supplied code is executed.
export function validateLocalWebm(input){
 const b=Buffer.from(input),bad=()=>{throw canvasError(422,'VIDEO_WEBM_INVALID','Chọn WebM VP8/VP9 hợp lệ, tối đa 2 phút và Full HD.');};
 if(b.length<32||b.length>LOCAL_VIDEO_LIMITS.bytes||b.readUInt32BE(0)!==0x1a45dfa3)bad();
 const vint=(at,id=false)=>{if(at>=b.length||!b[at])bad();let width=1,mask=128;while(!(b[at]&mask)){mask>>=1;width++;if(width>8)bad();}if(at+width>b.length)bad();let value=id?b[at]:b[at]&(mask-1),unknown=!id&&value===mask-1;for(let i=1;i<width;i++){value=value*256+b[at+i];unknown=unknown&&b[at+i]===255;}return{width,value,unknown};};
 let count=0,scale=1000000,duration,codec,width,height,docType,videoTracks=0;
 const masters=new Set([0x1a45dfa3,0x18538067,0x1549a966,0x1654ae6b,0xae,0xe0]);
 const walk=(start,end,depth=0,track=null)=>{if(depth>7)bad();for(let at=start;at<end;){if(++count>20000)bad();const id=vint(at,true);at+=id.width;const size=vint(at);at+=size.width;const stop=size.unknown?end:at+size.value;if(stop>end||stop<at)bad();const n=()=>{if(stop-at>6)bad();let v=0;for(let i=at;i<stop;i++)v=v*256+b[i];return v;};
   if(id.value===0x4282)docType=b.toString('utf8',at,stop);
   else if(id.value===0x2ad7b1)scale=n();
   else if(id.value===0x4489){if(stop-at!==4&&stop-at!==8)bad();duration=stop-at===4?b.readFloatBE(at):b.readDoubleBE(at);}
   else if(id.value===0x83&&track)track.type=n();else if(id.value===0x86&&track)track.codec=b.toString('utf8',at,stop);
   else if(id.value===0xb0&&track)track.width=n();else if(id.value===0xba&&track)track.height=n();
   else if(id.value===0xae){const current={};walk(at,stop,depth+1,current);if(current.type===1){videoTracks++;({codec,width,height}=current);}}
   else if(masters.has(id.value))walk(at,stop,depth+1,track);
   // Clusters contain compressed frames and are skipped as data, not recursively interpreted.
   at=stop;
 }};walk(0,b.length);
 const seconds=duration*scale/1e9;
 if(docType!=='webm'||videoTracks!==1||!['V_VP8','V_VP9'].includes(codec)||!Number.isFinite(seconds)||seconds<.1||seconds>LOCAL_VIDEO_LIMITS.seconds||!Number.isInteger(width)||!Number.isInteger(height)||width<16||height<16||width>LOCAL_VIDEO_LIMITS.width||height>LOCAL_VIDEO_LIMITS.height)bad();
 return{bytes:b,width,height,durationMs:Math.round(seconds*1000),codec};
}
export async function localVideoBody(req){
 requireLocalVideo(req);
 if(req.headers['content-type']!=='video/webm')throw canvasError(415,'VIDEO_TYPE','Chỉ nhận video WebM.');
 const declared=req.headers['content-length'];if(declared!==undefined&&(!/^\d+$/.test(declared)||Number(declared)>LOCAL_VIDEO_LIMITS.bytes))throw canvasError(413,'VIDEO_SIZE','Video tối đa 128 MB.');
 let length=0;const chunks=[];for await(const chunk of req){length+=chunk.length;if(length>LOCAL_VIDEO_LIMITS.bytes)throw canvasError(413,'VIDEO_SIZE','Video tối đa 128 MB.');chunks.push(chunk);}if(declared!==undefined&&Number(declared)!==length)throw canvasError(422,'VIDEO_SIZE','Kích thước tệp không khớp.');return Buffer.concat(chunks);
}
export class LocalVideoAssetsService{
 constructor(designs){this.designs=designs;}
 async upload(user,designId,mutationId,input){
  requireLocalVideo();const d=this.designs;d.requireEdit();uuid(mutationId);const design=await d.get(user,designId);if(design.provenance?.purpose==='creator')throw canvasError(403,'VIDEO_SENDER_ONLY','Video local chỉ dùng cho thiệp cá nhân.');
  const video=validateLocalWebm(input),hex=createHash('sha256').update(`${user.sub}:${designId}:video:${mutationId}`).digest('hex').slice(0,32).split('');hex[12]='5';hex[16]='8';const h=hex.join(''),id=`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  const contentHash='sha256:'+createHash('sha256').update(video.bytes).digest('hex'),existing=await d.repository.getAsset(user.sub,id);
  if(existing){if(existing.contentHash!==contentHash)throw canvasError(409,'ASSET_MUTATION_CONFLICT','Mã tải video đã dùng cho tệp khác.');if(d.assetExists(existing))return this.view(existing);}
  fs.mkdirSync(d.mediaRoot,{recursive:true});const storageKey=id+'.webm',final=path.join(d.mediaRoot,storageKey),stage=path.join(d.mediaRoot,id+'.'+randomUUID()+'.staging');fs.writeFileSync(stage,video.bytes,{flag:'wx'});
  try{const asset={id,ownerId:user.sub,designId,status:'ready',mediaKind:'video',mime:'video/webm',bytes:video.bytes.length,width:video.width,height:video.height,durationMs:video.durationMs,codec:video.codec,contentHash,storageKey,createdAt:new Date().toISOString()};return this.view(await d.repository.insertAsset(user.sub,designId,asset,{prepare:()=>{if(fs.existsSync(final)){if('sha256:'+createHash('sha256').update(fs.readFileSync(final)).digest('hex')!==contentHash)throw canvasError(409,'ASSET_MUTATION_CONFLICT','Nội dung tải lại không khớp.');}else fs.renameSync(stage,final);}}));}finally{if(fs.existsSync(stage))fs.unlinkSync(stage);}
 }
 view(a){return{id:a.id,assetId:a.id,status:a.status,mediaKind:'video',mime:a.mime,bytes:a.bytes,width:a.width,height:a.height,durationMs:a.durationMs};}
}
