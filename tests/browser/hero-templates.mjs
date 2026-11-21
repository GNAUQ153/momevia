import assert from 'node:assert/strict';

const ids = ['hai-phong-bi', 'birthday-radiance', 'proud-of-you'];
const artwork = ['wedding-memory', 'birthday', 'graduation'];
const active = page => page.locator('.mkt-hero').getAttribute('data-hero-template');
const waitForTemplate = (page, id) => page.waitForFunction(value =>
  globalThis.document.querySelector('.mkt-hero')?.dataset.heroTemplate === value, id);
const progressState = page => page.locator('[aria-pressed="true"] [data-hero-progress]').evaluate(node => {
  const animation = node.getAnimations()[0];
  return {
    time: Number(animation?.currentTime), state: animation?.playState,
    duration: animation?.effect.getTiming().duration, easing: animation?.effect.getTiming().easing,
    scale: new globalThis.DOMMatrixReadOnly(globalThis.getComputedStyle(node).transform).a,
  };
});
async function finishProgress(page, id) {
  await page.evaluate(() => {
    globalThis.document.querySelector('[data-peeking]')?.getAnimations().forEach(animation => animation.finish());
    globalThis.document.querySelector('[aria-pressed="true"] [data-hero-progress]').getAnimations()[0].finish();
  });
  await waitForTemplate(page, id);
}

async function verifyOrbit(page, previousId, nextId) {
  const sample = await page.locator('.mkt-hero__cover').evaluate((cover, ids) => {
    const oldCard = cover.querySelector(`[data-hero-image="${ids[0]}"]`);
    const newCard = cover.querySelector(`[data-hero-image="${ids[1]}"]`);
    const animations = [oldCard, newCard].flatMap(card => card.getAnimations());
    for (const animation of animations) {
      animation.pause();
      animation.currentTime = Number(animation.effect.getTiming().duration) * 0.25;
    }
    const centre = node => {
      const box = node.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    const angle = node => {
      const matrix = new globalThis.DOMMatrixReadOnly(globalThis.getComputedStyle(node).transform);
      return Math.atan2(matrix.b, matrix.a);
    };
    const entering = newCard.getAnimations().find(animation => animation.transitionProperty === 'transform');
    const start = entering && new globalThis.DOMMatrixReadOnly(entering.effect.getKeyframes()[0].transform);
    const blur = node => Number(globalThis.getComputedStyle(node).filter.match(/[\d.]+/)?.[0] || 0);
    const result = { old: centre(oldCard), next: centre(newCard), slot: centre(cover), oldAngle: angle(oldCard), newAngle: angle(newCard), count: animations.length,
      oldBlur: blur(oldCard), newBlur: blur(newCard), inlineFilter: newCard.style.filter,
      duration: entering?.effect.getTiming().duration, startAngle: start && Math.atan2(start.b, start.a) * 180 / Math.PI,
      newZ: Number(globalThis.getComputedStyle(newCard).zIndex), oldZ: Number(globalThis.getComputedStyle(oldCard).zIndex) };
    for (const animation of animations) animation.finish();
    result.settledBlur = blur(newCard);
    return result;
  }, [previousId, nextId]);
  assert(sample.count >= 4, 'Both complete cards animate transform and opacity');
  assert(sample.old.x < sample.slot.x && sample.oldAngle < 0, 'Old card arcs out to the left');
  assert(sample.next.x > sample.slot.x && sample.next.y > sample.slot.y && sample.newAngle > 0, 'Next card rises along an arc from the lower right');
  assert(sample.newZ > sample.oldZ, 'Incoming card stays in front, including the last-to-first wrap');
  assert.equal(sample.duration, 1200, 'Orbit has a slower 1.2-second handoff');
  assert(Math.abs(sample.startAngle - 12) < 0.1, `Handoff continues from the teased angle without jumping back (${sample.startAngle}°)`);
  assert(sample.oldBlur > 0 && sample.oldBlur <= 2 && sample.newBlur > 0 && sample.newBlur <= 2, 'Moving cards use only a gentle blur');
  assert.equal(sample.settledBlur, 0, 'Selected card becomes completely sharp at rest');
  assert.equal(sample.inlineFilter, '', 'Teaser blur is handed off without leaving inline styling');
}

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
      const frame = await page.locator('.mkt-hero__frame').boundingBox();
      assert(await page.locator('.mkt-stage__cards').evaluate(node => {
        const style = globalThis.getComputedStyle(node);
        return ['hidden', 'clip'].includes(style.overflowX) && ['hidden', 'clip'].includes(style.overflowY);
      }), 'The dedicated card layer clips moving cards on both axes');
      const note = await page.locator('.mkt-stage__note').boundingBox();
      const reply = await page.locator('.mkt-stage__reply').boundingBox();
      assert(note.x < frame.x && note.x + note.width > frame.x, 'Left note straddles the frame');
      assert(reply.x < frame.x + frame.width && reply.x + reply.width > frame.x + frame.width, 'Right note straddles the frame');
      assert.equal(await page.locator('.mkt-stage__cards .mkt-stage__note, .mkt-stage__cards .mkt-stage__reply').count(), 0, 'Notes remain outside the card clipping layer');
      const controls = await page.locator('.mkt-hero__rotation').boundingBox();
      assert(controls.y >= frame.y + frame.height, 'The three indicators sit below the artwork');
      assert.equal(await page.locator('[data-hero-playback]').count(), 0, 'There is no pause button');
      for (const [index, id] of ids.entries()) {
        const selector = page.locator(`[data-hero-select="${index}"]`);
        const box = await selector.boundingBox();
        assert(box.width >= 44 && box.height >= 44, 'Template selector has a touch target');
        await selector.click();
        await waitForTemplate(page, id);
        assert.equal(await selector.getAttribute('aria-pressed'), 'true');
        assert.equal(await selector.locator('[data-hero-progress]').evaluate(node => node.getAnimations().length), 0, 'Reduced motion uses a static selected indicator');
        const image = cover.locator('[data-active="true"]');
        assert.match(await image.getAttribute('src'), new RegExp(`${language === 'en' ? '/en' : ''}/${id}\\.svg`));
        assert(await image.evaluate(node => parseFloat(globalThis.getComputedStyle(node).transitionDuration) <= 0.001), 'Reduced motion makes manual changes immediate');
        assert.equal(await image.evaluate(node => globalThis.getComputedStyle(node).filter), 'none', 'Reduced motion keeps the card sharp');
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
    } finally { await context.close(); }
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await waitForTemplate(page, ids[0]);
    await page.locator('[data-hero-image]').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    await page.locator('[data-peeking]').waitFor({ state: 'attached' });
    const transition = await page.locator('[data-hero-image]').first().evaluate(node => {
      const style = globalThis.getComputedStyle(node);
      return { properties: style.transitionProperty.split(', '), duration: parseFloat(style.transitionDuration) };
    });
    assert(transition.duration > 0 && transition.properties.includes('opacity') && transition.properties.includes('transform'), 'Normal motion bridges cover changes with a visible transition');
    const firstProgress = await progressState(page);
    assert.equal(firstProgress.duration, 5000);
    assert.equal(firstProgress.easing, 'linear');
    await page.locator('[aria-pressed="true"] [data-hero-progress]').evaluate(node => {
      const animation = node.getAnimations()[0];
      animation.pause();
      animation.currentTime = 2500;
    });
    await page.locator('[data-peeking]').evaluate(node => {
      const animation = node.getAnimations()[0];
      animation.pause();
      animation.currentTime = 2500;
    });
    assert.equal(await page.locator('[data-peeking]').evaluate(node => Number(globalThis.getComputedStyle(node).opacity)), 0, 'Next cover remains hidden during the first three seconds');
    await page.locator('[data-peeking]').evaluate(node => { node.getAnimations()[0].currentTime = 4000; });
    const hint = await page.locator('[data-peeking]').evaluate(node => ({ opacity: Number(globalThis.getComputedStyle(node).opacity), active: node.dataset.active }));
    assert(hint.opacity > 0 && hint.opacity < 0.72 && hint.active === 'false', 'Last two seconds reveal a partial, non-selected next cover');
    assert(Math.abs((await progressState(page)).scale - 0.5) < 0.01, 'Half the duration fills half the track');
    assert.equal(await active(page), ids[0], 'Partial fill does not change the cover');
    let previousId = ids[0];
    for (const id of [ids[1], ids[2], ids[0]]) {
      await finishProgress(page, id);
      await verifyOrbit(page, previousId, id);
      previousId = id;
      assert((await progressState(page)).time < 1000, 'Next cover starts a fresh progress cycle');
    }
    const cover = page.locator('.mkt-hero__cover');
    await cover.focus();
    await finishProgress(page, ids[1]);
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await dialog.locator('[data-runtime-element="event-photo-birthday"]').waitFor();
    assert.equal((await progressState(page)).state, 'paused', 'Preview pauses the same progress clock');
    assert.equal(await page.locator('[data-peeking]').evaluate(node => node.getAnimations()[0].playState), 'paused', 'Preview also pauses the teaser');
    assert.equal(await active(page), ids[1], 'Open player freezes its corresponding cover');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => globalThis.document.activeElement?.matches('.mkt-hero__cover'));
    await cover.evaluate(node => node.blur());
    await page.mouse.move(0, 0);
    await page.waitForFunction(() => globalThis.document.querySelector('[aria-pressed="true"] [data-hero-progress]')?.getAnimations()[0]?.playState === 'running');
    await finishProgress(page, ids[2]);
    await cover.hover();
    await finishProgress(page, ids[0]);
    await page.mouse.move(0, 0);

    await page.locator('footer').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => globalThis.document.querySelector('[aria-pressed="true"] [data-hero-progress]')?.getAnimations()[0]?.playState === 'paused');
    const offscreenTime = (await progressState(page)).time;
    await cover.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => globalThis.document.querySelector('[aria-pressed="true"] [data-hero-progress]')?.getAnimations()[0]?.playState === 'running');
    assert((await progressState(page)).time >= offscreenTime, 'Returning to the cover resumes rather than resets progress');

    await page.locator('[aria-pressed="true"] [data-hero-progress]').evaluate(node => { node.getAnimations()[0].currentTime = 4000; });
    await page.locator('[data-hero-select="2"]').click();
    await waitForTemplate(page, ids[2]);
    assert((await progressState(page)).time < 1000, 'Clicking another track restarts its five seconds');
    const previous = await page.locator('[aria-pressed="true"] [data-hero-progress]').evaluateHandle(node => node.getAnimations()[0]);
    await page.locator('[data-hero-select="2"]').click();
    await page.waitForFunction(old => {
      const animation = globalThis.document.querySelector('[aria-pressed="true"] [data-hero-progress]').getAnimations()[0];
      return animation && animation !== old;
    }, previous);
    assert((await progressState(page)).time < 1000, 'Clicking the selected track also restarts the clock');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => [...globalThis.document.querySelectorAll('[data-hero-progress]')].every(node => node.getAnimations().length === 0));
    assert.equal(await page.locator('[data-hero-progress]').evaluateAll(nodes => nodes.flatMap(node => node.getAnimations()).length), 0);
    assert.equal(await page.locator('[data-peeking]').count(), 0, 'Reduced motion removes the teaser');
    assert.equal(await active(page), ids[2], 'Reduced motion keeps the selected cover');
    await page.locator('[data-hero-select="0"]').click();
    await waitForTemplate(page, ids[0]);
    await page.locator('.mkt-actions a[href="/explore"]').click();
    await page.waitForURL('**/explore');
    assert.deepEqual(errors, [], 'No callbacks update a disposed hero');

    // A missing alternate cover never replaces the working cover or its player.
    await page.route('**/birthday-radiance.svg?*', route => route.abort());
    await page.goto(base);
    await waitForTemplate(page, ids[0]);
    await page.locator('[data-hero-select="1"]').click();
    assert.equal(await active(page), ids[0]);
    await page.locator('.mkt-hero__cover').click();
    await page.getByRole('dialog').locator('[data-runtime-element="open-memory"]').waitFor();
  } finally { await context.close(); }

  const timed = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  try {
    await timed.goto(base);
    await waitForTemplate(timed, ids[0]);
    await timed.waitForFunction(() => {
      const fill = globalThis.document.querySelector('[data-hero-select="0"] [data-hero-progress]');
      const scale = fill && new globalThis.DOMMatrixReadOnly(globalThis.getComputedStyle(fill).transform).a;
      return scale > 0.2 && scale < 0.8;
    });
    assert.equal(await active(timed), ids[0], 'Real time shows an intermediate fill before the cover changes');
    await timed.waitForFunction(() => {
      const image = globalThis.document.querySelector('[data-peeking]');
      return image && Number(globalThis.getComputedStyle(image).opacity) > 0.05;
    });
    assert.equal(await active(timed), ids[0], 'Teaser appears before the five-second selection boundary');
    await waitForTemplate(timed, ids[1]);
    await verifyOrbit(timed, ids[0], ids[1]);
    assert((await progressState(timed)).time < 1000, 'Natural animation completion advances the cover and resets progress');
  } finally { await timed.close(); }
  console.log('PASS Hero covers: three seconds clear/two seconds teaser, 1.2-second arc with continuous handoff, five-second boundary, matching players VI/EN, clickable reset, shared pause/resume and reduced motion.');
}
