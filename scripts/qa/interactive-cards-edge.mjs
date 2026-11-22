import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
const root=path.resolve('local/interactive-cards-20261122'),out=path.join(root,'final/edge');fs.mkdirSync(out,{recursive:true});
const {base,cookie}=JSON.parse(fs.readFileSync(path.join(root,'final/session.json'))),results=[];
const api=async(url,body,expected=200)=>{const r=await fetch(base+'/api'+url,{method:body?'POST':'GET',headers:{cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const v=await r.json();assert.equal(r.status,expected,JSON.stringify(v));return v;};
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'vi-VN',reducedMotion:'no-preference'});
const [name,...parts]=cookie.split('=');await context.addCookies([{name,value:parts.join('='),url:base}]);
await context.addInitScript(()=>{
 globalThis.localStorage.setItem('momevia-locale','vi');globalThis.__motionCalls=[];
 globalThis.__giftTimers=new Set();globalThis.__giftAnimations=new Set();
 const nativeTimeout=globalThis.setTimeout,nativeClear=globalThis.clearTimeout,nativeInterval=globalThis.setInterval,nativeClearInterval=globalThis.clearInterval;
 const owned=()=>new Error().stack.includes('/features/gift-runtime/');
 globalThis.setTimeout=(callback,ms,...args)=>{const mine=owned();if(typeof callback!=='function')return nativeTimeout(callback,ms,...args);let id;id=nativeTimeout(()=>{globalThis.__giftTimers.delete(id);callback(...args);},ms);if(mine)globalThis.__giftTimers.add(id);return id;};
 globalThis.clearTimeout=id=>{globalThis.__giftTimers.delete(id);nativeClear(id);};
 globalThis.setInterval=(callback,ms,...args)=>{const id=nativeInterval(callback,ms,...args);if(owned())globalThis.__giftTimers.add(id);return id;};
 globalThis.clearInterval=id=>{globalThis.__giftTimers.delete(id);nativeClearInterval(id);};
 const animate=globalThis.Element.prototype.animate;globalThis.Element.prototype.animate=function(frames,options){globalThis.__motionCalls.push({id:this.closest('[data-runtime-element]')?.dataset.runtimeElement,effect:this.dataset.giftEffect,frames,options,at:globalThis.performance.now()});const animation=animate.call(this,frames,options);if(owned()){globalThis.__giftAnimations.add(animation);animation.finished.catch(()=>{}).finally(()=>globalThis.__giftAnimations.delete(animation));}return animation;};
});
const page=await context.newPage();
try{
 // Actual Studio inspector: choose, replay on the selected image, off, undo,
 // save and reopen. Public uses the exact pinned document after publication.
 const {design:initial}=await api('/designs/designs',{source:{kind:'template',templateId:'cuon-phim-ngay-ay'},mutationId:randomUUID()},201);
 await page.goto(base+'/design/'+initial.id+'?mode=layout');
 await page.locator('[data-editor-action="library-tab"][data-tab="layers"]').click();
 await page.locator('[data-editor-action="select"][data-id="cover-art"]').click();
 const field=key=>page.locator(`.editor-inspector [data-editor-field="${key}"]`);
 await field('effect.entrance.id').selectOption('photo-settle-v1');await field('effect.entrance.speed').selectOption('normal');await field('effect.entrance.delay').selectOption('150');
 await page.locator('.editor-inspector [data-editor-action="effect-preview"][data-family="entrance"]').click();
 await page.waitForFunction(()=>globalThis.__motionCalls.some(c=>c.effect==='photo-settle-v1'&&c.options.duration===380));
 await page.locator('.editor-preview-dialog').screenshot({path:path.join(out,'recipe-studio-photo.png')});await page.keyboard.press('Escape');await page.waitForFunction(()=>globalThis.__giftTimers.size===0&&globalThis.__giftAnimations.size===0);
 await page.locator('.editor-inspector [data-editor-action="effect-remove"][data-family="entrance"]').click();await page.locator('[data-editor-action="undo"]').click();
 await page.locator('[data-editor-action="save"]').click();await page.locator('.editor-save-status[data-tone="saved"]').waitFor();await page.reload();
 await page.locator('[data-editor-action="library-tab"][data-tab="layers"]').click();await page.locator('[data-editor-action="select"][data-id="cover-art"]').click();assert.equal(await field('effect.entrance.id').inputValue(),'photo-settle-v1');assert.equal(await field('effect.entrance.delay').inputValue(),'150');
 let design=(await api('/designs/designs/'+initial.id)).design;for(const b of Object.values(design.document.bindings))b.value='Nội dung fixture';
 await api(`/designs/designs/${design.id}/save`,{expectedRevision:design.revision,mutationId:randomUUID(),title:design.title,document:design.document});design=(await api('/designs/designs/'+design.id)).design;
 const {gift}=await api('/gifts/gifts/from-design',{designId:design.id,expectedRevision:design.revision,expectedDocumentHash:design.documentHash,idempotencyKey:randomUUID()},201);
 await page.goto(base+'/g/'+gift.slug);await page.waitForFunction(()=>globalThis.__motionCalls.some(c=>c.effect==='photo-settle-v1'&&c.options.duration===380));
 const recipe=await page.evaluate(()=>globalThis.__motionCalls.filter(c=>c.effect==='photo-settle-v1'));assert.equal(recipe.at(-1).options.iterations,1);results.push({recipe:'photo-settle-v1',studio:true,public:true,saveReload:true,calls:recipe});
 // Compare the built-in photo entrance and line-draw; labels stay visible.
 await page.goto(base+'/template/ban-do-ngay-ra-truong');await page.locator('[data-template-preview]').click();await page.locator('[data-scene-id="scene-milestone-1"]').click();await page.waitForFunction(()=>globalThis.__motionCalls.some(c=>c.effect==='E04'));
 assert(await page.getByRole('heading',{name:'Khởi đầu',exact:true}).isVisible());await page.keyboard.press('Escape');await page.waitForFunction(()=>globalThis.__giftTimers.size===0&&globalThis.__giftAnimations.size===0);
 await page.goto(base+'/template/loi-moi-ben-hien');await page.locator('[data-template-preview]').click();await page.waitForFunction(()=>globalThis.__motionCalls.some(c=>c.options.duration===2400));
 const sun=await page.evaluate(()=>globalThis.__motionCalls.filter(c=>c.options.duration===2400));assert(sun.length<=8);await page.waitForTimeout(3000);assert.equal(await page.locator('.gift-ambience').count(),0);results.push({recipe:'porch-sun-v1',definitionCount:8,sparseRenderedCount:sun.length,duration:2400,loop:false,finished:true});
 await page.keyboard.press('Escape');await page.waitForFunction(()=>globalThis.__giftTimers.size===0&&globalThis.__giftAnimations.size===0);
 // Six fast activations must light one flame, no scene jump or reply side effect.
 await page.goto(base+'/template/birthday-radiance');await page.locator('[data-template-preview]').click();const candle=page.locator('[data-runtime-element="birthday-candle"] button');await candle.waitFor();
 const before=await page.evaluate(()=>globalThis.performance.now());for(let i=0;i<6;i++)await candle.click({force:true});
 const candleCalls=await page.evaluate(()=>globalThis.__motionCalls.filter(c=>c.effect==='R04'));assert.equal(candleCalls.length,1);assert(candleCalls[0].at-before<200);
 assert.equal(await page.locator('[data-scene-id="scene-cover"]').getAttribute('aria-current'),'step');assert.equal(await candle.getAttribute('aria-pressed'),'true');
 await page.locator('.template-preview-dialog').screenshot({path:path.join(out,'candle-lit.png')});results.push({candleActivations:6,reactions:1,visibleReactionMs:candleCalls[0].at-before,noSceneJump:true});await page.keyboard.press('Escape');await page.waitForFunction(()=>globalThis.__giftTimers.size===0&&globalThis.__giftAnimations.size===0);
 // Two equal branches, either order, keyboard activation and return paths.
 await page.goto(base+'/template/hai-phong-bi');await page.locator('[data-template-preview]').click();
 for(const order of [['memory','wish'],['wish','memory']])for(const branch of order){await page.locator('.gift-runtime-stage:not([inert])').waitFor();await page.locator(`[data-runtime-element="open-${branch}"]`).press('Enter');await page.locator(`[data-runtime-element="${branch}-back"]`).waitFor();await page.locator('.gift-runtime-stage:not([inert])').waitFor();await page.locator(`[data-runtime-element="${branch}-back"]`).press('Enter');await page.locator('[data-runtime-element="open-memory"]').waitFor();}
 results.push({envelopes:['A→B','B→A'],keyboard:true,returnPaths:true});await page.keyboard.press('Escape');await page.waitForFunction(()=>globalThis.__giftTimers.size===0&&globalThis.__giftAnimations.size===0);
 // The tassel is its own editable vector and the three folds remain keyboard-readable.
 await page.goto(base+'/template/proud-of-you');await page.locator('[data-template-preview]').click();
 await page.waitForFunction(()=>globalThis.__motionCalls.some(c=>c.id==='graduation-tassel'&&c.effect==='hanging-sway-v2'));
 const tasselCalls=await page.evaluate(()=>globalThis.__motionCalls.filter(c=>c.effect==='hanging-sway-v2'));assert(tasselCalls.every(c=>c.id==='graduation-tassel'));
 await page.locator('[data-scene-id="scene-surprise"]').press('Enter');await page.locator('.gift-runtime-stage:not([inert])').waitFor();
 const folds=page.locator('.gift-letter-fold');assert.equal(await folds.count(),3);
 for(let i=0;i<3;i++){const fold=folds.nth(i);if(!await fold.evaluate(n=>n.open))await fold.locator('summary').press('Enter');assert(await fold.locator('p').isVisible());}
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('[data-scene-id="scene-reply"]').press('Enter');await page.locator('.gift-runtime-reply').waitFor();await page.keyboard.press('Escape');await page.waitForFunction(()=>globalThis.__giftTimers.size===0&&globalThis.__giftAnimations.size===0);await page.emulateMedia({reducedMotion:'no-preference'});
 const {design:graduate}=await api('/designs/designs',{source:{kind:'template',templateId:'proud-of-you'},mutationId:randomUUID()},201);
 await page.goto(base+'/design/'+graduate.id+'?mode=layout');await page.locator('[data-editor-action="library-tab"][data-tab="layers"]').click();await page.locator('[data-editor-action="select"][data-id="graduation-tassel"]').click();
 await field('props.color').fill('#AA5744');await page.locator('[data-editor-action="save"]').click();await page.locator('.editor-save-status[data-tone="saved"]').waitFor();
 const moved=(await api('/designs/designs/'+graduate.id)).design.document;assert.equal(moved.elements.find(e=>e.id==='graduation-tassel').props.color.toUpperCase(),'#AA5744');assert.deepEqual(moved.elements.find(e=>e.id==='event-photo-graduation'),graduate.document.elements.find(e=>e.id==='event-photo-graduation'));
 results.push({tasselOnlyAnimation:true,tasselColorEditable:true,capUnchanged:true,foldsReadByKeyboard:3,reducedMotionReplyReachable:true});
 // Trial switches retain data; creation and the existing-draft pilot use UI.
 await page.goto(base+'/template/sunny-wishes');await page.getByRole('button',{name:'Thử đổi bản phối',exact:true}).click();
 const dialog=page.locator('dialog[open]');await dialog.locator('[data-trial-binding="recipientName"]').fill('Tên thử qua hai bản phối');await dialog.locator('[data-trial-binding="senderName"]').fill('Momevia QA');await dialog.locator('[data-trial-binding="message"]').fill('Lời nhắn được giữ nguyên khi thử đổi.');
 const target=dialog.locator('select');await target.selectOption('confetti');await target.selectOption('sunny-wishes');assert.equal(await dialog.locator('[data-trial-binding="recipientName"]').inputValue(),'Tên thử qua hai bản phối');
 await dialog.getByRole('button',{name:'Tạo bản mới độc lập',exact:true}).click();await page.locator('[data-editor-field="binding.recipientName"]').waitFor();assert.equal(await page.locator('[data-editor-field="binding.recipientName"]').inputValue(),'Tên thử qua hai bản phối');
 const sourcePath=new URL(page.url()).pathname;await page.getByRole('button',{name:'Tạo bản mới theo mẫu này',exact:true}).click();await page.locator('dialog[open] .gift-runtime-stage').waitFor();await page.locator('dialog[open]').getByRole('button',{name:'Tạo bản mới độc lập',exact:true}).click();await page.getByRole('button',{name:'Về bản nháp gốc',exact:true}).waitFor();assert.notEqual(new URL(page.url()).pathname,sourcePath);await page.getByRole('button',{name:'Về bản nháp gốc',exact:true}).click();await page.waitForURL(base+sourcePath+'?mode=quick');
 results.push({trialSwitchRoundTrip:true,independentDraftViaUi:true,returnedToOriginal:true});
 // Empty, one-photo and three-photo albums: caption and focal-point payloads
 // survive save; a failed image request never hides navigation or story text.
 const uploadBytes=fs.readFileSync('web/assets/event-cards/originals-v2/porch-d9ae45b9952f.webp');
 const {design:film}=await api('/designs/designs',{source:{kind:'template',templateId:'cuon-phim-ngay-ay'},mutationId:randomUUID()},201);
 const response=await fetch(`${base}/api/designs/designs/${film.id}/assets`,{method:'POST',headers:{cookie,'content-type':'image/webp','x-mutation-id':randomUUID()},body:uploadBytes});assert.equal(response.status,201);const asset=(await response.json()).asset;
 let current=film;
 for(const count of [0,1,3]){
  const d=structuredClone(current.document),album=d.elements.find(e=>e.id==='event-album');d.assets=d.assets.filter(a=>a.assetId!==asset.id);if(count)d.assets.push({assetId:asset.id,kind:'image'});
  for(const [i,p]of album.props.photos.entries())Object.assign(p,{assetId:i<count?asset.id:null,caption:'Một chú thích rất dài. '.repeat(200).slice(0,4000),alt:'Ảnh thử',focalPoint:{x:i/3,y:.8}});
  await api(`/designs/designs/${film.id}/save`,{expectedRevision:current.revision,mutationId:randomUUID(),title:film.title,document:d});current=(await api('/designs/designs/'+film.id)).design;
  await page.goto(base+'/design/'+film.id+'?mode=quick');await page.locator('[data-editor-action="preview"]').click();await page.locator('[data-scene-id="scene-album"]').click();assert(await page.locator('[data-runtime-element="album-story"]').isVisible());
  if(count){await page.locator('.gift-album-frame figcaption').waitFor();assert.match(await page.locator('.gift-album-frame figcaption').innerText(),/rất dài/);}
  await page.keyboard.press('Escape');await page.waitForFunction(()=>globalThis.__giftTimers.size===0&&globalThis.__giftAnimations.size===0);
 }
 const beforeReplacement=structuredClone(current.document.elements.find(e=>e.id==='event-album').props.photos);
 const portrait=await sharp({create:{width:32,height:96,channels:3,background:'#DEA99C'}}).png().toBuffer();
 await page.goto(base+'/design/'+film.id+'?mode=quick');
 await page.locator('[data-editor-field="event-photo"][data-slot="event-photo-slot-2"]').setInputFiles({name:'synthetic-portrait.png',mimeType:'image/png',buffer:portrait});
 await page.waitForFunction(()=>/Đã lưu/.test(globalThis.document.querySelector('.editor-save-status')?.textContent||''));await page.locator('[data-editor-action="save"]').click();
 const afterReplacement=(await api('/designs/designs/'+film.id)).design.document.elements.find(e=>e.id==='event-album').props.photos;
 assert.deepEqual(afterReplacement[1].focalPoint,{x:.5,y:.5});assert.deepEqual(afterReplacement[0],beforeReplacement[0]);assert.deepEqual(afterReplacement[2],beforeReplacement[2]);assert.equal(afterReplacement[1].caption,beforeReplacement[1].caption);
 results.push({filmPhotoCounts:[0,1,3],captionCharacters:4000,replacementSlot:2,onlyReplacedFocalPointReset:true,otherSlotsUnchanged:true});
 await page.setViewportSize({width:320,height:900});await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/assets/*',route=>route.abort());await page.goto(base+'/design/'+film.id+'?mode=quick');await page.locator('[data-editor-action="preview"]').click();await page.locator('[data-scene-id="scene-album"]').click();assert(await page.locator('[data-runtime-element="album-story"]').isVisible());assert(await page.locator('[data-runtime-element="album-next"]').isVisible());const bounds=await page.locator('.gift-album-frame figcaption').evaluate(n=>{const a=n.getBoundingClientRect(),s=n.closest('.gift-runtime-stage').getBoundingClientRect();return{left:a.left,right:a.right,stageLeft:s.left,stageRight:s.right};});assert(bounds.left>=bounds.stageLeft-1&&bounds.right<=bounds.stageRight+1,JSON.stringify({captionBounds:bounds}));await page.locator('.editor-preview-dialog').screenshot({path:path.join(out,'album-broken-320.png')});
 await page.keyboard.press('Escape');await page.waitForFunction(()=>globalThis.__giftTimers.size===0&&globalThis.__giftAnimations.size===0);results.push({brokenPhotos:true,readableStory:true,workingContinue:true});
 let publishedFilm=(await api('/designs/designs/'+film.id)).design;for(const b of Object.values(publishedFilm.document.bindings))b.value='Long caption fixture';
 await api(`/designs/designs/${film.id}/save`,{expectedRevision:publishedFilm.revision,mutationId:randomUUID(),title:publishedFilm.title,document:publishedFilm.document});publishedFilm=(await api('/designs/designs/'+film.id)).design;
 const {gift:longGift}=await api('/gifts/gifts/from-design',{designId:film.id,expectedRevision:publishedFilm.revision,expectedDocumentHash:publishedFilm.documentHash,idempotencyKey:randomUUID()},201);
 await page.goto(base+'/g/'+longGift.slug);await page.locator('[data-scene-id="scene-album"]').click();await page.locator('.gift-album-frame figcaption').waitFor();await page.evaluate(()=>{globalThis.document.body.style.zoom='2';});await page.evaluate(()=>new Promise(resolve=>globalThis.requestAnimationFrame(()=>globalThis.requestAnimationFrame(resolve))));
 const zoomBounds=await page.locator('.gift-album-frame figcaption').evaluate(n=>{const c=n.getBoundingClientRect(),s=n.closest('.gift-runtime-stage').getBoundingClientRect();return{left:c.left,right:c.right,stageLeft:s.left,stageRight:s.right};});assert(zoomBounds.left>=zoomBounds.stageLeft-1&&zoomBounds.right<=zoomBounds.stageRight+1,JSON.stringify(zoomBounds));results.push({longCaptionCharacters:4000,boundsAt320:bounds,boundsAtCssZoom200:zoomBounds});

 results.push({afterClose:{runtimeTimers:0,waapiAnimations:0},measurement:'tracked timeout/interval and WAAPI lifecycle after every modal close'});
 console.log('PASS Studio recipes, public recipe, E04, particle cleanup, repeated candle, both envelope orders, UI trial/restyle, and 0/1/3 photos');
}catch(error){results.push({failure:error.message,stack:error.stack});process.exitCode=1;console.error(error.stack);}
finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(results,null,2));}
