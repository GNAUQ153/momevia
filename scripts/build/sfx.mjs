// Original procedural Foley and musical miniatures. No third-party recordings.
// The algorithm, score and generated recordings are dedicated to CC0-1.0.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { encodeWav } from '../../web/js/shared/canvas/audio-pcm.js';
if(fs.existsSync(new URL('../../web/assets/sfx/v2/catalog.json',import.meta.url)))throw new Error('The synthesized v1 generator is archived. Import external recordings with scripts/assets/import-recorded-audio.py; never regenerate pinned legacy files.');

const groups = [
 ['paper','Thư và giấy','Letters & paper',[
  ['seal-peel','Bóc niêm phong','Peeling a seal',850,'peel'],['letter-unfold','Mở nếp thư','Unfolding a letter',1300,'fold'],['page-turn','Lật trang','Turning a page',700,'page'],['paper-rustle','Giấy xào xạc','Paper rustle',1100,'rustle'],['pen-sign','Nét ký tên','Pen signature',950,'pen']]],
 ['gift','Hộp và quà','Boxes & gifts',[
  ['ribbon-untie','Tháo nơ','Untying a ribbon',1200,'ribbon'],['box-pop','Bật nắp hộp','Box lid pop',650,'pop'],['gift-shake','Lắc hộp quà','Shaking a gift',1500,'shake'],['wood-lid','Mở hộp gỗ','Wooden lid',900,'wood'],['wrap-tear','Xé giấy gói','Tearing gift wrap',1000,'tear']]],
 ['sparkle','Lấp lánh','Sparkles',[
  ['tiny-spark','Tia sáng nhỏ','Tiny spark',600,'bell'],['fairy-dust','Bụi tiên','Fairy dust',1700,'arpeggio'],['star-trail','Vệt sao','Star trail',1500,'glide'],['glass-twinkle','Leng keng pha lê','Crystal twinkle',1300,'glass'],['magic-reveal','Phép màu hiện ra','Magic reveal',1900,'rise']]],
 ['birthday','Sinh nhật','Birthday',[
  ['candle-blow','Thổi nến','Blowing a candle',1200,'blow'],['confetti-pop','Pháo giấy','Confetti pop',1400,'confetti'],['balloon-pop','Bóng bay nổ','Balloon pop',450,'balloon'],['birthday-chime','Chuông mừng tuổi','Birthday chime',1800,'birthday'],['party-horn','Kèn tiệc vui','Party horn',900,'horn']]],
 ['memory','Kỷ niệm','Memories',[
  ['camera-shutter','Màn trập máy ảnh','Camera shutter',450,'shutter'],['projector-click','Máy chiếu ký ức','Memory projector',1600,'projector'],['heartbeat','Nhịp tim','Heartbeat',1500,'heart'],['music-box','Hộp nhạc xưa','Vintage music box',2400,'musicbox'],['clock-tick','Tích tắc','Clock tick',1300,'clock']]],
 ['interaction','Tương tác','Interaction',[
  ['soft-tap','Chạm nhẹ','Soft tap',200,'tap'],['gentle-click','Bấm dịu','Gentle click',240,'click'],['swipe-whoosh','Vuốt qua','Swipe whoosh',550,'whoosh'],['choice-ding','Đã chọn','Choice ding',700,'ding'],['success-pair','Hai nốt hoàn tất','Success pair',950,'success']]],
 ['nature','Thiên nhiên','Nature',[
  ['water-drop','Giọt nước','Water drop',600,'drop'],['rain-window','Mưa bên cửa','Rain at the window',2600,'rain'],['bird-call','Chim gọi sáng','Morning bird',1500,'bird'],['gentle-wind','Gió dịu','Gentle wind',2400,'wind'],['shore-wave','Sóng ven bờ','Shore wave',2800,'wave']]],
 ['melody','Giai điệu ngắn','Short melodies',[
  ['warm-ending','Kết ấm áp','Warm ending',2400,'warm'],['playful-ending','Kết tinh nghịch','Playful ending',1800,'playful'],['tender-ending','Kết dịu dàng','Tender ending',2800,'tender'],['bright-ending','Kết rạng rỡ','Bright ending',2100,'bright'],['goodnight-ending','Khúc chúc ngủ ngon','Goodnight ending',3000,'night']]],
];
const rate=44100, output=new URL('../../web/assets/sfx/v1/',import.meta.url);
fs.mkdirSync(output,{recursive:true});
const catalog=[];
function writeRecording(url,bytes){
 if(fs.existsSync(url)){
  if(!fs.readFileSync(url).equals(bytes))throw new Error('SFX v1 is immutable. Publish a new version instead of replacing referenced recordings.');
 }else fs.writeFileSync(url,bytes);
}
for (const [group,vi,en,items] of groups) for (const [id,nameVi,nameEn,durationMs,recipe] of items) {
 let seed=Array.from(id).reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,1), smooth=0;
 const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
 const samples=new Float32Array(Math.round(durationMs*rate/1000));
 const tone=(t,f,start,len,gain=.3)=>{const x=t-start;return x<0||x>len?0:Math.sin(2*Math.PI*f*x)*Math.exp(-x*7/len)*Math.min(1,x*180)*gain;};
 const scores={arpeggio:[1046,1318,1568,2093,2637],birthday:[523,523,659,784],musicbox:[784,659,698,587,523],success:[659,988],warm:[261.63,329.63,392,523.25],playful:[523,784,659,1046],tender:[440,523,659,880],bright:[659,784,988,1318],night:[523,440,392,330,262]};
 for(let i=0;i<samples.length;i++) {
  const t=i/rate,d=durationMs/1000,u=t/d,n=noise();smooth=.97*smooth+.03*n;
  const envelope=Math.sin(Math.PI*u)**.8, pulse=(hz,width)=>Math.exp(-((t*hz)%1)/width);
  let value=0;
  switch(recipe){
   case 'peel':value=n*(.07+.22*Math.sin(Math.PI*u)**2)*(.4+.6*pulse(34,.3));break;
   case 'fold':value=n*(.09+.22*pulse(3,.12))*(.2+.8*Math.sin(2*Math.PI*170*t)**2);break;
   case 'page':value=(n*.08+smooth*.9)*Math.sin(Math.PI*u)**2;break;
   case 'rustle':value=n*.27*(.15+.85*pulse(7,.2));break;
   case 'pen':value=n*.1*(Math.sin(2*Math.PI*2*t)>.1?1:.1)+tone(t,1700,.1,.08,.09);break;
   case 'ribbon':value=smooth*.9+n*.06*Math.sin(2*Math.PI*4*t)**2;break;
   case 'pop':value=n*.45*Math.exp(-t*28)+tone(t,130,0,.4,.7);break;
   case 'shake':value=n*.3*pulse(4,.13)+tone(t,850,0,.2,.1);break;
   case 'wood':value=tone(t,240,0,.6,.6)+tone(t,370,.22,.3,.3)+n*.2*Math.exp(-t*28);break;
   case 'tear':value=n*.45*pulse(23,.3)*Math.sin(Math.PI*u);break;
   case 'bell':value=tone(t,2637,0,d,.6)+tone(t,3980,.03,d,.2);break;
   case 'glass':value=tone(t,1760,0,1,.4)+tone(t,2349,.25,1,.3)+tone(t,3136,.5,.7,.2);break;
   case 'glide':value=Math.sin(2*Math.PI*(1000*t+1100*t*t))*.24*Math.exp(-t);break;
   case 'rise':value=smooth*.3*u+Math.sin(2*Math.PI*(400*t+650*t*t))*.16+tone(t,2093,1.1,.7,.45);break;
   case 'blow':value=smooth*2.3*Math.sin(Math.PI*u)**2+n*.035;break;
   case 'confetti':value=n*(.65*Math.exp(-t*20)+.2*pulse(31,.07)*Math.exp(-t*2));break;
   case 'balloon':value=n*.8*Math.exp(-t*40)+tone(t,70,0,.25,.6);break;
   case 'horn':value=(Math.sin(2*Math.PI*392*t)+.3*Math.sin(2*Math.PI*784*t))*.22*Math.sin(Math.PI*u);break;
   case 'shutter':value=n*(.7*Math.exp(-t*110)+.5*Math.exp(-Math.abs(t-.12)*110));break;
   case 'projector':value=n*.4*pulse(8,.035)+tone(t,180,0,d,.08);break;
   case 'heart':value=tone(t,65,0,.25,.8)+tone(t,78,.25,.2,.65)+tone(t,65,.85,.25,.8)+tone(t,78,1.1,.2,.65);break;
   case 'clock':value=n*.4*pulse(2,.015)+tone(t,1400,0,.03,.4)+tone(t,1800,.5,.03,.3);break;
   case 'tap':value=tone(t,220,0,d,.75)+n*.15*Math.exp(-t*70);break;
   case 'click':value=tone(t,950,0,.08,.5)+n*.35*Math.exp(-t*110);break;
   case 'whoosh':value=(smooth*2+n*.04)*Math.sin(Math.PI*u)**3;break;
   case 'ding':value=tone(t,1318,0,d,.6);break;
   case 'drop':value=Math.sin(2*Math.PI*(1800*t-1000*t*t))*.5*Math.exp(-t*14);break;
   case 'rain':value=n*.08+n*.28*pulse(61,.045)+tone(t,2400,.5,.08,.25);break;
   case 'bird':value=Math.sin(2*Math.PI*(1700*t+250*Math.sin(t*20)))*.3*Math.sin(2*Math.PI*2*t)**8;break;
   case 'wind':value=smooth*2.3*(.5+.5*Math.sin(t*3));break;
   case 'wave':value=(smooth*1.5+n*.12)*Math.sin(Math.PI*u)**2;break;
   default:{const notes=scores[recipe];for(const [j,f]of notes.entries()){const start=j*(d*.55/notes.length);value+=tone(t,f,start,d-start,.32)+tone(t,f*2,start,(d-start)*.65,.065);} }
  }
  // Fixed fades prevent clicks; normalize every asset individually below.
  samples[i]=value*Math.min(1,t/.008,(d-t)/.02)*envelope;
 }
 const peak=samples.reduce((a,b)=>Math.max(a,Math.abs(b)),0);
 for(let i=0;i<samples.length;i++)samples[i]*=.72/peak;
 const bytes=Buffer.from(encodeWav(samples,rate));writeRecording(new URL(id+'.wav',output),bytes);
 catalog.push({id,version:1,name:{vi:nameVi,en:nameEn},group,groupName:{vi,en},keywords:`${nameVi} ${nameEn} ${vi} ${en} ${recipe}`,durationMs:samples.length/rate*1000,sampleCount:samples.length,sampleRate:rate,channels:1,mime:'audio/wav',bytes:bytes.length,sourceFile:`web/assets/sfx/v1/${id}.wav`,author:'Momevia procedural audio project',license:'CC0-1.0',evidence:'scripts/build/sfx.mjs — original deterministic synthesis; web/assets/sfx/LICENSE.txt',sha256:createHash('sha256').update(bytes).digest('hex'),recipe});
}
fs.writeFileSync(new URL('catalog.json',output),JSON.stringify({formatVersion:1,version:1,assets:catalog},null,2)+'\n');
fs.writeFileSync(new URL('../../web/js/shared/canvas/sfx-index.js',import.meta.url),`// Generated by scripts/build/sfx.mjs. Keep historical versions.\nexport const SFX_VERSIONS = Object.freeze({1:Object.freeze(${JSON.stringify(Object.fromEntries(catalog.map(a=>[a.id,a.durationMs])))})});\n`);
fs.writeFileSync(new URL('../LICENSE.txt',output),'Momevia original procedural sound effects v1\nAuthor: Momevia procedural audio project\nSource: scripts/build/sfx.mjs (deterministic synthesis and original short scores).\nNo external recordings, samples, melodies or downloaded packages were used.\nTo the extent possible under law, the author dedicates the generator and generated audio to the public domain under CC0 1.0 Universal.\nSPDX-License-Identifier: CC0-1.0\nLicense: https://creativecommons.org/publicdomain/zero/1.0/legalcode\nAutomated validation does not constitute human listening approval.\n');
console.log(`Generated ${catalog.length} original WAVs, provenance and SHA-256 manifest.`);
