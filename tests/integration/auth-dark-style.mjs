import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { startSfxFixture } from './sfx-fixture.mjs';

const output = path.join(process.cwd(), 'local/ui-ux-20261126/auth-dark');
fs.mkdirSync(output, { recursive: true });
const fixture = await startSfxFixture({ label: 'auth-dark' });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const locale of ['vi', 'en']) {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await context.addInitScript(locale => localStorage.setItem('momevia-locale', locale), locale);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const route of ['login', 'register']) for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 960 });
      await page.goto(`${fixture.base}/${route}`);
      await page.locator('.auth-submit').waitFor();
      await page.evaluate(() => globalThis.document.fonts.ready);
      await page.waitForFunction(() => globalThis.getComputedStyle(globalThis.document.body).backgroundColor === 'rgb(16, 13, 29)' && globalThis.getComputedStyle(globalThis.document.querySelector('.site-header')).backgroundColor === 'rgb(17, 13, 30)');
      const styles = await page.evaluate(() => {
        const css = selector => globalThis.getComputedStyle(globalThis.document.querySelector(selector));
        return {
          classes: globalThis.document.body.className,
          body: css('body').backgroundColor,
          page: css('.auth-page').backgroundImage,
          header: css('.site-header').backgroundColor,
          panel: css('.auth-panel').backgroundImage,
          title: css('.auth-panel h1').color,
          input: css('.auth-input input').backgroundColor,
          submit: css('.auth-submit').backgroundImage,
          story: css('.auth-showcase__story').backgroundImage,
          scroll: globalThis.document.documentElement.scrollWidth,
          width: globalThis.document.documentElement.clientWidth,
        };
      });
      assert.equal(styles.body, 'rgb(16, 13, 29)', JSON.stringify(styles));
      assert.equal(styles.header, 'rgb(17, 13, 30)');
      assert.match(styles.page, /radial-gradient/);
      assert.match(styles.panel, /linear-gradient/);
      assert.equal(styles.title, 'rgb(255, 247, 255)');
      assert.equal(styles.input, 'rgba(255, 255, 255, 0.07)');
      assert.match(styles.submit, /linear-gradient/);
      assert.match(styles.story, /linear-gradient/);
      assert(styles.scroll <= styles.width + 1, JSON.stringify({ route, width, styles }));
      assert.equal(await page.locator('.auth-showcase').isVisible(), width > 990);
      assert.equal(await page.locator('[data-auth-provider]').count(), route === 'login' ? 2 : 0);
      if (route === 'login') {
        assert.equal(await page.locator('[data-auth-provider="zalo"] img').getAttribute('src'), '/assets/brand/zalo.svg');
        assert.equal(await page.locator('[data-auth-provider]:disabled').count(), 2);
      }
      const password = page.locator('input[name="password"]');
      await password.fill('AuthDarkFixture123');
      const toggle = page.locator('[data-action="toggle-password"]').first();
      await toggle.focus(); await page.keyboard.press('Enter');
      assert.equal(await password.getAttribute('type'), 'text');
      await page.keyboard.press('Enter');
      assert.equal(await password.getAttribute('type'), 'password');
      await password.fill(''); await password.blur();
      if ([390, 1920].includes(width)) await page.screenshot({ path: path.join(output, `${route}-${locale}-${width}.png`), fullPage: true });
      results.push({ route, locale, width, styles });
    }
    // Locale switching keeps the same fields and restores their dark styling.
    await page.goto(fixture.base + '/login');
    const email = page.locator('input[name="email"]');
    await email.fill('auth-dark@example.test');
    await page.locator('.nav-actions [data-locale-select]').selectOption(locale === 'vi' ? 'en' : 'vi');
    assert.equal(await email.inputValue(), 'auth-dark@example.test');
    assert.equal(await page.locator('.auth-panel h1').evaluate(n => globalThis.getComputedStyle(n).color), 'rgb(255, 247, 255)');
    // The ordinary paper palette still serves browsing and recovery routes.
    for (const route of ['/explore', '/recover', '/verify-email']) {
      await page.goto(fixture.base + route);
      await page.locator('main h1').waitFor();
      assert.equal(await page.locator('body').evaluate(n => globalThis.getComputedStyle(n).backgroundColor), 'rgb(250, 248, 242)');
      if (await page.locator('.recovery-panel').count()) {
        assert.equal(await page.locator('.recovery-panel').evaluate(n => globalThis.getComputedStyle(n).backgroundColor), 'rgb(255, 255, 255)');
      }
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  // Exercise actual registration and sign-in after the stylesheet restoration.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const email = `auth-dark-${Date.now()}@example.test`, password = 'AuthDarkFixture123';
  await page.goto(fixture.base + '/register');
  await page.locator('input[name="name"]').fill('Auth Dark QA');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="confirmPassword"]').fill(password);
  const registration = page.waitForResponse('**/api/auth/register');
  await page.locator('.auth-submit').click();
  assert.equal((await registration).status(), 201);
  await page.waitForURL('**/studio');
  await context.clearCookies();
  await page.goto(fixture.base + '/login');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  const login = page.waitForResponse('**/api/auth/login');
  await page.locator('.auth-submit').click();
  assert.equal((await login).status(), 200);
  await page.waitForURL('**/studio');
  await context.close();
  fs.writeFileSync(path.join(output, 'measurements.json'), JSON.stringify(results, null, 2));
  console.log(`PASS restored d36c664 Auth theme: ${results.length} VI/EN responsive screens, computed dark styles, toggle/focus, locale, paper routes, registration and sign-in.`);
} finally {
  await browser.close();
  await fixture.close();
}
