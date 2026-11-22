import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
const root=path.resolve('local/interactive-cards-20261122'),out=path.resolve('local/lcp-20261122/loading');fs.mkdirSync(out,{recursive:true});
const {base}=JSON.parse(fs.readFileSync(path.join(root,'final/session.json'))),meta=JSON.parse(fs.readFileSync('web/assets/app/metafile.json'));
const ids=['hai-phong-bi','birthday-radiance','proud-of-you','loi-moi-ben-hien','cuon-phim-ngay-ay','ban-do-ngay-ra-truong'],results=[],errors=[];
const browser=await chromium.launch({channel:'chrome',headless:true});
const props=['display','position','width','height','marginTop','marginBottom','paddingTop','paddingBottom','fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','color','backgroundColor','borderRadius','boxShadow','transform','gap','alignItems','justifyContent','gridTemplateColumns'];
async function snapshot(page){return page.evaluate(properties=>[...globalThis.document.querySelectorAll('body,body *')].filter(n=>!['SCRIPT','LINK','STYLE'].includes(n.tagName)).map(n=>{const s=globalThis.getComputedStyle(n),r=n.getBoundingClientRect();return{tag:n.tagName,id:n.id,styles:Object.fromEntries(properties.map(p=>[p,s[p]])),box:[r.x,r.y,r.width,r.height].map(v=>Math.round(v*100)/100)};}),props);}
try{
 for(const file of ['web/js/shared/canvas/event-recipes.js','web/js/features/gift-runtime/effects.js','web/js/features/gift-runtime/interactions.js','web/js/features/gift-runtime/index.js','web/css/gift-runtime.css']){
  const before=execFileSync('git',['show','7b684e1:'+file]),after=fs.readFileSync(file);assert.equal(before.toString().replaceAll('\r\n','\n'),after.toString().replaceAll('\r\n','\n'));results.push({unchangedSource:file,sha256:createHash('sha256').update(after).digest('hex')});
 }
 for(const [id,media]of Object.entries(JSON.parse(fs.readFileSync('web/assets/event-cards/realistic-v3/manifest.json')))){const bytes=fs.readFileSync('web/assets/event-cards/'+media.file);assert.equal(createHash('sha256').update(bytes).digest('hex'),media.sha256);results.push({unchangedArtwork:id,bytes:bytes.length,sha256:media.sha256});}
 for(const locale of ['vi','en'])for(const width of [320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});await context.addInitScript(l=>globalThis.localStorage.setItem('momevia-locale',l),locale);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  for(const route of ['/explore',...ids.map(id=>'/template/'+id)]){
   const scripts=new Set(),library=[];page.on('request',collect);function collect(r){if(r.resourceType()==='script')scripts.add(new URL(r.url()).pathname);if(new URL(r.url()).pathname==='/api/designs/library')library.push(r.url());}
   await page.goto(base+route);await page.locator('#main h1').waitFor();await page.evaluate(()=>globalThis.document.fonts.ready);await page.evaluate(()=>new Promise(resolve=>globalThis.requestAnimationFrame(()=>globalThis.requestAnimationFrame(resolve))));
   const inputs=[...new Set([...scripts].flatMap(file=>Object.keys(meta.outputs['web'+file]?.inputs||{})))];assert(inputs.length>0);assert(!inputs.some(file=>file.includes('/features/canvas-editor/')||file.endsWith('/pages/designer.js')||file.endsWith('/vendor/qrcode.js')));assert.deepEqual(library,[]);
   const before=await snapshot(page),full=await page.locator('#app-fonts').getAttribute('data-full-css');
   const sheet=await page.addStyleTag({url:base+full});await sheet.evaluate(n=>{n.dataset.fullStylesReady='';});await page.evaluate(()=>globalThis.document.fonts.ready);await page.evaluate(()=>new Promise(resolve=>globalThis.requestAnimationFrame(()=>globalThis.requestAnimationFrame(resolve))));
   const after=await snapshot(page),differences=before.flatMap((b,i)=>JSON.stringify(b)===JSON.stringify(after[i])?[]:[{index:i,before:b,after:after[i]}]);
   if(differences.length)fs.writeFileSync(path.join(out,'style-differences.json'),JSON.stringify({route,locale,width,differences},null,2));
   assert.deepEqual(differences,[],`${route}/${locale}/${width}: Catalog CSS must match complete CSS`);
   if(width===390){await page.screenshot({path:path.join(out,`${route==='/explore'?'catalog':route.split('/').at(-1)}-${locale}.png`)});}
   results.push({route,locale,width,matchedFullStyles:true,startupLogicalInputs:inputs.length,noEditorOrQRAtStartup:true,noLibraryRequestAtStartup:true});page.off('request',collect);
  }
  await context.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto(base+'/explore');await page.locator('#catalog-grid article').first().waitFor();
 assert(await page.locator('img[data-cover-lazy]').count()>0);const last=page.locator('#catalog-grid article').last().locator('img');await last.scrollIntoViewIfNeeded();await last.waitFor();await page.waitForFunction(()=>{const img=globalThis.document.querySelector('#catalog-grid article:last-child img');return img?.complete&&img.naturalWidth>0;});results.push({offscreenCoverLoadedOnScroll:true});
 await page.goto(base+'/template/birthday-radiance');const calls=[];page.on('request',r=>{const p=new URL(r.url()).pathname;if(p==='/api/designs/library'||p.endsWith('/preview'))calls.push(p);});await page.locator('[data-template-preview]').click();await page.locator('.gift-runtime-stage [data-runtime-element="birthday-candle"] button').waitFor();assert.deepEqual(calls,['/api/designs/library/templates/birthday-radiance/preview']);assert(await page.locator('[data-full-styles-ready]').count()>0);await page.locator('[data-runtime-element="birthday-candle"] button').click();await page.locator('.gift-interaction-candle.is-lit').waitFor();await page.keyboard.press('Escape');results.push({previewLazyLoadsFullStylesAndOneDocument:true,photographicCandleWorked:true});
 const gift=JSON.parse(fs.readFileSync(path.join(root,'final/handoff/report.json'))).find(r=>r.slug);const loaded=new Set();page.on('request',r=>{if(r.resourceType()==='script')loaded.add(new URL(r.url()).pathname);});await page.goto(base+'/g/'+gift.slug);await page.locator('.gift-runtime-stage').waitFor();
 const inputFiles=[...new Set([...loaded].flatMap(file=>Object.keys(meta.outputs['web'+file]?.inputs||{})))];assert(!inputFiles.some(file=>file.includes('/features/canvas-editor/')||file.endsWith('/pages/designer.js')));results.push({publicPlayerNoEditorInputs:true,logicalInputs:inputFiles});
 assert.deepEqual(errors,[]);console.log('PASS Chrome: exact Catalog/full-CSS geometry and style parity (56 route/locale/width sets), delayed offscreen artwork, lazy preview styles/single document, unchanged image/motion sources and public player module isolation');
}catch(error){results.push({failure:error.message,stack:error.stack});console.error(error.stack);process.exitCode=1;}
finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({browser:'Chrome',results,errors},null,2)+'\n');}
