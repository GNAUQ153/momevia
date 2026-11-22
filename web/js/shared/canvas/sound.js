import { SFX_VERSIONS } from './sfx-index.js';
export const SOUND_TYPES=Object.freeze(['sound-button','button','envelope','gift-box']);
export const usesSound=document=>document.elements.some(e=>e.sound||e.type==='sound-button')||document.assets.some(a=>a.kind==='audio');
export const soundUrl=(sound,assetUrl)=>sound.kind==='library'?`/api/designs/sfx/${sound.version}/${encodeURIComponent(sound.id)}`:assetUrl(sound.assetId);
export function validateSound(sound) {
 const fail=()=>{throw new Error('Âm thanh cần nguồn hợp lệ, đoạn 0,1–10 giây và âm lượng 0–100%.');};
 if(!sound||Object.getPrototypeOf(sound)!==Object.prototype)fail();
 const allowed=sound.kind==='library'?['kind','id','version','startMs','endMs','volume']:['kind','assetId','volume'];
 if(Object.keys(sound).length!==allowed.length||Object.keys(sound).some(k=>!allowed.includes(k)))fail();
 if(!Number.isFinite(sound.volume)||sound.volume<0||sound.volume>1)fail();
 if(sound.kind==='library'){
  const duration=Number.isSafeInteger(sound.version)&&Object.hasOwn(SFX_VERSIONS,sound.version)&&Object.hasOwn(SFX_VERSIONS[sound.version],sound.id)?SFX_VERSIONS[sound.version][sound.id]:null;
  if(!Number.isFinite(duration)||![sound.startMs,sound.endMs].every(Number.isFinite)||sound.startMs<0||sound.endMs>duration+.001||sound.endMs-sound.startMs<100||sound.endMs-sound.startMs>10000)fail();
 }else if(sound.kind!=='audio'||typeof sound.assetId!=='string'||! /^[\w-]{1,128}$/.test(sound.assetId))fail();
 return sound;
}
