import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { confirmGiftAccess } from './gift-access.mjs';

export async function runNewTemplates(base) {
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined) });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    const response = await context.request.post(base + '/api/auth/demo', { data: {
      deviceId: randomUUID(), name: 'Người gửi hai mẫu QA',
    } });
    assert.equal(response.status(), 200);
    const page = await context.newPage();
    const capture = async name => {
      if (process.env.BROWSER_ARTIFACT_DIR) await page.screenshot({ path: path.join(process.env.BROWSER_ARTIFACT_DIR, name) });
    };
    const field = name => page.locator(`[data-editor-field="${name}"]`);
    const action = name => page.locator(`[data-editor-action="${name}"]`);
    await page.goto(base + '/template/mot-ky-niem');
    await page.getByRole('link', { name: 'Dùng mẫu' }).click();
    for (const [key, value] of Object.entries({ recipientName: 'Mai Anh', senderName: 'Minh An', message: 'Lời chúc đang viết.' }))
      await field('binding.' + key).fill(value);
    await page.getByRole('button', { name: 'Mình vẫn nhớ lần…' }).click();
    assert.equal(await field('binding.message').inputValue(), 'Lời chúc đang viết.\nMình vẫn nhớ lần…');
    await action('undo').click();
    assert.equal(await field('binding.message').inputValue(), 'Lời chúc đang viết.');
    await page.getByLabel('Chú thích ảnh').fill('Ảnh mừng sinh nhật');
    for (const [width, height, color] of [[90, 50, '#91ACA0'], [50, 90, '#C98461']]) {
      const upload = page.waitForResponse(res => res.url().endsWith('/assets') && res.request().method() === 'POST');
      const buffer = await sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer();
      await field('quick-photo').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer });
      const uploaded = await upload;
      assert.equal(uploaded.status(), 201);
      const { asset } = await uploaded.json();
      await page.locator(`.editor-artboard img[src$="/${asset.id}"]`).waitFor();
      await capture(`memory-${width}x${height}.png`);
    }
    await page.getByRole('button', { name: 'Bỏ ảnh cá nhân' }).click();
    await page.locator('.editor-artboard img').waitFor({ state: 'detached' });
    const long = 'Mừng sinh nhật bạn. '.repeat(44).trim();
    await field('binding.message').fill(long);
    await action('preview').click();
    await capture('memory-without-photo.png');
    await action('preview-send').click();
    await confirmGiftAccess(page, { open: 'link', send: 'link', read: 'sender' });
    await page.waitForURL('**/success/*');
    await page.getByRole('link', { name: 'Xem món quà' }).click();
    const stage = page.locator('.gift-runtime-stage');
    await stage.getByText('Ảnh mừng sinh nhật', { exact: true }).waitFor();
    await stage.getByRole('button', { name: 'Mở lời chúc' }).click();
    await stage.getByText(long, { exact: true }).waitFor();
    await capture('memory-long-greeting.png');

    await page.goto(base + '/template/hai-phong-bi');
    await page.getByRole('button', { name: 'Xem thử' }).click();
    // Dialog phải mở thực sự trước khi bắt đầu kiểm thử điều hướng bàn phím.
    // Bắt đúng stage bên trong dialog để tránh trùng với trình phát quà cũ.
    const preview = page.locator('dialog.template-preview-dialog[open]');
    await preview.waitFor({ state: 'visible' });
    const previewStage = preview.locator('.gift-runtime-stage');
    for (const branch of ['Một điều mình chúc bạn', 'Một kỷ niệm', 'Một kỷ niệm', 'Một điều mình chúc bạn']) {
      const entry = previewStage.getByRole('button', { name: branch, exact: true });
      await entry.focus();
      await page.keyboard.press('Enter');
      await previewStage.getByText(branch, { exact: true }).waitFor();
      await previewStage.getByRole('button', { name: 'Về hai phong bì' }).click();
    }
    await capture('two-envelopes-390.png');
  } finally { await browser.close(); }
}
