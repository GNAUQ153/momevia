import assert from 'node:assert/strict';
import path from 'node:path';
import { chromium } from 'playwright';
import en from '../../web/assets/locales/en.json' with { type: 'json' };

export async function runLocaleBrowser(base) {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const capture = (page, name) => {
      if (process.env.BROWSER_ARTIFACT_DIR) return page.screenshot({
        path: path.join(process.env.BROWSER_ARTIFACT_DIR, name),
      });
    };
    const login = `${base}/login`;
    const locale = page.locator('.nav-actions [data-locale-select]');
    const html = page.locator('html');
    const input = page.locator('#email-login-form input[name=password]');
    await page.goto(login);
    await page.getByRole('heading', { name: 'Rất vui khi bạn quay lại!' }).waitFor();
    assert.equal(await html.getAttribute('lang'), 'vi');
    await input.fill('SyntheticFixture123');
    await input.evaluate(element => element.setSelectionRange(3, 8));
    const original = await input.elementHandle();
    let requestCount = 0;
    page.on('request', request => { if (request.url().includes('/api/')) requestCount++; });
    await page.route('**/assets/locales/en.json', route => route.fulfill({ body: '{broken json' }));
    await locale.selectOption('en');
    await page.locator('.nav-actions [data-locale-error]').getByText(/Chưa tải được ngôn ngữ/).waitFor();
    assert.equal(await locale.inputValue(), 'vi');
    await page.unroute('**/assets/locales/en.json');
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route('**/assets/locales/en.json', async route => { await gate; await route.continue(); });
    const response = page.waitForResponse('**/assets/locales/en.json');
    await locale.selectOption('en');
    await locale.selectOption('vi');
    release();
    assert.match((await response).headers()['content-type'], /application\/json/);
    await locale.selectOption('en');
    await page.getByRole('heading', { name: 'Welcome back!' }).waitFor();
    assert.equal(await html.getAttribute('lang'), 'en');
    assert.equal(await page.title(), 'Sign in — Momevia');
    assert.equal(await input.inputValue(), 'SyntheticFixture123');
    assert.deepEqual(await input.evaluate(element => [element.selectionStart, element.selectionEnd]), [3, 8]);
    assert.equal(await input.evaluate((element, previous) => element === previous, original), true);
    assert.equal(await requestCount, 0);
    assert.equal(await page.locator('input[name=password]').getAttribute('placeholder'), 'Enter your password');
    await page.locator('input[name=email]').fill('locale-browser-test@example.test');
    const loginResponse = page.waitForResponse('**/api/auth/login');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    const loginError = await loginResponse;
    assert.equal(loginError.status(), 401);
    assert.equal((await loginError.json()).error, 'Email hoặc mật khẩu không chính xác.');
    await page.getByRole('alert').getByText('The email address or password is incorrect.').waitFor();
    const other = await context.newPage();
    await other.goto(login);
    await other.getByRole('heading', { name: 'Welcome back!' }).waitFor();
    await locale.selectOption('vi');
    await other.getByRole('heading', { name: 'Rất vui khi bạn quay lại!' }).waitFor();
    await page.getByRole('alert').getByText('Email hoặc mật khẩu không chính xác.').waitFor();
    await page.reload();
    await page.getByRole('heading', { name: 'Rất vui khi bạn quay lại!' }).waitFor();
    await locale.selectOption('en');
    await page.getByRole('heading', { name: 'Welcome back!' }).waitFor();
    await page.goto(base);
    const homeHeading = page.locator('.mkt-hero h1');
    await homeHeading.waitFor();
    assert.equal((await homeHeading.innerText()).replace(/\s+/g, ' ').trim(), `${en['home.openMe.title']} ${en['home.openMe.emphasis']}`);
    await capture(page, 'locale-home-en-desktop.png');
    await page.goto(base + '/explore');
    await page.getByRole('heading', { name: 'Gift template library' }).waitFor();
    await page.getByRole('searchbox').fill('Snowglobe Countdown');
    await page.getByText('1 matching template', { exact: true }).waitFor();
    await page.getByRole('link', { name: 'Snowglobe Countdown', exact: true }).click();
    await page.getByRole('heading', { name: 'Snowglobe Countdown', exact: true }).waitFor();
    assert.match(await page.locator('.detail-art img').getAttribute('src'), /basic-templates\/en\/snowglobe-countdown\.svg/);
    await page.goto(login);
    await page.locator('#email-login-form input[name="email"]').fill('env-qa@example.test');
    await input.fill('EnvFixturePass123');
    await page.locator('#email-login-form button[type="submit"]').click();
    const account = page.locator('[data-action="account-menu"]');
    await account.focus();
    await page.keyboard.press('Enter');
    assert.equal(await account.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('#account-menu a').first().evaluate(el => el === el.ownerDocument.activeElement), true);
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('#account-menu a').nth(1).evaluate(el => el === el.ownerDocument.activeElement), true);
    await page.keyboard.press('Escape');
    assert.equal(await account.getAttribute('aria-expanded'), 'false');
    assert.equal(await account.evaluate(el => el === el.ownerDocument.activeElement), true);
    await page.locator('[data-action="support"]').first().click();
    const support = page.getByRole('dialog');
    assert.equal(await support.getAttribute('aria-labelledby'), await support.locator('h2').getAttribute('id'));
    await page.keyboard.press('Escape');
    await support.waitFor({ state: 'hidden' });
    await context.close();

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await mobile.addInitScript(() => {
      Object.defineProperty(globalThis, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
    });
    const mobilePage = await mobile.newPage();
    for (const route of ['/login', '/register', '/recover']) {
      await mobilePage.goto(base + route);
      const supportTrigger = mobilePage.locator('main [data-action="support"]');
      await supportTrigger.waitFor();
      const entry=route==='/login'||route==='/register';
      assert.equal(await mobilePage.locator('#site-footer').isVisible(),!entry,route+' footer visibility follows the Auth layout');
      const policies = mobilePage.locator(entry?'main .auth-policy-note a':'main .auth-policy-note a, footer a[href="/policies/privacy"]');
      if(entry)assert.equal(await policies.count(),2,route+' keeps both policy links inside the form');
      for (const link of await policies.all()) {
        await link.scrollIntoViewIfNeeded();
        // The dock reveals focused controls; native scrolling alone does not
        // account for fixed overlays when a link already intersects the viewport.
        await link.focus();
        assert.equal(await link.evaluate(element => {
          const rect = element.getClientRects()[0];
          const hit = element.ownerDocument.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
          return Boolean(hit && element.contains(hit));
        }), true, route + ' policy link is not covered');
        assert.equal(await link.evaluate(element => element.ownerDocument.activeElement === element), true);
      }
      await supportTrigger.press('Enter');
      await mobilePage.getByRole('dialog').waitFor();
      await mobilePage.keyboard.press('Escape');
      await mobilePage.getByRole('dialog').waitFor({ state: 'hidden' });
    }
    await mobilePage.goto(login);
    await mobilePage.locator('#site-header .nav-actions [data-locale-select]').selectOption('en');
    await mobilePage.getByRole('heading', { name: 'Welcome back!' }).waitFor();
    // Auth V9 keeps a visible locale control and intentionally has no menu.
    // Exercise the shared compact menu on a route that still exposes it.
    assert.equal(await mobilePage.locator('#site-header [data-action="toggle-menu"]').isVisible(),false);
    await mobilePage.goto(base+'/explore');
    await mobilePage.locator('#template-search').waitFor();
    await mobilePage.getByRole('button', { name: 'Mở menu' }).click();
    await mobilePage.locator('#mobile-nav [data-locale-select]').selectOption('en');
    await mobilePage.getByRole('heading', { name: 'Gift template library', exact: true }).waitFor();
    await mobilePage.locator('#mobile-nav [data-locale-select]').focus();
    await mobilePage.keyboard.press('Escape');
    const menu = mobilePage.getByRole('button', { name: 'Open menu' });
    assert.equal(await menu.getAttribute('aria-expanded'), 'false');
    assert.equal(await menu.evaluate(element => element === element.ownerDocument.activeElement), true);
    await mobile.close();
    console.log('PASS Browser locale: VI default, EN/VI in-place form, failed load and retry, no API refetch, reload and tab sync, mobile blocked storage.');
  } finally {
    await browser.close();
  }
}
