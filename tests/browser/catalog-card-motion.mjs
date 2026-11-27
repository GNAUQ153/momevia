import assert from 'node:assert/strict';

// Đo vị trí vùng bấm thay vì chỉ kiểm tra chuỗi CSS.
async function geometry(card) {
  return card.evaluate(node => {
    const view = node.ownerDocument.defaultView;
    const bounds = element => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return [x, y, width, height];
    };
    const visual = node.querySelector('.template-card__visual');
    const favorite = node.querySelector('.favorite-button');
    const label = node.querySelector('.template-card__view');
    return {
      card: bounds(node),
      visual: bounds(visual),
      favorite: bounds(favorite),
      cardTransform: view.getComputedStyle(node).transform,
      favoriteTransform: view.getComputedStyle(favorite).transform,
      artwork: view.getComputedStyle(visual.querySelector('.artwork')).transform,
      opacity: view.getComputedStyle(label).opacity,
    };
  });
}

function stable(before, after) {
  assert.equal(after.cardTransform, 'none');
  assert.equal(after.favoriteTransform, 'none');
  for (const key of ['card', 'visual', 'favorite']) {
    assert(before[key].every((value, index) => Math.abs(value - after[key][index]) < 1), key);
  }
}

export async function runCatalogCardMotion(browser, base) {
  for (const language of ['vi', 'en']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    try {
      await context.addInitScript(locale => globalThis.localStorage.setItem('momevia-locale', locale), language);
      const page = await context.newPage();
      await page.goto(base + '/explore');
      const card = page.locator('#catalog-grid .template-card').first();
      const visual = card.locator('.template-card__visual');
      const favorite = card.locator('.favorite-button');
      await visual.waitFor();
      await page.waitForFunction(locale => globalThis.document.documentElement.lang === locale, language);
      await page.evaluate(() => globalThis.document.fonts.ready);
      await visual.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.mouse.move(0, 0);
      await page.waitForFunction(() => {
        const art = globalThis.document.querySelector('#catalog-grid .template-card__visual .artwork');
        return art && globalThis.getComputedStyle(art).transform === 'none';
      });
      const before = await geometry(card);
      assert.equal(before.opacity, '1');
      assert(before.favorite[2] >= 44 && before.favorite[3] >= 44);
      await visual.hover();
      await page.waitForFunction(() => globalThis.getComputedStyle(globalThis.document.querySelector('#catalog-grid .template-card__visual .artwork')).transform.startsWith('matrix3d('));
      stable(before, await geometry(card));
      await favorite.hover();
      stable(before, await geometry(card));
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await visual.hover();
      const reduced = await geometry(card);
      assert.equal(reduced.artwork, 'none');
      assert.equal(reduced.opacity, '1');
      stable(before, reduced);
    } finally {
      await context.close();
    }
  }

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' });
  try {
    const page = await mobile.newPage();
    await page.goto(base + '/explore');
    const card = page.locator('#catalog-grid .template-card').first();
    await card.waitFor();
    const touch = await geometry(card);
    assert.equal(touch.artwork, 'none');
    assert.equal(touch.opacity, '1');
    assert(touch.favorite[2] >= 44 && touch.favorite[3] >= 44);
    assert(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.document.documentElement.clientWidth + 1));
  } finally {
    await mobile.close();
  }
}
