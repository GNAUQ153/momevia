import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {REFRESH_21} from '../../web/js/shared/canvas/refresh-21-config.js';
const base='http://127.0.0.1:4121',report={cases:[],errors:[],zoomMethod:'Desktop 200% emulation: 1440 physical pixels, 720 CSS pixels, DPR 2. No physical keyboard or mobile virtual keyboard.'};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const locale of ['vi','en'])for(const [width,dpr,zoom]of [[320,1,1],[1440,1,1],[720,2,2]]){
  const context=await browser.newContext({viewport:{width,height:1000},deviceScaleFactor:dpr,reducedMotion:'reduce',locale:locale==='vi'?'vi-VN':'en-US'});
  await context.addInitScript(l=>globalThis.localStorage.setItem('momevia-locale',l),locale);
  const greeting=(locale==='vi'?'Mong bạn có thật nhiều bình an, niềm vui và những khoảnh khắc được yêu thương. '.repeat(35):'May this little gift bring you peace, warm memories and many more days of kindness and joy. '.repeat(35)).slice(0,1000);
  const recipient=(locale==='vi'?'Nguyễn Hoàng Phương Thảo · người bạn từ những ngày đầu, qua biết bao mùa nắng và mưa':'Alexandra Catherine Montgomery · my friend through so many seasons, sunny mornings and rainy days').slice(0,60);
  await context.route('**/api/designs/library/templates/*/preview',async route=>{
   const response=await route.fetch(),body=await response.json();
   for(const doc of Object.values(body.documents)){
    doc.bindings.recipientName.value=recipient;doc.bindings.senderName.value=locale==='vi'?'Những người bạn luôn nhớ đến bạn':'Your friends, thinking of you';doc.bindings.message.value=greeting;
   }
   await route.fulfill({response,json:body});
  });
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(e.message));
  for(const id of Object.keys(REFRESH_21)){
   await page.goto(base+'/template/'+id);await page.locator('[data-template-preview]').first().click();const stage=page.locator('.template-preview-dialog .gift-runtime-stage');
   await stage.locator('[data-runtime-element="open-gift"]').press('Enter');await stage.locator('[data-runtime-element="text-message"]').waitFor();
   assert.equal((await stage.locator('[data-runtime-element="text-message"]').innerText()).trim(),greeting.trim());
   await page.waitForFunction(()=>{const stage=globalThis.document.querySelector('.template-preview-dialog .gift-runtime-stage'),message=stage?.querySelector('[data-runtime-element="text-message"]');return message&&message.getBoundingClientRect().bottom<=stage.getBoundingClientRect().bottom+1;});
   const layout=await stage.evaluate(stage=>{const rect=stage.getBoundingClientRect();const nodes=[...stage.querySelectorAll('.gift-runtime-text,.gift-runtime-reply,button')];return {clipped:nodes.filter(n=>{const r=n.getBoundingClientRect();return r.left<rect.left-1||r.right>rect.right+1;}).map(n=>n.dataset.runtimeElement),height:rect.height,messageHeight:stage.querySelector('[data-runtime-element="text-message"]').getBoundingClientRect().height};});
   assert.deepEqual(layout.clipped,[],`${id}/${locale}/${width}/zoom-${zoom}`);assert(layout.messageHeight>500);
   await stage.locator('[data-runtime-element="to-message"]').press('Space');await stage.locator('.gift-runtime-reply textarea').fill(locale==='vi'?'Một lời hồi âm bằng bàn phím.':'A reply, typed with the keyboard.');
   await stage.locator('.gift-runtime-reply button[type="submit"]').press('Enter');await stage.locator('[data-runtime-element="replay-gift"]').press('Enter');await stage.locator('[data-runtime-element="open-gift"]').waitFor();
   await page.keyboard.press('Escape');report.cases.push({id,locale,width,zoom,dpr,characters:greeting.length,recipientCharacters:recipient.length,...layout,replyKeyboard:true});
  }
  await context.close();console.log(`PASS long copy ${locale} ${width} DPR ${dpr} zoom ${zoom}`);
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure={message:error.message,stack:error.stack};console.error(error.stack);process.exitCode=1;}
finally{await browser.close();fs.writeFileSync('docs/template-refresh-natural-20261123/browser/long-copy-report.json',JSON.stringify(report,null,2)+'\n');}
