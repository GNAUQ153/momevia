import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{chromium}from'playwright';
export async function runGiftVolumeProof(base){
 const out=path.resolve('local/natural-objects-20261128');fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
 try{const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'no-preference'});await page.goto(base);await page.evaluate(async()=>{
  const {driveElementCards}=await import('/js/shared/canvas/drive-elements.js'),{renderElement,applyLayout}=await import('/js/features/gift-runtime/renderer.js'),{createMotion}=await import('/js/features/gift-runtime/effects.js'),{eventMediaUrl}=await import('/js/shared/canvas/event-media.js');
  globalThis.document.body.replaceChildren();const host=globalThis.document.createElement('div');host.className='gift-runtime';host.dataset.motion='on';host.style.backgroundColor='#F5EFFF';host.style.width='390px';host.style.height='844px';globalThis.document.body.append(host);
  const model=driveElementCards().find(c=>c.id==='drive-santa-gift-box').create()[0];Object.assign(model.layout,{x:26,y:80,width:338,height:600});const controller=new AbortController();
  const node=renderElement(model,{mode:'preview',assetUrl:eventMediaUrl,signal:controller.signal,motion:createMotion(()=>true),onAction:(_actions,play)=>{void play(controller.signal);}});applyLayout(node,model,{width:390,height:844});host.append(node);
  await Promise.all([...node.querySelectorAll('image')].map(async el=>{const image=new globalThis.Image();image.src=el.getAttribute('href');await image.decode();}));await globalThis.document.fonts.ready;
 });
 const card=page.locator('.gift-cube-card');assert.equal(await card.evaluate(el=>globalThis.getComputedStyle(el).opacity),'1','Closed card must be occluded by solid faces, not hidden with opacity');
 const text=await card.textContent(),closed=await page.screenshot();await card.evaluate(el=>{el.textContent='OCCLUSION PROBE';});const probe=await page.screenshot();assert(closed.equals(probe),'The closed box must completely occlude the printed card');await card.evaluate((el,text)=>{el.textContent=text;},text);fs.writeFileSync(path.join(out,'volume-proof-closed.png'),closed);
 await page.locator('.gift-object-opening').click();await page.waitForTimeout(1250);assert.equal(await page.locator('.gift-cube-under').count(),1);const open=await page.screenshot();await card.evaluate(el=>{el.textContent='VISIBLE PROBE';});const changed=await page.screenshot();assert(!open.equals(changed),'The open box must expose the printed card');await card.evaluate((el,text)=>{el.textContent=text;},text);fs.writeFileSync(path.join(out,'volume-proof-open.png'),open);
 fs.writeFileSync(path.join(out,'volume-proof.json'),JSON.stringify({closedCardOccludedByFaces:true,openCardVisible:true,lidHasUnderside:true},null,2));console.log('PASS physical gift: closed faces occlude print, opened box exposes print and retains lid underside');
 }finally{await browser.close();}
}
