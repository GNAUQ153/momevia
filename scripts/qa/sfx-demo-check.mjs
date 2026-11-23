import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium,webkit } from 'playwright';
import { execFileSync } from 'node:child_process';
const file=process.argv[2];assert(file,'Provide the isolated demo session file.');
const session=JSON.parse(fs.readFileSync(file,'utf8')),directory=path.dirname(path.resolve(file)),base=session.base;
const currentSfx=JSON.parse(fs.readFileSync(new URL('../../web/assets/sfx/v2/catalog.json',import.meta.url),'utf8'));
const report={physicalDevices:false,checks:[],webkit:{engine:'Playwright WebKit Windows',physicalSafari:false}};
const browser=await chromium.launch({channel:'chrome',headless:true});let wk;
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),requests=[];
 await page.addInitScript(()=>{
  globalThis.localStorage.setItem('momevia-locale','vi');globalThis.__qaAudio={contexts:[],starts:[],decodes:0};const Context=globalThis.AudioContext;
  globalThis.AudioContext=class extends Context{
   constructor(options){super(options);globalThis.__qaAudio.contexts.push(this);}
   decodeAudioData(...args){return super.decodeAudioData(...args).then(buffer=>{globalThis.__qaAudio.decodes++;return buffer;});}
   createBufferSource(){const node=super.createBufferSource(),start=node.start.bind(node);node.start=(...args)=>{globalThis.__qaAudio.starts.push(args);return start(...args);};return node;}
  };
 });
 page.on('request',r=>requests.push(r.url()));
 for(const [name,route]of [['catalog','/explore'],['gift-without-sound','/g/'+session.silentGift.slug]]){
  requests.length=0;await page.goto(base+route);await page.locator(name==='catalog'?'#main h1':'.gift-runtime-stage').waitFor();await page.waitForTimeout(600);const audio=requests.filter(url=>/\/api\/designs\/sfx(?:\/|$)|\.(?:wav|mp3)(?:\?|$)/.test(url));assert.equal(audio.length,0);report.checks.push({name,audioRequests:0,result:'PASS'});
 }
 await page.goto(base+'/g/'+session.gift.slug);await page.locator('[data-sound-control]').waitFor();assert.equal(await page.evaluate(()=>globalThis.__qaAudio.contexts.length),0);await page.getByRole('button',{name:'Bật âm thanh',exact:true}).tap();await page.waitForFunction(()=>globalThis.__qaAudio.decodes>=2);await page.locator('.gift-runtime-envelope').tap();await page.waitForFunction(()=>globalThis.__qaAudio.starts.length===1);const first=await page.evaluate(()=>globalThis.__qaAudio.starts[0]);assert.equal(first[1],0);assert.equal(first[2],currentSfx.assets.find(a=>a.id==='seal-peel').durationMs/1000);await page.getByRole('button',{name:'Nghe đoạn tín hiệu giữa',exact:true}).tap();await page.waitForFunction(()=>globalThis.__qaAudio.starts.length===2);await page.screenshot({path:path.join(directory,'demo-recipient.png'),fullPage:true});report.checks.push({name:'live recipient: opt-in preparation, envelope feedback and personal clip',result:'PASS',firstStartArguments:first});
 const mediaId=(await (await fetch(base+'/api/gifts/gifts/'+session.gift.slug)).json()).gift.documentSnapshot.elements.find(e=>e.sound?.kind==='audio').sound.assetId;
 wk=await webkit.launch({headless:true});const p=await wk.newPage({viewport:{width:390,height:844},hasTouch:true});
 await p.addInitScript(()=>{globalThis.__wkContexts=[];const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(Context)globalThis.AudioContext=class extends Context{constructor(options){super(options);globalThis.__wkContexts.push(this);}};});
 await p.goto(base+'/g/'+session.gift.slug);await p.locator('[data-sound-control]').waitFor();report.webkit.loaded=true;
 // Probe decoder and context separately: this distinguishes the Windows test
 // engine's audio backend from the gift's API or WAV structure.
 report.webkit.decoder=await p.evaluate(async({url})=>{
  if(!globalThis.AudioContext)return {decoded:false,reason:'AudioContext and webkitAudioContext unavailable in this Windows WebKit build'};
  const bytes=await (await fetch(url)).arrayBuffer(),c=new globalThis.AudioContext({sampleRate:44100});
  try{return await Promise.race([c.decodeAudioData(bytes).then(b=>({decoded:true,sampleRate:b.sampleRate,channels:b.numberOfChannels,seconds:b.duration})),new Promise(resolve=>setTimeout(()=>resolve({decoded:false,reason:'decode timeout',state:c.state}),4000))]);}catch(error){return {decoded:false,reason:error.message,state:c.state};}finally{void c.close();}
 },{url:`${base}/api/gifts/gifts/${session.gift.slug}/assets/${mediaId}`});
 await p.getByRole('button',{name:'Bật âm thanh',exact:true}).click();await p.waitForTimeout(500);report.webkit.contexts=await p.evaluate(()=>globalThis.__wkContexts.map(c=>({state:c.state,sampleRate:c.sampleRate})));report.webkit.notes='Windows WebKit emulation; this is not Safari or an iPhone.';if(!report.webkit.contexts.length){await p.getByText('Trình duyệt này chưa hỗ trợ phát âm.',{exact:false}).waitFor();await p.locator('.gift-runtime-envelope').click();await p.locator('.gift-runtime-sound-button').first().waitFor();report.webkit.unsupportedPlaybackFallback='PASS';}
 report.chrome=browser.version();
 if(process.env.SFX_QA_FFMPEG){
  for(const [ext,args]of [['mp3',['-c:a','libmp3lame']],['m4a',['-c:a','aac','-movflags','+faststart']]])execFileSync(process.env.SFX_QA_FFMPEG,['-hide_banner','-loglevel','error','-y','-i',path.join(directory,'three-signals.wav'),...args,path.join(directory,'source.'+ext)],{windowsHide:true});
  report.webkit.codecs=[];for(const name of ['three-signals.wav','source.mp3','source.m4a'])report.webkit.codecs.push(await p.evaluate(async({name,bytes})=>{try{const {decodeSource}=await import('/js/features/canvas-editor/audio-trimmer.js');return await Promise.race([decodeSource(new File([new Uint8Array(bytes)],name)).then(buffer=>({name,decoded:true,rate:buffer.sampleRate,seconds:buffer.duration})),new Promise(resolve=>setTimeout(()=>resolve({name,decoded:false,reason:'decoder did not finish within 5 seconds'}),5000))]);}catch(error){return {name,decoded:false,reason:error.message};}},{name,bytes:[...fs.readFileSync(path.join(directory,name))]}));
 }
}catch(error){report.error=error.stack;process.exitCode=1;console.error(error.stack);}
finally{await wk?.close();await browser.close();fs.writeFileSync(path.join(directory,'demo-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
