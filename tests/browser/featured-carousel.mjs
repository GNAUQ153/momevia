import assert from 'node:assert/strict';

export async function runFeaturedCarousel(browser,base){
  const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
  try{
    const page=await context.newPage(),errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(r.url().includes('/api/')&&!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
    await page.clock.install();await page.goto(base);
    const root=page.locator('[data-featured-carousel]'),viewport=page.locator('[data-featured-viewport]');
    await root.waitFor();await viewport.scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>globalThis.document.querySelector('[data-featured-carousel]').dataset.featuredRunning==='true');
    const ids=await page.locator('[data-featured-track] > article').evaluateAll(ns=>ns.map(n=>n.dataset.templateId));
    assert.equal(ids.length,15);assert.equal(new Set(ids).size,15);assert.equal(await root.getAttribute('data-featured-visible'),'3');
    const read=()=>root.getAttribute('data-featured-window');
    assert.equal(await read(),ids.slice(0,3).join(','));
    const second=await page.locator('[data-featured-track] > article').nth(1).elementHandle();
    await page.waitForFunction(()=>globalThis.document.querySelector('[data-featured-carousel]').dataset.featuredPhase==='sliding',null,{timeout:8000});
    await page.waitForFunction(()=>{const t=globalThis.getComputedStyle(globalThis.document.querySelector('[data-featured-track]')).transform;if(!t.startsWith('matrix('))return false;return Number(t.slice(7,-1).split(',')[4])<0;});
    await page.waitForFunction(()=>globalThis.document.querySelector('[data-featured-carousel]').dataset.featuredStart==='1');
    assert.equal(await read(),ids.slice(1,4).join(','),'1,2,3 becomes 2,3,4');
    assert(await page.locator('[data-featured-track]').evaluate((n,oldSecond)=>n.firstElementChild===oldSecond,second),'Existing card identity survives the move');
    for(let start=2;start<=15;start++){
      await page.clock.fastForward(5000);
      await page.waitForFunction(s=>globalThis.document.querySelector('[data-featured-carousel]').dataset.featuredStart===String(s%15),start);
      const expected=Array.from({length:3},(_,i)=>ids[(start+i)%15]).join(',');assert.equal(await read(),expected);
    }
    assert.equal(await page.locator('[data-featured-track] > article:not([inert])').count(),3,'Only visible cards enter the tab order');
    const saved=await read();await page.emulateMedia({reducedMotion:'reduce'});await page.clock.fastForward(10000);assert.equal(await read(),saved);
    await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('#how-it-works').scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>globalThis.document.querySelector('[data-featured-carousel]').dataset.featuredRunning==='false');
    await page.clock.fastForward(10000);assert.equal(await read(),saved,'Offscreen carousel does not rotate');
    await viewport.scrollIntoViewIfNeeded();
    const link=page.locator('[data-featured-track] > article:not([inert]) .template-card__visual').first(),href=await link.getAttribute('href');
    await link.focus();await page.clock.fastForward(10000);assert.equal(await read(),saved,'Keyboard focus keeps its card stable');
    await link.click();await page.waitForURL(new URL(href,base).href);await page.locator('.template-preview-player .gift-runtime').waitFor();
    assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  }finally{await context.close();}
  console.log('PASS featured carousel: 15 real cards, three visible, actual left slide after five seconds, circular wrap, stable DOM/preview and no writes.');
}
