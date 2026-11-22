import { soundUrl } from '../../shared/canvas/sound.js';

// One lazy AudioContext, one voice, bounded decoded cache, latest intent wins.
export function createSoundPlayer({assetUrl,onError=()=>{},contextFactory=()=>{const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)throw Object.assign(new Error('Audio API unavailable'),{code:'AUDIO_UNSUPPORTED'});return new Context();},fetcher=globalThis.fetch}={}) {
 let context,source,gain,pending,epoch=0,disposed=false,enabled=false;
 const cache=new Map(),preparations=new Map();
 const cacheBuffer=(url,buffer)=>{if(cache.size>=8&&!cache.has(url))cache.delete(cache.keys().next().value);cache.set(url,buffer);};
 async function readBuffer(url,signal){
  const response=await fetcher(url,{signal,credentials:'same-origin'});if(!response.ok)throw new Error('AUDIO_LOAD');
  const length=Number(response.headers.get('content-length'));if(length>882044)throw new Error('AUDIO_BUDGET');
  const bytes=await response.arrayBuffer();if(disposed||signal?.aborted)throw new DOMException('Audio intent cancelled','AbortError');if(bytes.byteLength>882044)throw new Error('AUDIO_BUDGET');return getContext().decodeAudioData(bytes);
 }
 function cancelPreparations(){for(const task of preparations.values())task.controller.abort();preparations.clear();}
 async function prepare(sound,{signal}={}){
  if(disposed||!enabled||signal?.aborted)return false;
  const url=soundUrl(sound,assetUrl);if(cache.has(url))return true;
  if(preparations.has(url))return preparations.get(url).promise;
  if(preparations.size>=4)return false;
  const controller=new AbortController(),combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
  const promise=(async()=>{try{const buffer=await readBuffer(url,combined);if(disposed||combined.aborted||!enabled)return false;cacheBuffer(url,buffer);return true;}catch{return false;}finally{if(preparations.get(url)?.controller===controller)preparations.delete(url);}})();preparations.set(url,{controller,promise});return promise;
 }
 function cancelPending(){epoch++;pending?.abort();pending=null;}
 function stop(){cancelPending();try{source?.stop();}catch{/* already ended */}source?.disconnect();gain?.disconnect();source=gain=null;}
 function getContext(){context??=contextFactory();return context;}
 async function unlock(){try{await getContext().resume();return true;}catch(error){onError(error);return false;}}
 async function play(sound,{explicit=false,bytes:localBytes}={}){
  stop();if(disposed||!sound||(!explicit&&!enabled))return false;
  const current=epoch;
  try{
   const ctx=getContext();const resumed=ctx.resume().catch(()=>false); // Called synchronously inside the user gesture.
   const url=localBytes?null:soundUrl(sound,assetUrl);
   let buffer=cache.get(url);
   if(localBytes)buffer=await ctx.decodeAudioData(localBytes.slice(0));
   if(!buffer&&preparations.has(url)){await preparations.get(url).promise;buffer=cache.get(url);}
   if(!buffer){
    if(disposed||epoch!==current)return false;
    pending=new AbortController();buffer=await readBuffer(url,pending.signal);
    if(disposed||epoch!==current)return false;
    cacheBuffer(url,buffer);
   }
   if(ctx.state!=='running')await resumed;
   if(disposed||epoch!==current)return false;
   if(ctx.state!=='running'){onError();return false;}
   pending=null;
   const offset=sound.kind==='library'?sound.startMs/1000:0,duration=sound.kind==='library'?(sound.endMs-sound.startMs)/1000:buffer.duration;
   source=ctx.createBufferSource();gain=ctx.createGain();source.buffer=buffer;gain.gain.value=sound.volume;source.connect(gain);gain.connect(ctx.destination);
   const voice=source,node=gain;source.onended=()=>{voice.disconnect();node.disconnect();if(source===voice)source=gain=null;};
   source.start(0,offset,Math.max(0,Math.min(duration,buffer.duration-offset)));return true;
  }catch(error){if(error.name!=='AbortError'&&epoch===current&&!disposed)onError(error);return false;}
 }
 return {play,prepare,unlock,stop,cancelPending,suspend(){stop();cancelPreparations();void context?.suspend?.().catch(()=>{});},setEnabled(value){enabled=value;if(!value){stop();cancelPreparations();}else void unlock();},get enabled(){return enabled;},dispose(){if(disposed)return;disposed=true;stop();cancelPreparations();cache.clear();void context?.close().catch(()=>{});context=null;}};
}
