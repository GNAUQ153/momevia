import assert from 'node:assert/strict';
import path from 'node:path';
import { chromium } from 'playwright';
import { templatePreviewDocument } from '../../web/js/shared/canvas/index.js';
import { runtimeVersionFor } from '../../web/js/shared/canvas/schema.js';

export async function runFestivalBrowser(base) {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-12-05T02:00:00Z'));
    await page.goto(base);
    const lights = page.locator('.festival-lights');
    await lights.waitFor({ state: 'visible' });
    assert.match(await page.locator('[data-season-countdown]').innerText(), /19 ngày 15 giờ/);
    await page.waitForFunction(() => globalThis.document.querySelectorAll('.festival-particles i').length === 30);
    const tree = page.locator('[data-festival-tree]');
    await tree.press('Enter');
    assert.equal(await tree.getAttribute('aria-pressed'), 'true');

    const advent = page.locator('[data-festival-advent]');
    await advent.locator('summary').click();
    assert.equal(await advent.locator('[data-advent-day]:enabled').count(), 5);
    await advent.locator('[data-advent-day="5"]').press('Enter');
    assert.match(await advent.getByRole('status').innerText(), /Ngày 5/);
    await page.locator('.nav-actions [data-locale-select]').selectOption('en');
    await page.waitForFunction(() => globalThis.document.querySelector('[data-advent-result]').textContent.startsWith('Day 5.'));
    const toggle = page.locator('[data-season-toggle]');
    await toggle.click();
    await page.reload();
    await page.waitForFunction(() => globalThis.document.documentElement.dataset.festivalStill === 'true');
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.festival-particles').count(), 0);
    await toggle.click();

    await page.locator('[data-season-link]').click();
    await page.locator('#catalog-grid .template-card').first().waitFor();
    assert.equal(new URL(page.url()).searchParams.get('occasion'), 'Giáng sinh');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base);
    await page.waitForFunction(() => globalThis.document.querySelectorAll('.festival-particles i').length === 12);
    assert.equal(await page.locator('.festival-sleigh').count(), 0);
    assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth), 390);
    if (process.env.BROWSER_ARTIFACT_DIR) {
      await page.locator('.template-card--home').first().scrollIntoViewIfNeeded();
      await page.waitForFunction(() => {
        const image = globalThis.document.querySelector('.template-card--home img');
        return image?.complete && image.naturalWidth > 0;
      });
      await page.evaluate(() => globalThis.scrollTo(0, 0));
      await page.screenshot({ path: path.join(process.env.BROWSER_ARTIFACT_DIR, 'festival-home-390.png'), fullPage: true });
    }

    const doc = templatePreviewDocument({ id: 'snowglobe-countdown' });
    const gift = {
      title: 'Thiệp mùa lễ thử nghiệm',
      templateId: 'snowglobe-countdown',
      documentSnapshot: doc,
      runtimeVersion: runtimeVersionFor(doc),
      replyPermissions: { canSend: false, canRead: false },
    };
    await page.route('**/api/gifts/gifts/festival-fixture', route => route.fulfill({ json: { gift } }));
    const giftUrl = base + '/g/festival-fixture';
    await page.goto(giftUrl);
    const opener = page.locator('[data-runtime-element="open-gift"]');
    const overlay = page.locator('.festival-unboxing');
    const music = page.locator('.festival-recipient__music');
    await music.waitFor();
    assert.equal(await music.getAttribute('aria-pressed'), 'false');
    await opener.click();
    await overlay.waitFor();
    if (process.env.BROWSER_ARTIFACT_DIR) {
      await page.waitForFunction(() => {
        const box = globalThis.document.querySelector('.festival-unboxing');
        return box && Number(globalThis.getComputedStyle(box).opacity) > .4;
      });
      await page.screenshot({ path: path.join(process.env.BROWSER_ARTIFACT_DIR, 'festival-open-box.png') });
    }
    await page.locator('[data-runtime-element="to-discover"]').waitFor();
    assert.equal(await overlay.count(), 0);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(giftUrl);
    await opener.click();
    await page.locator('[data-runtime-element="to-discover"]').waitFor();
    assert.equal(await overlay.count(), 0);
    await page.goto(giftUrl);
    await page.locator('[data-runtime-element="skip-surprise"]').click();
    await page.locator('[data-runtime-element="to-discover"]').waitFor();
    assert.equal(await overlay.count(), 0);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
  console.log('PASS festival browser: countdown, header, calendar, preference persistence, collection, mobile snow and recipient unboxing.');
}
