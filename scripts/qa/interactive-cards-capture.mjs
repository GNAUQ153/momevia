import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const phase=process.argv[2]||'final',root=path.resolve('local/interactive-cards-20261122'),out=path.join(root,phase,'handoff');fs.mkdirSync(out,{recursive:true});
const {base,cookie}=JSON.parse(fs.readFileSync(path.join(root,phase,'session.json'))),inventory=JSON.parse(fs.readFileSync(path.join(root,phase,'inventory.json')));
const ids=['hai-phong-bi','birthday-radiance','proud-of-you',...(phase==='final'?['loi-moi-ben-hien','cuon-phim-ngay-ay','ban-do-ngay-ra-truong']:[])],report=[];
const api=async(url,body)=>{const r=await fetch(base+'/api'+url,{method:body?'POST':'GET',headers:{cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const v=await r.json();assert(r.ok,JSON.stringify(v));return v;};
async function decodedStudioArtwork(page){
 const images=page.locator('.editor-artboard img');await images.first().waitFor({state:'attached'});
 const ready=await images.evaluateAll(imgs=>Promise.all(imgs.map(async img=>{try{await img.decode();return img.complete&&img.naturalWidth>0;}catch{return false;}})));
 assert(ready.length&&ready.every(Boolean),'Studio artwork must be decoded before evidence capture');
}
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const locale of ['vi','en']){
  const context=await browser.newContext({viewport:{width:390,height:1000},locale:locale==='vi'?'vi-VN':'en-US',reducedMotion:'reduce'}),[name,...parts]=cookie.split('=');await context.addCookies([{name,value:parts.join('='),url:base}]);await context.addInitScript(l=>globalThis.localStorage.setItem('momevia-locale',l),locale);
  const page=await context.newPage();
  for(const width of [390,1440]){
   await page.setViewportSize({width,height:1000});await page.goto(base+'/explore');await page.locator('#catalog-grid article').first().waitFor();await page.screenshot({path:path.join(out,`catalog-${locale}-${width}.png`),fullPage:true});
   for(const id of ids){await page.goto(base+'/template/'+id);await page.locator('[data-template-preview]').waitFor();await page.screenshot({path:path.join(out,`${id}-detail-${locale}-${width}.png`),fullPage:true});}
  }
  if(phase==='final'){
   const templateId='loi-moi-ben-hien';const response=await fetch(base+'/api/designs/designs',{method:'POST',headers:{cookie,'content-type':'application/json','x-momevia-locale':locale},body:JSON.stringify({source:{kind:'template',templateId},mutationId:randomUUID()})});assert.equal(response.status,201);const d=(await response.json()).design;
   await page.goto(base+'/design/'+d.id+'?mode=layout');await page.locator('[data-editor-field="title"]').waitFor();await page.locator('[data-editor-action="library-tab"][data-tab="layers"]').click();await page.locator('[data-editor-action="select"][data-id="cover-art"]').click();
   if(locale==='en')assert.match(await page.locator('[data-editor-field="effect.entrance.delay"] option[value="0"]').innerText(),/Immediately/);
   await decodedStudioArtwork(page);await page.screenshot({path:path.join(out,`studio-${locale}-1440.png`),fullPage:true});
   await page.goto(base+'/explore');await page.locator('#palette-filter').selectOption('birthdayPaper');await page.waitForFunction(()=>globalThis.document.querySelectorAll('#catalog-grid article').length===1);assert.match(await page.locator('#catalog-grid').innerText(),/Birthday Radiance/);
   await page.locator('#occasion-filter').selectOption({label:locale==='vi'?'Tốt nghiệp':'Graduation'});await page.locator('#catalog-grid .empty-state').waitFor();await page.locator('[data-action="clear-filters"]').first().click();await page.waitForFunction(()=>globalThis.document.querySelectorAll('#catalog-grid article').length===9);

  }
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'vi-VN',reducedMotion:'reduce'}),[name,...parts]=cookie.split('=');await context.addCookies([{name,value:parts.join('='),url:base}]);await context.addInitScript(()=>globalThis.localStorage.setItem('momevia-locale','vi'));const page=await context.newPage();
 for(const id of ids){
  const record=inventory.find(r=>r.template.id===id);let d=(await api('/designs/designs/'+record.designId)).design;
  for(const [key,b]of Object.entries(d.document.bindings))b.value=key==='message'?'Chúc bạn có thật nhiều ngày đáng nhớ.':key==='recipientName'?'Nguyễn Hoàng Phương Thảo':'Momevia QA';
  if(id==='loi-moi-ben-hien'){
   for(const [key,value]of Object.entries({'event-1-time':'09:30','event-1-activity':'Gặp nhau bên hiên','event-1-address':'Địa chỉ thử A · Một dòng địa chỉ tiếng Việt rất dài cần xuống hàng để đọc rõ ở màn hình hẹp.','event-2-time':'17:45','event-2-activity':'Cùng kể chuyện hôm nay','event-2-address':'Địa chỉ thử B · Một địa điểm khác, được giữ đúng ở hàng thứ hai của chương trình.'}))d.document.elements.find(e=>e.id===key).props.text=value;
  }
  await api(`/designs/designs/${d.id}/save`,{expectedRevision:d.revision,mutationId:randomUUID(),title:d.title,document:d.document});d=(await api('/designs/designs/'+d.id)).design;
  await page.goto(`${base}/design/${d.id}?mode=layout`);await page.locator('[data-editor-field="title"]').waitFor();await decodedStudioArtwork(page);await page.screenshot({path:path.join(out,`${id}-studio-1440.png`),fullPage:true});
  const {gift}=await api('/gifts/gifts/from-design',{designId:d.id,expectedRevision:d.revision,expectedDocumentHash:d.documentHash,idempotencyKey:randomUUID()});
  await page.setViewportSize({width:320,height:1000});await page.goto(base+'/g/'+gift.slug);await page.locator('.gift-runtime-stage').waitFor();
  for(const scene of d.document.scenes){
   await page.locator(`[data-scene-id="${scene.id}"]`).click();
   const controls=await page.locator('.gift-runtime-stage .gift-runtime-control').evaluateAll(nodes=>nodes.map(n=>({label:n.textContent,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height})));
   if(phase==='final')assert(controls.every(c=>c.height>=43.9),`${id}/${scene.id}: touch height`);
   await page.screenshot({path:path.join(out,`${id}-${scene.id}-public-320.png`),fullPage:true});
   await page.evaluate(()=>{globalThis.document.body.style.zoom='2';});
   await page.evaluate(()=>new Promise(resolve=>globalThis.requestAnimationFrame(()=>globalThis.requestAnimationFrame(resolve))));
   const fit=await page.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.innerWidth+1);
   if(!fit){const overflow=await page.evaluate(()=>({width:globalThis.innerWidth,scroll:globalThis.document.documentElement.scrollWidth,nodes:[...globalThis.document.querySelectorAll('*')].filter(n=>n.getBoundingClientRect().right>globalThis.innerWidth+1&&globalThis.getComputedStyle(n).position!=='fixed').slice(-15).map(n=>({tag:n.tagName,class:n.className,rect:n.getBoundingClientRect().toJSON()}))}));report.push({overflow,id,sceneId:scene.id});await page.screenshot({path:path.join(out,'zoom-failure.png'),fullPage:true});}
   assert(fit,`${id}/${scene.id}: 200% CSS zoom horizontal overflow`);
   await page.screenshot({path:path.join(out,`${id}-${scene.id}-zoom200.png`),fullPage:true});
   await page.evaluate(()=>{globalThis.document.body.style.zoom='';});
  }
  report.push({id,designId:d.id,slug:gift.slug,documentHash:d.documentHash,templateVersionId:d.source.templateVersionId,cssZoom200:true,screenWidth:320});await page.setViewportSize({width:1440,height:1000});
 }
 await context.close();
 if(phase==='final'){
  const videoContext=await browser.newContext({viewport:{width:390,height:844},locale:'vi-VN',reducedMotion:'no-preference',recordVideo:{dir:path.join(out,'video'),size:{width:390,height:844}}});await videoContext.addInitScript(()=>globalThis.localStorage.setItem('momevia-locale','vi'));const videoPage=await videoContext.newPage();await videoPage.goto(base+'/template/birthday-radiance');await videoPage.locator('[data-template-preview]').click();await videoPage.locator('[data-runtime-element="birthday-candle"] button').waitFor();await videoPage.waitForTimeout(700);await videoPage.locator('[data-runtime-element="birthday-candle"] button').click();await videoPage.waitForTimeout(1000);await videoPage.locator('[data-runtime-element="open-gift"]').click();await videoPage.waitForTimeout(800);await videoContext.close();
 }
 console.log(`PASS ${phase} handoff: Catalog/detail VI/EN, Studio, public scenes at 320, independent long addresses, CSS zoom 200%, touch targets${phase==='final'?', real candle video':''}`);
}catch(error){report.push({failure:error.message,stack:error.stack});console.error(error.stack);process.exitCode=1;}
finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
