import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
const base='http://127.0.0.1:4182',folder='docs/celebration-loops';fs.mkdirSync(folder,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),results=[];
try {
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
  assert.equal((await context.request.post(base+'/api/auth/demo',{data:{name:'Loop settings QA',deviceId:randomUUID()}})).status(),200);
  const api=async(route,data,status=200)=>{const r=await context.request.fetch(base+'/api'+route,{method:data?'POST':'GET',data});const body=await r.json();assert.equal(r.status(),status,JSON.stringify(body));return body;};
  const {design}=await api('/designs/designs',{source:{kind:'template',templateId:'birthday-radiance'},mutationId:randomUUID()},201);
  const page=await context.newPage();await page.goto(base+'/design/'+design.id);await page.locator('.editor-workspace').waitFor();
  const field=key=>page.locator(`[data-editor-field="${key}"]`),action=key=>page.locator(`[data-editor-action="${key}"]`);
  const save=async()=>{await action('save').click();await page.locator('.editor-save-status[data-tone="saved"]').waitFor();};
  await page.locator('[data-editor-action="scene-select"]').first().click();
  const configurations={B05:{enabled:true,speed:'fast',density:'sparse',loop:true},B06:{enabled:true,speed:'slow',density:'dense',loop:true},B07:{enabled:true,speed:'normal',density:'normal',loop:true},B08:{enabled:true,speed:'fast',density:'sparse',loop:true}};
  for(const [id,p]of Object.entries(configurations)) {
    await field(`celebration.${id}.enabled`).check();await field(`celebration.${id}.speed`).selectOption(p.speed);
    await field(`celebration.${id}.density`).selectOption(p.density);await field(`celebration.${id}.loop`).check();
  }
  await save();assert.deepEqual((await api('/designs/designs/'+design.id)).design.document.scenes[0].effects.celebrations,configurations);
  await page.reload();await page.locator('.editor-workspace').waitFor();await page.locator('[data-editor-action="scene-select"]').first().click();
  for(const [id,p]of Object.entries(configurations)) {
    assert(await field(`celebration.${id}.enabled`).isChecked());assert.equal(await field(`celebration.${id}.speed`).inputValue(),p.speed);assert.equal(await field(`celebration.${id}.density`).inputValue(),p.density);
  }
  await field('celebration.B06.enabled').uncheck();await save();
  const disabled=(await api('/designs/designs/'+design.id)).design.document.scenes[0].effects.celebrations;
  assert.deepEqual(disabled.B06,{...configurations.B06,enabled:false});assert.deepEqual(disabled.B05,configurations.B05);
  await field('celebration.B06.enabled').check();await save();
  for(const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.innerWidth+1));
  }
  await page.screenshot({path:`${folder}/canvas-controls.png`,fullPage:true});
  await page.locator('[data-editor-action="celebration-preview"][data-celebration="B06"]').click();
  const dialog=page.locator('dialog.editor-preview-dialog[open]');await dialog.waitFor();
  await dialog.locator('.gift-butterfly').first().waitFor();
  assert.equal(await dialog.locator('.gift-celebration:not([data-gift-effect="B06"])').count(),0);
  await dialog.locator('[data-editor-action="preview-close"]').click();
  results.push({check:'Canvas independently toggles, saves and reloads four speeds/densities/loop flags; per-effect preview; 320/390/768/1440',result:'PASS'});

  let saved=(await api('/designs/designs/'+design.id)).design;
  for(const b of Object.values(saved.document.bindings))b.value='Thiệp kiểm thử hiệu ứng lặp';
  await api(`/designs/designs/${design.id}/save`,{expectedRevision:saved.revision,mutationId:randomUUID(),title:saved.title,document:saved.document});
  saved=(await api('/designs/designs/'+design.id)).design;
  const {gift}=await api('/gifts/gifts/from-design',{designId:design.id,expectedRevision:saved.revision,expectedDocumentHash:saved.documentHash,idempotencyKey:randomUUID()},201);
  const recipient=await browser.newContext({viewport:{width:390,height:1000},reducedMotion:'no-preference'}),p=await recipient.newPage();
  const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/g/'+gift.slug);await p.locator('.gift-runtime-stage').waitFor();
  await p.evaluate(()=>{
    const stage=globalThis.document.querySelector('.gift-runtime-stage'),seen=new WeakSet();
    globalThis.loopQA={generations:{},maxLayers:0};
    const collect=()=>{const layers=stage.querySelectorAll('.gift-celebration');globalThis.loopQA.maxLayers=Math.max(globalThis.loopQA.maxLayers,layers.length);for(const layer of layers)if(!seen.has(layer)){seen.add(layer);const id=layer.dataset.giftEffect;globalThis.loopQA.generations[id]=(globalThis.loopQA.generations[id]||0)+1;}};
    collect();new globalThis.MutationObserver(collect).observe(stage,{childList:true});
  });
  await p.waitForTimeout(12500);
  const looping=await p.evaluate(()=>globalThis.loopQA);
  for(const id of Object.keys(configurations))assert(looping.generations[id]>=2,JSON.stringify(looping));
  assert(looping.maxLayers<=4,JSON.stringify(looping));
  const layers=await p.locator('.gift-celebration').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.giftEffect,n.children.length])));
  if(layers.B06)assert.equal(layers.B06,14);if(layers.B05)assert.equal(layers.B05,6);
  const cdp=await recipient.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  const frames=await p.evaluate(()=>new Promise(resolve=>{const gaps=[];let previous=performance.now(),end=previous+2400;function frame(now){gaps.push(now-previous);previous=now;if(now<end)globalThis.requestAnimationFrame(frame);else resolve(gaps.slice(1));}globalThis.requestAnimationFrame(frame);}));
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
  const sorted=[...frames].sort((a,b)=>a-b);
  results.push({check:'All four repeat beyond the first burst without accumulating layers',result:'PASS',observed:looping,particleCounts:layers,desktop4xCpuFrameIntervals:{samples:frames.length,p95:sorted[Math.floor(sorted.length*.95)],max:Math.max(...frames)},physicalPhone:false});

  const control=p.locator('.gift-motion-control');await control.click();await p.waitForTimeout(300);
  assert.equal(await p.locator('.gift-celebration').count(),0);const stopped=await p.evaluate(()=>({...globalThis.loopQA.generations}));
  await p.waitForTimeout(3500);assert.deepEqual(await p.evaluate(()=>globalThis.loopQA.generations),stopped);
  await control.click();await p.locator('.gift-celebration').first().waitFor();
  await p.emulateMedia({reducedMotion:'reduce'});await p.waitForTimeout(300);assert.equal(await p.locator('.gift-celebration').count(),0);
  await p.emulateMedia({reducedMotion:'no-preference'});await p.locator('.gift-celebration').first().waitFor();
  await p.evaluate(()=>{globalThis.loopHidden=true;Object.defineProperty(globalThis.document,'hidden',{configurable:true,get:()=>globalThis.loopHidden});globalThis.document.dispatchEvent(new Event('visibilitychange'));});
  await p.waitForTimeout(300);assert.equal(await p.locator('.gift-celebration').count(),0);
  await p.evaluate(()=>{globalThis.loopHidden=false;globalThis.document.dispatchEvent(new Event('visibilitychange'));});await p.locator('.gift-celebration').first().waitFor();
  results.push({check:'Global off/on, reduced motion, and simulated tab-hidden visibility pause/resume',result:'PASS'});
  await p.locator('.gift-runtime-navigation button').nth(1).click();
  await p.waitForFunction(()=>{const s=globalThis.document.querySelector('.gift-runtime-stage');return s&&!s.inert&&s.getAttribute('aria-label')==='Thời gian';});
  await p.waitForTimeout(6000);
  const active=await p.locator('.gift-celebration').evaluateAll(nodes=>nodes.map(n=>n.dataset.giftEffect));
  assert(active.every(id=>id==='B05'),JSON.stringify(active));
  assert.deepEqual(errors,[]);await recipient.close();
  results.push({check:'Leaving a scene cancels its loops; new scene runs only its own configured effect',result:'PASS'});
  fs.writeFileSync(`${folder}/results.json`,JSON.stringify(results,null,2)+'\n');
  console.log('PASS independent Canvas settings, repeated public effects, bounded layers, pause/resume and scene cleanup.');
}finally{await browser.close();}
