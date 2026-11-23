import { randomUUID } from 'node:crypto';
import { createElement } from '../../web/js/shared/canvas/index.js';
import { encodeWav,trimPcm } from '../../web/js/shared/canvas/audio-pcm.js';
import { sfxCatalog } from '../../src/modules/designs/audio.service.mjs';
import { SOUNDTRACKS } from '../../web/js/shared/canvas/soundtracks.js';
export async function seedSfxDemoCard(fixture,owner,{withSound=true}={}){
 const post=async(route,body)=>{const result=await fixture.request(route,{cookie:owner.cookie,body});if(result.status>=300)throw new Error(JSON.stringify(result.data));return result.data;};
 const {design}=await post('/designs/designs',{source:{kind:'blank'},presetId:'envelope-basic',title:withSound?'Momevia — thử âm thanh':'Momevia — thiệp im lặng',mutationId:randomUUID()});
 for(const [key,value]of Object.entries({recipientName:'Bạn thương',senderName:'Momevia',message:'Một lá thư nhỏ, một hộp quà và một lời chúc thật vui. Bạn vẫn đọc được mọi nội dung khi tắt tiếng.'}))design.document.bindings[key].value=value;
 let source,clip;
 if(withSound){
  const catalog=sfxCatalog(),librarySound=(id,volume)=>{const item=catalog.assets.find(a=>a.id===id);return {kind:'library',id,version:item.version,startMs:0,endMs:item.durationMs,volume};};
  const samples=Float32Array.from({length:132300},(_,i)=>.35*Math.sin(2*Math.PI*(i<44100?220:i<88200?880:1760)*i/44100));source=Buffer.from(encodeWav(samples));clip=Buffer.from(trimPcm({sampleRate:44100,length:samples.length,numberOfChannels:1,getChannelData:()=>samples},1000,2000).bytes);
  const upload=await fixture.request(`/designs/designs/${design.id}/audio`,{cookie:owner.cookie,bytes:clip,headers:{'content-type':'audio/wav','x-mutation-id':randomUUID()}});if(upload.status!==201)throw new Error(JSON.stringify(upload.data));
  const doc=design.document;doc.schemaVersion=doc.registryVersion=3;doc.assets.push({kind:'audio',assetId:upload.data.asset.id});
  doc.soundtrack={id:SOUNDTRACKS[0].id,volume:.35};
  const envelope=doc.elements.find(e=>e.type==='envelope');envelope.sound=librarySound('seal-peel',.8);
  const box=createElement('gift-box',{props:{label:'Mở hộp quà'},sound:librarySound('box-pop',.7),layout:{x:90,y:470,width:220,height:150},actions:[{on:'activate',type:'goToScene',targetSceneId:doc.scenes[2].id}]}),library=createElement('sound-button',{props:{label:'Nghe giai điệu kết'},sound:librarySound('warm-ending',.55),layout:{x:50,y:510,width:290,height:54}}),personal=createElement('sound-button',{props:{label:'Nghe đoạn tín hiệu giữa'},sound:{kind:'audio',assetId:upload.data.asset.id,volume:.45},layout:{x:50,y:580,width:290,height:54}});
  doc.elements.push(box,library,personal);doc.scenes[0].elementIds.push(box.id);doc.scenes[1].elementIds.push(library.id,personal.id);
 }
 const saved=await post(`/designs/designs/${design.id}/save`,{title:design.title,document:design.document,expectedRevision:design.revision,mutationId:randomUUID()});
 const {gift}=await post('/gifts/gifts/from-design',{designId:design.id,expectedRevision:saved.savedRevision,expectedDocumentHash:saved.documentHash,idempotencyKey:randomUUID()});return {designId:design.id,gift,source,clip};
}
