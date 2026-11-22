// Supplemental evidence against the retained 70f2be0 server and pinned gifts.
// Never replaces the original baseline code or performance samples.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {chromium} from 'playwright';
const root=path.resolve('local/interactive-cards-20261122'),out=path.join(root,'legacy-evidence');fs.mkdirSync(out,{recursive:true});
const baseline=JSON.parse(fs.readFileSync(path.join(root,'baseline/session.json'))),final=JSON.parse(fs.readFileSync(path.join(root,'final/session.json'))),gifts=JSON.parse(fs.readFileSync(path.join(root,'final/api-report.json'))).filter(r=>r.legacy);
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
try{
 for(const locale of ['vi','en']){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),[name,...value]=baseline.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:baseline.base}]);await context.addInitScript(l=>globalThis.localStorage.setItem('momevia-locale',l),locale);
  const response=await fetch(baseline.base+'/api/designs/designs',{method:'POST',headers:{cookie:baseline.cookie,'content-type':'application/json','x-momevia-locale':locale},body:JSON.stringify({source:{kind:'template',templateId:'birthday-radiance'},mutationId:randomUUID()})});assert.equal(response.status,201);const {design}=await response.json();
  const page=await context.newPage();await page.goto(baseline.base+'/design/'+design.id+'?mode=layout');await page.locator('[data-editor-field="title"]').waitFor();await page.locator('.editor-artboard img').first().waitFor();assert(await page.locator('.editor-artboard img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode().then(()=>true,()=>false))).then(a=>a.every(Boolean))));
  const file=`baseline-studio-${locale}.png`;await page.screenshot({path:path.join(out,file),fullPage:true});results.push({sourceCommit:'70f2be0',kind:'Studio',locale,file,documentHash:design.documentHash,templateVersionId:design.source.templateVersionId,supplementalCapture:true});
  await page.setViewportSize({width:390,height:1000});
  for(const gift of gifts){
   const raw=await fetch(final.base+'/api/gifts/gifts/'+gift.slug);assert.equal(raw.status,200);const snapshot=(await raw.json()).gift.documentSnapshot;
   await page.goto(final.base+'/g/'+gift.slug);await page.locator('.gift-runtime-stage [data-runtime-element]').first().waitFor();await page.locator('.gift-runtime-stage img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode().catch(()=>{}))));
   const file=`legacy-${gift.legacy}-${locale}.png`;await page.screenshot({path:path.join(out,file),fullPage:true});results.push({kind:gift.legacy,slug:gift.slug,locale,file,snapshotSha256:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),authoredText:'Pinned fixture, not translated by changing UI language'});
  }
  await context.close();
 }
 console.log('PASS supplemental 70f2be0 Studio VI/EN and immutable V1/old-V2 public screenshots');
}finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(results,null,2)+'\n');}
