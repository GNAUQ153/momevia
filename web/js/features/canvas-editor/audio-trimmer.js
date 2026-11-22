import { node,field } from './dom.js';
import { t } from '../../core/i18n.js';
import { AUDIO_LIMITS,sampleWindow,trimPcm } from '../../shared/canvas/audio-pcm.js';

export async function decodeSource(file) {
 if(!(globalThis.AudioContext||globalThis.webkitAudioContext))throw new Error(t('sfx.unsupportedBrowser'));
 if(!file||file.size>AUDIO_LIMITS.sourceBytes)throw new Error(t('sfx.sourceSize'));
 if(!/\.(wav|mp3|m4a|aac)$/i.test(file.name))throw new Error(t('sfx.sourceType'));
 const url=URL.createObjectURL(file),probe=document.createElement('audio');let sourceDuration;
 try{
  const duration=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{probe.removeAttribute('src');reject(new Error(t('sfx.decodeError')));},12000);
   probe.preload='metadata';probe.onloadedmetadata=()=>{clearTimeout(timer);resolve(probe.duration);};probe.onerror=()=>{clearTimeout(timer);reject(new Error(t('sfx.decodeError')));};probe.src=url;
  });
  if(!Number.isFinite(duration)||duration<=0||duration>AUDIO_LIMITS.sourceSeconds+.001)throw new Error(t('sfx.sourceDuration'));
  sourceDuration=duration;
 }finally{probe.removeAttribute('src');probe.load();URL.revokeObjectURL(url);}
 const data=await file.arrayBuffer();
 // WAV fmt header exposes allocation before decode; compressed formats get a
 // duration probe first and a decoded allocation check immediately afterwards.
 if(file.name.toLowerCase().endsWith('.wav')&&data.byteLength>=36){
  const header=new DataView(data);
  if(header.getUint32(0,false)===0x52494646){
   const channels=header.getUint16(22,true),rate=header.getUint32(24,true);
   if(channels>8||rate>192000||channels*Math.max(rate,44100)*sourceDuration*4>AUDIO_LIMITS.decodedBytes)throw new Error(t('sfx.memoryError'));
  }
 }
 const context=new (globalThis.AudioContext||globalThis.webkitAudioContext)({sampleRate:44100});
 try{
  const buffer=await context.decodeAudioData(data);
  if(buffer.duration>AUDIO_LIMITS.sourceSeconds+.001||buffer.duration<.1)throw new Error(t('sfx.sourceDuration'));
  if(buffer.length*buffer.numberOfChannels*4>AUDIO_LIMITS.decodedBytes||buffer.numberOfChannels>8)throw new Error(t('sfx.memoryError'));
  return buffer;
 }catch(error){if(error.message===t('sfx.sourceDuration')||error.message===t('sfx.memoryError'))throw error;throw new Error(t('sfx.decodeError'));}
 finally{await context.close();}
}

export function mountTrimmer(host,{buffer,startMs=0,endMs=Math.min(10000,buffer.duration*1000),volume=1,onApply,onCancel}={}){
 const controller=new AbortController(),signal=controller.signal;
 let context,voice,gain,closed=false,epoch=0;
 const maxMs=buffer.length/buffer.sampleRate*1000;
 const wave=node('canvas',{width:720,height:120,'aria-label':t('sfx.waveform'),role:'img'});
 const start=node('input',{type:'range',min:0,max:maxMs,step:1,value:startMs,'aria-label':t('sfx.startHandle')}),end=node('input',{type:'range',min:0,max:maxMs,step:1,value:endMs,'aria-label':t('sfx.endHandle')});
 const startSeconds=node('input',{type:'number',min:0,max:maxMs/1000,step:.001,value:startMs/1000}),endSeconds=node('input',{type:'number',min:0,max:maxMs/1000,step:.001,value:endMs/1000});
 const level=node('input',{type:'range',min:0,max:1,step:.01,value:volume});
 const duration=node('output',{'aria-live':'polite'}),error=node('p',{role:'alert'});
 const play=node('button',{type:'button'},t('sfx.previewSegment')),stop=node('button',{type:'button'},t('sfx.stop')),apply=node('button',{type:'button',class:'editor-primary'},t('sfx.apply')),cancel=node('button',{type:'button'},t('sfx.cancel'));
 function halt(){epoch++;try{voice?.stop();}catch{/* ended */}voice?.disconnect();gain?.disconnect();voice=gain=null;}
 function draw(){
  const ctx=wave.getContext('2d'),data=buffer.getChannelData(0);ctx.clearRect(0,0,720,120);ctx.fillStyle='#F4EDF8';ctx.fillRect(0,0,720,120);ctx.fillStyle='#DED0F5';ctx.fillRect(startMs/maxMs*720,0,(endMs-startMs)/maxMs*720,120);ctx.strokeStyle='#6136DF';ctx.beginPath();
  const step=Math.max(1,Math.floor(data.length/720));for(let x=0;x<720;x++){let peak=0;for(let i=x*step;i<Math.min(data.length,(x+1)*step);i++)peak=Math.max(peak,Math.abs(data[i]));ctx.moveTo(x,60-peak*54);ctx.lineTo(x,60+peak*54);}ctx.stroke();
 }
 function sync(){
  halt();start.value=startMs;end.value=endMs;startSeconds.value=(startMs/1000).toFixed(3);endSeconds.value=(endMs/1000).toFixed(3);duration.textContent=t('sfx.segmentDuration',{seconds:((endMs-startMs)/1000).toFixed(3)});
  try{sampleWindow(startMs,endMs,buffer.sampleRate,buffer.length);apply.disabled=play.disabled=false;error.textContent='';}catch{apply.disabled=play.disabled=true;error.textContent=t('sfx.segmentInvalid');}draw();
 }
 for(const [control,key,scale]of [[start,'start',1],[end,'end',1],[startSeconds,'start',1000],[endSeconds,'end',1000]])control.addEventListener('input',()=>{const value=Number(control.value)*scale;if(key==='start')startMs=value;else endMs=value;sync();},{signal});
 level.addEventListener('input',()=>{volume=Number(level.value);if(gain)gain.gain.value=volume;},{signal});
 play.addEventListener('click',async()=>{
  halt();const intent=epoch;try{context??=new (globalThis.AudioContext||globalThis.webkitAudioContext)();await context.resume();if(closed||epoch!==intent)return;
   const window=sampleWindow(startMs,endMs,buffer.sampleRate,buffer.length);voice=context.createBufferSource();voice.buffer=buffer;gain=context.createGain();gain.gain.value=volume;voice.connect(gain);gain.connect(context.destination);voice.start(0,window.start/buffer.sampleRate,(window.end-window.start)/buffer.sampleRate);
  }catch{error.textContent=t('sfx.playError');}
 },{signal});
 stop.addEventListener('click',halt,{signal});cancel.addEventListener('click',onCancel,{signal});
 apply.addEventListener('click',()=>{halt();onApply({startMs,endMs,volume,pcm:()=>trimPcm(buffer,startMs,endMs)});},{signal});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)halt();},{signal});
 host.replaceChildren(node('h3',{},t('sfx.trim')),wave,field(t('sfx.startHandle'),start),field(t('sfx.endHandle'),end),node('div',{class:'sfx-times'},field(t('sfx.startSeconds'),startSeconds),field(t('sfx.endSeconds'),endSeconds)),duration,field(t('sfx.volume'),level),node('p',{class:'editor-help'},t('sfx.reselectSource')),error,node('div',{class:'sfx-actions'},play,stop,apply,cancel));sync();
 return {dispose(){closed=true;controller.abort();halt();void context?.close().catch(()=>{});host.replaceChildren();}};
}
