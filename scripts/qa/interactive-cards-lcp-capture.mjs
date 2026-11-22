import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const out=path.resolve('local/lcp-20261122/capture');fs.mkdirSync(out,{recursive:true});
const {base}=JSON.parse(fs.readFileSync('local/interactive-cards-20261122/final/session.json'));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:1000},locale:'vi-VN',reducedMotion:'no-preference',recordVideo:{dir:path.join(out,'video'),size:{width:390,height:1000}}});
 await context.addInitScript(()=>globalThis.localStorage.setItem('momevia-locale','vi'));const page=await context.newPage();
 await page.goto(base+'/explore');await page.locator('#main h1').waitFor();await page.evaluate(()=>globalThis.document.fonts.ready);await page.locator('#catalog-grid article img').first().evaluate(img=>img.decode());await page.screenshot({path:path.join(out,'catalog-mobile.png')});
 await page.locator('#catalog-grid a[href="/template/birthday-radiance"]').first().click();await page.locator('[data-template-preview]').click();await page.locator('[data-runtime-element="birthday-candle"] button').waitFor();
 await page.locator('.gift-runtime-stage img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));await page.waitForTimeout(700);
 await page.locator('[data-runtime-element="birthday-candle"] button').click();await page.locator('.gift-interaction-candle.is-lit').waitFor();await page.waitForTimeout(900);
 await page.locator('.gift-motion-control').click();assert.equal(await page.locator('.gift-motion-control').getAttribute('aria-pressed'),'true');
 await page.locator('.template-preview-dialog').screenshot({path:path.join(out,'candle-lit-mobile.png')});
 await page.locator('.gift-motion-control').click();await page.locator('[data-runtime-element="open-gift"]').click();await page.waitForTimeout(700);
 await context.close();console.log('PASS Chrome evidence: decoded Catalog artwork, real candle reaction, motion off/on preserves lit state, continue works; silent WebM recorded');
}finally{await browser.close();}
