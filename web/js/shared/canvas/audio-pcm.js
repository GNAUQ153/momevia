// PCM conversion is shared by the trimmer, generator and verification fixtures.
export const AUDIO_LIMITS=Object.freeze({sourceBytes:10*1024*1024,sourceSeconds:60,decodedBytes:64*1024*1024,minMs:100,maxMs:10000,rate:44100,uploadBytes:882044,ownerBytes:50*1024*1024});
export function sampleWindow(startMs,endMs,sampleRate,length) {
 if (![startMs,endMs,sampleRate,length].every(Number.isFinite) || startMs<0 || endMs<=startMs || endMs-startMs<AUDIO_LIMITS.minMs || endMs-startMs>AUDIO_LIMITS.maxMs) throw new Error('Chọn đoạn từ 0,1 đến 10 giây.');
 const start=Math.round(startMs*sampleRate/1000),end=Math.round(endMs*sampleRate/1000);
 if(end>length||start>=end)throw new Error('Mốc cắt vượt tệp âm thanh.');
 return {start,end};
}
export function encodeWav(samples,rate=44100) {
 const bytes=new ArrayBuffer(44+samples.length*2),v=new DataView(bytes);
 const str=(at,s)=>Array.from(s).forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));
 str(0,'RIFF');v.setUint32(4,bytes.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,samples.length*2,true);
 for(let i=0;i<samples.length;i++){const s=Math.max(-1,Math.min(1,samples[i]));v.setInt16(44+i*2,Math.round(s*(s<0?32768:32767)),true);}
 return bytes;
}
export function trimPcm(buffer,startMs,endMs) {
 const {start,end}=sampleWindow(startMs,endMs,buffer.sampleRate,buffer.length),count=Math.round((end-start)*44100/buffer.sampleRate),mono=new Float32Array(count);
 for(let c=0;c<buffer.numberOfChannels;c++){
  const channel=buffer.getChannelData(c);
  for(let i=0;i<count;i++){const pos=start+i*buffer.sampleRate/44100,at=Math.floor(pos),f=pos-at;mono[i]+=((channel[at]||0)*(1-f)+(channel[Math.min(at+1,end-1)]||0)*f)/buffer.numberOfChannels;}
 }
 return {bytes:encodeWav(mono),samples:mono,durationMs:count/44.1};
}
