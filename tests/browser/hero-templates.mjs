import assert from 'node:assert/strict';

export async function runHeroTemplatesBrowser(browser,base) {
  for(const language of ['vi','en']) {
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});
    await context.addInitScript(locale=>globalThis.localStorage.setItem('momevia-locale',locale),language);
    try {
      const page=await context.newPage(),errors=[],writes=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('request',r=>{if(r.url().includes('/api/')&&!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
      await page.goto(base);
      const cover=page.locator('.mkt-hero__cover'),choices=page.locator('.home-create-dialog'),create=page.locator('[data-home-create]');
      await cover.waitFor();assert.equal(await cover.count(),1);assert.equal(await page.locator('[data-hero-playback]').count(),0);
      const catalog=(await(await context.request.get(base+'/api/catalog/templates')).json()).templates;
      await page.waitForFunction(()=>globalThis.document.querySelectorAll('[data-hero-select]').length===5);
      const ids=await cover.locator('img').evaluateAll(ns=>ns.map(n=>n.dataset.heroImage));assert.equal(new Set(ids).size,5);
      await create.focus();await page.keyboard.press('Enter');await choices.waitFor({state:'visible'});
      for(const type of ['invitation','greeting'])assert.equal(await choices.locator(`.home-create-choice--${type}`).getAttribute('href'),`/explore?cardType=${type}`);
      assert.equal(await choices.locator('.home-create-dialog__blank').getAttribute('href'),'/design/new');
      await page.keyboard.press('Escape');await choices.waitFor({state:'hidden'});assert(await create.evaluate(n=>n===globalThis.document.activeElement));
      assert.equal(await page.locator('.gift-runtime').count(),0,'No player before preview');
      for(let i=0;i<5;i++) {
        await page.locator(`[data-hero-select="${i}"]`).click();
        await page.waitForFunction(id=>globalThis.document.querySelector('[data-hero-image][data-active="true"]').dataset.heroImage===id,ids[i]);
        const template=catalog.find(t=>t.id===ids[i]);assert(template,'Each sample comes from the live Catalog');
        await cover.focus();await page.keyboard.press('Enter');
        const dialog=page.locator('.template-preview-dialog');await dialog.waitFor({state:'visible'});await dialog.locator('.gift-runtime').waitFor();
        const url=new URL(await dialog.locator('[data-template-use]').getAttribute('href'),base);
        assert.equal(url.pathname,'/create/'+template.id);assert.equal(url.searchParams.get('version'),template.versionId||null);
        await page.keyboard.press('Escape');await dialog.locator('.gift-runtime').waitFor({state:'detached'});assert(await cover.evaluate(n=>n===globalThis.document.activeElement));
      }
      const template=catalog.find(t=>t.id===ids[4]);
      const endpoint=template.versionId?`**/api/catalog/templates/${template.id}/versions/${template.versionId}`:`**/api/designs/library/templates/${template.id}/preview`;
      await page.route(endpoint,r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}),{times:1});
      await cover.click();await page.locator('[data-template-error]:visible').waitFor();await page.locator('[data-template-retry]').click();await page.locator('.template-preview-player .gift-runtime').waitFor();
      await page.locator('[data-template-close]').click();await page.locator('.template-preview-player .gift-runtime').waitFor({state:'detached'});
      assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
    } finally {await context.close();}
  }
  await runHeroMotionBrowser(browser,base);
  console.log('PASS classic five-template cycle: one foreground, decoded next-card teaser behind, circular handoff, no pause button, correct preview/version VI/EN and zero writes.');
}

export async function runHeroMotionBrowser(browser,base) {
  const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'no-preference'});
  try {
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
    const cover=page.locator('.mkt-hero__cover');await cover.waitFor();
    const ids=await cover.locator('img').evaluateAll(ns=>ns.map(n=>n.dataset.heroImage));assert.equal(new Set(ids).size,5);
    await page.waitForFunction(()=>{const peek=globalThis.document.querySelector('[data-peeking]');return peek&&Number(globalThis.getComputedStyle(peek).opacity)>.3;},null,{timeout:8000});
    const peek=await page.locator('[data-peeking]').evaluate(n=>({id:n.dataset.heroImage,active:n.dataset.active,z:globalThis.getComputedStyle(n).zIndex,opacity:Number(globalThis.getComputedStyle(n).opacity),transform:globalThis.getComputedStyle(n).transform}));
    assert.equal(peek.id,ids[1]);assert.equal(peek.active,'false');assert(peek.opacity>0&&peek.opacity<1);assert.notEqual(peek.transform,'none');
    assert.equal(await cover.locator('[data-active="true"]').count(),1);assert.equal(await cover.locator('[data-active="true"]').getAttribute('data-hero-image'),ids[0]);
    await page.waitForFunction(id=>globalThis.document.querySelector('.mkt-hero').dataset.heroTemplate===id,ids[1],{timeout:4000});
    for(const target of [2,3,4,0]) {
      await page.evaluate(()=>globalThis.document.querySelector('.mkt-hero__slide[aria-pressed="true"] [data-hero-progress]').getAnimations()[0].finish());
      await page.waitForFunction(id=>globalThis.document.querySelector('.mkt-hero').dataset.heroTemplate===id,ids[target]);
      assert.equal(await cover.locator('[data-active="true"]').count(),1);
    }
    assert.equal(await page.locator('[data-hero-playback]').count(),0);
    const hero=await page.locator('.mkt-hero').boundingBox(),art=await page.locator('.open-me-hero__showcase').boundingBox(),intro=await page.locator('.mkt-hero__intro').boundingBox();
    assert(hero.y+hero.height-Math.max(art.y+art.height,intro.y+intro.height)<=65,'No viewport-sized blank below hero');
    await cover.click();await page.locator('.template-preview-player .gift-runtime').waitFor();
    assert.equal(await page.locator('.mkt-hero').getAttribute('data-mkt-ambient-running'),null);
    await page.keyboard.press('Escape');await page.locator('.template-preview-player .gift-runtime').waitFor({state:'detached'});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>globalThis.document.querySelectorAll('[data-hero-progress]').length>0&&!globalThis.document.querySelector('.mkt-hero').hasAttribute('data-mkt-ambient-running'));
    assert.equal(await page.locator('[data-hero-progress]').evaluateAll(ns=>ns.flatMap(n=>n.getAnimations()).filter(a=>a.playState==='running').length),0);
    await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('#how-it-works').scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>!globalThis.document.querySelector('.mkt-hero').hasAttribute('data-mkt-ambient-running'));
    assert.equal(await page.locator('[data-hero-progress]').evaluateAll(ns=>ns.flatMap(n=>n.getAnimations()).filter(a=>a.playState==='running').length),0);
    await page.locator('.mkt-actions a[href="/explore"]').click();await page.waitForURL('**/explore');assert.equal(await page.locator('.mkt-hero').count(),0);
    assert.deepEqual(errors,[]);
  } finally {await context.close();}
}
