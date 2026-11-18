import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

// Chạy trong fixture của tests/integration/architecture.mjs, không dùng service/data local.
export async function runBrowserSmoke(base) {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
    const errors = [];
    const failures = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 400) failures.push(`${response.status()} ${new URL(response.url()).pathname}`); });
    await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    await page.goto(base + '/');
    await page.locator('#main .hero').waitFor();
    await page.goto(base + '/register');
    const email = `browser-${randomUUID()}@example.test`;
    const password = 'BrowserRegression123';
    await page.locator('#register-form input[name="name"]').fill('Browser QA');
    await page.locator('#register-form input[name="email"]').fill(email);
    await page.locator('#register-form input[name="password"]').fill(password);
    await page.locator('#register-form input[name="confirmPassword"]').fill(password);
    await page.locator('#register-form button[type="submit"]').click();
    await page.waitForURL('**/studio');
    await page.locator('.dashboard-heading').first().waitFor();
    await page.goto(base + '/creator');
    await page.locator('#main').getByText('Liên hệ quản trị viên để được cấp quyền Creator.').waitFor();
    assert.equal(await page.locator('#creator-template-form').count(), 0);
    await page.goto(base + '/explore');
    await page.locator('#catalog-grid .template-card').first().waitFor();
    const saved = page.locator('#catalog-grid [data-action="toggle-favorite"]').first();
    await saved.click();
    await page.locator('#catalog-grid [data-action="toggle-favorite"][aria-pressed="true"]').first().waitFor();
    await page.goto(base + '/favorites');
    await page.locator('.template-card').first().waitFor();
    const catalog = await (await page.request.get(base + '/api/catalog/templates')).json();
    const free = catalog.templates.find(template => template.price === 0);
    await page.goto(base + `/create/${free.id}`);
    await page.locator('[data-editor-field="binding.recipientName"]').fill('Mai');
    await page.locator('[data-editor-field="binding.senderName"]').fill('Browser QA');
    await page.locator('[data-editor-field="binding.message"]').fill('Browser refactor regression');
    await page.locator('[data-editor-action="save"]').click();
    await page.locator('.editor-save-status').filter({hasText:'Đã lưu'}).waitFor();
    await page.getByRole('button', { name: 'Xem như người nhận' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Gửi', exact: true }).click();
    await confirmGiftAccess(page);
    await page.waitForURL('**/success/*');
    await page.locator('[data-action="qr"]').click();
    await page.locator('.qr-image').waitFor();
    assert((await page.locator('.qr-image').getAttribute('src')).startsWith('data:image/gif;base64,'));
    await page.setViewportSize({ width: 390, height: 844 });
    if (process.env.BROWSER_ARTIFACT_DIR) {
      const directory = path.resolve(process.env.BROWSER_ARTIFACT_DIR);
      fs.mkdirSync(directory, { recursive: true });
      await page.screenshot({ path: path.join(directory, 'qr-mobile.png'), fullPage: true });
    }
    await page.request.post(base + '/api/auth/logout');
    await page.goto(base + '/login');
    await page.locator('#email-login-form input[name="email"]').fill(email);
    await page.locator('#email-login-form input[name="password"]').fill(password);
    await page.locator('#email-login-form button[type="submit"]').click();
    await page.waitForURL('**/studio');
    assert.deepEqual(errors, [], 'Browser JavaScript errors');
    assert.deepEqual(failures, [], 'Local HTTP resource/API failures');
    console.log('PASS Browser: register/login, pages, favorites, Creator guard, gift publication and local QR (isolated data)');
  } finally { await browser.close(); }
}
import { confirmGiftAccess } from './gift-access.mjs';
