import fs from 'node:fs';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { templatePreviewDocument } from '../../web/js/shared/canvas/index.js';
const folder='docs/celebration-loops',base='http://127.0.0.1:4182';
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[];
try {
  for(const id of ['birthday-radiance']) {
    const context=await browser.newContext({viewport:{width:390,height:1100},reducedMotion:'no-preference'});
    const page=await context.newPage();page.on('pageerror',e=>{throw e;});
    await page.goto(base+'/about');await page.locator('main h1').waitFor();
    const doc=templatePreviewDocument({id});for(const s of doc.scenes)if(s.effects?.celebrations)for(const p of Object.values(s.effects.celebrations))Object.assign(p,{enabled:true,speed:'normal',density:'sparse',loop:true});
    const cdp=await context.newCDPSession(page),frames=[];
    cdp.on('Page.screencastFrame',frame=>{
      frames.push({bytes:Buffer.from(frame.data,'base64'),timestamp:frame.metadata.timestamp ?? Date.now()/1000});
      void cdp.send('Page.screencastFrameAck',{sessionId:frame.sessionId});
    });
    await cdp.send('Page.startScreencast',{format:'jpeg',quality:78,maxWidth:390,maxHeight:1100,everyNthFrame:3});
    await page.evaluate(async doc=>{
      const {mountPlayer}=await import('/js/features/gift-runtime/index.js'),{eventMediaUrl}=await import('/js/shared/canvas/event-media.js');
      globalThis.document.body.classList.add('is-playing-gift');const main=globalThis.document.querySelector('#main');main.replaceChildren();
      globalThis.motionSeen=new Set();const observer=new globalThis.MutationObserver(()=>{
        for(const n of globalThis.document.querySelectorAll('[data-gift-effect]'))globalThis.motionSeen.add(n.dataset.giftEffect);
      });observer.observe(main,{subtree:true,attributes:true,childList:true});
      globalThis.motionStartedAt=Date.now()/1000;
      globalThis.motionPlayer=mountPlayer(main,{document:doc,assetUrl:eventMediaUrl,mode:'preview'});
    },doc);

    await page.mouse.move(0,0);await page.waitForTimeout(11500);





    const seen=await page.evaluate(()=>[...globalThis.motionSeen]);
    const started=await page.evaluate(()=>globalThis.motionStartedAt);
    assert(['B05','B06','B07','B08'].every(id=>seen.includes(id)),JSON.stringify(seen));
    // Check cancellation in the live renderer, rather than inferring it from CSS.
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>globalThis.document.getAnimations().filter(a=>a.playState==='running').length),0);
    await cdp.send('Page.stopScreencast');await context.close();
    // Keep real inter-frame timings, including still reading time and carousel delay.
    const selected=frames.filter((f,i)=>f.timestamp>=started&&(!i||f.timestamp-frames[i-1].timestamp>.025));
    const images=await Promise.all(selected.map(f=>sharp(f.bytes).resize({width:320}).png().toBuffer()));
    const delays=selected.map((f,i)=>Math.max(30,Math.min(6000,Math.round(((selected[i+1]?.timestamp??f.timestamp+1)-f.timestamp)*1000))));
    const output=`${folder}/${id}-motion.gif`;
    await sharp(images,{join:{animated:true}}).gif({delay:delays,loop:0,colours:128,effort:4,dither:.5}).toFile(output);
    const meta=await sharp(output,{animated:true}).metadata();assert(meta.pages>20);
    results.push({id,result:'PASS',observedEffects:seen,frames:meta.pages,output});
    fs.writeFileSync(`${folder}/motion-results.json`,JSON.stringify(results,null,2)+'\n');
    console.log(`PASS ${id}: ${meta.pages} actual rendered animation frames; reduced motion cancels active animations.`);
  }
}finally{await browser.close();}
