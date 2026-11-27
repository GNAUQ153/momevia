import assert from 'node:assert/strict';

// Rotation timing starts after the construction tour releases the page.
// Keep the original carousel/hero deadlines and exercise the full tour first.
export async function waitForHomeConstruction(page) {
  await page.locator('.mkt-hero[data-hero-template]').waitFor();
  const main = page.locator('#main');
  if (await main.getAttribute('data-home-construction') === null) return;
  await page.waitForFunction(() => !globalThis.document.getElementById('main').hasAttribute('data-home-construction-running'), null, { timeout: 120000 });
  assert.equal(await main.getAttribute('data-home-construction-phase'), 'complete', 'Construction must finish its reunion, not fail or be cancelled');
  assert.equal(await page.locator('.home-construction,.home-construction-pending').count(), 0);
  assert(await page.evaluate(() => Math.abs(globalThis.scrollY) <= 2), 'Construction returns to the top before rotation resumes');
}
