import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const root=path.resolve('local/interactive-cards-20261122'),out=path.join(root,'final/motion-budget.json'),{base}=JSON.parse(fs.readFileSync(path.join(root,'final/session.json')));
const context=await chromium.launchPersistentContext(path.join(root,'chrome-lab-profile'),{channel:'chrome',headless:true,viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:'vi-VN',reducedMotion:'no-preference'});
const page=await context.newPage(),cdp=await context.newCDPSession(page),results=[];
try{
 await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:100,downloadThroughput:200000,uploadThroughput:93750});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await page.addInitScript(()=>{
  globalThis.localStorage.setItem('momevia-locale','vi');globalThis.__frameBudget={started:false,deltas:[],peakAnimations:0,peakParticles:0};
  const animate=globalThis.Element.prototype.animate;
  globalThis.Element.prototype.animate=function(...args){
   const animation=animate.apply(this,args),sample=globalThis.__frameBudget;
   if(this.closest('.gift-runtime')&&!sample.started){
    sample.started=true;let previous=globalThis.performance.now();const end=previous+3000;
    const tick=now=>{sample.deltas.push(now-previous);previous=now;sample.peakAnimations=Math.max(sample.peakAnimations,globalThis.document.getAnimations().filter(a=>a.effect?.target?.closest?.('.gift-runtime')).length);sample.peakParticles=Math.max(sample.peakParticles,globalThis.document.querySelectorAll('.gift-ambience .gift-particle').length);if(now<end)globalThis.requestAnimationFrame(tick);else sample.done=true;};
    globalThis.requestAnimationFrame(tick);
   }
   return animation;
  };
 });
 for(const [id,effect]of [['birthday-radiance','E01'],['cuon-phim-ngay-ay','photo-arrive-v3 + keepsake-sway-v1'],['loi-moi-ben-hien','porch-sun-v1 + photo-arrive-v3 + keepsake-sway-v1']]){
  await page.goto(base+'/template/'+id);await page.locator('[data-template-preview]').click();await page.waitForFunction(()=>globalThis.__frameBudget.done);
  const data=await page.evaluate(()=>globalThis.__frameBudget),sorted=data.deltas.slice().sort((a,b)=>a-b),duration=data.deltas.reduce((n,v)=>n+v,0);
  await page.keyboard.press('Escape');await page.locator('.template-preview-dialog .gift-runtime').waitFor({state:'detached'});const remaining=await page.evaluate(()=>globalThis.document.getAnimations().filter(a=>a.effect?.target?.closest?.('.gift-runtime')).length);assert.equal(remaining,0);
  results.push({id,effect,sampleMs:duration,frames:data.deltas.length,fps:data.deltas.length*1000/duration,p95FrameMs:sorted[Math.floor(sorted.length*.95)],framesOver50Ms:data.deltas.filter(n=>n>50).length,peakAnimations:data.peakAnimations,peakParticles:data.peakParticles,afterCloseAnimations:remaining});
 }
 // Observe real visibility state rather than making a synthetic visibility claim.
 await page.goto(base+'/template/loi-moi-ben-hien');await page.locator('[data-template-preview]').click();
 const other=await context.newPage();await other.goto('about:blank');await other.bringToFront();const hidden=await page.evaluate(()=>globalThis.document.visibilityState);await other.close();await page.bringToFront();const visible=await page.evaluate(()=>globalThis.document.visibilityState);
 await page.keyboard.press('Escape');results.push({tabVisibility:{background:hidden,returned:visible,observedHidden:hidden==='hidden'},note:hidden==='hidden'?'Actual Chrome visibility changed':'Headless Chrome did not expose a hidden state; background-tab behavior is NOT VERIFIED by this probe'});
 console.log('PASS measured three-second frame pacing and resource peaks; tab visibility probe recorded without simulation');
}catch(error){results.push({failure:error.message,stack:error.stack});process.exitCode=1;console.error(error.stack);}
finally{await context.close();fs.writeFileSync(out,JSON.stringify({configuration:{profile:'chrome-lab-profile',viewport:'390×844',cpuSlowdown:4,latencyMs:100,downloadBytesPerSecond:200000,kind:'single three-second headless lab sample per effect; not a physical-device FPS benchmark'},results},null,2));}
