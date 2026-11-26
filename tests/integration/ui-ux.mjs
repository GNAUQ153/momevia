import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {startSfxFixture} from './sfx-fixture.mjs';
const root=process.cwd(),phase='regression',out=path.join(root,'local/ui-ux-20261126',phase);
fs.mkdirSync(out,{recursive:true});
const fixture=await startSfxFixture({label:'ui-ux-'+phase});
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
const contrast=(foreground,background)=>{
 const luminance=color=>color.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((v,n,i)=>v+n*[.2126,.7152,.0722][i],0);
 const a=luminance(foreground),b=luminance(background);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
};
try{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const page=await context.newPage();
 const html=fs.readFileSync(path.join(root,'web/index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
 await page.route('**/__qa',route=>route.fulfill({contentType:'text/html',body:html}));
 await page.goto(fixture.base+'/__qa');
 await page.evaluate(async()=>{
  const i=await import('/js/core/i18n.js');globalThis.qaI18n=i;
  await i.initializeLocale();
  globalThis.qaGift=await import('/js/pages/gifts.js');
  globalThis.qaCreator=await import('/js/pages/creator.js');
  globalThis.qaAdmin=await import('/js/pages/admin-payments.js');
  globalThis.qaMain=globalThis.document.querySelector('main');
 });
 for(const locale of ['vi','en'])for(const width of [320,390,391,430,768,1024,1440]){
  await page.setViewportSize({width,height:844});
  await page.evaluate(async locale=>{
   await globalThis.qaI18n.selectLocale(locale);
   globalThis.qaState={user:{name:'Nguyễn Trần Hoàng Anh - tên dài để kiểm tra',provider:'email',emailVerified:false},providers:{recoveryEmail:true},favorites:new Set()};
   globalThis.qaViews=globalThis.qaGift.createGiftViews({state:globalThis.qaState,buttonLink:(url,text)=>`<a class="btn btn--dark" href="${url}">${text}</a>`});
   globalThis.qaStudioCleanup?.();globalThis.qaMain.innerHTML=globalThis.qaViews.dashboard();
   const {mountStudioSpace}=await import('/js/features/studio/studio-space.js');
   globalThis.qaStudioCleanup=mountStudioSpace(globalThis.qaMain);
  },locale);
  const m=await page.evaluate(()=>{
   const a=globalThis.document.querySelector('.studio-space__hero-inner > a'),s=globalThis.getComputedStyle(a);
   return {color:s.color,background:globalThis.getComputedStyle(a.closest('.studio-space__hero')).backgroundColor,buttons:[...globalThis.document.querySelectorAll('.studio-space__hero-actions .btn')].map(n=>({text:n.textContent.trim(),height:n.getBoundingClientRect().height})),scroll:globalThis.document.documentElement.scrollWidth,client:globalThis.document.documentElement.clientWidth};
  });results.push({item:'A1/A3',locale,width,...m});
  if([320,390,1440].includes(width))await page.screenshot({path:path.join(out,`studio-${locale}-${width}.png`),fullPage:true});
 }
 for(const locale of ['vi','en'])for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:844});
  await page.evaluate(async locale=>{
   await globalThis.qaI18n.selectLocale(locale);
   globalThis.qaMain.innerHTML=globalThis.qaViews.successPage({slug:'qa-share',url:globalThis.location.origin+'/g/qa-share',inviteUrl:globalThis.location.origin+'/g/qa-share?invite=qa-private',recipientName:'Nguyễn Mai Anh',access:{open:'link',send:'invite',read:'sender'}});
  },locale);
  results.push({item:'A2',locale,width,...await page.locator('.success-foot').evaluate(n=>({color:globalThis.getComputedStyle(n).color,font:globalThis.getComputedStyle(n).fontSize,text:n.textContent.trim(),scroll:globalThis.document.documentElement.scrollWidth,client:globalThis.document.documentElement.clientWidth}))});
  await page.screenshot({path:path.join(out,`share-${locale}-${width}.png`),fullPage:true});
  if(width===320){
   await page.locator('.success-foot').evaluate(n=>{n.style.fontSize='28px';});
   assert(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.document.documentElement.clientWidth+1));
   assert(await page.locator('.success-foot').evaluate(n=>n.scrollHeight<=n.clientHeight+1));
  }
 }
 for(const locale of ['vi','en']){
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(async locale=>{
   await globalThis.qaI18n.selectLocale(locale);const group={orders:0,grossVnd:0,platformFeeVnd:0,creatorVnd:0};
   globalThis.qaMain.innerHTML=globalThis.qaCreator.creatorFinancePanel({summary:{live:group,sandbox:group},recent:[{creatorVnd:0}]})+globalThis.qaAdmin.adminFinancePanel({summary:{live:group,sandbox:group}});
  },locale);
  results.push({item:'A4',locale,text:await page.locator('.finance-metric strong').allTextContents()});
  await page.screenshot({path:path.join(out,`finance-${locale}.png`),fullPage:true});
 }
 for(const locale of ['vi','en'])for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:844});
  await page.evaluate(async locale=>{
   globalThis.qaReview?.dispose();await globalThis.qaI18n.selectLocale(locale);
   const {mountReview}=await import('/js/features/catalog/review.js');
   const {createOpenMeTemplate}=await import('/js/shared/canvas/open-me-templates.js');
   const canvasDocument=createOpenMeTemplate('club-22-invitation',globalThis.qaI18n.t);
   globalThis.qaReview=mountReview(globalThis.qaMain,{version:{document:canvasDocument,title:'Lời mời sinh nhật Nguyễn Trần Hoàng Anh - phiên bản kiểm duyệt dài',id:'qa-version',revision:2,status:'pending',bindings:['recipientName','senderName','message'],coverSceneId:canvasDocument.entrySceneId},endpoint:'/catalog/admin/versions/qa-version',api:{post:async()=>{}},navigate:()=>{}});
  },locale);
  await page.waitForTimeout(180);
  results.push({item:'A5',locale,width,...await page.evaluate(()=>({scroll:globalThis.document.documentElement.scrollWidth,client:globalThis.document.documentElement.clientWidth,grid:globalThis.document.querySelector('.template-review-grid').getBoundingClientRect().width,preview:globalThis.document.querySelector('.template-review-preview').getBoundingClientRect().width}))});
  await page.screenshot({path:path.join(out,`review-${locale}-${width}.png`),fullPage:true});
  if(width===320){
   const scenes=page.locator('.template-review-preview [data-scene-id]');
   assert.equal(await scenes.count(),4);await scenes.first().focus();await page.keyboard.press('End');
   assert(await scenes.last().evaluate(n=>n===globalThis.document.activeElement));await page.keyboard.press('Enter');
   assert.equal(await scenes.last().getAttribute('aria-current'),'step');
   assert(await page.locator('.template-review-controls input,.template-review-controls textarea,.template-review-controls button').evaluateAll(nodes=>nodes.every(n=>{const r=n.getBoundingClientRect();return r.left>=-1&&r.right<=globalThis.innerWidth+1;})));
  }
 }

 // Existing i18n markers update the same financial DOM nodes in place.
 await page.evaluate(async()=>{
  globalThis.qaReview?.dispose();const group={orders:0,grossVnd:0,platformFeeVnd:null,creatorVnd:-1200};
  globalThis.qaMain.innerHTML=globalThis.qaCreator.creatorFinancePanel({summary:{live:group,sandbox:group},recent:[{creatorVnd:undefined}]});
  globalThis.qaMoneyNode=globalThis.document.querySelector('.finance-metric strong');await globalThis.qaI18n.selectLocale('vi');
 });
 assert.equal((await page.locator('.finance-metric strong').first().innerText()).replace(/\s/g,''),'0₫');
 await page.evaluate(()=>globalThis.qaI18n.selectLocale('en'));
 assert.equal(await page.locator('.finance-metric strong').first().evaluate(n=>n===globalThis.qaMoneyNode),true);
 assert.equal((await page.locator('.finance-metric strong').first().innerText()).replace(/\s/g,''),'₫0');
 assert.match(await page.locator('.finance-metric strong').nth(1).innerText(),/No data/);
 assert.match(await page.locator('.finance-recent__amount strong').innerText(),/No data/);
 // Feature conditions remain the original email/provider/verified conjunction.
 for(const enabled of [false,true])for(const verified of [false,true])for(const provider of ['email','google']){
  const count=await page.evaluate(({enabled,verified,provider})=>{
   globalThis.qaState.providers.recoveryEmail=enabled;globalThis.qaState.user.emailVerified=verified;globalThis.qaState.user.provider=provider;
   globalThis.qaMain.innerHTML=globalThis.qaViews.dashboard();return globalThis.qaMain.querySelectorAll('a[href="/verify-email"]').length;
  },{enabled,verified,provider});assert.equal(count,Number(enabled&&!verified&&provider==='email'));
 }
 // Long translated labels and doubled text grow by content rather than clipping.
 for(const locale of ['vi','en'])for(const width of [320,390,391,430]){
  await page.setViewportSize({width,height:844});
  await page.evaluate(async locale=>{
   globalThis.qaStudioCleanup?.();globalThis.qaState.user.provider='email';globalThis.qaState.user.emailVerified=false;globalThis.qaState.providers.recoveryEmail=true;
   await globalThis.qaI18n.selectLocale(locale);globalThis.qaMain.innerHTML=globalThis.qaViews.dashboard();
   const {mountStudioSpace}=await import('/js/features/studio/studio-space.js');globalThis.qaStudioCleanup=mountStudioSpace(globalThis.qaMain);
   globalThis.document.querySelectorAll('.studio-space__hero-actions .btn').forEach(n=>{n.textContent=locale==='vi'?'Tiếp tục chỉnh sửa thiết kế dành cho Nguyễn Trần Hoàng Mai Anh':'Continue editing the gift for Nguyễn Trần Hoàng Mai Anh';n.style.fontSize='28px';});
  },locale);
  assert(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.document.documentElement.clientWidth+1));
  const buttons=await page.locator('.studio-space__hero-actions .btn').evaluateAll(nodes=>nodes.map(n=>({height:n.clientHeight,content:n.scrollHeight})));
  assert(buttons.every(n=>n.height>=44&&n.content<=n.height+1),JSON.stringify({width,locale,buttons}));
  const verify=page.locator('a[href="/verify-email"]');await verify.focus();
  assert.equal(await verify.evaluate(n=>globalThis.getComputedStyle(n).outlineStyle),'solid');
 }
 for(const r of results){
  if(r.item==='A1/A3'){assert(contrast(r.color,r.background)>=4.5,JSON.stringify(r));assert(r.buttons.every(b=>b.height>=44&&b.height<=52));}
  if(r.item==='A2'){assert(contrast(r.color,'rgb(255,255,255)')>=4.5,JSON.stringify(r));assert.equal(r.font,'14px');}
  if(r.item==='A4')assert(r.text.every(t=>t.includes('₫')&&!/Free|Miễn phí/.test(t)));
  if(r.client)assert(r.scroll<=r.client+1,JSON.stringify(r));
 }
 await context.close();
 const guest=await browser.newPage({viewport:{width:390,height:844}});
 await guest.goto(fixture.base+'/payment-result/qa-order');await guest.locator('main h2').waitFor();
 results.push({item:'A6',text:await guest.locator('main').innerText(),links:await guest.locator('main a').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent.trim(),href:n.getAttribute('href')})))});
 await guest.screenshot({path:path.join(out,'payment-guest-390.png'),fullPage:true});
 fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify({base:fixture.base,directory:fixture.directory,results},null,2));
 console.log('PASS A1–A5 browser measurements, feature conditions, zero/missing amounts and in-place VI/EN');
 await runPaymentChecks(browser,fixture,out);
}finally{await browser.close();await fixture.close();}


async function runPaymentChecks(browser,fixture,out){
 const user=await fixture.register('Người mua kiểm thử UI');
 const order='qa-order',contextId='qa-context';
 for(const scenario of ['none','saved','wrong-user-key','invalid-context','other-owner','pending','terminal_review','provider_error']){
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),gets=[];
  await page.route('**/api/checkout/payments/orders/'+order+'**',async route=>{
   const suffix=new URL(route.request().url()).pathname.split('/'+order)[1];gets.push(suffix);
   let status=200,body;
   if(scenario==='other-owner'){status=404;body={error:'Không tìm thấy giao dịch.'};}
   else if(suffix==='/design-contexts')body={contexts:[]};
   else if(suffix==='/design-contexts/'+contextId){
    if(scenario==='invalid-context'){status=404;body={error:'Context không hợp lệ.'};}
    else body={context:{designId:'qa-draft',resumePath:'/design/qa-draft',available:true,designRevision:3}};
   }else if(suffix==='/receipt')body={receipt:{receiptNo:'QA-SIMULATED',orderId:order,amountVnd:59000,templateTitle:'Birthday Radiance',provider:'payos',testPayment:true}};
   else if(suffix==='/refund-request')body={request:null};
   else body={payment:{orderId:order,status:['pending','terminal_review','provider_error'].includes(scenario)?scenario:'paid',amountVnd:59000,testPayment:true}};
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto(fixture.base+'/payment-result/'+order);
  await page.locator('[data-action="payment-login"]').waitFor();
  assert.equal(gets.length,0,'Guest must not request private payment data');
  if(['saved','invalid-context','wrong-user-key'].includes(scenario))await page.evaluate(({user,order,contextId,scenario})=>{
   globalThis.sessionStorage.setItem(`momevia:checkout-context:${scenario==='wrong-user-key'?'different-user':user.id}:${order}`,contextId);
   globalThis.sessionStorage.setItem(`momevia:checkout-mode:${user.id}:qa-draft`,'quick');
  },{user:user.user,order,contextId,scenario});
  await page.locator('[data-action="payment-login"]').click();await page.waitForURL('**/login');
  await page.locator('#email-login-form input[name="email"]').fill(user.email);
  await page.locator('#email-login-form input[name="password"]').fill(user.password);
  await page.locator('#email-login-form button[type="submit"]').click();
  await page.waitForURL('**/payment-result/'+order);
  if(scenario==='other-owner'){
   await page.locator('main .empty-state').waitFor();assert.equal(await page.locator('#payment-receipt').count(),0);
  }else{
   await page.locator('.payment-status').waitFor();
   const resume=page.locator('a[href="/design/qa-draft?mode=quick"]');
   assert.equal(await resume.count(),scenario==='saved'?1:0);
   if(['none','wrong-user-key'].includes(scenario))assert(!gets.includes('/design-contexts/'+contextId));
   if(scenario==='invalid-context')assert.match(await page.locator('main').innerText(),/Context không hợp lệ/);
   if(['pending','terminal_review','provider_error'].includes(scenario))assert.equal(await page.locator('.payment-status--success,#payment-receipt').count(),0);
  }
  if(['saved','pending','other-owner'].includes(scenario))await page.screenshot({path:path.join(out,'payment-'+scenario+'-390.png'),fullPage:true});
  console.log('PASS A6 login return '+scenario+' (payment/context responses simulated; real local login)');
  await context.close();
 }
}
