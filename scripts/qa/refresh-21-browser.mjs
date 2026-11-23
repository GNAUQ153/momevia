import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { REFRESH_21 } from '../../web/js/shared/canvas/refresh-21-config.js';
import { insertPhotoFrame } from '../../web/js/shared/canvas/basic-templates.js';
import { publicDocument } from '../../web/js/shared/canvas/schema.js';
const base='http://127.0.0.1:4121',out=path.resolve('docs/template-refresh-20261123/browser');fs.mkdirSync(out,{recursive:true});
const mode=process.argv[2]||'matrix',ids=Object.keys(REFRESH_21),report={mode,base,browser:'Chrome',cases:[],errors:[],waves:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});
const active=(stage,id)=>stage.locator(`[data-runtime-element="${id}"]`);
const ready=async stage=>{await stage.locator('[data-runtime-element]').first().waitFor();await stage.locator('img').evaluateAll(images=>Promise.all(images.map(i=>i.decode().catch(()=>{}))));};
async function layout(stage){return stage.evaluate(stage=>{
 const rect=stage.getBoundingClientRect();
 const nodes=[...stage.querySelectorAll('[data-runtime-element]')].filter(n=>globalThis.getComputedStyle(n).display!=='none'&&!/gift-runtime-(shape|line|sticker)/.test(n.className));
 return {clipped:nodes.filter(n=>{const r=n.getBoundingClientRect();return r.left<rect.left-1||r.right>rect.right+1;}).map(n=>n.dataset.runtimeElement),
  buttons:[...stage.querySelectorAll('button')].filter(n=>n.getClientRects().length).map(n=>{const r=n.getBoundingClientRect();return {label:n.getAttribute('aria-label')||n.textContent,width:r.width,height:r.height};}),animations:stage.getAnimations({subtree:true}).length};
});}
try{
 if(mode==='matrix'){
  for(const locale of ['vi','en'])for(const width of [320,390,1440])for(const reducedMotion of ['reduce','no-preference']){
   const context=await browser.newContext({viewport:{width,height:1000},locale:locale==='vi'?'vi-VN':'en-US',reducedMotion,hasTouch:width<768});
   await context.addInitScript(l=>globalThis.localStorage.setItem('momevia-locale',l),locale);
   const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push(e.message));
   for(let wave=1;wave<=4;wave++){
    for(const id of ids.filter(id=>REFRESH_21[id].wave===wave)){
     await page.goto(base+'/template/'+id);const opener=page.locator('[data-template-preview]').first();await opener.click();
     const dialog=page.locator('.template-preview-dialog'),stage=dialog.locator('.gift-runtime-stage');await ready(stage);
     const scenes=[];
     for(const [i,scene]of ['scene-cover','scene-surprise','scene-message'].entries()){
      await page.locator(`.template-preview-dialog [data-scene-id="${scene}"][aria-current="step"]`).waitFor();
      await page.locator('.template-preview-dialog .gift-runtime-stage:not([inert])').waitFor();
      const state=await layout(stage);assert.deepEqual(state.clipped,[],`${id}/${locale}/${width}/${scene}`);
      for(const button of state.buttons)assert(button.width>=43.9&&button.height>=43.9,`${id} target ${JSON.stringify(button)}`);
      if(reducedMotion==='reduce')assert.equal(state.animations,0);
      if(width===390&&reducedMotion==='reduce')await stage.screenshot({path:path.join(out,`${id}-${locale==='en'?'en-':''}${i}.png`)});
      scenes.push({scene,...state});
      if(i<2){const control=active(stage,i===0?'open-gift':'to-message');if((wave+i)%2)await control.press('Enter');else await control.press('Space');}
     }
     await active(stage,'reply-card').locator('input').fill('Người nhận QA');await active(stage,'reply-card').locator('textarea').fill('Một hồi âm mô phỏng.');
     await active(stage,'reply-card').locator('button[type="submit"]').click();
     await active(stage,'replay-gift').click();await active(stage,'open-gift').waitFor();
     await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert(await opener.evaluate(n=>globalThis.document.activeElement===n));
     report.cases.push({id,locale,width,reducedMotion,scenes,keyboard:true,previewReply:true});
    }
    report.waves.push({wave,locale,width,reducedMotion,reviewed:ids.filter(id=>REFRESH_21[id].wave===wave)});
   }
   await context.close();console.log(`PASS matrix ${locale} ${width} ${reducedMotion}`);
  }
 }else if(mode==='journeys'){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await context.addInitScript(()=>globalThis.localStorage.setItem('momevia-locale','vi'));
  const api=async(route,body,status=200)=>{const r=await context.request.fetch(base+'/api'+route,{method:body?'POST':'GET',data:body});const v=await r.json();assert.equal(r.status(),status,route+' '+JSON.stringify(v));return v;};
  await api('/auth/demo',{deviceId:'refresh-21-'+randomUUID(),name:'Momevia Template QA'});
  const user=(await api('/auth/me')).user;
  fs.mkdirSync('local/refresh-21',{recursive:true});fs.writeFileSync('local/refresh-21/session.json',JSON.stringify({base,user,cookies:await context.cookies()}));
  const templates=(await api('/catalog/templates')).templates;
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(e.message));
  for(const id of ids){
   let {design}=await api('/designs/designs',{source:{kind:'template',templateId:id},mutationId:randomUUID()},201);
   const source=structuredClone(design.source),policy=structuredClone(design.policy),t=templates.find(t=>t.id===id);
   await page.goto(base+'/design/'+design.id+'?mode=quick');
   for(const [key,value]of Object.entries({recipientName:'Nguyễn Hoàng Phương Thảo · người bạn từ những ngày đầu',senderName:'Những người bạn Momevia',message:'Một lời nhắn riêng. '+ 'Mong bạn có thật nhiều bình an, niềm vui và những khoảnh khắc được yêu thương. '.repeat(15)}))await page.locator(`[data-editor-field="binding.${key}"]`).fill(value);
   await page.locator('[data-editor-action="save"]').click();await page.locator('.editor-save-status[data-tone="saved"]').waitFor();
   await page.reload();assert.match(await page.locator('[data-editor-field="binding.recipientName"]').inputValue(),/Phương Thảo/);
   await page.locator('[data-editor-action="preview"]').click();const preview=page.locator('.editor-preview-dialog');await preview.locator('.gift-runtime-stage').waitFor();
   await active(preview,'open-gift').click();await active(preview,'text-message').waitFor();await preview.screenshot({path:path.join(out,`${id}-long-message.png`)});await page.keyboard.press('Escape');
   design=(await api('/designs/designs/'+design.id)).design;assert.deepEqual(design.source,source);assert.deepEqual(design.policy,policy);
   const pub={designId:design.id,expectedRevision:design.revision,expectedDocumentHash:design.documentHash,idempotencyKey:randomUUID()};
   let paidGate=false;
   if(t.price){await api('/gifts/gifts/from-design',pub,402);paidGate=true;
    // A synthetic, explicit QA entitlement; no payment provider is called.
    const orders='local/event-cards-refresh/app/services/checkout/data/orders.json',rows=JSON.parse(fs.readFileSync(orders));
    rows.push({id:randomUUID(),userId:user.id,templateId:id,status:'demo_paid',qaFixture:true});fs.writeFileSync(orders,JSON.stringify(rows));
   }
   const {gift}=await api('/gifts/gifts/from-design',pub,201);assert.deepEqual((await api('/gifts/gifts/'+gift.slug)).gift.documentSnapshot,publicDocument(design.document));
   await page.goto(base+'/g/'+gift.slug);await page.locator('.gift-runtime-stage').waitFor();await active(page,'open-gift').press('Enter');await active(page,'to-message').waitFor();await active(page,'to-message').press('Space');
   const reply=active(page,'reply-card');await reply.locator('input').fill('Người thử QA');await reply.locator('textarea').fill('Đã đọc trọn vẹn lời nhắn.');
   // Verify recoverable submit failure on the first template.
   if(id===ids[0]){await page.route('**/api/gifts/gifts/*/replies',route=>route.request().method()==='POST'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'QA retry'})}):route.continue());await reply.locator('button[type="submit"]').click();await reply.locator('button[type="submit"]:enabled').waitFor();await page.unroute('**/api/gifts/gifts/*/replies');}
   await reply.locator('button[type="submit"]').click();await page.waitForResponse(r=>r.url().includes('/replies')&&r.request().method()==='POST'&&r.status()===201).catch(()=>{});
   assert((await api('/gifts/gifts/mine/'+gift.slug+'/replies')).replies.some(r=>r.message==='Đã đọc trọn vẹn lời nhắn.'));
   if(['polaroid','mot-ky-niem'].includes(id)){
    const photos=[];
    for(const [width,height]of [[160,90],[90,160]]){
     const bytes=await sharp(Buffer.from(`<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="#906050"/><rect width="${width/3}" height="100%" fill="#3A7665"/><circle cx="${width*.7}" cy="${height*.3}" r="15" fill="#F0D794"/></svg>`)).png().toBuffer();
     const r=await context.request.post(base+'/api/designs/designs/'+design.id+'/assets',{headers:{'content-type':'image/png','x-mutation-id':randomUUID()},data:bytes});assert.equal(r.status(),201);const asset=(await r.json()).asset;
     design=(await api('/designs/designs/'+design.id)).design;const document=insertPhotoFrame(design.document,asset.id);document.elements.find(e=>e.id==='photo-window-image').props.focalPoint={x:.15,y:.8};
     await api('/designs/designs/'+design.id+'/save',{expectedRevision:design.revision,mutationId:randomUUID(),title:design.title,document});
     assert.deepEqual((await api('/designs/designs/'+design.id)).design.document,document);await page.goto(base+'/design/'+design.id+'?mode=quick');await page.locator('[data-editor-action="preview"]').click();
     const photoScene=document.scenes.find(s=>s.elementIds.includes('photo-window-image')).id;await page.locator(`.editor-preview-dialog [data-scene-id="${photoScene}"]`).click();
     const image=page.locator('.editor-preview-dialog [data-runtime-element="photo-window-image"] img');await image.waitFor();assert(await image.evaluate(async n=>{await n.decode();return n.naturalWidth>0;}));
     await page.locator('.editor-preview-dialog').screenshot({path:path.join(out,`${id}-photo-${width}x${height}.png`)});await page.keyboard.press('Escape');photos.push({width,height,focal:{x:.15,y:.8},assetReady:true});
    }
    // Published gift is still the earlier no-photo snapshot.
    assert.equal((await api('/gifts/gifts/'+gift.slug)).gift.documentSnapshot.assets.length,0);report.cases.push({id,photos,snapshotPreserved:true});
   }
   report.cases.push({id,designId:design.id,slug:gift.slug,price:t.price,paidGate,sourcePreserved:true,policyPreserved:true,savedReloaded:true,published:true,reply:true});console.log('PASS journey '+id);
  }
  // Preserve earlier published source while making a later draft edit.
  const first=report.cases.find(c=>c.published);let d=(await api('/designs/designs/'+first.designId)).design;const snapshot=(await api('/gifts/gifts/'+first.slug)).gift.documentSnapshot;d.document.bindings.message.value='Sửa nháp sau khi gửi';await api('/designs/designs/'+d.id+'/save',{expectedRevision:d.revision,mutationId:randomUUID(),title:d.title,document:d.document});assert.deepEqual((await api('/gifts/gifts/'+first.slug)).gift.documentSnapshot,snapshot);
  report.immutablePublishedSnapshot=true;await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure={message:error.message,stack:error.stack};console.error(error.stack);process.exitCode=1;}
finally{await browser.close();fs.writeFileSync(path.join(out,mode+'-report.json'),JSON.stringify(report,null,2)+'\n');}
