import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { AUDIO_LIMITS } from '../../../web/js/shared/canvas/audio-pcm.js';
import { canvasError, uuid } from './errors.mjs';

const root=fileURLToPath(new URL('../../../web/assets/sfx/',import.meta.url));
export function sfxCatalog(version=1) {
 if(!/^[1-9]\d{0,2}$/.test(String(version)))throw canvasError(404,'SFX_NOT_FOUND','Không tìm thấy phiên bản âm thanh.');
 const filename=path.join(root,`v${version}`,'catalog.json');if(!fs.existsSync(filename))throw canvasError(404,'SFX_NOT_FOUND','Không tìm thấy phiên bản âm thanh.');
 return JSON.parse(fs.readFileSync(filename,'utf8'));
}
export function librarySound(version,id) {
 const item=sfxCatalog(version).assets.find(a=>String(a.version)===String(version)&&a.id===id);
 if(!item)throw canvasError(404,'SFX_NOT_FOUND','Không tìm thấy phiên bản âm thanh.');
 return {filePath:path.join(root,`v${item.version}`,`${item.id}.wav`),contentType:'audio/wav'};
}
export function validatePcmWav(input) {
 const b=Buffer.from(input),bad=()=>{throw canvasError(422,'INVALID_PCM_WAV','Chỉ nhận đoạn WAV PCM16 mono 44,1 kHz từ 0,1 đến 10 giây. Chọn lại tệp và Áp dụng.');};
 if(b.length<44||b.length>AUDIO_LIMITS.uploadBytes)bad();
 if(b.toString('ascii',0,4)!=='RIFF'||b.readUInt32LE(4)!==b.length-8||b.toString('ascii',8,12)!=='WAVE'||b.toString('ascii',12,16)!=='fmt '||b.readUInt32LE(16)!==16||b.readUInt16LE(20)!==1||b.readUInt16LE(22)!==1||b.readUInt32LE(24)!==44100||b.readUInt32LE(28)!==88200||b.readUInt16LE(32)!==2||b.readUInt16LE(34)!==16||b.toString('ascii',36,40)!=='data'||b.readUInt32LE(40)!==b.length-44||(b.length-44)%2)bad();
 const sampleCount=(b.length-44)/2;
 if(sampleCount<4410||sampleCount>441000)bad();
 return {bytes:b,sampleCount,durationMs:sampleCount/44.1,sampleRate:44100,channels:1};
}
export async function audioBody(req) {
 if(req.headers['content-type']!=='audio/wav')throw canvasError(415,'AUDIO_TYPE','Hãy dùng bộ tỉa để xuất WAV PCM16.');
 const declared=req.headers['content-length'];
 if(declared!==undefined&&(!/^\d+$/.test(declared)||Number(declared)>AUDIO_LIMITS.uploadBytes))throw canvasError(413,'AUDIO_SIZE','Đoạn WAV vượt dung lượng cho phép.');
 const chunks=[];let length=0;
 for await(const chunk of req){length+=chunk.length;if(length>AUDIO_LIMITS.uploadBytes)throw canvasError(413,'AUDIO_SIZE','Đoạn WAV vượt dung lượng cho phép.');chunks.push(chunk);}
 if(declared!==undefined&&Number(declared)!==length)throw canvasError(422,'AUDIO_SIZE','Kích thước thực tế không khớp.');
 return Buffer.concat(chunks);
}
export class AudioAssetsService {
 constructor(designs){this.designs=designs;}
 async upload(user,designId,mutationId,input){
  const d=this.designs;d.requireEdit();d.requireSoundCreate();uuid(mutationId);await d.get(user,designId);
  await d.repository.requireAudio?.();
  const pcm=validatePcmWav(input),hex=createHash('sha256').update(`${user.sub}:${designId}:audio:${mutationId}`).digest('hex').slice(0,32).split('');hex[12]='5';hex[16]='8';const h=hex.join(''),id=`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  const contentHash=`sha256:${createHash('sha256').update(pcm.bytes).digest('hex')}`,existing=await d.repository.getAsset(user.sub,id);
  if(existing){if(existing.contentHash!==contentHash)throw canvasError(409,'ASSET_MUTATION_CONFLICT','Mã tải âm đã dùng cho nội dung khác.');if(d.assetExists(existing))return this.view(existing);}
  fs.mkdirSync(d.mediaRoot,{recursive:true});
  const storageKey=`${id}.wav`,final=path.join(d.mediaRoot,storageKey),stage=path.join(d.mediaRoot,`${id}.${randomUUID()}.staging`);
  fs.writeFileSync(stage,pcm.bytes,{flag:'wx'});
  try{
   const asset={id,ownerId:user.sub,designId,status:'ready',mediaKind:'audio',mime:'audio/wav',bytes:pcm.bytes.length,width:0,height:0,durationMs:pcm.durationMs,sampleCount:pcm.sampleCount,sampleRate:44100,channels:1,contentHash,storageKey,createdAt:new Date().toISOString()};
   return this.view(await d.repository.insertAsset(user.sub,designId,asset,{prepare:()=>{
    if(fs.existsSync(final)){
     if(`sha256:${createHash('sha256').update(fs.readFileSync(final)).digest('hex')}`!==contentHash)throw canvasError(409,'ASSET_MUTATION_CONFLICT','Nội dung tải lại không khớp.');
    }else fs.renameSync(stage,final);
   }}));
  }finally{if(fs.existsSync(stage))fs.unlinkSync(stage);}
 }
 view(a){return {id:a.id,assetId:a.id,status:a.status,mediaKind:'audio',mime:a.mime,bytes:a.bytes,durationMs:a.durationMs,sampleCount:a.sampleCount,sampleRate:a.sampleRate,channels:a.channels};}
}
