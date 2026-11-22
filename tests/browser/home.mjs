import assert from 'node:assert/strict';
import path from 'node:path';
import { chromium } from 'playwright';
import { runHeroTemplatesBrowser } from './hero-templates.mjs';

const screens = [[1614, 1040], [1440, 900], [1024, 768], [820, 1180], [768, 1024], [390, 844], [320, 740]];

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
          const image = cover.locator('img[data-active="true"]');
          await image.evaluate(img => img.decode());
          assert.equal(await page.locator('html').getAttribute('lang'), language);
          assert.equal(await page.locator('html').getAttribute('data-type'), 'software');
          assert.equal(await page.locator('main > section').count(), 4);
          assert.equal(await page.locator('main > .mkt-journey').count(), 1);
          assert.equal(await page.locator('.mkt-journey [data-mkt-step]').count(), 5);
          assert.equal(await page.locator('footer #mkt-faq-title').count(), 1);
          const brand = await page.locator('#site-header .brand').boundingBox();
          assert(brand.height >= 44, `${width}: brand tap target`);
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
          if (width === 1024) {
            const toggle = page.locator('#site-header [data-action="toggle-menu"]');
            const compactMenu = page.locator('#mobile-nav');
            assert.equal(await page.locator('#site-header .nav-links').isVisible(), false, 'desktop links collapse at 1024px');
            assert.equal(await toggle.isVisible(), true, 'compact menu button is visible');
            await toggle.click();
            await compactMenu.waitFor({ state: 'visible' });
            assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
            assert.equal(await compactMenu.locator('a[href="/about"]').isVisible(), true);
            const compactFontSize = await compactMenu.locator('a[href="/about"]').evaluate(node => parseFloat(node.ownerDocument.defaultView.getComputedStyle(node).fontSize));
            assert(compactFontSize >= 14, 'compact navigation text stays readable');
            await toggle.press('Escape');
            await compactMenu.waitFor({ state: 'hidden' });
            assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
            await toggle.click();
            await compactMenu.waitFor({ state: 'visible' });
            await page.setViewportSize({ width: 1200, height });
            // CSS co the an menu truoc khi listener matchMedia cap nhat aria-expanded.
            // Cho ca hidden DOM va ARIA; van fail neu ung dung khong dong menu.
            await page.waitForFunction(() => {
              const nav = globalThis.document.getElementById('mobile-nav');
              const button = globalThis.document.querySelector('#site-header [data-action="toggle-menu"]');
              return nav?.hidden === true && button?.getAttribute('aria-expanded') === 'false';
            }, null, { timeout: 5000 });
            await compactMenu.waitFor({ state: 'hidden' });
            assert.equal(await toggle.getAttribute('aria-expanded'), 'false', 'menu closes when desktop nav returns');
            await page.setViewportSize({ width, height });
          }

          assert.equal(await cover.evaluate(node => globalThis.getComputedStyle(node).animationName), 'none');
          const cards = page.locator('#home-featured-gifts .template-card');
          await cards.first().waitFor();
          const [featuredTitle, journeyTitle, howTitle, cardsTail, journeySection] = await Promise.all([
            page.locator('.mkt-featured__heading h2').boundingBox(),
            page.locator('#mkt-journey-title').boundingBox(),
            page.locator('#mkt-experience-title').boundingBox(),
            cards.evaluateAll(items => Math.max(...items.map(item => item.getBoundingClientRect().bottom))),
            page.locator('main > .mkt-journey').boundingBox(),
          ]);
          const artwork = await hero.locator('.mkt-hero__artwork').boundingBox();
          const frameGap = featuredTitle.y - Math.max(artwork.y + artwork.height, previewBox.y + previewBox.height);
          const featuredToJourneyGap = journeyTitle.y - cardsTail;
          const journeyToHowGap = howTitle.y - (journeySection.y + journeySection.height);
          assert(frameGap >= 30 && frameGap <= (width <= 900 ? 80 : 120),
            `${width}×${height} ${language} hero → featured: ${frameGap}px`);
          assert(featuredToJourneyGap >= 30 && featuredToJourneyGap <= 220,
            `${width}×${height} ${language} featured → journey: ${featuredToJourneyGap}px`);
          assert(journeyToHowGap >= 20 && journeyToHowGap <= 100,
            `${width}×${height} ${language} journey → how-to: ${journeyToHowGap}px`);
          const footerStep = await page.locator('footer .footer-column a').evaluateAll(items =>
            items[1].getBoundingClientRect().top - items[0].getBoundingClientRect().top);
          assert(footerStep >= 28 && footerStep <= 44, `${width}×${height} ${language} footer link spacing: ${footerStep}px`);
          if (width === 1440) {
            const selector = page.locator('.nav-actions [data-locale-select]');
            const options = await selector.locator('option').allTextContents();
            assert.deepEqual(options, ['VI', 'EN']);
            if (await selector.evaluate(node => node.ownerDocument.defaultView.CSS.supports('appearance', 'base-select'))) {
              await selector.click();
              await selector.and(page.locator('select:open')).waitFor();
              assert.equal(await selector.evaluate(node => node.ownerDocument.defaultView.getComputedStyle(node, '::picker(select)').appearance), 'base-select');
              await page.keyboard.press('Escape');
              await selector.and(page.locator('select:open')).waitFor({ state: 'hidden' });
              assert.equal(await selector.inputValue(), language);
            }
            const otherLanguage = language === 'vi' ? 'en' : 'vi';
            await selector.selectOption(otherLanguage);
            await page.waitForFunction(value => globalThis.document.documentElement.lang === value, otherLanguage);
            await selector.selectOption(language);
            await page.waitForFunction(value => globalThis.document.documentElement.lang === value, language);
          }
          if (width !== 390) continue;
          const journey = page.locator('main > .mkt-journey');
          for (const step of ['create', 'share', 'open', 'reply', 'keep']) {
            const button = journey.locator(`[data-mkt-step="${step}"]`);
            await button.click();
            assert.equal(await button.getAttribute('aria-pressed'), 'true');
            assert.equal(await journey.locator('[data-mkt-journey-scene]').getAttribute('data-stage'), step);
            assert.equal(await journey.locator(`[data-mkt-panel="${step}"]`).isVisible(), true);
          }
          // 390px: bước có cỡ chữ dễ đọc và vuốt ngang thực sự đổi cảnh.
          const rail = journey.locator('.mkt-journey__steps');
          assert(await rail.evaluate(node => node.scrollWidth > node.clientWidth), 'mobile journey uses an inner horizontal rail');
          assert(await journey.locator('[data-mkt-step="create"]').evaluate(node =>
            parseFloat(globalThis.getComputedStyle(node).fontSize) >= 13), 'mobile step labels remain readable');
          await journey.locator('[data-mkt-step="create"]').click();
          await journey.locator('[data-mkt-journey-scene]').evaluate(scene => {
            const makeTouch = (type, x, y) => {
              const touch = new globalThis.Touch({ identifier: 1, target: scene, clientX: x, clientY: y });
              const options = type === 'touchstart'
                ? { bubbles: true, touches: [touch], targetTouches: [touch], changedTouches: [touch] }
                : { bubbles: true, touches: [], targetTouches: [], changedTouches: [touch] };
              scene.dispatchEvent(new globalThis.TouchEvent(type, options));
            };
            makeTouch('touchstart', 215, 120);
            makeTouch('touchend', 120, 123);
          });
          assert.equal(await journey.locator('[data-mkt-journey-scene]').getAttribute('data-stage'), 'share');
          assert.equal(await journey.locator('[data-mkt-step="share"]').getAttribute('aria-pressed'), 'true');
          assert.equal(await journey.locator('[data-mkt-panel="share"]').isVisible(), true);
          assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth), width);
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
          const back = stage.locator('[data-runtime-element="memory-back"]');
          await back.waitFor();
          const modelNode = await back.elementHandle();
          const previewLanguage = dialog.locator('[data-locale-select]');
          await previewLanguage.selectOption('en');
          await stage.getByText('A memory', { exact: true }).waitFor();
          assert.equal(await stage.getAttribute('aria-label'), 'Memory');
          assert.equal(await back.evaluate((node, original) => node === original, modelNode), true);
          await previewLanguage.selectOption(language);
          await page.waitForFunction(value => globalThis.document.documentElement.lang === value, language);
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
        await waitForHowHeading(page);
        await page.locator('.mkt-hero a[href="/explore"]').click();
        await page.locator('#template-search').waitFor();
        assert.equal(await page.locator('html').getAttribute('data-type'), null);
        await page.goBack();
        await waitForHowHeading(page);
        await verifyCatalog(context, page, base);
        for (const width of [1440, 390]) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(base);
          await page.locator('.mkt-hero h1').waitFor();
          const homeHeader = await headerSnapshot(page);
          await page.goto(base + '/explore');
          await page.locator('#template-search').waitFor();
          assert.deepEqual(await headerSnapshot(page), homeHeader, `${language} ${width}: shared header styling and links`);
        }
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
    const motionPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await motionPage.goto(base);
    const intro = motionPage.locator('.mkt-hero__intro');
    await motionPage.waitForFunction(() => globalThis.document.getAnimations()
      .some(animation => animation.animationName === 'mkt-glass-sheen' && animation.playState === 'finished'));
    await intro.hover();
    await motionPage.waitForFunction(() => globalThis.document.getAnimations()
      .some(animation => animation.animationName === 'mkt-glass-sheen' && animation.playState === 'running'));
    const title = motionPage.locator('[data-moment="liquid-type"] h2');
    const filter = motionPage.locator('filter[id^="mo-lt-"]');
    await filter.waitFor({ state: 'attached' });
    await title.scrollIntoViewIfNeeded();
    const box = await title.boundingBox();
    await motionPage.mouse.move(box.x + 10, box.y + 20);
    await motionPage.mouse.move(box.x + 110, box.y + 24, { steps: 4 });
    await motionPage.waitForFunction(() => globalThis.document.querySelector('[data-moment="liquid-type"] h2').style.filter.includes('mo-lt-'));
    await motionPage.emulateMedia({ reducedMotion: 'reduce' });
    await filter.waitFor({ state: 'detached' });
    assert.equal(await title.evaluate(node => node.style.filter), '');
    await motionPage.emulateMedia({ reducedMotion: 'no-preference' });
    await filter.waitFor({ state: 'attached' });
    await motionPage.locator('.mkt-hero a[href="/explore"]').click();
    await filter.waitFor({ state: 'detached' });
    await motionPage.close();
    await runHeroTemplatesBrowser(browser, base);
    console.log('PASS Browser home VI/EN: seven viewports, compact section gaps, first-screen actions, preview, Escape and focus, Back and how-it-works, reduced motion.');
  } finally { await browser.close(); }
}

function headerSnapshot(page) {
  return page.locator('#site-header').evaluate(header => {
    const view = header.ownerDocument.defaultView;
    const style = view.getComputedStyle(header);
    const nav = header.querySelector('.nav-inner');
    const current = header.querySelector('.nav-links a.is-active');
    const underline = view.getComputedStyle(current, '::after');
    return {
      height: header.offsetHeight,
      position: style.position,
      backdrop: style.backdropFilter,
      background: style.backgroundColor,
      font: style.fontFamily,
      width: nav.offsetWidth,
      underline: underline.backgroundImage,
      transition: view.getComputedStyle(current).transition,
      links: [...header.querySelectorAll('.nav-links a')].map(link => link.getAttribute('href')),
    };
  });
}

function waitForHowHeading(page) {
  return page.waitForFunction(() => {
    if (globalThis.location.hash !== '#how-it-works' || globalThis.scrollY === 0) return false;
    const heading = globalThis.document.getElementById('mkt-experience-title')?.getBoundingClientRect();
    const header = globalThis.document.getElementById('site-header')?.getBoundingClientRect();
    return heading && header && heading.top >= header.bottom - 1 && heading.bottom <= globalThis.innerHeight;
  });
}

async function verifyCatalog(context, page, base) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/pricing');
  const freeLink = page.locator('a[href="/explore?free=1"]');
  await freeLink.waitFor();
  const freeBox = await freeLink.boundingBox();
  assert(freeBox.y >= 0 && freeBox.y + freeBox.height <= 844);
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
  const first = page.locator('#catalog-grid .template-card').first();
  const firstBox = await first.boundingBox();
  assert(firstBox.y < 844);
  const shelfSummary = shelf.locator('summary');
  assert.equal(await shelf.getAttribute('open'), null);
  await shelfSummary.tap();
  assert.notEqual(await shelf.getAttribute('open'), null);
  await shelfSummary.press('Enter');
  await search.fill('midnight bloom');
  const cover=first.locator('img');
  await cover.waitFor({state:'visible'});
  await cover.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>Boolean(globalThis.document.querySelector('#catalog-grid .template-card img[src]:not([data-cover-lazy])')));
  const retainedCover=await cover.elementHandle(),coverSource=await cover.getAttribute('src');
  const retained = await first.elementHandle();
  await search.fill('MIDNIGHT BLOOM');
  assert.equal(await first.evaluate((node, original) => node === original, retained), true);
  assert.equal(await cover.evaluate((node, original) => node === original, retainedCover),true);
  assert.equal(await cover.getAttribute('src'),coverSource);
  assert.equal(await first.evaluate(node => globalThis.getComputedStyle(node).animationName), 'none');
  await search.fill('');
  await page.locator('#catalog-pagination [data-page="2"]').first().press('Enter');
  await page.waitForFunction(() => globalThis.document.activeElement?.id === 'catalog-range');
  let failedCatalogRequests=0;
  await page.route('**/api/catalog/templates', route => {failedCatalogRequests++;return route.fulfill({ status: 503 });}, { times: 1 });
  // A normal catalog navigation now embeds its public data in HTML. Remove
  // only that bootstrap in this fixture to exercise a real API failure/retry.
  await page.route(url=>url.origin===base&&url.pathname==='/explore',async route=>{
    const response=await route.fetch(),html=await response.text();
    const body=html.replace(/<script type="application\/json" id="public-catalog-bootstrap">[\s\S]*?<\/script>/,'');
    assert.notEqual(body,html,'Catalog fixture must contain its public bootstrap');
    await route.fulfill({response,body});
  },{times:1});
  await page.reload();
  await page.getByRole('alert').locator('[data-action="retry-catalog"]').click();
  await page.locator('#catalog-grid .template-card').first().waitFor();
  assert.equal(failedCatalogRequests,1);
}
