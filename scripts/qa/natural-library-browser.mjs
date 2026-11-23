import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {catalog} from '../../web/js/features/canvas-editor/library.js';
const ids=catalog.flatMap(g=>g.items).filter(b=>b.id.startsWith('natural-')).map(b=>b.id),out=path.resolve('docs/template-refresh-natural-20261123/library');fs.mkdirSync(out,{recursive:true});
assert.equal(ids.length,40);const report={cases:[],errors:[]},base='http://127.0.0.1:4121',browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'});const api=async(route,body,status=200)=>{const r=await context.request.fetch(base+'/api'+route,{method:body?'POST':'GET',data:body}),v=await r.json();assert.equal(r.status(),status,route+JSON.stringify(v));return v;};
 await api('/auth/demo',{deviceId:randomUUID(),name:'Natural Element Library QA'});const {design}=await api('/designs/designs',{source:{kind:'blank'},mutationId:randomUUID()},201);
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(base+'/design/'+design.id);await page.locator('[data-editor-action="library-tab"][data-tab="content"]').click();
 for(const [key,value]of Object.entries({recipientName:'Người nhận QA',senderName:'Người tặng QA',message:'Một lời chúc từ các element tự nhiên.'}))await page.locator(`[data-editor-field="binding.${key}"]`).fill(value);
 const add=page.locator('[data-editor-action="library-tab"][data-tab="add"]');await add.click();await page.locator('[data-library-kind="text"]').click();await page.locator('[data-block="greeting"]').click();
 await page.locator('[data-library-kind="interactive"]').click();await page.locator('[data-block="reply"]').click();
 for(const id of ids){
  await add.click();await page.locator('[data-library-kind="all"]').click();const before=await page.locator('.editor-artboard [data-element-id]').count();
  const block=page.locator(`[data-block="${id}"]`);await block.scrollIntoViewIfNeeded();await block.click();await page.waitForFunction(n=>globalThis.document.querySelectorAll('.editor-artboard [data-element-id]').length>n,before);report.cases.push({id,inserted:true});
 }
 await page.locator('.editor-artboard img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
 await page.locator('[data-editor-action="save"]').click();await page.locator('.editor-save-status[data-tone="saved"]').waitFor();const saved=(await api('/designs/designs/'+design.id)).design;
 assert(saved.document.assets.length>10&&saved.document.assets.length<64);assert(saved.document.assets.every(a=>/^[a-f\d-]{36}$/.test(a.assetId)));
 await page.reload();await page.locator('.editor-artboard img').first().waitFor();assert.deepEqual((await api('/designs/designs/'+design.id)).design.document,saved.document);
 for(const kind of ['graphics','photos','three-d','animation','interactive']){
  await add.click();await page.locator(`[data-library-kind="${kind}"]`).click();const visible=await page.locator('[data-block]:visible').count();assert(visible>0);await page.locator('.editor-library').screenshot({path:path.join(out,kind+'.png')});
 }
 const {gift}=await api('/gifts/gifts/from-design',{designId:design.id,expectedRevision:saved.revision,expectedDocumentHash:saved.documentHash,idempotencyKey:randomUUID()},201);
 const assetId=saved.document.assets[0].assetId,owner=await context.request.get(`${base}/api/designs/designs/${design.id}/assets/${assetId}`),privateGuest=await fetch(`${base}/api/designs/designs/${design.id}/assets/${assetId}`);assert.equal(privateGuest.status,401);
 const publicAsset=await fetch(`${base}/api/gifts/gifts/${gift.slug}/assets/${assetId}`);assert.equal(publicAsset.status,200);assert.equal(createHash('sha256').update(Buffer.from(await owner.body())).digest('hex'),createHash('sha256').update(Buffer.from(await publicAsset.arrayBuffer())).digest('hex'));
 await page.goto(base+'/g/'+gift.slug);await page.locator('.gift-runtime-stage').waitFor();await page.locator('.gift-runtime-stage img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
 const publicStage=page.locator('.gift-runtime-stage');
 assert.equal(await page.locator('.gift-runtime.is-natural-stationery').count(),0,'Adding stock decorations must not restyle an unrelated reply form');
 assert.equal(await publicStage.evaluate(n=>n.getAnimations({subtree:true}).length),0);
 const fold=publicStage.locator('details.gift-letter-fold').first(),wasOpen=await fold.evaluate(n=>n.open);await fold.locator('summary').press('Enter');assert.notEqual(await fold.evaluate(n=>n.open),wasOpen);
 await page.emulateMedia({reducedMotion:'no-preference'});await page.reload();await publicStage.waitFor();
 await page.waitForFunction(()=>globalThis.document.querySelector('.gift-runtime-stage')?.getAnimations({subtree:true}).length>0);
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>globalThis.document.querySelector('.gift-runtime-stage')?.getAnimations({subtree:true}).length===0);
 report.motion={normalMotion:true,liveReducedMotionStops:true,keyboardFoldout:true};
 report.roundTrip={designId:design.id,slug:gift.slug,assets:saved.document.assets.length,published:true,privateACL:true,publicBytesMatch:true};assert.deepEqual(report.errors,[]);report.passed=true;console.log('PASS natural library: 40 insertions, owner-private media, save/reload, five category filters and real publication');await context.close();
}catch(error){report.failure={message:error.message,stack:error.stack};console.error(error.stack);process.exitCode=1;}
finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
