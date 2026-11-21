import fs from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { confirmGiftAccess } from '../../tests/browser/gift-access.mjs';
import { templatePreviewDocument } from '../../web/js/shared/canvas/index.js';
import { serverText } from '../../src/shared/locale.mjs';
const base = 'http://127.0.0.1:4178', folder = 'docs/event-cards/after';
fs.mkdirSync(folder, { recursive: true });
const ids = ['birthday-radiance', 'hai-phong-bi', 'proud-of-you'];
const results = [], errors = [];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
const { cookie } = JSON.parse(fs.readFileSync('local/event-cards/session.json'));
await context.addCookies(cookie.split('; ').map(item => ({ name: item.split('=')[0], value: item.slice(item.indexOf('=') + 1), url: base })));
const api = async (route, body, status = 200, locale = 'vi') => {
  const r = await context.request.fetch(base + '/api' + route, { method: body ? 'POST' : 'GET', data: body, headers: { 'x-momevia-locale': locale } });
  const data = await r.json(); assert.equal(r.status(), status, `${route}: ${JSON.stringify(data)}`); return data;
};
const page = await context.newPage(); page.setDefaultTimeout(12000);
page.on('pageerror', error => errors.push(error.message));
const action = name => page.locator(`[data-editor-action="${name}"]`);
const field = name => page.locator(`[data-editor-field="${name}"]`);
const locale = async value => {
  // Locale setup for this template matrix. Native mobile controls are exercised
  // separately by event-card-guardrails and the full locale browser suite.
  await page.evaluate(async value => (await import('/js/core/i18n.js')).selectLocale(value),value);
  await page.waitForFunction(value => globalThis.document.documentElement.lang === value, value);
};
const save = async () => { await action('save').click(); await page.locator('.editor-save-status[data-tone="saved"]').waitFor(); };
const noOverflow = async label => assert(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth + 1), label);
try {
  // Baseline records survive a code/preset update. Source IDs and rights remain intact.
  for (const old of JSON.parse(fs.readFileSync('local/event-cards/old-records.json'))) {
    assert.deepEqual((await api(`/designs/designs/${old.design.id}`)).design, old.design);
    assert.deepEqual((await api(`/gifts/gifts/${old.gift.slug}`)).gift, old.gift);
    const input = { mutationId: randomUUID() };
    const { design } = await api(`/gifts/gifts/mine/${old.gift.slug}/regift`, input, 201);
    assert.equal((await api(`/gifts/gifts/mine/${old.gift.slug}/regift`, input)).design.id, design.id);
    assert.equal(design.source.templateId, old.id);
    assert.notEqual(design.source.templateVersionId, old.design.source.templateVersionId);
    assert(Object.values(design.document.bindings).every(b => b.value === ''));
    const oldShapes = old.design.document.elements.filter(e => ['shape', 'line'].includes(e.type));
    assert.deepEqual(design.document.elements.filter(e => ['shape', 'line'].includes(e.type)).map(e => e.layout), oldShapes.map(e => e.layout));
    for (const privateValue of ['Nguyễn Hoàng Minh Anh', 'Trần Khánh An', 'Lời chúc cũ đã chỉnh']) assert(!JSON.stringify(design).includes(privateValue));
    await page.goto(base + '/design/' + old.design.id); await page.locator('.editor-workspace').waitFor();
    await page.goto(base + '/g/' + old.gift.slug); await page.locator('.gift-runtime-stage').waitFor();
    await page.locator('.gift-runtime-stage').screenshot({ path: `${folder}/${old.id}-old-gift.png` });
    results.push({ id: old.id, check: 'old draft / old gift / cleaned regift / replay', status: 'PASS' });
  }
  for (const language of ['vi', 'en']) for (const [id, term] of ids.map((id,i) => [id, language === 'vi' ? ['sinh nhật','đám cưới','tốt nghiệp'][i] : ['birthday','wedding','graduation'][i]])) {
    await page.goto(base + '/explore'); await locale(language);
    await page.locator('#template-search').fill(term);
    if (!await page.locator(`a[href="/template/${id}"]`).count())
      await page.locator('[data-action="set-page"][data-page="2"]').first().click();
    await page.locator(`a[href="/template/${id}"]`).first().waitFor();
    await noOverflow(`Catalog ${id} ${language}`);
    await page.locator(`a[href="/template/${id}"]`).first().click();
    const trigger = page.locator('[data-template-preview]').first(); await trigger.click();
    const dialog = page.locator('dialog.template-preview-dialog[open]');
    const stage = dialog.locator('.gift-runtime-stage'); await stage.waitFor();
    for (let index = 0; index < 3; index++) {
      await dialog.locator('.gift-runtime-navigation button').nth(index).click();
      await page.setViewportSize({ width:390,height:2000 });
      for (const img of await stage.locator('img').all()) {
        await img.scrollIntoViewIfNeeded();
        await img.evaluate(n => n.decode());
        assert(await img.evaluate(n => n.naturalWidth > 0));
      }
      await stage.screenshot({ path: `${folder}/${id}-${language}-${index+1}.png` });
      await page.setViewportSize({ width:390,height:844 });
    }
    // Keyboard choices can be opened in either order, with an explicit return path.
    if (id === 'hai-phong-bi') for (const order of [['open-memory','open-wish'],['open-wish','open-memory']]) {
      await dialog.locator('.gift-runtime-navigation button').first().click();
      for (const key of order) {
        await stage.locator(`[data-runtime-element="${key}"]`).focus(); await page.keyboard.press(key === 'open-wish' ? 'Space' : 'Enter');
        await stage.locator(`[data-runtime-element="${key === 'open-memory' ? 'memory-back' : 'wish-back'}"]`).click();
      }
    }
    await dialog.locator('.gift-runtime-navigation button').nth(2).click();
    await stage.locator('textarea').fill('Preview only; never sent.');
    await stage.locator('button[type="submit"]').click();
    await stage.getByText('Preview only; never sent.', { exact: true }).waitFor();
    await dialog.locator('[data-template-close]').click();
    assert(await trigger.evaluate(node => node === globalThis.document.activeElement));
    results.push({ id, language, check: 'explore / preview / 3 scenes / simulated reply / focus return', status: 'PASS' });
  }
  if (!process.argv.includes('--capture-only')) {
    // Real UI journey; use the two catalog entry points and edit a real decorative layer.
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const [index, id] of ids.entries()) {
      await page.goto(base + '/template/' + id); await locale('vi');
      await page.getByRole('link', { name: 'Dùng mẫu', exact: true }).click();
      await field('binding.message').waitFor();
      const draftId = new URL(page.url()).pathname.split('/').at(-1);
      const recipient = id === 'hai-phong-bi' ? 'Nguyễn Hoàng Minh Anh & Trần Phương Thảo Nguyên' : 'Nguyễn Hoàng Minh Anh';
      const message = 'Mong những ngày phía trước có thật nhiều niềm vui.\n\n' + 'Cảm ơn vì đã luôn cố gắng và giữ những điều mình yêu ở gần. '.repeat(9);
      await field('binding.recipientName').fill(recipient); await field('binding.senderName').fill('Trần Khánh An'); await field('binding.message').fill(message);
      if (id === 'hai-phong-bi') await field('quick-template-text').fill('Kỷ niệm riêng của hai bạn.\n\nMình nhớ những lần cả nhóm cùng đi thật xa và cười thật nhiều.');
      await action('toggle-mode').click();
      const decoration = ['event-photo-birthday','event-photo-wedding-memory','event-photo-graduation'][index];
      await page.locator('[data-editor-action="library-tab"][data-tab="layers"]').click();
      await page.locator(`.editor-layers [data-id="${decoration}"]`).click();
      await page.locator('.editor-geometry summary').click();
      const x = Number(await field('layout.x').inputValue()); await field('layout.x').fill(String(x + 4)); await field('layout.x').dispatchEvent('change');
      await save();
      const saved = (await api(`/designs/designs/${draftId}`)).design;
      assert.equal(saved.document.elements.find(e => e.id === decoration).layout.x, x + 4);
      await page.reload(); await field('binding.message').waitFor();
      assert.equal(await field('binding.message').inputValue(), message);
      assert.deepEqual((await api(`/designs/designs/${draftId}`)).design.document, saved.document);
      await locale('en'); assert.equal(await field('binding.message').inputValue(), message); await locale('vi');
      await page.screenshot({ path: `${folder}/${id}-editor-1440.png`, fullPage: true });
      await action('toggle-mode').click();
      await action('preview').click(); await action('preview-send').click();
      await confirmGiftAccess(page, { open: 'link', send: 'link', read: 'sender' });
      await page.waitForURL('**/success/*');
      const slug = new URL(page.url()).pathname.split('/').at(-1);
      const publicGift = (await api(`/gifts/gifts/${slug}`)).gift;
      assert.equal(publicGift.documentSnapshot.bindings.message.value, message);
      const clean = (await api(`/gifts/gifts/mine/${slug}/regift`, { mutationId:randomUUID() },201)).design;
      assert.equal(clean.document.assets.length, 1);
      assert.notEqual(clean.document.assets[0].assetId,saved.document.assets[0].assetId);
      assert.equal(clean.document.elements.filter(e=>e.type==='image').length,saved.document.elements.filter(e=>e.type==='image').length);
      assert(Object.values(clean.document.bindings).every(b=>b.value===''));
      const receiver = await browser.newContext({ viewport:{width:390,height:844}, reducedMotion:'reduce' });
      const publicPage = await receiver.newPage();
      await publicPage.goto(base + '/g/' + slug); await publicPage.locator('.gift-runtime-stage').waitFor();
      const publicStage = publicPage.locator('.gift-runtime-stage');
      await publicStage.locator(`[data-runtime-element="${id === 'hai-phong-bi' ? 'open-wish' : 'open-gift'}"]`).click();
      await publicStage.getByText(message, { exact: true }).waitFor();
      if (id !== 'hai-phong-bi') await publicStage.locator('[data-runtime-element="to-message"]').click();
      await publicStage.locator('textarea').fill('Cảm ơn bạn, mình đã nhận được thiệp!'); await publicStage.locator('button[type="submit"]').click();
      await publicStage.getByText('Đã gửi lời đáp.', { exact:true }).waitFor();
      await publicStage.screenshot({ path:`${folder}/${id}-recipient-reply-390.png` });
      await receiver.close();
      const off = await api('/gifts/gifts/from-design', { designId: saved.id, expectedRevision: saved.revision, expectedDocumentHash:saved.documentHash, idempotencyKey:randomUUID(), access:{open:'link',send:'disabled',read:'sender'} }, 201);
      await page.goto(base + '/g/' + off.gift.slug); await page.locator('.gift-runtime-stage').waitFor();
      await page.locator('.gift-runtime-navigation button').nth(2).click();
      assert.equal(await page.locator('.gift-runtime-stage textarea').isVisible(), false);
      assert.equal((await api(`/gifts/gifts/${off.gift.slug}`)).gift.replyPermissions.canSend, false);
      await api(`/gifts/gifts/${off.gift.slug}/replies`, { name:'QA',message:'Disabled reply must fail',intentId:randomUUID() },403);
      // Also check the dedicated layout entry point creates a usable, separate draft.
      await page.goto(base + '/template/' + id); await page.getByRole('link',{name:'Chỉnh bố cục',exact:true}).click(); await page.locator('.editor-workspace').waitFor();
      assert(!new URL(page.url()).searchParams.has('mode'));
      results.push({id,check:'UI quick/layout / personalization / memory / decoration edit / save reload / publish / anonymous reply / replies disabled',status:'PASS',draftId,slug});
    }
    // Both languages, all scenes, long text, all requested widths; same shared public renderer.
    for (const language of ['vi','en']) for (const id of ids) for (const width of [320,390,768,1440]) {
      await page.setViewportSize({width,height:1000}); await page.goto(base+'/template/'+id);
      await page.evaluate(async value => (await import('/js/core/i18n.js')).selectLocale(value),language);
      const document = templatePreviewDocument({id}, key => serverText(language,key));
      document.bindings.recipientName.value = id === 'hai-phong-bi' ? 'Nguyễn Hoàng Minh Anh & Trần Phương Thảo Nguyên' : 'Nguyễn Hoàng Minh Anh';
      document.bindings.message.value = (language === 'vi' ? 'Lời chúc nhiều đoạn, tiếng Việt có dấu và đầy niềm vui.\n\n' : 'Here is a longer English note, celebrating every step along the way.\n\n').repeat(12);
      const memory = document.elements.find(e => e.id === 'envelope-memory');
      if (memory) memory.props.text = (language === 'vi' ? 'Một kỷ niệm của chúng mình. Cả nhóm cùng cười thật lâu.\n\n' : 'A memory of all of us, sharing stories and laughing together.\n\n').repeat(14);
      await page.evaluate(async document => {
        const {mountPlayer} = await import('/js/features/gift-runtime/index.js');
        const {eventMediaUrl} = await import('/js/shared/canvas/event-media.js');
        document.responsive.desktop.maxContentWidth=600;
        const host = globalThis.document.querySelector('#main'); host.replaceChildren();
        globalThis.document.body.classList.add('is-playing-gift');
        globalThis.eventPlayer=mountPlayer(host,{document,mode:'preview',assetUrl:eventMediaUrl});
      },document);
      for (const [i,scene] of document.scenes.entries()) {
        await page.evaluate(id => globalThis.eventPlayer.goToScene(id),scene.id);
        await noOverflow(`${id} ${language} ${width} scene${i+1}`);
        const overflow = await page.locator('.gift-scene-content > [data-runtime-element]').evaluateAll(nodes => nodes.filter(n => !n.matches('.gift-runtime-shape,.gift-runtime-line,.gift-runtime-sticker') && n.scrollWidth > n.clientWidth + 1).map(n=>n.dataset.runtimeElement));
        assert.deepEqual(overflow,[],`${id} ${language} ${width} clipped content`);
        const overlaps = await page.locator('.gift-scene-content > [data-runtime-element]').evaluateAll(nodes => {
          const content = nodes.filter(n => n.matches('.gift-runtime-text,.gift-runtime-control,.gift-runtime-reply')).map(n => ({ id:n.dataset.runtimeElement,box:n.getBoundingClientRect() }));
          return content.slice(1).flatMap((item,i) => item.box.top < content[i].box.bottom - 1 ? [[content[i].id,item.id]] : []);
        });
        assert.deepEqual(overlaps,[],`${id} ${language} ${width} content collision`);
        if (width===320) await page.locator('.gift-runtime-stage').screenshot({path:`${folder}/${id}-${language}-long-320-${i+1}.png`});
      }
    }
    results.push({check:'3 templates × 2 locales × 4 widths × 3 scenes with long text',status:'PASS'});
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync('docs/event-cards/browser-results.json',JSON.stringify(results,null,2)+'\n');
  console.log(`PASS ${results.length} event-card journey groups; no browser errors.`);
} catch (error) { await page.screenshot({path:'local/event-cards/failure.png',fullPage:true}); throw error; }
finally { await browser.close(); }
