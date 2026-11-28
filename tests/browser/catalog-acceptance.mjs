import assert from 'node:assert/strict';
import path from 'node:path';

const screens = [[320, 740, 1], [390, 844, 2], [1440, 900, 3]];
const tier = price => Number.isSafeInteger(price) && price >= 0 ? (price === 0 ? 'free' : 'paid') : 'unknown';
const clean = value => value.replace(/\s+/gu, ' ').trim();

async function noOverflow(page, label) {
  assert(await page.evaluate(() => {
    const root = globalThis.document.documentElement;
    return root.scrollWidth <= root.clientWidth + 1;
  }), `${label}: horizontal overflow`);
}

async function verifyCards(page, templates, freeOnly = false) {
  const cards = await page.locator('#catalog-grid .template-card').evaluateAll(nodes => nodes.map(node => ({
    id: node.dataset.templateId,
    tier: node.querySelector('.template-card__price').dataset.priceTier,
  })));
  assert(cards.length > 0 && cards.length <= 9);
  assert.equal(new Set(cards.map(card => card.id)).size, cards.length);
  for (const card of cards) {
    const template = templates.get(card.id);
    assert(template, `Catalog card missing in public API: ${card.id}`);
    assert.equal(card.tier, tier(template.price), `Price tier: ${card.id}`);
    if (freeOnly) assert.equal(card.tier, 'free');
  }
}

// Chạy trên server fixture của integration suite; không tạo tài khoản hoặc giao dịch.
export async function runCatalogAcceptance(browser, base) {
  for (const language of ['vi', 'en']) {
    for (const [width, height, columns] of screens) {
      const label = `${language}-${width}`;
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 768, reducedMotion: 'reduce' });
      try {
        await context.addInitScript(locale => globalThis.localStorage.setItem('momevia-locale', locale), language);
        const response = await context.request.get(base + '/api/catalog/templates');
        assert.equal(response.status(), 200);
        const templates = new Map((await response.json()).templates.map(template => [template.id, template]));
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base + '/explore');
        const grid = page.locator('#catalog-grid');
        const first = grid.locator('.template-card').first();
        await first.waitFor();
        await page.waitForFunction(locale => globalThis.document.documentElement.lang === locale, language);
        await page.evaluate(() => globalThis.document.fonts.ready);
        await verifyCards(page, templates);
        const layout = await grid.evaluate(node => node.ownerDocument.defaultView.getComputedStyle(node).gridTemplateColumns.trim().split(/\s+/).length);
        assert.equal(layout, columns, `${label}: catalog column count`);
        await noOverflow(page, label);
        if (process.env.BROWSER_ARTIFACT_DIR) await page.screenshot({ path: path.join(process.env.BROWSER_ARTIFACT_DIR, `catalog-acceptance-${label}.png`) });

        // Tìm một mẫu Originals miễn phí theo đúng ngôn ngữ đang hiển thị.
        const query = language === 'vi' ? 'qua cau tuyet' : 'snowglobe countdown';
        await page.goto(base + '/explore?free=1&q=' + query.replaceAll(' ', '+'));
        await first.waitFor();
        await verifyCards(page, templates, true);
        const search = page.locator('#template-search');
        const free = page.locator('#free-filter');
        const chip = page.locator('#catalog-active-filters [data-filter="freeOnly"]');
        assert.equal(await free.isChecked(), true);
        await chip.press('Enter');
        await chip.waitFor({ state: 'detached' });
        assert.equal(await search.inputValue(), query);
        assert.equal(await free.isChecked(), false);
        const url = new URL(page.url());
        assert.equal(url.searchParams.get('q'), query);
        assert.equal(url.searchParams.has('free'), false);
        await page.waitForFunction(() => globalThis.document.activeElement?.matches('.catalog-reset'));
        const card = grid.locator('[data-template-id="snowglobe-countdown"]');
        await card.waitFor();
        const price = card.locator('.template-card__price');
        const cardPrice = clean(await price.innerText());
        const cardTier = await price.getAttribute('data-price-tier');
        const catalogUrl = new URL(page.url());
        await card.locator('.template-card__title').click();
        const detail = page.locator('.detail-info .catalog-price-summary');
        await detail.waitFor();
        assert.equal(await detail.getAttribute('data-price-tier'), cardTier);
        assert(cardPrice.endsWith(clean(await detail.locator('strong').innerText())));
        const createHref = await page.locator('[data-template-create-cta]').getAttribute('href');
        const trigger = page.locator('.detail-start-actions [data-template-preview]');
        await trigger.press('Enter');
        const dialog = page.locator('.template-preview-dialog');
        await dialog.waitFor({ state: 'visible' });
        const previewPrice = dialog.locator('[data-preview-price]');
        assert.equal(await previewPrice.getAttribute('data-price-tier'), cardTier);
        assert.equal(clean(await previewPrice.locator('strong').innerText()), clean(await detail.locator('strong').innerText()));
        assert.equal(await dialog.locator('[data-template-use]').getAttribute('href'), createHref);
        await dialog.locator('[data-template-close]').press('Enter');
        await dialog.waitFor({ state: 'hidden' });
        await page.waitForFunction(() => globalThis.document.activeElement?.matches('.detail-start-actions [data-template-preview]'));
        await page.goBack();
        await search.waitFor();
        assert.equal(new URL(page.url()).search, catalogUrl.search);
        assert.equal(await search.inputValue(), query);
        await noOverflow(page, label);
        assert.deepEqual(errors, [], `${label}: page errors`);
      } finally {
        await context.close();
      }
    }
  }
  console.log('PASS Catalog acceptance VI/EN: six responsive cases, public prices, filters, Preview and Back.');
}
