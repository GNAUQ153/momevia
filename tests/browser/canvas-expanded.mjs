import assert from 'node:assert/strict';
import path from 'node:path';
import { chromium } from 'playwright';
import { catalog } from '../../web/js/features/canvas-editor/library.js';
import { effectFamilies } from '../../web/js/shared/canvas/effects.js';
import { syntheticPhoto } from '../integration/canvas-expanded.mjs';

const exact = { exact:true };
const effectCard = {E03:'heading', E04:'wave-line', A02:'arch-photo', A04:'heading',
  R01:'envelope', R02:'gift-box', R03:'continue', R04:'light-a-candle'};
const routes = (context,base) => context.route('**/*',route=>new URL(route.request().url()).origin===base ? route.continue() : route.abort());

export async function runExpandedBrowser(base, cookie, {cards, controls}, artifacts) {
  const browser = await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || (process.platform==='win32'?'msedge':undefined)});
  const desktop = await browser.newContext({viewport:{width:1440,height:1000}});
  const mobile = await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  const errors = [];
  const csp = [];
  const shot = async (page,name) => { if (artifacts) await page.screenshot({path:path.join(artifacts,name)}); };
  async function pageFor(context) {
    await routes(context,base);
    const page = await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(() => {
      globalThis.canvasQaCsp=[];
      globalThis.document.addEventListener('securitypolicyviolation', event => globalThis.canvasQaCsp.push(event.violatedDirective));
      globalThis.canvasQaEffects=[];
      const logEffect = node => {
        if (node.nodeType !== 1) return;
        if (node.dataset.giftEffect) globalThis.canvasQaEffects.push(node.dataset.giftEffect);
        for (const child of node.querySelectorAll('[data-gift-effect]')) globalThis.canvasQaEffects.push(child.dataset.giftEffect);
      };
      new globalThis.MutationObserver(records => {
        for (const record of records) {
          if (record.type==='attributes') {
            if (record.oldValue) globalThis.canvasQaEffects.push(record.oldValue);
            logEffect(record.target);
          } else for (const node of record.addedNodes) logEffect(node);
        }
      }).observe(globalThis.document,{childList:true,subtree:true,attributes:true,attributeOldValue:true,attributeFilter:['data-gift-effect']});
      globalThis.canvasQaTimers=new Set();
      const {setInterval,clearInterval}=globalThis;
      globalThis.setInterval=(callback,ms,...args)=>{
        const id=setInterval(callback,ms,...args);
        if (ms===1000) globalThis.canvasQaTimers.add(id);
        return id;
      };
      globalThis.clearInterval=id=>{
        globalThis.canvasQaTimers.delete(id);
        clearInterval(id);
      };
    });
    return page;
  }
  try {
    const separator=cookie.indexOf('=');
    const {value:session,name}={name:cookie.slice(0,separator),value:cookie.slice(separator+1)};
    await desktop.addCookies([{name,value:session,url:base}]);
    const page = await pageFor(desktop);
    const control = action => page.locator(`[data-editor-action="${action}"]`);
    const field = key => page.locator(`.editor-inspector [data-editor-field="${key}"]`);
    const addTab = control('library-tab').filter({hasText:'Thêm'});
    const stage = page.locator('.editor-artboard');
    const active = () => stage.locator('.editor-stage-element');
    const dialog = page.getByRole('dialog',{name:'Xem trước món quà'});
    const close = () => dialog.locator('[data-editor-action="preview-close"]').click();
    const save = async () => { await control('save').click(); await page.locator('.editor-save-status').filter({hasText:'Đã lưu'}).waitFor(); };
    const draft = async () => {
      const id = new URL(page.url()).pathname.split('/').at(-1);
      const response = await page.request.get(`${base}/api/designs/designs/${id}`);
      assert.equal(response.status(),200);
      return (await response.json()).design.document;
    };

    await page.goto(base+'/design/new');
    await control('create-blank').click();
    await addTab.click();
    assert.equal(await page.locator('[data-block]:visible').count(),100);
    await shot(page,'library-1440.png');
    const search = page.locator('[data-block-search]');
    await search.fill('con dau');
    assert.deepEqual(await page.locator('[data-block]:visible').evaluateAll(nodes=>nodes.map(node=>node.dataset.block)),['wax-seal']);
    await search.fill('từ khóa không tồn tại');
    await control('clear-block-search').click();
    for (const [i,group] of catalog.entries()) {
      await page.locator('[data-block-group-select]').selectOption(String(i));
      assert.equal(await page.locator('[data-block]:visible').count(),group.items.length);
      for (const item of group.items) {
        const card = page.locator(`[data-block="${item.id}"]`);
        await card.scrollIntoViewIfNeeded();
        await card.locator('.editor-thumbnail-surface > *').first().waitFor();
        await card.click();
        assert.equal(await active().count(),item.create().length,item.id);
        await control('undo').click();
        assert.equal(await active().count(),0,item.id);
        assert.equal(await page.locator('[data-block-group-select]').inputValue(),String(i));
      }
    }
    await page.locator('[data-block-group-select]').selectOption('');
    if (artifacts) {
      await page.evaluate(() => {
        const doc = globalThis.document;
        const contact = doc.createElement('section');
        contact.id = 'canvas-contact-sheet';
        Object.assign(contact.style,{background:'#fffaf4',color:'#32243b',position:'absolute',inset:'0 auto auto 0',
          width:'1344px',padding:'24px',zIndex:'9999',display:'grid',gap:'12px'});
        for (const section of doc.querySelectorAll('.editor-block-group')) {
          const clone = section.cloneNode(true);
          clone.hidden = false;
          const grid = clone.querySelector('.editor-block-grid');
          grid.style.gridTemplateColumns='repeat(12,minmax(0,1fr))';
          for (const button of grid.children) {
            button.hidden=false;
            Object.assign(button.style,{display:'grid',justifyItems:'center',gridTemplateRows:'48px auto',
              border:'1px solid #decce3',borderRadius:'6px',color:'#32243b',background:'#fff',padding:'5px',
              fontSize:'12px',lineHeight:'1.25',minHeight:'80px'});
          }
          contact.append(clone);
        }
        doc.body.append(contact);
      });
      await page.locator('#canvas-contact-sheet').screenshot({path:path.join(artifacts,'library-contact-sheet.png')});
      await page.locator('#canvas-contact-sheet').evaluate(node=>node.remove());
    }
    await save();
    console.log('PASS Browser 100/100 thẻ có thumbnail, chèn được và undo đúng một bước');

    const familiesCaptured = new Set();
    for (const [family,{presets}] of Object.entries(effectFamilies)) {
      for (const id of Object.keys(presets)) {
        const scene = ['transition','ambience'].includes(family);
        if (!scene) await page.locator(`[data-block="${effectCard[id] || 'rectangle'}"]`).click();
        else await control('scene-select').first().click();
        const choice = field(`effect.${family}.id`);
        await choice.selectOption(id);
        if (family !== 'surface') await field(`effect.${family}.speed`).selectOption('slow');
        await save();
        const document = await draft();
        const model = scene ? document.scenes[0] : document.elements.at(-1);
        assert.equal(model.effects[family].id,id);
        const preview = page.locator(`[data-editor-action="effect-preview"][data-family="${family}"]`);
        const captures = !familiesCaptured.has(family);
        if (captures) await shot(page,`effect-${family}-before.png`);
        await page.evaluate(()=>{globalThis.canvasQaEffects=[];});
        await preview.click();
        const rendered = family==='surface' ? `[data-gift-surface="${id}"]` :
          id==='R04' ? '.gift-interaction-candle.is-lit' : id==='E03' ? '.gift-typewriter-skip' : `[data-gift-effect="${id}"]`;
        if (family === 'surface' || captures) await dialog.locator(rendered).first().waitFor();
        else await page.waitForFunction(code=>globalThis.canvasQaEffects.includes(code),id);
        if (captures) {
          await shot(page,`effect-${family}-playing.png`);
          if (family!=='surface' && id!=='R04') await dialog.locator(rendered).first().waitFor({state:'detached'});
          await shot(page,`effect-${family}-ended.png`);
          await page.setViewportSize({width:390,height:844});
          await shot(page,`effect-${family}-390-before.png`);
          await dialog.locator('[data-editor-action="preview-reset"]').click();
          await dialog.locator(rendered).first().waitFor();
          await shot(page,`effect-${family}-390-playing.png`);
          if (family!=='surface' && id!=='R04') await dialog.locator(rendered).first().waitFor({state:'detached'});
          await shot(page,`effect-${family}-390-ended.png`);
          await page.setViewportSize({width:1440,height:1000});
          familiesCaptured.add(family);
        }
        await close();
        assert(await preview.evaluate(el=>el===document.activeElement),id);
        await choice.selectOption('');
        if (!scene) await control('element-delete').click();
      }
    }
    await save();
    console.log('PASS Browser 24 hiệu ứng cấu hình, lưu, Xem thử và Tắt');

    await page.locator('[data-block="arch-photo"]').click();
    const image = stage.locator('.gift-runtime-photo');
    const [archAsset] = await Promise.all([
      page.waitForResponse(response => response.url().endsWith('/assets') && response.status()===201),
      field('upload').setInputFiles({name:'arch.png',mimeType:'image/png',buffer:await syntheticPhoto(1)}),
    ]);
    const archId = (await archAsset.json()).asset.id;
    await image.locator('img').waitFor();
    await field('accessibility.alt').fill('Ảnh vòm màu xanh');
    await field('props.caption').fill('Chú thích vòm độc lập');
    await field('crop.x').fill('22');
    await field('crop.x').press('Tab');
    await control('element-duplicate').click();
    await save();
    let doc = await draft();
    const arch = doc.elements.filter(element=>element.type==='image');
    assert.equal(arch.length,2);
    assert.notEqual(arch[0].id,arch[1].id);
    assert.deepEqual(arch[0].props,arch[1].props);
    assert.equal(arch[0].props.assetId,archId);
    assert.equal(arch[0].props.focalPoint.x,.22);
    assert.equal(arch[0].props.caption,'Chú thích vòm độc lập');
    await page.reload();
    await image.nth(1).getByAltText('Ảnh vòm màu xanh').waitFor();

    await page.goto(`${base}/design/${controls.draftId}`);
    await control('scene-select').filter({hasText:'Album vuốt ngang'}).click();
    await stage.locator('.gift-runtime-swipe-album').click({position:{x:11,y:11}});
    const previous = (await draft()).elements.find(element=>element.props.kind==='swipe-album');
    const [upload] = await Promise.all([
      page.waitForResponse(response => response.url().endsWith('/assets') && response.status()===201),
      page.locator('[data-editor-field="upload"][data-slot="photo-1"]')
        .setInputFiles({name:'slot.png',mimeType:'image/png',buffer:await syntheticPhoto(2)}),
    ]);
    const assetId = (await upload.json()).asset.id;
    await field('slot.photo-1.alt').fill('Ảnh thay thế riêng cho ô đầu');
    await field('slot.photo-1.caption').fill('Chú thích ô đầu sau thay');
    await field('slot.photo-1.x').fill('27');
    await field('slot.photo-1.x').press('Tab');
    await control('element-duplicate').click();
    await save();
    doc = await draft();
    const albums = doc.elements.filter(element=>element.props.kind==='swipe-album');
    assert.equal(albums.length,2);
    assert.notEqual(albums[0].id,albums[1].id);
    assert.deepEqual(albums[0].props.photos,albums[1].props.photos);
    const [changed,other] = albums[0].props.photos;
    assert.deepEqual(changed,{id:'photo-1',assetId,alt:'Ảnh thay thế riêng cho ô đầu',caption:'Chú thích ô đầu sau thay',focalPoint:{x:.27,y:.29}});
    assert.deepEqual(other,previous.props.photos[1]);
    await control('undo').click();
    await save();
    await page.reload();
    assert.deepEqual((await draft()).elements.find(element=>element.id===previous.id).props.photos[0],changed);
    console.log('PASS Browser ảnh vòm và album: tải/thay, crop, alt, chú thích, nhân bản, undo và lưu lại');

    await control('preview').click();
    await dialog.locator('.gift-runtime-flip-card').getByRole('button',{name:'Lật thẻ'}).press('Space');
    await dialog.getByText('Mình nhớ những buổi chiều nghe bạn kể chuyện.').waitFor();
    await close();

    const guest = await pageFor(mobile);
    const nav = n => guest.locator('.gift-runtime-navigation button').nth(n-1);
    const stagePublic = guest.locator('.gift-runtime-stage');
    await guest.goto(`${base}/g/${controls.slug}`);
    const flip = stagePublic.getByRole('button',{name:'Lật thẻ'});
    await flip.tap();
    assert.equal(await flip.getAttribute('aria-pressed'),'true');
    await nav(2).tap();
    await stagePublic.getByRole('button',{name:'Mở ngay',...exact}).press('Enter');
    await stagePublic.getByText('Hẹn nhau ở quán nhỏ cuối phố nhé!').waitFor();
    await nav(3).tap();
    const fold = stagePublic.getByText('Điều mình muốn nói',exact);
    await fold.press('Enter');
    await stagePublic.getByText('Cảm ơn vì bạn luôn dành thời gian.').waitFor();
    await fold.tap();
    assert(!await stagePublic.getByText('Cảm ơn vì bạn luôn dành thời gian.').isVisible());
    await nav(4).tap();
    const picture = stagePublic.locator('.gift-interaction-picture');
    await picture.getByAltText('Ảnh QA 1').waitFor();
    await picture.scrollIntoViewIfNeeded();
    const cdp = await mobile.newCDPSession(guest);
    const box = await picture.boundingBox();
    const startX = box.x + box.width*.8, endX = box.x+box.width*.15, y = box.y+box.height*.5;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:startX,y}]});
    for (let step=1;step<=4;step++)
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:startX+(endX-startX)*step/4,y}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await stagePublic.getByText('Ảnh 2/2',exact).waitFor();
    await stagePublic.getByRole('button',{name:'Trước',...exact}).press('Enter');
    await stagePublic.getByText('Ảnh 1/2',exact).waitFor();
    await stagePublic.getByRole('button',{name:'Sau',...exact}).tap();
    await stagePublic.getByText('Ảnh 2/2',exact).waitFor();
    await nav(5).tap();
    const slider=stagePublic.getByRole('slider');
    await slider.press('ArrowRight');
    assert.equal(await slider.inputValue(),'51');
    await slider.tap({position:{x:30,y:10}});
    assert(Number(await slider.inputValue())<51);
    await nav(6).tap();
    await stagePublic.getByRole('button',{name:'Một ngày mưa'}).press('Enter');
    await stagePublic.getByRole('button',{name:'Bình yên'}).tap();
    await stagePublic.getByText('Chúc bạn mỗi ngày có chút thời gian cho mình.').waitFor();
    await stagePublic.getByRole('button',{name:'Niềm vui'}).press('Space');
    await stagePublic.getByText('Chúc bạn có nhiều điều nhỏ để mỉm cười.').waitFor();
    await nav(6).tap();
    await stagePublic.getByRole('button',{name:'Một ngày nắng'}).tap();
    await stagePublic.getByRole('button',{name:'Thắp nến'}).press('Space');
    await stagePublic.getByText('Chúc điều bạn ước sẽ thành hiện thực.').waitFor();
    await nav(9).tap();
    await stagePublic.getByRole('button',{name:'Mảnh 1'}).tap();
    await stagePublic.getByRole('button',{name:'Mảnh 2'}).press('Enter');
    await stagePublic.getByRole('button',{name:'Mảnh 3'}).tap();
    await stagePublic.getByText('Mỗi mảnh đều nhắc mình tới bạn.').waitFor();
    await nav(10).tap();
    await stagePublic.getByText('Đến giờ gặp nhau rồi!').waitFor();
    const timers = await guest.evaluate(()=>globalThis.canvasQaTimers.size);
    await nav(11).tap();
    await stagePublic.locator('time[datetime]').waitFor();
    assert.equal(await guest.evaluate(()=>globalThis.canvasQaTimers.size),timers+1);
    await nav(1).tap();
    assert.equal(await guest.evaluate(()=>globalThis.canvasQaTimers.size),timers);
    assert.equal(await flip.getAttribute('aria-pressed'),'false');
    await nav(2).tap();
    assert(await stagePublic.getByRole('button',{name:'Mở ngay',...exact}).isVisible());
    const scratch = stagePublic.locator('.gift-scratch-canvas');
    await scratch.scrollIntoViewIfNeeded();
    const scratchBox=await scratch.boundingBox();
    const row=scratchBox.y+scratchBox.height*.52;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:scratchBox.x+5,y:row}]});
    for (let step=1;step<=16;step++)
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:scratchBox.x+5+(scratchBox.width-10)*step/16,y:row}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await stagePublic.getByText('Hẹn nhau ở quán nhỏ cuối phố nhé!').waitFor();
    await nav(4).press('Enter');
    await stagePublic.getByText('Ảnh 1/2',exact).waitFor();
    console.log('PASS Browser public 10 tương tác bằng bàn phím/touch và đặt lại khi rời cảnh');

    for (const card of cards) {
      await page.setViewportSize({width:1440,height:1000});
      await page.goto(`${base}/design/${card.draftId}`);
      await control('preview').click();
      if (card.key === 'birthday') {
        await dialog.getByRole('button',{name:'Mở món quà',...exact}).click();
        await dialog.getByRole('button',{name:'Thắp nến',...exact}).press('Enter');
        await dialog.getByText('Chúc điều bạn ước sẽ thành hiện thực.').waitFor();
        await dialog.getByRole('button',{name:'Gửi lời hồi đáp',...exact}).click();
        await dialog.getByLabel('Lời đáp',exact).fill('Lời đáp xem thử QA');
        await dialog.getByRole('button',{name:'Gửi lời đáp',...exact}).click();
        await dialog.getByText(/Đã mô phỏng lời đáp/).waitFor();
      } else if (card.key === 'anniversary') {
        await dialog.getByRole('button',{name:'Mở album',...exact}).click();
        await dialog.getByRole('button',{name:'Sau',...exact}).press('Space');
        await dialog.getByAltText('Phong cảnh minh hoạ 2').waitFor();
        await dialog.getByRole('button',{name:'So sánh hai ảnh',...exact}).click();
        const compare = dialog.getByRole('slider');
        await compare.press('ArrowLeft');
        assert.equal(await compare.inputValue(),'49');
      } else {
        await dialog.getByRole('button',{name:'Mở lời cảm ơn',...exact}).click();
        await dialog.getByRole('button',{name:'Lật thẻ',...exact}).press('Enter');
        await dialog.getByText(/Bạn kiên nhẫn lắng nghe/).waitFor();
        await dialog.getByRole('button',{name:'Đọc lại lời nhắn',...exact}).click();
        await dialog.getByRole('button',{name:'Xem lại từ đầu',...exact}).click();
        await dialog.getByRole('button',{name:'Mở lời cảm ơn',...exact}).waitFor();
      }
      await shot(page,`${card.key}-designer-preview-1440.png`);
      await close();
      for (const width of [320,390,768,1440]) {
        const client = width < 768 ? guest : page;
        await client.setViewportSize({width,height:width<768?844:1000});
        await client.goto(`${base}/g/${card.slug}`);
        await client.locator('.gift-runtime-stage').waitFor();
        if (card.key === 'anniversary') {
          await client.waitForFunction(() => globalThis.document.querySelector('.gift-runtime-photo img')?.naturalWidth > 0);
        }
        assert(await client.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.innerWidth+1),`${card.key} ${width}`);
        if ([390,1440].includes(width)) {
          await shot(client,`${card.key}-cover-${width}.png`);
          if (card.key === 'birthday') {
            const envelope=client.getByRole('button',{name:'Mở món quà',...exact});
            await envelope.evaluate(button=>{button.click();button.click();});
            await client.getByRole('button',{name:'Thắp nến',...exact}).press('Enter');
            await client.getByText('Chúc điều bạn ước sẽ thành hiện thực.').waitFor();
          } else if (card.key === 'anniversary') {
            await client.getByRole('button',{name:'Mở album',...exact}).click();
            await client.getByAltText('Phong cảnh minh hoạ 1').waitFor();
            await client.getByText(/Ngày ấy, chúng mình ngồi trên đồi/).waitFor();
          } else {
            await client.getByRole('button',{name:'Mở lời cảm ơn',...exact}).click();
            await client.getByRole('button',{name:'Lật thẻ',...exact}).press('Space');
            await client.getByText(/Bạn kiên nhẫn lắng nghe/).waitFor();
          }
          await shot(client,`${card.key}-interaction-${width}.png`);
        }
        csp.push(...await client.evaluate(()=>globalThis.canvasQaCsp));
      }
    }
    assert.deepEqual(errors,[]);
    assert.deepEqual(csp,[]);
    console.log('PASS Browser 3 thiệp QA qua Designer preview và link công khai ở 320, 390, 768, 1440 px');
  } finally {
    await browser.close();
  }
}
