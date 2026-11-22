import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { publicDocument } from '../../web/js/shared/canvas/schema.js';
const phase=process.argv[2]||'final',mode=process.argv[3]||'matrix';
assert(['baseline','final'].includes(phase));
const root=path.resolve('local/interactive-cards-20261122'),out=path.join(root,phase,'browser');fs.mkdirSync(out,{recursive:true});
const session=JSON.parse(fs.readFileSync(path.join(root,phase,'session.json'))),{base,cookie}=session;
const ids=['hai-phong-bi','birthday-radiance','proud-of-you',...(phase==='final'?['loi-moi-ben-hien','cuon-phim-ngay-ay','ban-do-ngay-ra-truong']:[])];
const request=async(route,body,expected=200)=>{const r=await fetch(base+'/api'+route,{method:body?'POST':'GET',headers:{cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const v=await r.json();assert.equal(r.status,expected,JSON.stringify(v));return v;};
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={phase,mode,browser:browser.version(),configuration:{widths:[320,390,768,1440],locales:['vi','en'],motion:['no-preference','reduce'],device:'Chrome desktop mobile emulation; no physical device'},cases:[],errors:[]};
try{
 if(mode==='perf'){
  await browser.close();
  // Same persistent profile, viewport and lab network before/after. Cache is
  // disabled for every navigation, five cold samples per route, no login data.
  const context=await chromium.launchPersistentContext(path.join(root,'chrome-lab-profile'),{channel:'chrome',headless:true,viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:'vi-VN'});
  try{
   const page=await context.newPage(),cdp=await context.newCDPSession(page);
   const network=new Map();
   cdp.on('Network.requestWillBeSent',({requestId,request,type})=>{const url=new URL(request.url);if(['http:','https:'].includes(url.protocol))network.set(requestId,{name:url.pathname,type,bytes:0,partialBytes:0});});
   cdp.on('Network.responseReceived',({requestId,response})=>{const item=network.get(requestId);if(item){item.status=response.status;item.mime=response.mimeType;}});
   cdp.on('Network.dataReceived',({requestId,encodedDataLength})=>{const item=network.get(requestId);if(item)item.partialBytes+=encodedDataLength;});
   cdp.on('Network.loadingFinished',({requestId,encodedDataLength})=>{const item=network.get(requestId);if(item)item.bytes=encodedDataLength;});
   cdp.on('Network.loadingFailed',({requestId})=>{const item=network.get(requestId);if(item)item.failed=true;});
   await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
   await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:100,downloadThroughput:200000,uploadThroughput:93750});
   await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
   await page.addInitScript(()=>{globalThis.__lab={lcp:0,cls:0};new globalThis.PerformanceObserver(list=>{for(const e of list.getEntries())globalThis.__lab.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});new globalThis.PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)globalThis.__lab.cls+=e.value;}).observe({type:'layout-shift',buffered:true});});
   report.configuration={profile:path.join(root,'chrome-lab-profile'),viewport:'390×844',dpr:1,cpuSlowdown:4,network:{latencyMs:100,downloadBytesPerSecond:200000,uploadBytesPerSecond:93750},cache:'disabled',runs:5,byteMethod:'CDP encoded bytes, including main document and cross-origin HTTP resources; ResourceTiming retained separately'};
   for(const route of ['/explore',...ids.map(id=>'/template/'+id)])for(let run=1;run<=5;run++){
    network.clear();await page.goto(base+route);await page.locator('#main h1').first().waitFor();await page.waitForTimeout(4500);
    const metrics=await page.evaluate(()=>({...globalThis.__lab,resources:globalThis.performance.getEntriesByType('resource').map(e=>({name:new URL(e.name).pathname,bytes:e.transferSize,decodedBytes:e.decodedBodySize,duration:e.duration})),totalBytes:globalThis.performance.getEntriesByType('resource').reduce((n,e)=>n+e.transferSize,0)}));
    metrics.networkResources=[...network.values()].map(item=>({...item,bytes:item.bytes||item.partialBytes}));metrics.networkTotalBytes=metrics.networkResources.reduce((n,item)=>n+item.bytes,0);
    report.cases.push({route,run,...metrics});console.log(`${phase} perf ${route} ${run}: LCP=${Math.round(metrics.lcp)} CLS=${metrics.cls.toFixed(4)}`);
   }
   if(phase==='final'){
   await page.goto(base+'/template/birthday-radiance');await page.locator('[data-template-preview]').click();await page.locator('[data-runtime-element="birthday-candle"] button').waitFor();
   await page.evaluate(()=>{globalThis.__tapResponses=[];globalThis.document.addEventListener('click',e=>{if(e.target.closest('[data-runtime-element="birthday-candle"] button')){const start=globalThis.performance.now();globalThis.requestAnimationFrame(()=>globalThis.requestAnimationFrame(()=>globalThis.__tapResponses.push(globalThis.performance.now()-start)));}},{capture:true});});
   for(let run=0;run<5;run++){if(run)await page.locator('[data-template-reset]').click();await page.locator('.gift-runtime-stage:not([inert])').waitFor();await page.locator('[data-runtime-element="birthday-candle"] button').tap();await page.waitForFunction(n=>globalThis.__tapResponses.length===n,run+1);}
   report.touchResponseMs=await page.evaluate(()=>globalThis.__tapResponses);
   await page.keyboard.press('Escape');await page.locator('.template-preview-dialog .gift-runtime').waitFor({state:'detached'});
   report.afterPreviewClose=await page.evaluate(()=>({animations:globalThis.document.getAnimations().filter(a=>a.effect?.target?.closest?.('.gift-runtime')).length}));
   }
  }finally{await context.close();}
 }else{
  for(const locale of ['vi','en'])for(const width of [320,390,768,1440])for(const reducedMotion of ['no-preference','reduce']){
   const context=await browser.newContext({viewport:{width,height:1000},locale:locale==='vi'?'vi-VN':'en-US',reducedMotion,hasTouch:width<768});
   await context.addInitScript(l=>globalThis.localStorage.setItem('momevia-locale',l),locale);
   const [name,...value]=cookie.split('=');await context.addCookies([{name,value:value.join('='),url:base}]);
   const page=await context.newPage();page.on('pageerror',e=>report.errors.push({locale,width,reducedMotion,message:e.message}));
   try{
    for(const id of ids){
     await page.goto(`${base}/template/${id}`);const opener=page.locator('[data-template-preview]').first();await opener.click();
     const dialog=page.locator('.template-preview-dialog'),stage=dialog.locator('.gift-runtime-stage');await stage.locator('[data-runtime-element]').first().waitFor();
     const nav=dialog.locator('[data-scene-id]');await nav.first().waitFor();const sceneIds=await nav.evaluateAll(nodes=>nodes.map(n=>n.dataset.sceneId));
     const coverImages=await stage.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(async img=>{try{await img.decode();}catch{}return{src:new URL(img.src).pathname,decoded:img.naturalWidth>0};})));
     assert(coverImages.length>0,`${id}: cover needs real artwork`);assert.equal(sceneIds.length,id==='hai-phong-bi'?6:id==='cuon-phim-ngay-ay'?4:5);
     assert(coverImages.every(i=>i.decoded),`${id}: missing preview image`);
     if(width===390&&reducedMotion==='reduce')await dialog.screenshot({path:path.join(out,`${id}-${locale}-cover.png`)});
     const scenes=[];
     for(const sceneId of sceneIds){
      await dialog.locator(`[data-scene-id="${sceneId}"]`).click();await page.waitForTimeout(reducedMotion==='reduce'?30:220);
      const layout=await stage.evaluate(stage=>{
       const rect=stage.getBoundingClientRect(),nodes=[...stage.querySelectorAll('[data-runtime-element]')].filter(n=>globalThis.getComputedStyle(n).display!=='none').map(n=>({id:n.dataset.runtimeElement,type:n.className,text:n.textContent,rect:n.getBoundingClientRect().toJSON()}));
       const clipped=nodes.filter(n=>n.rect.left<rect.left-1||n.rect.right>rect.right+1).map(n=>n.id);
       return{clipped,animations:stage.getAnimations({subtree:true}).length,texts:nodes.filter(n=>n.type.includes('gift-runtime-text')).map(n=>({id:n.id,text:n.text})),focusables:[...stage.querySelectorAll('button,summary')].map(n=>({text:n.textContent,height:n.getBoundingClientRect().height,width:n.getBoundingClientRect().width}))};
      });
      assert.deepEqual(layout.clipped,[],`${id}/${sceneId}/${width}`);
      if(reducedMotion==='reduce')assert.equal(layout.animations,0,`${id} reduced motion`);
      scenes.push({sceneId,...layout});
      if(width===320&&locale==='vi'&&reducedMotion==='reduce'&&/schedule|milestone|surprise/.test(sceneId))await dialog.screenshot({path:path.join(out,`${id}-${sceneId}-320.png`)});
     }
     await closeWithEscape(page,dialog);assert(await opener.evaluate(n=>globalThis.document.activeElement===n),'Escape must restore focus');
     await dialog.locator('.gift-runtime').waitFor({state:'detached'});assert.equal(await dialog.locator('.gift-runtime').count(),0,'Closing preview disposes its player');
     report.cases.push({id,locale,width,reducedMotion,coverImages,scenes});console.log(`PASS ${phase} ${id} ${locale} ${width} ${reducedMotion}`);
    }
   }finally{await context.close();}
  }
  if(phase==='final'){
   const context=await browser.newContext({viewport:{width:390,height:844},locale:'vi-VN',reducedMotion:'reduce'}),[name,...value]=cookie.split('=');
   await context.addCookies([{name,value:value.join('='),url:base}]);await context.addInitScript(()=>globalThis.localStorage.setItem('momevia-locale','vi'));
   const page=await context.newPage();
   try{
    const journeys=[];
    for(const id of ids){
     await page.goto(base+'/template/'+id);await page.locator(`a[href^="/create/${id}?mode=quick"]`).click();
     const recipient=page.locator('[data-editor-field="binding.recipientName"]');await recipient.fill('Nguyễn Hoàng Phương Thảo · người bạn từ những ngày đầu');
     await page.locator('[data-editor-field="binding.senderName"]').fill('Những người bạn Momevia');await page.locator('[data-editor-field="binding.message"]').fill('Một lời nhắn thử nghiệm riêng. '+ 'Cảm ơn bạn vì đã cùng đi qua những ngày nhiều nắng. '.repeat(12));
     await page.locator('[data-editor-action="save"]').click();await page.waitForFunction(()=>/r[2-9]/.test(globalThis.document.querySelector('.editor-save-status')?.textContent||globalThis.document.body.textContent));
     const designId=new URL(page.url()).pathname.split('/').at(-1);let design=(await request('/designs/designs/'+designId)).design;
     assert.match(design.document.bindings.recipientName.value,/Phương Thảo/);
     await page.reload();await recipient.waitFor();assert.match(await recipient.inputValue(),/Phương Thảo/);
     await page.locator('[data-editor-action="toggle-mode"]').click();await page.locator('.editor-workspace:not(.is-quick)').waitFor();
     await page.locator('[data-editor-action="save"]').click();
     await page.locator('[data-editor-action="preview"]').click();await page.locator('.editor-preview-dialog .gift-runtime-stage').waitFor();
     await page.locator('.editor-preview-dialog').screenshot({path:path.join(out,`${id}-studio-long-name.png`)});await page.keyboard.press('Escape');
     design=(await request('/designs/designs/'+designId)).design;
     const {gift}=await request('/gifts/gifts/from-design',{designId,expectedRevision:design.revision,expectedDocumentHash:design.documentHash,idempotencyKey:randomUUID()},201);
     const saved=(await request('/gifts/gifts/'+gift.slug)).gift;assert.deepEqual(saved.documentSnapshot,publicDocument(design.document));
     await page.goto(base+'/g/'+gift.slug);await page.locator('.gift-runtime-stage').waitFor();
     for(const scene of design.document.scenes){await page.locator(`[data-scene-id="${scene.id}"]`).click();}
     const reply=page.locator('.gift-runtime-reply');await reply.locator('input').fill('Người thử fixture');await reply.locator('textarea').fill('Mình đã đọc được thiệp và các lời nhắn.');await reply.locator('button[type="submit"]').click();
     await page.reload();await page.locator('.gift-runtime-stage').waitFor();journeys.push({id,designId,slug:gift.slug,source:design.source,hash:design.documentHash,roundTrip:true,publicReply:true});
     console.log('PASS journey '+id);
    }
    report.journeys=journeys;
   }finally{await context.close();}
  }
 }
 assert.deepEqual(report.errors,[]);
}catch(error){report.failure={message:error.message,stack:error.stack};process.exitCode=1;console.error(error.stack);}
finally{await browser.close();fs.writeFileSync(path.join(out,`${mode}-report.json`),JSON.stringify(report,null,2));}
async function closeWithEscape(page,dialog){await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});}
