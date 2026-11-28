import assert from 'node:assert/strict';
import path from 'node:path';
import { chromium } from 'playwright';
import { registrationPolicyVersion } from '../../web/js/shared/registration-consent.js';

export async function runAuthEntryBrowser(base) {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-12-05T02:00:00Z'));
    for (const route of ['login', 'register']) {
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(base + '/' + route);
        const panel = page.locator('.auth-panel');
        const headline = panel.getByRole('heading', { level: 1 });
        await headline.waitFor();
        assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth), width);
        const showcase = page.locator('.auth-showcase');
        assert.equal(await showcase.isVisible(), width > 990);
        if (width > 990) {
          const artBox = await showcase.boundingBox();
          const panelBox = await panel.boundingBox();
          assert(artBox.x + artBox.width <= panelBox.x + 1);
          assert.equal(artBox.y, panelBox.y);
        }
        const input = panel.locator('input[name="email"]');
        assert.equal(await input.getAttribute('placeholder'), 'Nhập địa chỉ email');
        assert.equal(await panel.locator('input[name="password"]').getAttribute('placeholder'), 'Nhập mật khẩu');
        if (route === 'register') {
          assert.equal(await panel.locator('input[name="confirmPassword"]').getAttribute('placeholder'), 'Nhập lại mật khẩu');
          assert.equal(await panel.locator('.auth-password-rules').isHidden(), true);
          const nameBox = await panel.locator('input[name="name"]').boundingBox();
          const emailBox = await input.boundingBox();
          assert.equal(nameBox.x, emailBox.x);
          assert(nameBox.y + nameBox.height < emailBox.y);
        }
        // ui-system.css applies the shared 12px control radius to both forms.
        for (const field of await panel.locator('.auth-input input').all()) {
          assert.equal(await field.evaluate(node => globalThis.getComputedStyle(node).borderRadius), '12px');
          assert.equal(await field.evaluate(node => globalThis.getComputedStyle(node).fontSize), '16px');
          assert((await field.boundingBox()).height >= 44);
        }
        assert.deepEqual(await panel.evaluate(node => globalThis.getComputedStyle(node).backgroundColor), 'rgb(255, 252, 246)');
        if (process.env.BROWSER_ARTIFACT_DIR && width !== 320) {
          await page.evaluate(() => globalThis.document.fonts.ready);
          await page.screenshot({ path: path.join(process.env.BROWSER_ARTIFACT_DIR, `auth-${route}-${width}.png`), fullPage: true });
        }
      }
    }
    const register = page.locator('#register-form');
    const password = register.locator('input[name="password"]');
    const confirmation = register.locator('input[name="confirmPassword"]');
    const terms = register.locator('#auth-terms');
    const privacy = register.locator('#auth-privacy');
    const registerSubmit = register.locator('[type=submit]');
    assert.equal(await registerSubmit.isEnabled(), true);
    assert.equal(await terms.isChecked(), false);
    assert.equal(await privacy.isChecked(), false);
    let registerRequests = 0;
    page.on('request', request => {
      if (request.method() === 'POST' && request.url().endsWith('/api/auth/register')) registerRequests++;
    });
    // An untouched form can be submitted for validation; no invalid data may reach the API.
    await registerSubmit.click();
    assert.equal(registerRequests, 0);
    assert.equal(await register.locator('input[name="name"]').getAttribute('aria-invalid'), 'true');
    assert.equal(await register.getByRole('alert').isHidden(), true);
    await register.locator('label[for="auth-terms"]').click();
    assert.equal(await terms.isChecked(), true);
    assert.equal(await registerSubmit.isEnabled(), true);
    await privacy.check();
    assert.equal(await registerSubmit.isEnabled(), true);
    await register.locator('input[name="name"]').fill('Kiểm thử');
    await register.locator('input[name="email"]').fill('auth-entry@example.test');
    await password.fill('LettersOnly');
    assert.equal(await register.locator('[data-password-rule][data-met="true"]').count(), 2);
    await password.fill('lowercase1');
    assert.equal(await register.locator('[data-password-rule="letter"]').getAttribute('data-met'), 'false');
    await password.fill('TestPassword123');
    assert.equal(await register.locator('[data-password-rule][data-met="true"]').count(), 3);

    const toggle = register.locator('[aria-controls="auth-password"]');
    await toggle.press('Enter');
    assert.equal(await password.getAttribute('type'), 'text');
    await toggle.press('Space');
    assert.equal(await password.getAttribute('type'), 'password');
    await confirmation.fill('AnotherPassword123');
    await registerSubmit.click();
    assert.equal(await confirmation.getAttribute('aria-invalid'), 'true');
    assert.equal(await confirmation.evaluate(node => node === node.ownerDocument.activeElement), true);
    assert.equal(registerRequests, 0);
    const locale = page.locator('#site-header .nav-actions [data-locale-select]');
    await locale.selectOption('en');
    await page.waitForFunction(() => globalThis.document.documentElement.lang === 'en');
    const mismatch = register.locator('#auth-error-confirmPassword');
    assert.match(await mismatch.innerText(), /match/i);
    assert.equal(await register.getByRole('alert').isHidden(), true);
    assert.equal(await register.locator('input[name="email"]').getAttribute('placeholder'), 'Enter your email address');
    assert.equal(await confirmation.getAttribute('placeholder'), 'Re-enter your password');
    assert.equal(await terms.isChecked(), true);
    assert.equal(await privacy.isChecked(), true);
    await privacy.uncheck();
    assert.equal(await registerSubmit.isEnabled(), true);
    assert.equal(await password.inputValue(), 'TestPassword123');
    await confirmation.fill('TestPassword123');
    await mismatch.waitFor({ state: 'hidden' });
    assert.equal(await confirmation.getAttribute('aria-invalid'), null);
    await registerSubmit.click();
    assert.equal(await privacy.getAttribute('aria-invalid'), 'true');
    assert.equal(await privacy.evaluate(node => node === node.ownerDocument.activeElement), true);
    assert.equal(registerRequests, 0);
    await privacy.check();
    // A valid form reaches the API once with both consents and the current policy version.
    let registrationBody;
    await page.route('**/api/auth/register', async route => {
      registrationBody = route.request().postDataJSON();
      await route.fulfill({ status: 409, json: { messageKey: 'errors.auth.emailTaken' } });
    });
    await registerSubmit.click();
    await register.getByRole('alert').waitFor();
    assert.equal(registerRequests, 1);
    assert.deepEqual(registrationBody.consent, { terms: true, privacy: true, version: registrationPolicyVersion });
    assert.equal(await registerSubmit.isEnabled(), true);
    await page.unroute('**/api/auth/register');

    await page.goto(base + '/login');
    const login = page.locator('#email-login-form');
    let release;
    let requests = 0;
    const hold = new Promise(resolve => { release = resolve; });
    await page.route('**/api/auth/login', async route => {
      requests++;
      await hold;
      await route.fulfill({ status: 401, json: { messageKey: 'errors.auth.badCredentials' } });
    });
    await login.locator('input[name="email"]').fill('auth-entry@example.test');
    await login.locator('input[name="password"]').fill('TestPassword123');
    const submit = login.locator('[type=submit]');
    await submit.click();
    assert.equal(await login.getAttribute('aria-busy'), 'true');
    assert.equal(await submit.isDisabled(), true);
    assert.match(await submit.innerText(), /Signing in/);
    await login.evaluate(form => form.requestSubmit());
    release();
    await login.getByRole('alert').waitFor();
    assert.equal(requests, 1);
    assert.equal(await submit.isEnabled(), true);
    assert.equal(await login.getAttribute('aria-busy'), 'false');
    assert.equal(await login.getByRole('alert').evaluate(node => node === node.ownerDocument.activeElement), true);
    await login.locator('input[name="password"]').fill('Corrected123');
    await login.getByRole('alert').waitFor({ state: 'hidden' });
    assert.deepEqual(errors, []);
    await page.route('**/api/auth/providers', route => route.fulfill({ json: { google: true, zalo: false } }));
    const oauthDestination = 'https://accounts.google.com/o/oauth2/v2/auth?state=browser-fixture';
    const oauthStarts = [];
    let legacyGoogleGets = 0;
    page.on('request', request => {
      if (request.method() === 'GET' && new URL(request.url()).pathname === '/api/auth/google') legacyGoogleGets++;
    });
    await page.route('**/api/auth/google/start', async route => {
      oauthStarts.push({ method: route.request().method(), body: route.request().postDataJSON() });
      await route.fulfill({ json: { url: oauthStarts.length === 1 ? 'https://invalid.example/redirect' : oauthDestination } });
    });
    // Intercept the provider navigation: never contact the real OAuth service in CI.
    await page.route('https://invalid.example/redirect', route => route.abort());
    await page.route(oauthDestination, route => route.fulfill({ status: 200, contentType: 'text/plain', body: 'OAuth fixture' }));
    await page.goto(base + '/register');
    const google = page.locator('[data-auth-provider="google"]');
    const zalo = page.locator('[data-auth-provider="zalo"]');
    assert.equal(await google.isDisabled(), true);
    await terms.check();
    assert.equal(await google.isDisabled(), true);
    await privacy.check();
    assert.equal(await google.isEnabled(), true);
    assert.equal(await zalo.isDisabled(), true);
    await terms.uncheck();
    assert.equal(await google.isDisabled(), true);
    await terms.check();
    assert.equal(oauthStarts.length, 0);
    await google.click();
    await register.getByRole('alert').waitFor();
    assert.equal(new URL(page.url()).pathname, '/register');
    assert.equal(await google.isEnabled(), true);
    await Promise.all([page.waitForURL(oauthDestination), google.click()]);
    assert.equal(oauthStarts.length, 2);
    for (const start of oauthStarts) {
      assert.equal(start.method, 'POST');
      assert.deepEqual(start.body, { consent: { terms: true, privacy: true, version: registrationPolicyVersion } });
    }
    assert.equal(legacyGoogleGets, 0);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
  console.log('PASS auth entry: responsive seasonal layout, placeholders, consent, OAuth gating, password controls, locale, pending and retry.');
}
