import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { templatePreviewDocument } from '../../web/js/shared/canvas/index.js';
import { EVENT_MEDIA, eventMediaId } from '../../web/js/shared/canvas/event-media.js';
import { serverText } from '../../src/shared/locale.mjs';
import { confirmGiftAccess } from '../../tests/browser/gift-access.mjs';
const base = 'http://127.0.0.1:4178', folder = 'docs/event-cards-expanded';
fs.mkdirSync(folder, { recursive: true });
const ids = ['birthday-radiance','hai-phong-bi','proud-of-you'];
const results = [], errors = [];
const captureOnly = process.argv.includes('--capture-only');
const browser = await chromium.launch({ channel:'msedge',headless:true });
const context = await browser.newContext({ viewport:{width:1440,height:1000},reducedMotion:'reduce' });
const {cookie} = JSON.parse(fs.readFileSync('local/event-cards/session.json'));
await context.addCookies(cookie.split('; ').map(c=>({name:c.split('=')[0],value:c.slice(c.indexOf('=')+1),url:base})));
const page = await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
const api = async (route,body,status=200,language='vi') => {
  const r=await context.request.fetch(base+'/api'+route,{method:body?'POST':'GET',data:body,headers:{'x-momevia-locale':language}});
  const data=await r.json();assert.equal(r.status(),status,JSON.stringify(data));return data;
};
const action = key=>page.locator(`[data-editor-action="${key}"]`),field=key=>page.locator(`[data-editor-field="${key}"]`);
const setLocale = language=>page.evaluate(async language=>(await import('/js/core/i18n.js')).selectLocale(language),language);
try {
  if (!captureOnly) {
  for(const old of JSON.parse(fs.readFileSync('local/event-cards-expanded/v1-records.json'))) {
    assert.deepEqual((await api('/designs/designs/'+old.design.id)).design,old.design);
    assert.deepEqual((await api('/gifts/gifts/'+old.gift.slug)).gift,old.gift);
    const {design}=await api(`/gifts/gifts/mine/${old.gift.slug}/regift`,{mutationId:randomUUID()},201);
    assert.equal(design.document.schemaVersion,1);assert.equal(design.document.scenes.length,3);
    assert(Object.values(design.document.bindings).every(b=>b.value===''));
  }
  results.push({check:'All three previous photographic V1 drafts/gifts remain exact; V1 regift keeps old layout',result:'PASS'});
  for(const [index,id]of ids.entries()) {
    const count=id==='hai-phong-bi'?6:5;
    await page.goto(base+'/template/'+id);await setLocale('vi');
    await page.getByRole('link',{name:'Dùng mẫu',exact:true}).click();await field('binding.message').waitFor();
    const designId=new URL(page.url()).pathname.split('/').at(-1);
    const recipient=id==='hai-phong-bi'?'Nguyễn Hoàng Minh Anh & Trần Phương Thảo Nguyên':'Nguyễn Hoàng Minh Anh';
    const message='Những ngày cố gắng và những lần cùng cười, mình đều muốn giữ lại.\n\n'+ 'Mong bạn có thật nhiều niềm vui và luôn đủ can đảm để đi tiếp con đường mình yêu. '.repeat(7);
    await field('binding.recipientName').fill(recipient);await field('binding.senderName').fill('Trần Khánh An');await field('binding.message').fill(message);
    if(id==='hai-phong-bi')await field('quick-template-text').fill('Một kỷ niệm riêng của hai bạn.\n\nMình vẫn nhớ lần cả nhóm cùng đi xa và cười thật lâu.');
    await field('event-date.countdown').fill('2026-12-31T20:30');await field('event-date.elapsed').fill('2020-06-01T08:00');
    const seed=(await api('/designs/designs/'+designId)).design;
    const album=seed.document.elements.find(e=>e.id==='event-album');
    const preview=EVENT_MEDIA[eventMediaId(['birthday-album','wedding-album','graduation-album'][index])];
    for(const [i,slot]of album.props.photos.entries()) {
      if(i)await page.locator(`.editor-event-photo:has([data-slot="${slot.id}"]) summary`).click();
      const bytes=await sharp(path.join('web/assets/event-cards',preview.file)).resize({width:420+i*20}).modulate({brightness:1-i*.05}).png().toBuffer();
      const uploaded=page.waitForResponse(r=>r.url().endsWith('/assets')&&r.request().method()==='POST');
      await page.locator(`[data-editor-field="event-photo"][data-slot="${slot.id}"]`).setInputFiles({name:`private-${i}.png`,mimeType:'image/png',buffer:bytes});
      assert.equal((await uploaded).status(),201);
      await page.locator(`[data-event-photo-preview="${slot.id}"] img`).waitFor();
      await field('event-caption.'+slot.id).fill(`Kỷ niệm riêng ${i+1}`);await field('event-alt.'+slot.id).fill(`Ảnh người gửi chọn ${i+1}`);
    }
    await action('save').click();await page.locator('.editor-save-status[data-tone="saved"]').waitFor();
    await page.reload();await field('binding.message').waitFor();
    let saved=(await api('/designs/designs/'+designId)).design;
    assert.equal(saved.document.schemaVersion,2);assert.equal(saved.document.scenes.length,count);
    assert.equal(saved.document.elements.find(e=>e.id==='event-album').props.photos.filter(p=>p.assetId).length,3);
    assert.equal(await field('event-date.elapsed').inputValue(),'2020-06-01T08:00');
    assert.equal(await field('event-date.countdown').inputValue(),'2026-12-31T20:30');
    assert.equal(await field('binding.message').inputValue(),message);
    for (const width of [320,390,768,1440]) {
      await page.setViewportSize({width,height:1000});
      assert(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.innerWidth+1),`${id} quick editor ${width}`);
    }
    await action('toggle-mode').click();await page.locator('[data-editor-action="library-tab"][data-tab="layers"]').click();
    const picture=['event-photo-birthday','event-photo-wedding-memory','event-photo-graduation'][index];
    await page.locator(`.editor-layers [data-id="${picture}"]`).click();await page.locator('.editor-geometry summary').click();
    const x=Number(await field('layout.x').inputValue());await field('layout.x').fill(String(x+3));await field('layout.x').dispatchEvent('change');
    await action('save').click();await page.locator('.editor-save-status[data-tone="saved"]').waitFor();
    saved=(await api('/designs/designs/'+designId)).design;assert.equal(saved.document.elements.find(e=>e.id===picture).layout.x,x+3);
    await action('toggle-mode').click();await action('preview').click();await action('preview-send').click();
    await confirmGiftAccess(page,{open:'link',send:'link',read:'link'});await page.waitForURL('**/success/*');
    const slug=new URL(page.url()).pathname.split('/').at(-1),gift=(await api('/gifts/gifts/'+slug)).gift;
    assert.equal(gift.runtimeVersion,2);assert.equal(gift.documentSnapshot.scenes.length,count);
    const clean=(await api(`/gifts/gifts/mine/${slug}/regift`,{mutationId:randomUUID()},201)).design;
    const cleanAlbum=clean.document.elements.find(e=>e.props.kind==='swipe-album');
    assert(cleanAlbum.props.photos.every(p=>p.assetId===null&&!p.alt&&!p.caption));
    assert(clean.document.elements.filter(e=>e.props.kind==='event-countdown').every(e=>e.props.eventAt===null));
    assert.equal(clean.document.assets.length,1);assert(!JSON.stringify(clean).includes('Kỷ niệm riêng'));

    const receiver=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'no-preference'});
    const p=await receiver.newPage();p.on('pageerror',e=>errors.push(e.message));
    await p.goto(base+'/g/'+slug);const stage=p.locator('.gift-runtime-stage');await stage.waitFor();
    const stableScene = async sceneId => {
      const name = gift.documentSnapshot.scenes.find(s=>s.id===sceneId).name;
      await p.waitForFunction(name=>{ const s=globalThis.document.querySelector('.gift-runtime-stage');return s&&!s.inert&&s.getAttribute('aria-label')===name; },name);
    };
    const go=async sceneId=>{
      const at=gift.documentSnapshot.scenes.findIndex(s=>s.id===sceneId);
      await p.locator('.gift-runtime-navigation button').nth(at).click();
      await stableScene(sceneId);
    };
    await go('scene-time');
    for(const key of ['event-countdown','event-elapsed']) assert.match(await stage.locator(`[data-runtime-element="${key}"] .gift-countdown-time`).innerText(),/\d/);
    await go('scene-surprise');
    const typing=stage.locator(`[data-runtime-element="${id==='hai-phong-bi'?'envelope-memory':'text-message'}"]`);
    if(id!=='hai-phong-bi') {
      if(await p.locator('.gift-typewriter-skip').isVisible())await p.locator('.gift-typewriter-skip').click();
      await p.waitForFunction(message=>globalThis.document.querySelector('[data-runtime-element="text-message"]')?.textContent===message,message);
    } else assert(await typing.count());
    if(id==='hai-phong-bi')for(const order of [['open-memory','open-wish'],['open-wish','open-memory']]) {
      await go('scene-cover');
      for(const key of order) {
        await stage.locator(`[data-runtime-element="${key}"]`).focus();await p.keyboard.press(key==='open-wish'?'Space':'Enter');
        await stableScene(key==='open-memory'?'scene-surprise':'scene-message');
        await stage.locator(`[data-runtime-element="${key==='open-memory'?'memory-back':'wish-back'}"]`).click();
        await stableScene('scene-cover');
      }
    }
    await go('scene-album');await p.mouse.move(0,0);
    const image=stage.locator('.gift-interaction-picture img'),first=await image.getAttribute('src');
    await p.waitForFunction(old=>globalThis.document.querySelector('.gift-runtime-stage .gift-interaction-picture img')?.getAttribute('src')!==old,first,{timeout:8000});
    await stage.locator('.gift-album-play').click();assert.equal(await stage.locator('.gift-album-play').getAttribute('aria-pressed'),'false');
    await p.emulateMedia({reducedMotion:'reduce'});const paused=await image.getAttribute('src');
    await p.waitForTimeout(5200);assert.equal(await image.getAttribute('src'),paused);
    await stage.getByRole('button',{name:'Trước',exact:true}).click();
    await go('scene-reply');await stage.locator('textarea').fill('Cảm ơn bạn vì món quà rất vui!');await stage.locator('button[type="submit"]').click();
    await stage.getByText('Đã gửi lời đáp.',{exact:true}).waitFor();
    assert(await p.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.innerWidth+1));
    await receiver.close();results.push({id,result:'PASS',scenes:count,slug,checks:['UI dates and three private photo uploads','save/reload/layout edit','real V2 publication and anonymous reply','both clock modes','typing/skip','autoplay/pause/reduced motion','private photo/date cleaning on regift','wedding branches in both orders']});
  }
  }
  // All scene/language/width combinations use the same renderer as the public gifts.
  for(const language of ['vi','en'])for(const id of ids)for(const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:1800});await page.goto(base+'/template/'+id);
    await page.locator('[data-template-preview]').waitFor();await setLocale(language);
    const doc=templatePreviewDocument({id},key=>serverText(language,key));
    if(width!==390) {
      doc.bindings.recipientName.value=id==='hai-phong-bi'?'Nguyễn Hoàng Minh Anh & Trần Phương Thảo Nguyên':'Nguyễn Hoàng Minh Anh';
      doc.bindings.message.value=(language==='vi'?'Lời chúc dài nhiều đoạn, giữ đủ dấu tiếng Việt và niềm vui.\n\n':'A longer note that celebrates your effort and all the happy days ahead.\n\n').repeat(10);
    }
    await page.evaluate(async doc=>{
      const {mountPlayer}=await import('/js/features/gift-runtime/index.js'),{eventMediaUrl}=await import('/js/shared/canvas/event-media.js');
      globalThis.document.body.classList.add('is-playing-gift');const main=globalThis.document.querySelector('#main');main.replaceChildren();
      globalThis.storyPlayer=mountPlayer(main,{document:doc,assetUrl:eventMediaUrl,mode:'preview'});
    },doc);
    for(const [i,s]of doc.scenes.entries()) {
      await page.evaluate(id=>globalThis.storyPlayer.goToScene(id),s.id);
      assert(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.innerWidth+1),`${id} ${language} ${width} ${s.id}`);
      const collisions=await page.locator('.gift-scene-content > [data-runtime-element]').evaluateAll(nodes=>{
        const list=nodes.filter(n=>n.matches('.gift-runtime-text,.gift-runtime-control,.gift-runtime-reply,.gift-runtime-interaction')).map(n=>({id:n.dataset.runtimeElement,r:n.getBoundingClientRect()}));
        return list.slice(1).flatMap((e,i)=>e.r.top<list[i].r.bottom-1?[[list[i].id,e.id]]:[]);
      });assert.deepEqual(collisions,[],`${id} ${language} ${width} overlap`);
      if(width===390) {
        const stage=page.locator('.gift-runtime-stage');
        await stage.click({position:{x:8,y:8}});
        for(const img of await stage.locator('img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(n=>n.decode());}
        await stage.screenshot({path:`${folder}/${id}-${language}-${i+1}.png`});
      }
    }
  }
  results.push({check:'3 cards × VI/EN × 320/390/768/1440, all 16 scenes, long names and messages',result:'PASS'});
  assert.deepEqual(errors,[]);fs.writeFileSync(`${folder}/${captureOnly ? 'capture-results' : 'browser-results'}.json`,JSON.stringify(results,null,2)+'\n');
  console.log('PASS expanded stories: dates/photos, V2 save/publish/regift, animations/autoplay/reduced motion and all viewport scenes.');
}catch(error){await page.screenshot({path:'local/event-cards-expanded/failure.png',fullPage:true});throw error;}
finally{await browser.close();}
