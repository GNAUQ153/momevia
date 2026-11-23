import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {SOUNDTRACKS} from '../../web/js/shared/canvas/soundtracks.js';
import {confirmGiftAccess} from './gift-access.mjs';

export async function verifyRecordedMusic({fixture,context,browser,design,check}){
 const page=await context.newPage(),errors=[],requests=[],decoded=[];
 const {base,directory}=fixture;let publicContext;
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.addInitScript(()=>{globalThis.__musicPlayed=[];const play=globalThis.HTMLMediaElement.prototype.play;globalThis.HTMLMediaElement.prototype.play=function(...args){globalThis.__musicPlayed.push(this);return play.apply(this,args);};});
 const control=name=>page.locator(`[data-editor-action="${name}"]`);
 try{
  await check('fifty external instrumental/vocal tracks decode/play in Studio; filters, credits, save and reload preserve selection',async()=>{
   await page.goto(base+'/design/'+design.id);await page.locator('.editor-artboard').waitFor();await page.locator('[data-editor-action="library-tab"][data-tab="content"]').click();
   assert.equal(await page.locator('.editor-music-track[data-track-id]:not([data-track-id=""])').count(),50);assert.equal(requests.filter(u=>u.includes('/assets/music/v2/')).length,0);
   const layout=await page.locator('.editor-music-grid').evaluate(grid=>[...grid.querySelectorAll('[data-track-id]')].filter(button=>button.dataset.trackId).map(button=>{
    const bounds=button.getBoundingClientRect(),children=[...button.children].map(child=>child.getBoundingClientRect());
    return {id:button.dataset.trackId,height:bounds.height,inside:children.every(child=>child.left>=bounds.left-1&&child.right<=bounds.right+1&&child.top>=bounds.top-1&&child.bottom<=bounds.bottom+1)};
   }));assert(layout.every(row=>row.height>=110&&row.inside),JSON.stringify(layout.filter(row=>row.height<110||!row.inside)));
   await page.locator('[data-editor-music-occasion]').selectOption('christmas');assert.equal(await page.locator('.editor-music-track[data-track-id]:visible:not([data-track-id=""])').count(),4);await page.locator('[data-editor-music-occasion]').selectOption('all');
   await page.locator('[data-editor-music-market]').selectOption('korea');assert.equal(await page.locator('.editor-music-track[data-track-id]:visible:not([data-track-id=""])').count(),6);await page.locator('[data-editor-music-market]').selectOption('all');
   await page.locator('[data-editor-music-vocals]').selectOption('vocal');assert.equal(await page.locator('.editor-music-track[data-track-id]:visible:not([data-track-id=""])').count(),1);await page.locator('[data-editor-music-vocals]').selectOption('all');
   const choice=page.locator('[data-editor-field="soundtrack"]');
   for(const track of SOUNDTRACKS){
    await choice.selectOption(track.id);await page.locator('[data-music-source]').getByText(track.artist,{exact:false}).waitFor();
    assert.equal(await page.locator('[data-music-source] a').getAttribute('href'),track.sourceUrl);
    await control('soundtrack-preview').click();await page.waitForFunction(src=>globalThis.__musicPlayed.some(a=>a.currentSrc.endsWith(src)&&!a.paused&&a.currentTime>0),track.src);await control('soundtrack-preview').click();
    decoded.push(await page.evaluate(async({src,expected})=>{const c=new globalThis.AudioContext({sampleRate:44100});try{const r=await fetch(src),buffer=await c.decodeAudioData(await r.arrayBuffer());return {src,status:r.status,type:r.headers.get('content-type'),duration:buffer.duration,expected,channels:buffer.numberOfChannels};}finally{await c.close();}},{src:track.src,expected:track.durationSeconds}));
   }
   for(const result of decoded){assert.equal(result.status,200);assert(result.type.startsWith('audio/mpeg'));assert(Math.abs(result.duration-result.expected)<.15);assert(result.channels>0);}
   const selected=SOUNDTRACKS.find(t=>t.occasion==='christmas');await choice.selectOption(selected.id);await page.locator('[data-editor-field="soundtrack-volume"]').fill('30');await control('save').click();await page.locator('.editor-save-status').filter({hasText:'Đã lưu'}).waitFor();await page.reload();await page.locator('.editor-artboard').waitFor();await page.locator('[data-editor-action="library-tab"][data-tab="content"]').click();assert.equal(await choice.inputValue(),selected.id);assert.equal(await page.locator('[data-editor-field="soundtrack-volume"]').inputValue(),'30');
   await page.locator('.editor-music-card').screenshot({path:path.join(directory,'external-music-studio.png')});
  });
  await check('external music survives sender preview and UI publication; guest starts silent and credits/volume/disposal work',async()=>{
   await control('preview').click();const preview=page.locator('.editor-preview-player');await preview.locator('.gift-music-credit').waitFor();const music=preview.locator('.gift-soundtrack-button');assert.equal(await music.getAttribute('aria-pressed'),'false');await music.click();await page.waitForFunction(()=>globalThis.document.querySelector('.editor-preview-player .gift-soundtrack-button')?.getAttribute('aria-pressed')==='true');await control('preview-close').click();
   const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/gifts/gifts/from-design')&&r.request().method()==='POST');await control('publish').click();await confirmGiftAccess(page);const response=await responsePromise;assert.equal(response.status(),201,await response.text());const {gift}=await response.json();
   publicContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const guest=await publicContext.newPage(),network=[];guest.on('request',r=>network.push(r.url()));await guest.addInitScript(()=>{globalThis.__guestMusic=[];const play=globalThis.HTMLMediaElement.prototype.play;globalThis.HTMLMediaElement.prototype.play=function(...args){globalThis.__guestMusic.push(this);return play.apply(this,args);};});await guest.goto(base+'/g/'+gift.slug);await guest.locator('.gift-soundtrack-button').waitFor();assert.equal(network.filter(u=>u.includes('/assets/music/')).length,0);assert.equal(await guest.locator('.gift-soundtrack-button').getAttribute('aria-pressed'),'false');await guest.locator('.gift-music-credit').getByText('Emma_MA',{exact:false}).waitFor();await guest.locator('.gift-soundtrack-button').tap();await guest.waitForFunction(()=>globalThis.__guestMusic.some(a=>!a.paused&&a.currentTime>0));assert.equal(await guest.evaluate(()=>globalThis.__guestMusic[0].volume),.3);
   const original=(await (await fetch(base+'/api/gifts/gifts/'+gift.slug)).json()).gift.documentSnapshot.soundtrack;assert.equal(original.id,'music-wintery');assert.equal(original.volume,.3);await guest.locator('.gift-soundtrack-volume').press('Home');assert.equal(await guest.evaluate(()=>globalThis.__guestMusic[0].volume),0);assert.equal((await (await fetch(base+'/api/gifts/gifts/'+gift.slug)).json()).gift.documentSnapshot.soundtrack.volume,.3);
   assert(await guest.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.document.documentElement.clientWidth+1),'Music credits must not widen the mobile page');await guest.screenshot({path:path.join(directory,'external-music-recipient.png'),fullPage:true});assert(!network.some(u=>u.startsWith('https://opengameart.org')));await guest.locator('.recipient-viral__actions a[href="/explore"][data-link]').click();await guest.locator('#main h1').first().waitFor();assert(await guest.evaluate(()=>globalThis.__guestMusic.every(a=>a.paused&&!a.getAttribute('src'))));
  });
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(directory,'external-music-results.json'),JSON.stringify({browser:browser.version(),decoded,humanListening:false,physicalDevices:false,errors},null,2));
 }finally{await publicContext?.close();await page.close();}
}
