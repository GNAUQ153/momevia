import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { startSfxFixture } from './sfx-fixture.mjs';

const root = process.cwd();
const output = path.join(root, 'local/ui-ux-20261126/followup');
fs.mkdirSync(output, { recursive: true });
const fixture = await startSfxFixture({ label: 'ui-ux-followup' });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const measurements = [];
try {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  const html = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  await page.route('**/__qa', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto(fixture.base + '/__qa');
  await page.evaluate(async () => {
    globalThis.qaI18n = await import('/js/core/i18n.js');
    await globalThis.qaI18n.initializeLocale();
    const { createGiftViews } = await import('/js/pages/gifts.js');
    globalThis.qaGift = createGiftViews({ state: {}, buttonLink: (url, label, css) => `<a href="${url}" class="btn ${css}">${label}</a>` });
  });
  for (const locale of ['vi', 'en']) for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const open of ['link', 'invite']) for (const send of ['link', 'invite', 'none']) {
      const urls = [fixture.base + '/g/qa-share', fixture.base + '/g/qa-share?invite=qa-invite'];
      await page.evaluate(async ({ locale, open, send, urls }) => {
        await globalThis.qaI18n.selectLocale(locale);
        globalThis.document.querySelector('main').innerHTML = globalThis.qaGift.successPage({ slug: 'qa-share', url: urls[0], inviteUrl: urls[1], access: { open, send, read: 'sender' } });
      }, { locale, open, send, urls });
      const buttons = page.locator('.share-option [data-action="copy-link"]');
      const ordered = open === 'invite' ? [urls[1], urls[0]] : urls;
      assert.deepEqual(await buttons.evaluateAll(nodes => nodes.map(n => n.dataset.value)), ordered);
      const labels = locale === 'vi' ? ['Sao chép link thường', 'Sao chép link mời'] : ['Copy regular link', 'Copy invitation link'];
      assert.deepEqual(await buttons.allTextContents().then(values => values.map(v => v.trim())), open === 'invite' ? labels.toReversed() : labels);
      assert.deepEqual(await page.locator('.share-option [data-action="qr"]').evaluateAll(nodes => nodes.map(n => n.dataset.value)), ordered);
      const shares = await page.locator('.share-option [data-action="share-gift"]').evaluateAll(nodes => nodes.map(n => n.dataset.value));
      if (shares.length) assert.deepEqual(shares, ordered);
      assert.equal(await page.locator('.share-option').first().locator('a').getAttribute('href'), new URL(ordered[0]).pathname + new URL(ordered[0]).search);
      await assertFits(page, { item: 'B1', locale, width, open, send });
    }
    await page.screenshot({ path: path.join(output, `share-${locale}-${width}.png`), fullPage: true });
    // Long translated labels must remain operable with doubled text.
    await page.locator('.share-link button').evaluateAll(nodes => nodes.forEach(n => { n.style.fontSize = '28px'; }));
    await assertFits(page, { item: 'B1-large-text', locale, width });
  }
  await page.route('**/api/gifts/gifts/mine/qa-list/recipients', route => route.fulfill({ json: { recipients: [] } }));
  for (const locale of ['vi', 'en']) for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(async locale => {
      await globalThis.qaI18n.selectLocale(locale);
      globalThis.document.querySelector('main').innerHTML = globalThis.qaGift.successPage({ slug: 'qa-list', recipientMode: 'list' });
      const { mountRecipientResults } = await import('/js/features/gifts/recipient-results.js');
      await mountRecipientResults(globalThis.document.querySelector('[data-recipient-results-host]'), 'qa-list');
    }, locale);
    const download = page.locator('.recipient-results > a[download]');
    assert.equal(await download.getAttribute('href'), '/api/gifts/gifts/mine/qa-list/recipients.xlsx');
    await download.focus();
    assert.equal(await download.evaluate(node => node === globalThis.document.activeElement), true);
    await assertFits(page, { item: 'BASE-list', locale, width });
    await page.screenshot({ path: path.join(output, `xlsx-${locale}-${width}.png`), fullPage: true });
    await download.evaluate(node => { node.style.fontSize = '28px'; });
    await assertFits(page, { item: 'BASE-list-large-text', locale, width });
  }
  await context.close();

  // Exercise actual SPA routes, preview loading/retry and navigation in an isolated server.
  for (const locale of ['vi', 'en']) {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await context.addInitScript(locale => localStorage.setItem('momevia-locale', locale), locale);
    const page = await context.newPage(), mutations = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/api/designs/designs')) mutations.push(request.url()); });
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(fixture.base + '/template/birthday-radiance');
      await page.locator('.detail-art img').evaluate(img => img.decode());
      const layout = await page.locator('.detail-info').evaluate(node => {
        const box = selector => { const r = node.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }; };
        return { title: box('h1'), price: box('.detail-price-row'), art: box('.detail-art'), actions: box('.detail-start-actions') };
      });
      if (width < 681) {
        assert(layout.title.bottom <= layout.price.y + 1);
        assert(layout.price.bottom <= layout.art.y + 1);
        assert(layout.art.bottom <= layout.actions.y + 1);
      } else assert(layout.title.right <= layout.art.x);
      await assertFits(page, { item: 'B2-detail', locale, width, layout });
      await page.screenshot({ path: path.join(output, `detail-${locale}-${width}.png`), fullPage: true });
      const trigger = page.locator('[data-template-preview]');
      await trigger.focus(); await page.keyboard.press('Enter');
      const dialog = page.locator('.template-preview-dialog');
      await dialog.locator('[data-template-reset]').waitFor({ state: 'visible' });
      assert.equal(await dialog.locator('[data-template-use]').getAttribute('href'), '/create/birthday-radiance?mode=quick');
      const select = dialog.locator('select');
      assert.equal(await select.count(), 1);
      await select.selectOption(locale === 'vi' ? 'en' : 'vi');
      await dialog.locator('[data-template-reset]').click();
      await assertFits(page, { item: 'B2-preview', locale, width });
      const controls = await dialog.locator('.template-preview-actions button,.template-preview-actions a,.template-preview-actions select').evaluateAll(nodes => nodes.filter(n => !n.hidden).map(n => { const r = n.getBoundingClientRect(); return { left: r.left, right: r.right, height: r.height, clipped: n.scrollHeight > n.clientHeight + 1 }; }));
      assert(controls.every(r => r.left >= 0 && r.right <= width + 1 && r.height >= 44 && !r.clipped), JSON.stringify(controls));
      await page.screenshot({ path: path.join(output, `preview-${locale}-${width}.png`), fullPage: true });
      await dialog.locator('.template-preview-actions').evaluate(node => { node.style.fontSize = '28px'; node.querySelectorAll('button,a,select').forEach(n => { n.style.fontSize = '28px'; }); });
      await assertFits(page, { item: 'B2-preview-large-text', locale, width });
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(await trigger.evaluate(n => n === globalThis.document.activeElement), true);
      assert.equal(await dialog.locator('.template-preview-player').evaluate(n => n.childElementCount), 0);
    }
    // Force one failed preview request, then retry without creating a draft.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixture.base + '/template/birthday-radiance');
    let fail = true;
    await page.route('**/api/designs/library/templates/birthday-radiance/preview', route => fail ? (fail = false, route.fulfill({ status: 503, json: { error: 'QA preview retry' } })) : route.continue());
    await page.locator('[data-template-preview]').click();
    await page.locator('[data-template-retry]').waitFor({ state: 'visible' });
    await page.locator('[data-template-retry]').click();
    await page.locator('[data-template-reset]').waitFor({ state: 'visible' });
    await page.locator('[data-template-close]').click();
    // Isolate viewport visibility from the independent footer suppression rule.
    await page.locator('main').evaluate(n => { n.style.minHeight = '2600px'; });
    const inline = page.locator('[data-template-create-cta]'), dock = page.locator('[data-floating-cta]');
    await inline.evaluate(n => n.scrollIntoView({ block: 'center' }));
    await page.waitForFunction(() => globalThis.document.querySelector('[data-floating-cta]').hidden);
    await inline.evaluate(n => globalThis.scrollBy(0, n.getBoundingClientRect().bottom + 10));
    await dock.waitFor({ state: 'visible' });
    assert.equal(await dock.locator('[data-floating-action="create"]').getAttribute('href'), await inline.getAttribute('href'));
    await inline.evaluate(n => n.scrollIntoView({ block: 'center' }));
    await dock.waitFor({ state: 'hidden' });
    // A versioned Creator template keeps its exact preview endpoint and create URL.
    await page.route('**/api/catalog/templates/qa-versioned', route => route.fulfill({ json: { template: { id: 'qa-versioned', versionId: 'version/a', title: 'QA version', price: 59000, creator: 'QA', scenes: 1 } } }));
    const preview = await fixture.request('/designs/library/templates/birthday-radiance/preview');
    assert.equal(preview.status, 200);
    await page.route('**/api/catalog/templates/qa-versioned/versions/version%2Fa', route => route.fulfill({ json: { version: { document: preview.data.documents.vi } } }));
    await page.goto(fixture.base + '/template/qa-versioned');
    const expected = '/create/qa-versioned?mode=quick&version=version%2Fa';
    assert.equal(await page.locator('[data-template-create-cta]').getAttribute('href'), expected);
    assert.match(await page.locator('.detail-price-row').innerText(), /59[.,]000/);
    await page.locator('[data-template-preview]').click();
    await page.locator('[data-template-reset]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-template-use]').getAttribute('href'), expected);
    await page.keyboard.press('Escape');
    // Navigation back retains the filter query through the actual detail breadcrumb.
    await page.goto(fixture.base + '/explore?q=Birthday&free=1');
    const before = new URL(page.url()).pathname + new URL(page.url()).search;
    await page.locator('#catalog-grid .template-card__title').first().click();
    await page.locator('.detail-info h1').waitFor();
    assert.equal(await page.locator('.breadcrumb a').getAttribute('href'), before);
    await page.locator('.breadcrumb a').click();
    await page.locator('#template-search').waitFor();
    assert.equal(await page.locator('#template-search').inputValue(), 'Birthday');
    assert.equal(mutations.length, 0, 'Preview/replay/retry never create drafts');
    assert.deepEqual(errors, []);
    await context.close();
  }
  fs.writeFileSync(path.join(output, 'measurements.json'), JSON.stringify(measurements, null, 2));
  console.log(`PASS B1/B2/BASE-list: ${measurements.length} layout checks, VI/EN, 320/390/1440px, enlarged labels, link permissions, version, retry, focus, dock and catalog return.`);
} finally {
  await browser.close();
  await fixture.close();
}

async function assertFits(page, details) {
  const size = await page.evaluate(() => ({ width: globalThis.document.documentElement.clientWidth, scroll: globalThis.document.documentElement.scrollWidth }));
  measurements.push({ ...details, ...size });
  assert(size.scroll <= size.width + 1, JSON.stringify({ ...details, ...size }));
}
