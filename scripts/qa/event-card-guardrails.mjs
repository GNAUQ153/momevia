import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { previewSvg } from '../../web/js/shared/canvas/cover-svg.js';
import { serverText } from '../../src/shared/locale.mjs';
const base='http://127.0.0.1:4178',ids=['birthday-radiance','hai-phong-bi','proud-of-you'];
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[];
try {
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'no-preference',isMobile:true,hasTouch:true});
  const {cookie}=JSON.parse(fs.readFileSync('local/event-cards/session.json'));
  await context.addCookies(cookie.split('; ').map(item=>({name:item.split('=')[0],value:item.slice(item.indexOf('=')+1),url:base})));
  const page=await context.newPage();
  const api=async route=>{const r=await context.request.get(base+'/api'+route);assert(r.ok());return r.json();};
  for(const id of ids) {
    await page.goto(base+'/template/'+id);
    await page.locator('[data-action="toggle-menu"]').click();
    await page.locator('#mobile-nav [data-locale-select]').selectOption('en');
    await page.locator('[data-action="toggle-menu"]').click();
    await page.getByRole('link',{name:'Use template',exact:true}).click();
    const field=name=>page.locator(`[data-editor-field="${name}"]`);
    await field('binding.message').waitFor();
    const designId=new URL(page.url()).pathname.split('/').at(-1);
    assert.equal((await api('/designs/designs/'+designId)).design.startingLocale,'en');
    const greeting='Every day of effort brought you here. Here’s to many happy days ahead.\n\n'+ 'Keep your curiosity close and enjoy this moment with the people you love. '.repeat(6);
    await field('binding.recipientName').fill(id==='hai-phong-bi'?'Alexandra Morgan & Christopher Nguyen':'Alexandra Morgan Nguyen');
    await field('binding.senderName').fill('Jordan Taylor'); await field('binding.message').fill(greeting);
    if(id==='hai-phong-bi') await field('quick-template-text').fill('I still remember our long walks and the stories we shared.\n\nSo glad to celebrate you both today.');
    await page.locator('[data-editor-action="save"]').click(); await page.locator('.editor-save-status[data-tone="saved"]').waitFor();
    await page.reload(); assert.equal(await field('binding.message').inputValue(),greeting);
    await page.locator('[data-editor-action="preview"]').click(); await page.locator('[data-editor-action="preview-send"]').click();
    const access=page.getByRole('dialog',{name:serverText('en','editor.access.title')});
    for(const [key,value]of Object.entries({open:'link',send:'link',read:'sender'})) await access.locator(`[data-editor-field="${key}"]`).selectOption(value);
    await access.locator('button[type="submit"]').click(); await page.waitForURL('**/success/*');
    const slug=new URL(page.url()).pathname.split('/').at(-1);
    const gift=(await api('/gifts/gifts/'+slug)).gift;
    const receiver=await browser.newContext({viewport:{width:320,height:844},reducedMotion:'no-preference',isMobile:true,hasTouch:true});
    const p=await receiver.newPage();
    await p.goto(base+'/g/'+slug); await p.locator('.gift-runtime-stage').waitFor();
    await p.locator('.recipient-preferences [data-locale-select]').selectOption('en');
    const backgrounds = await p.evaluate(async gift => {
      const {renderElement} = await import('/js/features/gift-runtime/index.js');
      const original = gift.documentSnapshot.elements.find(e=>e.type==='image');
      const legacy=structuredClone(original);delete legacy.accessibility.label;
      const colors=[];
      for(const model of [original,legacy]) {
        const node=renderElement(model,{document:gift.documentSnapshot,mode:'public',assetUrl:id=>`/api/gifts/gifts/${gift.slug}/assets/${id}`});
        globalThis.document.body.append(node);colors.push(globalThis.getComputedStyle(node).backgroundColor);node.remove();
      }
      return colors;
    },gift);
    assert.equal(backgrounds[0],'rgba(0, 0, 0, 0)');assert.equal(backgrounds[1],'rgb(242, 237, 247)','legacy decorative image presentation stays unchanged');
    const cdp=await receiver.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    const timings=[];
    for(const width of [320,390,768,1440]) {
      await p.setViewportSize({width,height:1000});
      for(let i=0;i<3;i++) {
        await p.locator('.gift-runtime-navigation button').nth(i).click();
        assert(await p.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.innerWidth+1));
        const small=await p.locator('.gift-runtime-control').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().height<44).map(n=>n.dataset.runtimeElement));
        assert.deepEqual(small,[],`${id} ${width}: touch targets`);
        assert.equal(await p.locator('.gift-runtime-stage').evaluate(n=>n.getAnimations({subtree:true}).length),0,'V1 has no animated layout / no decorative loops');
      }
      if(width===320||width===390) await p.locator('.gift-runtime-navigation button').nth(1).click();
      if(width===320||width===390) await p.locator('.gift-runtime-stage').screenshot({path:`docs/event-cards/after/${id}-en-public-${width}.png`});
    }
    for(let i=0;i<6;i++) timings.push(await p.evaluate(async index=>{
      const start=performance.now();globalThis.document.querySelectorAll('.gift-runtime-navigation button')[index%3].click();
      await new Promise(resolve=>globalThis.requestAnimationFrame(()=>globalThis.requestAnimationFrame(resolve)));return Math.round((performance.now()-start)*100)/100;
    },i));
    await p.route('**/api/gifts/gifts/*/assets/*',route=>route.abort());
    await p.reload();await p.locator('.gift-runtime-stage').waitFor();
    const stage=p.locator('.gift-runtime-stage');
    await stage.locator(`[data-runtime-element="${id==='hai-phong-bi'?'open-wish':'open-gift'}"]`).click();
    await stage.getByText(greeting,{exact:true}).waitFor();
    assert(await p.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.innerWidth+1));
    results.push({id,check:'English mobile quick edit/save/reload/publish; public 4 widths; touch targets >=44; normal motion CPU 4x',status:'PASS',slug,navigationToSecondFrameMs:timings,device:'Edge desktop emulation; not physical phone'});
    await receiver.close();
  }
  await context.close();

  // A local proxy serves the old image at v3 and the application at v4. Real
  // Chromium HTTP cache stays enabled (no Playwright request routing).
  const old=JSON.parse(fs.readFileSync('tests/fixtures/event-cards-before.json')).documents;
  const counts={};
  const proxy=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://proxy.test');
    const id=ids.find(id=>url.pathname===`/assets/basic-templates/${id}.svg`);
    if(url.pathname.startsWith('/cache-prime')) {
      res.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});
      res.end(ids.map(id=>`<img src="/assets/basic-templates/${id}.svg?v=3">`).join(''));return;
    }
    if(id)counts[id+url.search]=(counts[id+url.search]||0)+1;
    if(id&&url.search==='?v=3') {
      const doc=structuredClone(old[id]);for(const binding of Object.values(doc.bindings))binding.value='Old preview';
      res.writeHead(200,{'content-type':'image/svg+xml','cache-control':'public,max-age=31536000,immutable'});res.end(previewSvg(doc));return;
    }
    try {const upstream=await fetch(base+req.url);res.writeHead(upstream.status,Object.fromEntries(upstream.headers));res.end(Buffer.from(await upstream.arrayBuffer()));}
    catch(error){res.writeHead(502);res.end(error.message);}
  });
  proxy.listen(0,'127.0.0.1');await once(proxy,'listening');
  try {
    const origin=`http://127.0.0.1:${proxy.address().port}`;
    const c=await browser.newContext(),p=await c.newPage();
    const cdp=await c.newCDPSession(p);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:false});
    await p.goto(origin+'/cache-prime/1');await p.goto(origin+'/cache-prime/2');
    for(const id of ids)assert.equal(counts[id+'?v=3'],1,'old cover served from actual HTTP cache');
    for(const id of ids) {
      await p.goto(origin+'/template/'+id);
      const image=p.locator('.detail-art img');await image.waitFor();
      const src=await image.getAttribute('src');assert(src.includes('v=5'),src);
      await p.waitForFunction(selector=>globalThis.document.querySelector(selector)?.complete,'.detail-art img');
      assert(counts[id+'?v=5']>=1,'new cover bypassed cached old version');
    }
    await c.close();results.push({check:'All 3 old v3 covers cached in real browser HTTP cache; all current v5 covers fetched',status:'PASS',requests:counts});
  }finally{proxy.closeAllConnections();await new Promise(resolve=>proxy.close(resolve));}
  fs.writeFileSync('docs/event-cards/guardrail-results.json',JSON.stringify(results,null,2)+'\n');
  console.log('PASS English mobile sending, real public widths/touch, normal motion 4x CPU, and real HTTP cover cache.');
}finally{await browser.close();}
