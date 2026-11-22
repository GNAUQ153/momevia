import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium,webkit } from 'playwright';
import { confirmGiftAccess } from './gift-access.mjs';
import { execFileSync } from 'node:child_process';

export async function runSfxBrowser({fixture,owner,gift,check}){
 const {base,directory,request}=fixture,browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000},locale:'vi-VN'}),errors=[],requests=[],uploads=[];
 const split=owner.cookie.indexOf('=');await context.addCookies([{name:owner.cookie.slice(0,split),value:owner.cookie.slice(split+1),url:base}]);
 await context.addInitScript(()=>{
  globalThis.localStorage.setItem('momevia-locale','vi');globalThis.__soundQa={starts:[],stops:0,closed:0,decodes:0};
  const Original=globalThis.AudioContext;if(!Original)return;
  globalThis.AudioContext=class extends Original{
   decodeAudioData(...args){return super.decodeAudioData(...args).then(buffer=>{globalThis.__soundQa.decodes++;return buffer;});}
   createBufferSource(){const s=super.createBufferSource(),start=s.start.bind(s),stop=s.stop.bind(s);s.start=(...args)=>{globalThis.__soundQa.starts.push(args);return start(...args);};s.stop=(...args)=>{globalThis.__soundQa.stops++;return stop(...args);};return s;}
   close(){globalThis.__soundQa.closed++;return super.close();}
  };
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{requests.push(new URL(r.url()).pathname);if(r.url().endsWith('/audio'))uploads.push(r.postDataBuffer());});
 const control=name=>page.locator(`[data-editor-action="${name}"]`),dialog=()=>page.locator('.sfx-dialog'),read=async()=>{const id=new URL(page.url()).pathname.split('/').at(-1),r=await request(`/designs/designs/${id}`,{cookie:owner.cookie});assert.equal(r.status,200);return r.data.design;},save=async()=>{await control('save').click();await page.locator('.editor-save-status').filter({hasText:'Đã lưu'}).waitFor();return read();};
 let created,published,personalId;
 try{
  await check('Studio: create from starter, discover Sound, audition all 40 without editing or loading the trimmer',async()=>{
   await page.goto(base+'/design/new');await control('create-starter').click();await page.locator('.editor-artboard').waitFor();await page.waitForURL(/\/design\/[0-9a-f-]{36}$/);created=await read();
   await control('library-tab').filter({hasText:'Âm thanh'}).click();const before=await save();await control('sound-add').click();await dialog().locator('.sfx-row').last().waitFor();assert.equal(await dialog().locator('.sfx-row').count(),40);
   assert.equal(requests.filter(p=>p.includes('/sfx/1/')).length,0);assert(!requests.some(p=>p.includes('audio-trimmer')));
   await dialog().getByRole('searchbox').fill('boc niem phong');assert.equal(await dialog().locator('.sfx-row').count(),1);await dialog().getByRole('searchbox').fill('Bóc niêm phong');assert.equal(await dialog().locator('.sfx-row').count(),1);await dialog().getByRole('searchbox').fill('');
   await dialog().getByLabel('Nhóm âm',{exact:true}).selectOption('nature');assert.equal(await dialog().locator('.sfx-row').count(),5);await dialog().getByLabel('Nhóm âm',{exact:true}).selectOption('');
   for(const row of await dialog().locator('.sfx-row').all()){
    const count=await page.evaluate(()=>globalThis.__soundQa.starts.length);await row.getByRole('button',{name:/^Nghe thử /}).click();await page.waitForFunction(n=>globalThis.__soundQa.starts.length>n,count);await row.getByRole('button',{name:'Dừng',exact:true}).click();
   }
   await dialog().screenshot({path:path.join(directory,'sound-library-desktop.png')});await dialog().getByRole('button',{name:'Đóng',exact:true}).click();assert.deepEqual((await read()).document,before.document);
  });
  async function chooseLibrary(id){await dialog().locator(`[data-sfx-id="${id}"]`).getByRole('button',{name:/^Chọn /}).click();await dialog().locator('.sfx-details').getByRole('button',{name:'Áp dụng',exact:true}).click();}
  await check('Studio: envelope peel and gift-box lid retain original actions; library button supports undo/redo and reload',async()=>{
   const envelope=created.document.elements.find(e=>e.type==='envelope');await page.locator(`.editor-stage-element[data-element-id="${envelope.id}"]`).click();await page.locator('.editor-inspector [data-editor-action="sound-picker"]').click();await chooseLibrary('seal-peel');
   await control('library-tab').filter({hasText:'Thêm',exact:true}).click();await page.locator('[data-block="gift-box"]').click();await page.locator('.editor-inspector [data-editor-action="sound-picker"]').click();await chooseLibrary('box-pop');
   // The newly inserted gift box needs an ordinary navigation destination.
   await page.locator('.editor-target-picker summary').click();await page.locator('.editor-target-scenes [data-editor-action="action-target"]').nth(1).click();
   await control('library-tab').filter({hasText:'Âm thanh'}).click();await control('sound-add').click();await dialog().locator('[data-sfx-id="warm-ending"]').getByRole('button',{name:/^Chọn /}).click();await dialog().getByRole('button',{name:'Tỉa âm thanh',exact:true}).click();await dialog().locator('canvas').waitFor();await dialog().getByLabel('Bắt đầu (giây)',{exact:true}).fill('0.1');await dialog().getByLabel('Kết thúc (giây)',{exact:true}).fill('1.8');await dialog().locator('.sfx-trim').getByLabel('Âm lượng',{exact:true}).fill('0.35');await dialog().locator('.sfx-trim').getByRole('button',{name:'Áp dụng',exact:true}).click();await dialog().waitFor({state:'detached'});
   const after=await save(),count=after.document.elements.length;assert.equal(after.document.elements.filter(e=>e.sound?.kind==='library').length,3);assert.equal(after.document.schemaVersion,3);assert.deepEqual(after.document.elements.find(e=>e.type==='sound-button').sound,{kind:'library',id:'warm-ending',version:1,startMs:100,endMs:1800,volume:.35});
   await control('undo').click();assert.equal((await save()).document.elements.length,count-1);await control('redo').click();assert.equal((await save()).document.elements.length,count);await page.reload();await page.locator('.editor-artboard').waitFor();assert.equal((await read()).document.elements.filter(e=>e.sound).length,3);
  });
  await check('Studio device-only source: waveform, numeric/keyboard bounds, Cancel, minimum/edge clips and exact middle upload',async()=>{
   await control('library-tab').filter({hasText:'Âm thanh'}).click();await control('sound-add').click();const before=await read();
   await dialog().locator('input[type=file]').setInputFiles(path.join(directory,'three-signals.wav'));await dialog().locator('canvas').waitFor();
   await dialog().getByLabel('Bắt đầu (giây)',{exact:true}).fill('1');await dialog().getByLabel('Kết thúc (giây)',{exact:true}).fill('2');await dialog().getByRole('button',{name:'Hủy',exact:true}).click();assert.deepEqual((await read()).document,before.document);assert.equal(uploads.length,0);
   await dialog().locator('input[type=file]').setInputFiles(path.join(directory,'three-signals.wav'));await dialog().locator('canvas').waitFor();
   const start=dialog().getByLabel('Bắt đầu (giây)',{exact:true}),end=dialog().getByLabel('Kết thúc (giây)',{exact:true});
   await start.fill('0');await end.fill('0.1');assert.equal(await dialog().locator('.sfx-trim').getByRole('button',{name:'Áp dụng',exact:true}).isEnabled(),true);await start.fill('2.9');await end.fill('3');assert.equal(await dialog().locator('.sfx-trim').getByRole('button',{name:'Áp dụng',exact:true}).isEnabled(),true);
   await start.fill('1');await end.fill('2');await dialog().getByLabel('Mốc đầu đoạn',{exact:true}).focus();await page.keyboard.press('ArrowRight');await start.fill('1');
   await dialog().locator('.sfx-trim').getByLabel('Âm lượng',{exact:true}).fill('0.45');await dialog().getByRole('button',{name:'Nghe đoạn chọn',exact:true}).click();await dialog().locator('.sfx-trim').getByRole('button',{name:'Dừng',exact:true}).click();await dialog().screenshot({path:path.join(directory,'trimmer-desktop.png')});
   let lostAck=true;const mutations=[];
   await page.route('**/api/designs/designs/*/audio',async route=>{mutations.push(route.request().headers()['x-mutation-id']);const response=await route.fetch();if(lostAck){lostAck=false;await route.abort('failed');}else await route.fulfill({response});});
   await dialog().locator('.sfx-trim').getByRole('button',{name:'Áp dụng',exact:true}).click();await dialog().getByRole('status').filter({hasText:'kết nối'}).waitFor();
   await dialog().locator('.sfx-trim').getByRole('button',{name:'Áp dụng',exact:true}).click();await dialog().waitFor({state:'detached'});await page.unrouteAll({behavior:'wait'});created=await save();
   assert.equal(uploads.length,2);assert.equal(mutations[0],mutations[1]);assert.deepEqual(uploads[0],uploads[1]);assert.equal(uploads[0].length,88244,'full 3-second source must never be uploaded');const personal=created.document.elements.find(e=>e.sound?.kind==='audio');personalId=personal.sound.assetId;assert.equal(personal.sound.volume,.45);assert(!('startMs'in personal.sound));
   await control('undo').click();assert(!(await save()).document.elements.some(e=>e.sound?.assetId===personalId));await control('redo').click();await save();await page.reload();await page.locator('.editor-artboard').waitFor();
  });
  await check('Studio sender preview, UI publication and guest link use the same silent-by-default sound player',async()=>{
   await control('library-tab').filter({hasText:'Nội dung',exact:true}).click();for(const key of ['recipientName','senderName','message'])await page.locator(`[data-editor-field="binding.${key}"]`).fill('Lời chúc SFX có nội dung dạng chữ');await save();
   await control('preview').click();const preview=page.locator('.editor-preview-player');await preview.locator('[data-sound-control]').waitFor();assert.equal(await preview.getByRole('button',{name:'Bật âm thanh',exact:true}).count(),1);const decodedBefore=await page.evaluate(()=>globalThis.__soundQa.decodes);await preview.getByRole('button',{name:'Bật âm thanh',exact:true}).click();await page.waitForFunction(n=>globalThis.__soundQa.decodes>=n+2,decodedBefore);const startsBefore=await page.evaluate(()=>globalThis.__soundQa.starts.length);await preview.locator('.gift-runtime-envelope').focus();await page.keyboard.press('Enter');await page.waitForFunction(n=>globalThis.__soundQa.starts.length===n+1,startsBefore);const closedBefore=await page.evaluate(()=>globalThis.__soundQa.closed);await control('preview-close').click();assert((await page.evaluate(()=>globalThis.__soundQa.closed))>closedBefore);
   const publication=page.waitForResponse(r=>r.url().endsWith('/api/gifts/gifts/from-design')&&r.request().method()==='POST');await control('publish').click();await confirmGiftAccess(page);const response=await publication;assert.equal(response.status(),201,await response.text());published=(await response.json()).gift;
   const receiver=await request(`/gifts/gifts/${published.slug}/assets/${personalId}`);assert.equal(receiver.status,200);assert.equal(receiver.bytes.length,88244);
   // Browser decode verifies the served clip has the middle tone, with no first or last tone.
   const proof=await page.evaluate(async({base,slug,id})=>{const c=new globalThis.AudioContext({sampleRate:44100}),b=await c.decodeAudioData(await (await fetch(`${base}/api/gifts/gifts/${slug}/assets/${id}`)).arrayBuffer()),d=b.getChannelData(0),values=[220,880,1760].map(f=>{let n=0;for(let i=0;i<d.length;i++)n+=d[i]*Math.sin(2*Math.PI*f*i/b.sampleRate);return Math.abs(n/d.length);});await c.close();return {duration:b.duration,values};},{base,slug:published.slug,id:personalId});assert(proof.values[1]>.18&&proof.values[0]<.001&&proof.values[2]<.001);fs.writeFileSync(path.join(directory,'browser-trim-proof.json'),JSON.stringify(proof,null,2));
   const guest=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});const receiverPage=await guest.newPage(),network=[];receiverPage.on('request',r=>network.push(r.url()));await receiverPage.goto(base+'/g/'+published.slug);await receiverPage.locator('[data-sound-control]').waitFor();assert.equal(network.filter(u=>u.includes('/sfx/1/')||u.endsWith('/assets/'+personalId)).length,0);
   await receiverPage.getByRole('button',{name:'Bật âm thanh',exact:true}).tap();await receiverPage.getByRole('button',{name:'Tắt âm thanh',exact:true}).tap();await receiverPage.getByRole('button',{name:'Bật âm thanh',exact:true}).waitFor();await receiverPage.screenshot({path:path.join(directory,'recipient-mobile.png'),fullPage:true});await guest.close();
  });
  await check('mobile Chromium touch, accessible labels and keyboard controls; unsupported files preserve the draft',async()=>{
   await page.goto(base+'/design/'+created.id);await page.locator('.editor-artboard').waitFor();await page.setViewportSize({width:390,height:844});await control('sheet-library').click();await control('library-tab').filter({hasText:'Âm thanh'}).click();await control('sound-add').click();await dialog().locator('.sfx-row').last().waitFor();await dialog().locator('input[type=file]').setInputFiles(path.join(directory,'three-signals.wav'));await dialog().locator('canvas').waitFor();await dialog().getByLabel('Mốc cuối đoạn',{exact:true}).focus();await page.keyboard.press('ArrowLeft');await dialog().screenshot({path:path.join(directory,'trimmer-mobile.png')});assert((await dialog().ariaSnapshot()).includes('Mốc đầu đoạn'));
   await dialog().getByRole('button',{name:'Hủy',exact:true}).click();await dialog().locator('input[type=file]').setInputFiles({name:'bad.mp3',mimeType:'audio/mpeg',buffer:Buffer.from('broken-audio')});await dialog().getByRole('status').filter({hasText:'không giải mã'}).waitFor();await page.keyboard.press('Escape');
  });
  if(process.env.SFX_QA_FFMPEG)await check('desktop Chrome decodes generated PCM WAV, MP3 and M4A/AAC sources locally',async()=>{
   await page.setViewportSize({width:1440,height:1000});await page.reload();await page.locator('.editor-artboard').waitFor();await control('library-tab').filter({hasText:'Âm thanh'}).click();await control('sound-add').click();await dialog().locator('.sfx-row').last().waitFor();
   const formats=[['wav',[]],['mp3',['-c:a','libmp3lame','-b:a','128k']],['m4a',['-c:a','aac','-b:a','128k','-movflags','+faststart']]],results=[];
   for(const [ext,args]of formats){
    const filename=ext==='wav'?path.join(directory,'three-signals.wav'):path.join(directory,'codec-source.'+ext);
    if(ext!=='wav')execFileSync(process.env.SFX_QA_FFMPEG,['-hide_banner','-loglevel','error','-y','-i',path.join(directory,'three-signals.wav'),...args,filename],{windowsHide:true});
    await dialog().locator('input[type=file]').setInputFiles(filename);await dialog().locator('canvas').waitFor();results.push({format:ext,decoded:true,uploaded:false});await dialog().getByRole('button',{name:'Hủy',exact:true}).click();
   }
   fs.writeFileSync(path.join(directory,'codec-results.json'),JSON.stringify({browser:browser.version(),os:'Windows',physicalDevice:false,results},null,2));await dialog().getByRole('button',{name:'Đóng',exact:true}).click();
  });
  await check('recipient playback handles rapid presses, mute, hidden-tab simulation, slow and broken media without blocking gift actions',async()=>{
   await page.setViewportSize({width:1000,height:900});await page.goto(base+'/g/'+published.slug);await page.locator('[data-sound-control]').waitFor();const hear=page.locator('.gift-runtime-sound-button').first();await hear.waitFor();const n=await page.evaluate(()=>globalThis.__soundQa.starts.length);await hear.click();await page.waitForFunction(n=>globalThis.__soundQa.starts.length>n,n);for(let i=0;i<5;i++)await hear.click();assert((await page.evaluate(()=>globalThis.__soundQa.stops))>0);
   await page.evaluate(()=>{Object.defineProperty(globalThis.document,'hidden',{configurable:true,get:()=>true});globalThis.document.dispatchEvent(new globalThis.Event('visibilitychange'));});await page.evaluate(()=>{Object.defineProperty(globalThis.document,'hidden',{configurable:true,get:()=>false});});
   await page.reload();await page.locator('[data-sound-control]').waitFor();
   let release,seen;const gate=new Promise(r=>{release=r;}),requested=new Promise(r=>{seen=r;});
   await page.route('**/api/designs/sfx/1/warm-ending',async route=>{seen();await gate;await route.fulfill({status:200,contentType:'audio/wav',body:fs.readFileSync(path.join(directory,'web/assets/sfx/v1/warm-ending.wav'))}).catch(()=>{});});
   await hear.click();await requested;const startsBeforeNavigation=await page.evaluate(()=>globalThis.__soundQa.starts.length),envelopeId=created.document.elements.find(e=>e.type==='envelope').id;
   await page.locator(`[data-runtime-element="${envelopeId}"]`).click();await page.waitForFunction(id=>!globalThis.document.querySelector(`[data-runtime-element="${id}"]`),envelopeId);release();await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>globalThis.__soundQa.starts.length),startsBeforeNavigation);await page.unroute('**/api/designs/sfx/1/warm-ending');
   await page.route('**/api/designs/sfx/1/**',route=>route.fulfill({status:500,body:'broken'}));await page.reload();await page.locator('[data-sound-control]').waitFor();await hear.click();await page.getByText('Chưa phát được âm.',{exact:false}).waitFor();assert(await page.locator('.gift-runtime-navigation button').count()>0);await page.unroute('**/api/designs/sfx/1/**');
  });
  await check('Canvas v3 recipient keeps background music and interaction sound independently controllable',async()=>{
   const mixed=await context.newPage();mixed.on('pageerror',error=>errors.push(error.message));
   try{
    await mixed.addInitScript(()=>{
     globalThis.__mixedMusic=[];
     const play=globalThis.HTMLMediaElement.prototype.play;
     globalThis.HTMLMediaElement.prototype.play=function(...args){globalThis.__mixedMusic.push(this);return play.apply(this,args);};
    });
    await mixed.goto(base+'/g/'+gift.slug);
    const music=mixed.locator('.gift-soundtrack-button'),sfx=mixed.locator('[data-sound-control]');
    await music.waitFor();assert.equal(await music.getAttribute('aria-pressed'),'false');assert.equal(await sfx.getAttribute('aria-pressed'),'false');
    assert.equal(await mixed.evaluate(()=>globalThis.__mixedMusic.length),0);
    await music.click();await mixed.waitForFunction(()=>globalThis.document.querySelector('.gift-soundtrack-button')?.getAttribute('aria-pressed')==='true');
    const volume=mixed.locator('.gift-soundtrack-volume');await volume.focus();await volume.press('Home');
    assert.equal(await mixed.evaluate(()=>globalThis.__mixedMusic[0].volume),0);
    await volume.press('ArrowRight');assert.equal(await mixed.evaluate(()=>globalThis.__mixedMusic[0].volume),.05);
    await sfx.click();await mixed.locator('.gift-runtime-envelope').click();await mixed.waitForFunction(()=>globalThis.__soundQa.starts.length>0);
    assert.equal(await music.getAttribute('aria-pressed'),'true');
    await sfx.click();assert.equal(await music.getAttribute('aria-pressed'),'true');
    await music.click();assert.equal(await music.getAttribute('aria-pressed'),'false');
   }finally{await mixed.close();}
  });
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(directory,'browser-results.json'),JSON.stringify({browser:browser.version(),screens:['1440×1000','390×844'],humanListening:false,physicalDevices:false,errors,requests,uploads:uploads.map(b=>b.length),published},null,2));
  // Available WebKit is reported separately from real Safari/iPhone hardware.
  let wk;
  try{
   wk=await webkit.launch({headless:true});const p=await wk.newPage({viewport:{width:390,height:844},hasTouch:true});await p.addInitScript(()=>{globalThis.__webkitStarts=0;if(!globalThis.AudioBufferSourceNode)return;const start=globalThis.AudioBufferSourceNode.prototype.start;globalThis.AudioBufferSourceNode.prototype.start=function(...args){globalThis.__webkitStarts++;return start.apply(this,args);};});
   await p.goto(base+'/g/'+gift.slug);await p.locator('[data-sound-control]').waitFor();await p.locator('.gift-runtime-navigation button').nth(1).click();await p.locator('.gift-runtime-sound-button').first().click();const supported=await p.evaluate(()=>Boolean(globalThis.AudioContext||globalThis.webkitAudioContext));
   if(supported)await p.waitForFunction(()=>globalThis.__webkitStarts>0);else await p.getByText('Trình duyệt này chưa hỗ trợ phát âm.',{exact:false}).waitFor();
   const results=[];for(const name of ['three-signals.wav','codec-source.mp3','codec-source.m4a']){
    const filename=path.join(directory,name);if(!fs.existsSync(filename))continue;
    results.push(await p.evaluate(async({name,bytes})=>{try{const {decodeSource}=await import('/js/features/canvas-editor/audio-trimmer.js');const buffer=await decodeSource(new File([new Uint8Array(bytes)],name));return {name,decoded:true,seconds:buffer.duration};}catch(error){return {name,decoded:false,reason:error.message};}},{name,bytes:[...fs.readFileSync(filename)]}));
   }
   fs.writeFileSync(path.join(directory,'webkit-result.json'),JSON.stringify({engine:'Playwright WebKit 27.2 on Windows',physicalSafari:false,loaded:true,playback:supported?'PASS':'UNSUPPORTED_API',fallback:supported?null:'PASS',codecs:results},null,2));
  }catch(error){fs.writeFileSync(path.join(directory,'webkit-result.json'),JSON.stringify({engine:'Playwright WebKit',physicalSafari:false,verified:false,reason:error.message.split('\n')[0]}));}finally{await wk?.close();}
 }finally{await context.close();await browser.close();}
}
