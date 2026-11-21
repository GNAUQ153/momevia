import assert from 'node:assert/strict';

const ids = ['hai-phong-bi', 'birthday-radiance', 'proud-of-you'];
const artwork = ['wedding-memory', 'birthday', 'graduation'];
const active = page => page.locator('.mkt-hero').getAttribute('data-hero-template');
const waitForTemplate = (page, id) => page.waitForFunction(value =>
  globalThis.document.querySelector('.mkt-hero')?.dataset.heroTemplate === value, id);

export async function runHeroTemplatesBrowser(browser, base) {
  for (const language of ['vi', 'en']) {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 }, hasTouch: true });
    try {
      if (language === 'en') await context.addInitScript(() => localStorage.setItem('momevia-locale', 'en'));
      const page = await context.newPage();
      await page.goto(base);
      const cover = page.locator('.mkt-hero__cover');
      const dialog = page.getByRole('dialog');
      await waitForTemplate(page, ids[0]);
      const originalBox = await cover.boundingBox();
      for (const [index, id] of ids.entries()) {
        const selector = page.locator(`[data-hero-select="${index}"]`);
        const box = await selector.boundingBox();
        assert(box.width >= 44 && box.height >= 44, 'Template selector has a touch target');
        await selector.click();
        await waitForTemplate(page, id);
        assert.equal(await selector.getAttribute('aria-pressed'), 'true');
        const image = cover.locator('[data-active="true"]');
        assert.match(await image.getAttribute('src'), new RegExp(`${language === 'en' ? '/en' : ''}/${id}\\.svg`));
        assert(await image.evaluate(node => parseFloat(globalThis.getComputedStyle(node).transitionDuration) <= 0.001), 'Reduced motion makes manual changes immediate');
        const nextBox = await cover.boundingBox();
        assert(Math.abs(nextBox.height - originalBox.height) < 1, 'Changing cover keeps the artboard size');
        await cover.click();
        await dialog.locator(`[data-runtime-element="event-photo-${artwork[index]}"]`).waitFor();
        assert.equal(await dialog.locator('h2').textContent(), await selector.getAttribute('aria-label'));
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        await page.waitForFunction(() => globalThis.document.activeElement?.matches('.mkt-hero__cover'));
        assert.equal(await cover.evaluate(node => node === globalThis.document.activeElement), true);
      }
      assert.equal(await page.locator('[data-hero-playback]').isDisabled(), true);
    } finally { await context.close(); }
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install();
    await page.goto(base);
    await waitForTemplate(page, ids[0]);
    await page.locator('[data-hero-image]').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    const transition = await page.locator('[data-hero-image]').first().evaluate(node => {
      const style = globalThis.getComputedStyle(node);
      return { properties: style.transitionProperty.split(', '), duration: parseFloat(style.transitionDuration) };
    });
    assert(transition.duration > 0 && transition.properties.includes('opacity') && transition.properties.includes('transform'), 'Normal motion bridges cover changes with a visible transition');
    for (const id of [ids[1], ids[2], ids[0]]) {
      await page.clock.fastForward(5100);
      await waitForTemplate(page, id);
    }
    const playback = page.locator('[data-hero-playback]');
    await playback.click();
    await page.clock.fastForward(11000);
    assert.equal(await active(page), ids[0], 'Explicit pause persists');
    await playback.click();
    await page.clock.fastForward(5100);
    await waitForTemplate(page, ids[1]);
    const cover = page.locator('.mkt-hero__cover');
    await cover.focus();
    await page.clock.fastForward(11000);
    assert.equal(await active(page), ids[1], 'Focused preview does not change under the keyboard');
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await dialog.locator('[data-runtime-element="event-photo-birthday"]').waitFor();
    await page.clock.fastForward(11000);
    assert.equal(await active(page), ids[1], 'Open player freezes its corresponding cover');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => globalThis.document.activeElement?.matches('.mkt-hero__cover'));
    await cover.evaluate(node => node.blur());
    await page.mouse.move(0, 0);
    // Let modal focus/visibility callbacks settle before advancing the rotation clock.
    await page.clock.runFor(300);
    await page.clock.fastForward(5100);
    await waitForTemplate(page, ids[2]);
    await cover.hover();
    await page.clock.fastForward(11000);
    assert.equal(await active(page), ids[2], 'Pointer hover pauses cover rotation');
    await page.mouse.move(0, 0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.fastForward(11000);
    assert.equal(await active(page), ids[2], 'Reduced motion stops automatic changes');
    await page.locator('[data-hero-select="0"]').click();
    await waitForTemplate(page, ids[0]);
    await page.locator('.mkt-actions a[href="/explore"]').click();
    await page.waitForURL('**/explore');
    await page.clock.fastForward(11000);
    assert.deepEqual(errors, [], 'No callbacks update a disposed hero');

    // A missing alternate cover never replaces the working cover or its player.
    await page.route('**/birthday-radiance.svg?*', route => route.abort());
    await page.goto(base);
    await waitForTemplate(page, ids[0]);
    await page.locator('[data-hero-select="1"]').click();
    await page.clock.fastForward(1000);
    assert.equal(await active(page), ids[0]);
    await page.locator('.mkt-hero__cover').click();
    await page.getByRole('dialog').locator('[data-runtime-element="open-memory"]').waitFor();
  } finally { await context.close(); }
  console.log('PASS Hero covers: all three matching players VI/EN, stable mobile artboard, autoplay loop, pause/resume, focus, hover, reduced motion, disposal and failed-image fallback.');
}
