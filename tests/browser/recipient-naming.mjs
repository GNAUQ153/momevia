import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { zipSync, strToU8 } from 'fflate';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { confirmGiftAccess } from './gift-access.mjs';

function xlsx(names) {
  const xml = value => value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const rows=['Tên người nhận',...names].map((name,i)=>`<row r="${i+1}"><c r="A${i+1}" t="inlineStr"><is><t>${xml(name)}</t></is></c></row>`).join('');
  return Buffer.from(zipSync(Object.fromEntries(Object.entries({
    '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>',
    'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Names" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`,
  }).map(([name,text])=>[name,strToU8(text)]))));
}
export async function runRecipientBrowser(base,{owner,manual,old,list,self,roster,coverless,legacyDirect,artifacts,baseline,sql}) {
  const perfOnly=process.argv.includes('--perf-only') || process.env.RECIPIENT_QA_PERF_ONLY==='true';
  const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||(process.platform==='win32'?'msedge':undefined)});
  const contexts=[], errors=[], metrics={profile:{viewport:'390x844',cpuSlowdown:4,latency:80,downloadBps:200000,uploadBps:93750,reducedMotion:'reduce',samples:5},manual:[],gate:[],open:[],file:{}};
  async function context(throttle=false,width=390){
    const c=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce',isMobile:true,hasTouch:true});contexts.push(c);
    const page=await c.newPage();page.on('pageerror',error=>errors.push(error.message));
    if(throttle){const cdp=await c.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:200000,uploadThroughput:93750});}
    return {c,page};
  }
  const shot=(page,name)=>page.screenshot({path:path.join(artifacts,name),fullPage:false});
  try {
    for(let i=0;i<5;i++){
      const {c,page}=await context(true);const start=performance.now();await page.goto(base+'/g/'+manual.slug);await page.locator('[data-runtime-element="text-recipient"]').waitFor();
      assert.equal(await page.locator('[data-runtime-element="text-recipient"]').innerText(),'Mai Anh');metrics.manual.push(performance.now()-start);await c.close();
    }
    const legacy=await context();await legacy.page.goto(base+'/g/'+old.slug);await legacy.page.locator('.gift-runtime-stage').waitFor();assert.equal(await legacy.page.locator('[data-recipient-gate]').count(),0);
    if(!baseline){
      if(!perfOnly){
      const legacyPage=await context();await legacyPage.page.goto(base+'/g/'+legacyDirect.slug);await legacyPage.page.locator('.recipient-sealed h1').waitFor();assert.equal(await legacyPage.page.locator('.recipient-sealed h1').innerText(),'Tên thủ công');assert.equal(await legacyPage.page.locator('[data-recipient-gate]').count(),0);
      await legacyPage.page.locator('[data-action="open-gift"]').click();await legacyPage.page.locator('[data-action="reveal-gift"]').click();assert.equal(await legacyPage.page.locator('.recipient-message').innerText(),'Gửi {người nhận}');
      const first=await context(),second=await context();
      for(const [person,name] of [[first,'Lan'],[second,'Minh']]){
        await person.page.goto(base+'/g/'+self.slug);if(name==='Lan')await shot(person.page,'self-name-gate-390.png');await person.page.getByLabel('Tên bạn muốn ghi trên thiệp').fill(name);
        assert.equal(await person.page.locator('.gift-runtime-stage').count(),0);await person.page.getByRole('button',{name:'Mở thiệp',exact:true}).click();
        await person.page.getByRole('heading',{name:'Gửi '+name,exact:true}).waitFor();
      }
      await shot(first.page,'self-lan-390.png');await shot(second.page,'self-minh-390.png');
      await second.page.locator('[data-scene-id="scene-message"]').click();
      await second.page.locator('.gift-runtime-reply input[name="name"]').fill('Minh ký tên riêng');
      await second.page.locator('.gift-runtime-reply textarea').fill('Lời nhắn từ phiên Minh trong trình duyệt');
      await second.page.locator('.gift-runtime-submit').click();
      await second.page.locator('.gift-runtime-reply-status').filter({hasText:'Đã gửi'}).waitFor();
      await first.page.reload();await first.page.getByRole('heading',{name:'Gửi Lan',exact:true}).waitFor();
      first.page.once('dialog',dialog=>dialog.accept());await first.page.getByRole('button',{name:'Dùng tên khác'}).click();await first.page.getByLabel('Tên bạn muốn ghi trên thiệp').fill('Mai Anh');
      await first.page.getByLabel('Tên bạn muốn ghi trên thiệp').press('Enter');await first.page.getByRole('heading',{name:'Gửi Mai Anh',exact:true}).waitFor();
      for(const width of [320,390]){
        const long=await context(false,width);await long.page.goto(base+'/g/'+self.slug);await long.page.getByLabel('Tên bạn muốn ghi trên thiệp').fill('Nguyễn Thị Mai Anh · Chúc một ngày bình yên và nhiều niềm vui');
        const box=await long.page.getByRole('button',{name:'Mở thiệp',exact:true}).boundingBox();assert(box.y+box.height<=844);
        await long.page.getByRole('button',{name:'Mở thiệp',exact:true}).click();await long.page.locator('[data-runtime-element="text-recipient"]').waitFor();
        assert(await long.page.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.innerWidth));
        assert(await long.page.locator('[data-runtime-element="text-recipient"]').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
        await shot(long.page,`long-name-${width}.png`);
      }
      const noCover=await context();await noCover.page.goto(base+'/g/'+coverless.slug);await noCover.page.getByLabel('Tên bạn muốn ghi trên thiệp').fill('Mai Anh');await noCover.page.getByRole('button',{name:'Mở thiệp',exact:true}).click();await noCover.page.locator('.recipient-dedication').waitFor();assert.equal(await noCover.page.locator('.recipient-dedication').innerText(),'Gửi Mai Anh');
      // Lost ACK: drop just the POST response after the server committed it.
      const lost=await context();await lost.page.goto(base+'/g/'+self.slug);await lost.page.getByLabel('Tên bạn muốn ghi trên thiệp').fill('Tên bị mất ACK');let intercepted=false;
      await lost.page.route('**/api/gifts/gifts/*/recipient',async route=>{if(!intercepted){intercepted=true;await route.fetch();await route.abort('connectionfailed');}else await route.continue();});
      await lost.page.getByRole('button',{name:'Mở thiệp',exact:true}).click();await lost.page.locator('#recipient-name-error').filter({hasText:/.+/}).waitFor();assert.equal(await lost.page.getByLabel('Tên bạn muốn ghi trên thiệp').inputValue(),'Tên bị mất ACK');
      await lost.page.getByRole('button',{name:'Mở thiệp',exact:true}).click();await lost.page.getByRole('heading',{name:'Gửi Tên bị mất ACK',exact:true}).waitFor();
      }
      for(let i=0;i<5;i++){
        const {c,page}=await context(true);let start=performance.now();await page.goto(base+'/g/'+self.slug);await page.getByLabel('Tên bạn muốn ghi trên thiệp').waitFor();metrics.gate.push(performance.now()-start);
        await page.getByLabel('Tên bạn muốn ghi trên thiệp').fill('Mai Anh');start=performance.now();await page.getByRole('button',{name:'Mở thiệp',exact:true}).click();await page.getByRole('heading',{name:'Gửi Mai Anh',exact:true}).waitFor();metrics.open.push(performance.now()-start);await c.close();
      }
      if(!perfOnly){
      const sender=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});contexts.push(sender);const page=await sender.newPage();page.on('pageerror',e=>errors.push(e.message));
      const login=await sender.request.post(base+'/api/auth/login',{data:{email:owner.email,password:owner.password},headers:{origin:base}});assert.equal(login.status(),200);
      // Actual template -> quick edit -> save -> reload -> publish -> list share.
      await page.goto(base+'/template/sunny-wishes');await page.locator('a[href^="/create/sunny-wishes"]').first().click();
      await page.locator('[name="recipient-mode"][value="list"]').check();
      const senderRequests=[];page.on('request',req=>senderRequests.push(req.url()));
      const names=roster.map(r=>r.name),file=xlsx(names),upload=page.locator('[data-recipient-file]');
      const start=performance.now();await upload.setInputFiles({name:'names.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:file});await page.getByRole('button',{name:'Xác nhận danh sách',exact:true}).waitFor();metrics.file.xlsx100=performance.now()-start;
      assert(senderRequests.some(url=>url.includes('recipient-xlsx.mjs')));
      await page.getByRole('button',{name:'Xác nhận danh sách',exact:true}).click();await page.locator('[data-editor-field="binding.senderName"]').fill('Người gửi');await page.locator('[data-editor-field="binding.message"]').fill('Gửi {người nhận}, chúc mừng bạn!');
      await page.locator('[data-editor-action="save"]').click();await page.locator('.editor-save-status').filter({hasText:'Đã lưu'}).waitFor();
      const draftUrl=page.url();await page.reload();await page.locator('.recipient-import-status').filter({hasText:'100'}).waitFor();
      assert(await page.locator('[name="recipient-mode"][value="list"]').isChecked());await shot(page,'sender-list-1440.png');
      await page.locator('[name="recipient-mode"][value="self"]').check();await page.locator('[name="recipient-mode"][value="list"]').check();assert(await page.locator('.recipient-import-status').innerText().then(t=>t.includes('100')));
      // Time CSV separately and verify final-row error blocks confirmation.
      let begin=performance.now();await upload.setInputFiles({name:'names.csv',mimeType:'text/csv',buffer:Buffer.from('\ufeffTên người nhận\r\n'+names.map(n=>'"'+n+'"').join('\r\n'))});await page.getByRole('button',{name:'Xác nhận danh sách',exact:true}).waitFor();metrics.file.csv100=performance.now()-begin;await page.getByRole('button',{name:'Xác nhận danh sách',exact:true}).click();
      await upload.setInputFiles({name:'bad.csv',mimeType:'text/csv',buffer:Buffer.from('Tên người nhận\r\n'+names.slice(0,99).map(n=>'"'+n+'"').join('\r\n')+'\r\n""')});await page.locator('.recipient-field-error').filter({hasText:'101'}).waitFor();assert(!await page.getByRole('button',{name:'Xác nhận danh sách',exact:true}).isVisible());
      await upload.setInputFiles({name:'bad.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:xlsx([...names.slice(0,99),'x'.repeat(61)])});await page.locator('.recipient-field-error').filter({hasText:'101'}).waitFor();assert(!await page.getByRole('button',{name:'Xác nhận danh sách',exact:true}).isVisible());
      await upload.setInputFiles({name:'names.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:file});await page.getByRole('button',{name:'Xác nhận danh sách',exact:true}).click();
      await page.locator('[data-editor-action="preview"]:visible').first().click();const preview=page.locator('dialog[open]');await preview.locator('.gift-runtime-stage').waitFor();assert.equal(await preview.locator('[data-runtime-element="text-recipient"]').innerText(),'Gửi Mai Anh');
      await preview.locator('[data-editor-action="preview-send"]').click();await confirmGiftAccess(page);await page.waitForURL(/\/success\//);await page.locator('.recipient-result').first().waitFor();assert.equal(await page.locator('.recipient-result').count(),100);await shot(page,'share-list-1440.png');
      const href=await page.locator('.recipient-result input').first().inputValue();assert.notEqual(href,new URL(roster[0].url).href);
      await page.locator('.recipient-result [data-action="qr"]').first().click();const qr=page.locator('.dialog .qr-image').first();await qr.waitFor();const png=await sharp(await qr.screenshot()).ensureAlpha().raw().toBuffer({resolveWithObject:true});const decoded=jsQR(new Uint8ClampedArray(png.data),png.info.width,png.info.height);assert.equal(decoded.data,href);
      const viaQr=await context();await viaQr.page.goto(decoded.data);await viaQr.page.getByText('Gửi '+names[0],{exact:true}).waitFor();
      await page.keyboard.press('Escape');await page.goto(base+'/studio');await page.locator(`[data-action="recipient-results"][data-id="${self.slug}"]`).click();await page.locator('.recipient-result').first().waitFor();await shot(page,'studio-recipients-1440.png');
      await page.goto(base+'/success/'+self.slug);await page.locator('#share-link').waitFor();
      assert.equal(new URL(await page.locator('#share-link').inputValue()).searchParams.has('r'),false);
      await page.locator('[data-action="qr"]').first().click();await page.locator('.qr-image').waitFor();
      const common=await sharp(await page.locator('.qr-image').screenshot()).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      const commonUrl=jsQR(new Uint8ClampedArray(common.data),common.info.width,common.info.height).data;
      assert.equal(new URL(commonUrl).searchParams.has('r'),false);
      const fresh=await context();await fresh.page.goto(commonUrl);await fresh.page.getByLabel('Tên bạn muốn ghi trên thiệp').waitFor();
      const requests=[];fresh.page.on('request',r=>requests.push(r.url()));
      await fresh.page.getByLabel('Tên bạn muốn ghi trên thiệp').fill('<img src=x onerror=alert(1)>');await fresh.page.getByLabel('Tên bạn muốn ghi trên thiệp').press('Enter');
      await fresh.page.getByRole('heading',{name:'Gửi <img src=x onerror=alert(1)>',exact:true}).waitFor();
      assert.equal(requests.filter(url=>new URL(url).pathname==='/x').length,0);
      // EN form retains VI field value and works with keyboard.
      const en=await context();await en.page.goto(base+'/g/'+self.slug);await en.page.evaluate(()=>localStorage.setItem('momevia-locale','en'));await en.page.reload();await en.page.getByLabel('The name you want on your card').fill('Mai Anh');await en.page.getByLabel('The name you want on your card').press('Enter');await en.page.getByRole('heading',{name:'To Mai Anh',exact:true}).waitFor();
      assert(draftUrl.includes('/design/'));assert(list.slug);
      }
    }
    assert.deepEqual(errors,[],'Uncaught browser errors');
    const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
    metrics.median={manualMs:median(metrics.manual),gateMs:median(metrics.gate),openMs:median(metrics.open)};
    fs.writeFileSync(path.join(artifacts,'browser-results.json'),JSON.stringify({storage:sql?'mysql':'json',baseline,browser:browser.version(),metrics,uncaughtErrors:errors},null,2));
    console.log('PASS browser recipient flows, screenshots, QR and measured timings '+JSON.stringify(metrics.median));
  } finally {await browser.close();}
}
