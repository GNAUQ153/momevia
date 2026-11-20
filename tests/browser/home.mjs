import assert from 'node:assert/strict';
import path from 'node:path';
import { chromium } from 'playwright';

const screens = [[1440, 900], [1024, 768], [820, 1180], [768, 1024], [390, 844], [320, 740]];

export async function runHomeBrowser(base) {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined });
  try {
    for (const language of ['vi', 'en']) {
      const context = await browser.newContext({ reducedMotion: 'reduce', hasTouch: true });
      try {
        const page = await context.newPage();
        const requests = [];
        const errors = [];
        page.on('request', request => requests.push(request));
        page.on('pageerror', error => errors.push(error.message));
        if (language === 'en') await context.addInitScript(() => localStorage.setItem('momevia-locale', 'en'));
        for (const [width, height] of screens) {
          await page.setViewportSize({ width, height });
          await page.goto(base);
          const hero = page.locator('main > .mkt-hero');
          await hero.getByRole('heading', { level: 1 }).waitFor();
          const primary = hero.locator('a[href="/explore"]');
          const preview = hero.locator('.mkt-actions [data-template-preview]');
          const cover = hero.locator('.mkt-hero__cover');
          const image = cover.locator('img');
          await image.evaluate(img => img.decode());
          assert.equal(await page.locator('html').getAttribute('lang'), language);
          assert.equal(await page.locator('html').getAttribute('data-type'), 'software');
          assert.equal(await page.locator('main > section').count(), 3);
          assert.equal(await page.locator('footer #mkt-faq-title').count(), 1);
          const [headingBox, primaryBox, previewBox, coverBox] = await Promise.all([
            hero.getByRole('heading', { level: 1 }).boundingBox(), primary.boundingBox(), preview.boundingBox(), cover.boundingBox(),
          ]);
          assert(headingBox.y + headingBox.height <= primaryBox.y, `${width}: headline precedes actions`);
          assert(primaryBox.height >= 44 && previewBox.height >= 44 && previewBox.y + previewBox.height <= height, `${width}: both actions fit the first screen`);
          assert(coverBox.width >= (width < 400 ? 145 : 175), `${width}: full cover is readable`);
          const frame = await hero.locator('.mkt-hero__frame').boundingBox();
          assert(Math.abs(coverBox.x * 2 + coverBox.width - frame.x * 2 - frame.width) < 3, `${width}: cover is centred inside its own frame`);
          if (width <= 680) assert(previewBox.y + previewBox.height <= frame.y, `${width}: mobile actions precede the artwork`);
          else assert(headingBox.x + headingBox.width < frame.x, `${width}: artwork and heading have distinct columns`);
          assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth), width);
          assert.equal(await cover.evaluate(node => globalThis.getComputedStyle(node).animationName), 'none');
          if (width === 1440) {
            const selector = page.locator('.nav-actions [data-locale-select]');
            const otherLanguage = language === 'vi' ? 'en' : 'vi';
            await selector.selectOption(otherLanguage);
            await page.waitForFunction(value => globalThis.document.documentElement.lang === value, otherLanguage);
            await selector.selectOption(language);
            await page.waitForFunction(value => globalThis.document.documentElement.lang === value, language);
          }
          if (width !== 390) continue;
          assert.match(await image.getAttribute('src'), language === 'en' ? /\/en\/hai-phong-bi.svg/ : /templates\/hai-phong-bi.svg/);
          assert(!requests.some(request => request.url().includes('/gift-runtime/index.js')), 'Guest landing leaves the player unloaded');
          const dialog = page.getByRole('dialog');
          await preview.focus();
          await page.keyboard.press('Enter');
          const entry = dialog.locator('[data-runtime-element="open-memory"]');
          await entry.waitFor();
          assert.match(await dialog.getAttribute('aria-label'), language === 'en' ? /Two Envelopes/i : /Hai phong bì/i);
          const stage = dialog.locator('.gift-runtime-stage');
          const coverName = await stage.getAttribute('aria-label');
          await entry.tap();
          assert.notEqual(await stage.getAttribute('aria-label'), coverName);
          if (process.env.BROWSER_ARTIFACT_DIR) await page.screenshot({ path: path.join(process.env.BROWSER_ARTIFACT_DIR, `home-preview-${language}-390.png`) });
          await page.keyboard.press('Escape');
          await dialog.waitFor({ state: 'hidden' });
          await page.waitForFunction(() => globalThis.document.activeElement?.matches('.mkt-actions [data-template-preview]'));
          await cover.tap();
          await entry.waitFor();
          await dialog.locator('[data-template-close]').click();
          await page.waitForFunction(() => globalThis.document.activeElement?.matches('.mkt-hero__cover'));
          assert(!requests.some(request => request.method() === 'POST' && request.url().includes('/api/')), 'Preview makes no writes');
          const featured = page.locator('.mkt-gift-grid .template-card__title').first();
          const target = await featured.getAttribute('href');
          assert.match(target, /^\/template\/[^/]+$/);
          await featured.click();
          await page.waitForURL(new URL(target, base).href);
          await page.locator('main h1').waitFor();
          await page.goBack();
          await hero.waitFor();
          const question = page.locator('footer details summary').first();
          await question.press('Enter');
          assert.equal(await question.evaluate(node => node.parentElement.open), true);
          await question.press('Enter');
          assert.equal(await question.evaluate(node => node.parentElement.open), false);
        }
        await page.goto(base + '/#how-it-works');
        await page.waitForFunction(() => globalThis.scrollY > globalThis.innerHeight);
        await page.locator('.mkt-hero a[href="/explore"]').click();
        await page.locator('#template-search').waitFor();
        assert.equal(await page.locator('html').getAttribute('data-type'), null);
        await page.goBack();
        await page.waitForFunction(() => globalThis.location.hash === '#how-it-works' && globalThis.scrollY > globalThis.innerHeight);
        await verifyCatalog(context, page, base);
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
    console.log('PASS Browser home VI/EN: six viewports, first-screen actions, real cover and preview interaction, Escape and focus, Back and how-it-works, reduced motion.');
  } finally { await browser.close(); }
}

async function verifyCatalog(context, page, base) {
  await page.goto(base + '/pricing');
  const freeLink = page.locator('a[href="/explore?free=1"]');
  const directUrl = new URL(await freeLink.getAttribute('href'), base).href;
  const tab = await context.newPage();
  try {
    await tab.goto(directUrl);
    assert.equal(await tab.locator('#free-filter').isChecked(), true);
  } finally { await tab.close(); }
  await freeLink.click();
  const free = page.locator('#free-filter');
  const search = page.getByRole('searchbox');
  await free.waitFor();
  assert.equal(await free.isChecked(), true);
  await page.reload();
  assert.equal(await free.isChecked(), true);
  assert.equal(await page.locator('.seasonal-shelf').isVisible(), false);
  await search.fill('sunny wishes');
  await page.locator('#catalog-grid .template-card__title').click();
  const returnLink = page.locator('.breadcrumb a');
  assert.match(await returnLink.getAttribute('href'), /free=1&q=sunny\+wishes/);
  await page.goBack();
  assert.equal(await search.inputValue(), 'sunny wishes');
  assert.equal(await free.isChecked(), true);
  await search.fill('');
  await page.locator('.catalog-reset').click();
  await page.waitForURL('**/explore');
  assert.equal(await free.isChecked(), false);
  const shelf = page.locator('.seasonal-shelf');
  await shelf.waitFor();
  const [searchBox, shelfBox] = await Promise.all([search.boundingBox(), shelf.boundingBox()]);
  assert(searchBox.y < shelfBox.y && searchBox.y + searchBox.height < page.viewportSize().height);
  await page.goBack();
  await page.waitForURL('**/pricing');
  await page.goto(base + '/explore');
  assert.equal(await free.isChecked(), false);
  await page.route('**/api/catalog/templates', route => route.fulfill({ status: 503 }), { times: 1 });
  await page.reload();
  await page.getByRole('alert').locator('[data-action="retry-catalog"]').click();
  await page.locator('#catalog-grid .template-card').first().waitFor();
}
