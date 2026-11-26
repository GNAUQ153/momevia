import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { startSfxFixture } from './sfx-fixture.mjs';
import { loadEnvironment } from '../../src/shared/config.mjs';
import { MusicLibraryService } from '../../src/modules/designs/music-library.service.mjs';
import { exportCanvas, restoreCanvas, verifyCanvas } from '../../scripts/dev/canvas-backup.mjs';
import { runLibraryPanelChecks } from '../browser/library-panels.mjs';
import { createElement } from '../../web/js/shared/canvas/registry.js';

if(process.argv.includes('--mysql-local'))loadEnvironment();
const sql=process.argv.includes('--mysql-local');
const fixture=await startSfxFixture({sql,externalSql:sql,label:sql?'music-mysql':'music-json'});
const {request,base,directory}=fixture,checks=[];
let browser;
async function check(name,work){await work();checks.push({name,result:'PASS'});console.log('PASS '+name);}
async function assertAudioPresentation(page,track){
 const preview=page.locator('.music-admin__preview');
 assert.equal(await preview.locator('a').count(),2,'Preview only links the selected asset license and source');
 assert.deepEqual(await preview.locator('a').evaluateAll(links=>links.map(link=>link.getAttribute('href'))),[track.licenseUrl,track.sourceUrl]);
 assert.equal(await page.locator('.music-admin__sources, .music-admin__providers').count(),0);
 assert(!/Feed Clips|Soundstripe API|Tuned Global|VCPMC|VCRRM/.test(await preview.innerText()));
 const kind=await page.locator('[data-music-admin-filter="kind"]').boundingBox(),status=await page.locator('[data-music-admin-filter="status"]').boundingBox();
 assert(Math.abs(kind.y-status.y)<1,'The kind and status filters share one row');
 assert(kind.x+kind.width<=status.x,'The filters do not overlap');
 assert(kind.height>=44&&status.height>=44,'Compact filters retain touch target height');
}
try {
 const admin=await fixture.register('Music Admin'),sender=await fixture.register('Music Sender');
 await fixture.app.modules.identity.service.users.update(admin.user.id,{role:'admin'});
 const libraryRoute='/designs/admin/music-library',get=()=>request(libraryRoute,{cookie:admin.cookie});
 let library=(await get()).data.audioLibrary;
 await check('100 real catalog entries; anonymous and Sender cannot administer; SQL migration 015 is applied only to QA',async()=>{
  assert.equal(library.items.filter(r=>r.kind==='music').length,50);assert.equal(library.items.filter(r=>r.kind==='sfx').length,50);assert(library.writable);
  assert.equal((await request(libraryRoute)).status,401);assert.equal((await request(libraryRoute,{cookie:sender.cookie})).status,403);
  if(sql){const [[row]]=await fixture.connection.query('SELECT DATABASE() name');assert.match(row.name,/^momevia_canvas_qa_music_/);assert.equal((await fixture.connection.query("SELECT version FROM schema_migrations WHERE version='015_music_library'"))[0].length,1);}
 });
 const track=library.items.find(r=>r.kind==='music');
 const design=(await request('/designs/designs',{cookie:sender.cookie,body:{source:{kind:'blank'},presetId:'envelope-basic',mutationId:randomUUID()}})).data.design;
 const document=structuredClone(design.document);document.schemaVersion=document.registryVersion=2;document.soundtrack={id:track.id,volume:.3};
 document.bindings.recipientName.value='Người nhận';document.bindings.senderName.value='Người gửi';document.bindings.message.value='Chúc bạn một ngày vui và bình yên.';
 let ack=(await request(`/designs/designs/${design.id}/save`,{cookie:sender.cookie,body:{title:design.title,document,expectedRevision:design.revision,mutationId:randomUUID()}}));assert.equal(ack.status,200,JSON.stringify(ack.data));
 const saved=(await request(`/designs/designs/${design.id}`,{cookie:sender.cookie})).data.design;
 const published=await request('/gifts/gifts/from-design',{cookie:sender.cookie,body:{designId:saved.id,expectedRevision:saved.revision,expectedDocumentHash:saved.documentHash,idempotencyKey:randomUUID()}});assert.equal(published.status,201,JSON.stringify(published.data));
 const gift=published.data.gift;
 await check('parallel edits enforce revision; reload retains Admin title, theme, disabled state and immutable source',async()=>{
  const route=libraryRoute+'/'+encodeURIComponent(track.key),body={expectedRevision:0,title:{vi:'Giai điệu của Admin',en:'Admin melody'},theme:'tet',keywords:'quan tri am nhac',status:'disabled'};
  assert.equal((await request(route,{cookie:sender.cookie,body})).status,403);
  assert.equal((await request(route,{cookie:admin.cookie,body:{...body,src:'https://example.test/audio.mp3'}})).status,422);
  const results=await Promise.all([request(route,{cookie:admin.cookie,body}),request(route,{cookie:admin.cookie,body})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  library=(await get()).data.audioLibrary;const item=library.items.find(r=>r.key===track.key);assert.equal(item.title.vi,body.title.vi);assert.equal(item.theme,'tet');assert.equal(item.status,'disabled');assert.equal(item.sha256,track.sha256);
  const reopened=new MusicLibraryService(fixture.app.modules.designs.service.musicLibrary.client,{filepath:path.join(directory,'services/designs/data/music-library.json')});await reopened.ready();const independent=await reopened.list();assert.equal(independent.items.find(r=>r.key===track.key).revision,1);
 });
 await check('disabled selection is rejected for a new draft; old draft and published recipient keep their audio',async()=>{
  const fresh=(await request('/designs/designs',{cookie:sender.cookie,body:{source:{kind:'blank'},mutationId:randomUUID()}})).data.design;
  const changed=structuredClone(fresh.document);changed.schemaVersion=changed.registryVersion=2;changed.soundtrack={id:track.id,volume:.3};
  assert.equal((await request(`/designs/designs/${fresh.id}/save`,{cookie:sender.cookie,body:{title:fresh.title,document:changed,expectedRevision:fresh.revision,mutationId:randomUUID()}})).status,422);
  assert.equal((await request(`/designs/designs/${saved.id}/save`,{cookie:sender.cookie,body:{title:saved.title,document:saved.document,expectedRevision:saved.revision,mutationId:randomUUID()}})).status,200);
  const publicGift=(await request('/gifts/gifts/'+gift.slug)).data.gift;assert.equal(publicGift.documentSnapshot.soundtrack.id,track.id);
  const media=await fetch(base+track.src);assert.equal(media.status,200);assert.equal((await media.arrayBuffer()).byteLength,fs.statSync(path.join(directory,'web',track.src)).size);
 });
 await check('SFX Admin changes reach the picker with the correct group label; disabling preserves the immutable media URL',async()=>{
  const effect=library.items.find(row=>row.kind==='sfx'),route=libraryRoute+'/'+encodeURIComponent(effect.key);
  const body={expectedRevision:0,title:{vi:'Âm giấy của Admin',en:'Admin paper sound'},theme:'gift',keywords:'am giay rieng',status:'active'};
  assert.equal((await request(route,{cookie:admin.cookie,body})).status,200);
  let catalog=(await request('/designs/sfx')).data,entry=catalog.assets.find(row=>row.id===effect.id);assert.equal(entry.name.vi,body.title.vi);assert.equal(entry.group,'gift');assert.equal(entry.groupName.vi,'Hộp và quà');assert.equal(entry.keywords,body.keywords);
  assert.equal((await request(route,{cookie:admin.cookie,body:{expectedRevision:1,status:'disabled'}})).status,200);catalog=(await request('/designs/sfx')).data;assert.equal(catalog.assets.length,49);assert(!catalog.assets.some(row=>row.id===effect.id));assert.equal((await fetch(base+effect.src)).status,200);
  assert.equal((await request(route,{cookie:admin.cookie,body:{expectedRevision:2,status:'active'}})).status,200);
 });
 if(!sql)await check('offline backup/restore includes curation and original byte hashes',async()=>{
  const source=path.join(directory,'services/designs/data'),target=path.join(directory,'music-backup'),restore=path.join(directory,'music-restored');
  exportCanvas({source,target,offline:true});verifyCanvas({source:target});restoreCanvas({source:target,target:restore,offline:true});assert.deepEqual(fs.readFileSync(path.join(restore,'music-library.json')),fs.readFileSync(path.join(source,'music-library.json')));
 });
 if(process.argv.includes('--browser'))await check('real Admin UI: desktop/mobile search, audition, editing, reload, Sender denial and silent initial load',async()=>{
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1365,height:900}});const [name,...value]=admin.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:base}]);
  const page=await context.newPage(),errors=[],audioRequests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/\.(mp3|wav)(\?|$)|\/sfx\/\d+\//.test(r.url()))audioRequests.push(r.url());});
  await page.goto(base+'/admin/music-library');await page.locator('[data-audio-key]').last().waitFor();assert.equal(await page.locator('[data-audio-key]').count(),50);assert.equal(audioRequests.length,0);
  const defaultTrack=(await get()).data.audioLibrary.items.find(row=>row.kind==='music');
  assert.equal(await page.locator('[data-audio-field="vi"]').inputValue(),defaultTrack.title.vi,'The first music entry opens without a click or a write');
  assert.equal(await page.locator(`[data-key="${defaultTrack.key}"]`).getAttribute('aria-pressed'),'true');
  await assertAudioPresentation(page,defaultTrack);
  await page.locator('[data-music-admin-filter="query"]').fill('quan tri am nhac');assert.equal(await page.locator('[data-audio-key]').count(),1);await page.locator('[data-music-admin="edit"]').click();
  await page.locator('[data-audio-field="vi"]').fill('Thư viện đã sửa từ UI');await page.locator('[data-audio-field="status"]').selectOption('active');await page.locator('[data-music-admin-form]').evaluate(form=>form.requestSubmit());await page.getByRole('status').filter({hasText:'Đã lưu vào thư viện'}).waitFor();
  await page.reload();await page.locator('[data-audio-key]').last().waitFor();await page.locator('[data-music-admin-filter="query"]').fill('thu vien da sua');assert.equal(await page.locator('[data-audio-key]').count(),1);
  await page.locator('[data-preview]').click();await page.waitForFunction(()=>globalThis.document.querySelector('[data-preview]')?.getAttribute('aria-pressed')==='true');assert(audioRequests.length>0);await page.locator('[data-preview]').click();
  await page.locator('[data-music-admin="edit"]').click();await page.locator('[data-audio-field="vi"]').fill('Chỉnh sửa chưa lưu');
  page.once('dialog',dialog=>dialog.dismiss());await page.locator('[data-admin-library] > .library-admin__container > .library-admin__back').click();assert.equal(new URL(page.url()).pathname,'/admin/music-library');assert.equal(await page.locator('[data-audio-field="vi"]').inputValue(),'Chỉnh sửa chưa lưu');await page.locator('[data-music-admin="cancel"]').click();
  await page.evaluate(()=>{document.activeElement?.blur();globalThis.scrollTo(0,0);});await page.waitForTimeout(150);
  await page.screenshot({path:path.join(directory,'music-library-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>globalThis.scrollTo(0,0));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));await page.screenshot({path:path.join(directory,'music-library-mobile.png'),fullPage:true});
  await assertAudioPresentation(page,(await get()).data.audioLibrary.items.find(row=>row.key===defaultTrack.key));
  await page.locator('[data-music-admin-filter="query"]').fill('');await page.locator('[data-music-admin-filter="kind"]').selectOption('sfx');assert.equal(await page.locator('[data-audio-key]').count(),50);
  await assertAudioPresentation(page,(await get()).data.audioLibrary.items.find(row=>row.kind==='sfx'));
  assert.deepEqual(errors,[]);await context.close();
  const senderContext=await browser.newContext({viewport:{width:1590,height:924}}),senderCookie=sender.cookie.indexOf('=');
  await senderContext.addCookies([{name:sender.cookie.slice(0,senderCookie),value:sender.cookie.slice(senderCookie+1),url:base}]);
  const freshDraft=(await request('/designs/designs/'+saved.id,{cookie:sender.cookie})).data.design;
  for(let index=0;index<30;index++){const element=createElement('text',{name:'Panel QA '+index,props:{text:'Panel QA '+index}});freshDraft.document.elements.push(element);freshDraft.document.scenes[0].elementIds.push(element.id);}
  assert.equal((await request('/designs/designs/'+saved.id+'/save',{cookie:sender.cookie,body:{title:freshDraft.title,document:freshDraft.document,expectedRevision:freshDraft.revision,mutationId:randomUUID()}})).status,200);
  const studio=await senderContext.newPage();await studio.goto(base+'/design/'+saved.id);await studio.locator('.editor-artboard').waitFor();
  await studio.locator('[data-editor-action="library-tab"][data-tab="layers"]').click();
  // Desktop keeps the tool rail fixed while the selected panel scrolls independently.
  const layerList=studio.locator('.editor-layers'),libraryPanel=studio.locator('#editor-panel-layers');
  await libraryPanel.evaluate(node=>{node.scrollTop=500;});
  const layerId=await layerList.evaluate(node=>{const bounds=node.getBoundingClientRect();const button=[...node.querySelectorAll('button')].find(control=>{const r=control.getBoundingClientRect();return r.top>=bounds.top+5&&r.bottom<bounds.bottom-5;});globalThis.__selectedLayerButton=button;return button.dataset.id;});
  const layerTop=await libraryPanel.evaluate(node=>node.scrollTop);assert(layerTop>0);
  await layerList.locator(`[data-id="${layerId}"]`).click();
  assert(await layerList.locator(`[data-id="${layerId}"]`).evaluate(node=>node===globalThis.__selectedLayerButton),'Designer layer selection must retain its existing button');
  assert(Math.abs((await libraryPanel.evaluate(node=>node.scrollTop))-layerTop)<=1);
  await studio.locator('[data-editor-field="element.name"]').fill('Panel QA renamed without moving the list');
  await studio.locator('[data-editor-field="element.name"]').dispatchEvent('change');
  assert.equal(await layerList.locator(`[data-id="${layerId}"]`).innerText(),'Panel QA renamed without moving the list');
  assert(Math.abs((await libraryPanel.evaluate(node=>node.scrollTop))-layerTop)<=1,'Renaming rebuilds layer labels without moving the inner panel');
  await studio.locator('[data-editor-action="library-tab"][data-tab="content"]').click();
  await studio.locator('.editor-music-card > summary').click();
  async function checkCards(){
    const cards=await studio.locator('.editor-music-grid').evaluate(grid=>[...grid.querySelectorAll('button[data-track-id]')].filter(button=>button.dataset.trackId).map(button=>{
      const bounds=button.getBoundingClientRect();return {height:bounds.height,inside:[...button.children].every(child=>{const b=child.getBoundingClientRect();return b.left>=bounds.left-1&&b.right<=bounds.right+1&&b.top>=bounds.top-1&&b.bottom<=bounds.bottom+1;})};
    }));assert.equal(cards.length,50);assert(cards.every(card=>card.height>=110&&card.inside));
  }
  await checkCards();assert(await studio.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));await studio.locator('.editor-music-grid').evaluate(grid=>grid.scrollIntoView({block:'center'}));
  await studio.locator('.editor-library').screenshot({path:path.join(directory,'studio-music-fixed-desktop.png')});
  await studio.setViewportSize({width:390,height:844});await studio.locator('[data-editor-action="sheet-library"]').click();await studio.locator('[data-editor-action="library-tab"][data-tab="content"]').click();await checkCards();
  await studio.locator('.editor-music-grid').evaluate(grid=>grid.scrollIntoView({block:'center'}));assert(await studio.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));
  await studio.locator('.editor-library').screenshot({path:path.join(directory,'studio-music-fixed-mobile.png')});await senderContext.close();
 });
 if(browser&&sql)await check('independent canvas/audio panels preserve scroll, DOM, drafts and safe audio lifecycle',()=>runLibraryPanelChecks({browser,base,cookie:admin.cookie,directory}));
 fs.writeFileSync(path.join(directory,'music-library-results.json'),JSON.stringify({checks,database:sql?'isolated-existing-local-server':'isolated-json',dockerStarted:false,humanListening:false,physicalDevices:false,browser:browser?.version()},null,2));
 console.log('Evidence '+directory);
}finally{await browser?.close();await fixture.close();}
