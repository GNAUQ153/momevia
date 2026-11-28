import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { confirmGiftAccess } from './gift-access.mjs';
import { clickEditorTool, selectEditorLocale } from './editor-tools.mjs';

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
    const draftPath = new URL(page.url()).pathname;
    const editorInput = await field('binding.message').elementHandle();
    await field('binding.message').evaluate(node => node.setSelectionRange(2, 7));
    await selectEditorLocale(page, 'en');
    await page.getByRole('button', { name: 'Save draft' }).waitFor();
    assert.equal(new URL(page.url()).pathname, draftPath);
    assert.equal(await field('binding.message').evaluate((node, previous) => node === previous, editorInput), true);
    assert.deepEqual(await field('binding.message').evaluate(node => [node.selectionStart, node.selectionEnd]), [2, 7]);
    assert.equal(await field('binding.message').inputValue(), 'Lời chúc đang viết.\nMình vẫn nhớ lần…');
    await capture('locale-editor-en-390.png');
    await action('undo').click();
    assert.equal(await field('binding.message').inputValue(), 'Lời chúc đang viết.');
    await selectEditorLocale(page, 'vi');
    await page.getByRole('button', { name: 'Lưu nháp' }).waitFor();
    await clickEditorTool(page, 'inline-fabric');
    const fabric = page.locator('.editor-fabric-dialog--inline[open]');
    const fabricCanvas = await fabric.locator('canvas.upper-canvas').elementHandle();
    await fabric.locator('[data-locale-select]').selectOption('en');
    await fabric.getByRole('button', { name: 'Apply to design' }).waitFor();
    assert.equal(await fabric.locator('canvas.upper-canvas').evaluate((node, previous) => node === previous, fabricCanvas), true);
    await capture('locale-fabric-en-390.png');
    await fabric.locator('[data-locale-select]').selectOption('vi');
    await fabric.getByRole('button', { name: 'Đóng', exact: true }).click();
    await clickEditorTool(page, 'toggle-mode');
    await page.getByRole('heading', { name: 'Điền nội dung' }).waitFor();
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
    await page.locator('.editor-artboard [data-element-id="photo-window-image"] img').waitFor({ state: 'detached' });
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
    await stage.getByRole('button', { name: 'Lật góc khung ảnh' }).click();
    const readLongGreeting=async()=>{
      const greeting=stage.locator('.gift-runtime-text').filter({hasText:'Mừng sinh nhật bạn.'}).first();await greeting.waitFor();
      const previousPart=page.locator('.gift-page-navigation button').first(),nextPart=page.locator('.gift-page-navigation button').last();
      for(let i=0;i<10&&!(await previousPart.isDisabled());i++)await previousPart.click();
      const parts=[];for(let i=0;i<10;i++){
        parts.push(await greeting.textContent());
        assert(await stage.locator('.gift-scene-body').evaluate(node=>node.scrollHeight<=node.clientHeight+1),'Each greeting part fits without scrolling');
        if(await nextPart.isDisabled())break;await nextPart.click();
      }assert.equal(parts.join(''),long,'Every authored character remains available across fitted parts');
    };
    await readLongGreeting();
    await capture('memory-long-greeting.png');
    assert.equal(await page.locator('.recipient-preferences,.gift-runtime-navigation').count(), 0);
    // Preferences selected on another public tab still translate the player in
    // place, without adding controls outside the immersive recipient card.
    const preferences = await context.newPage();
    await preferences.setViewportSize({ width: 1440, height: 900 });
    await preferences.goto(base + '/about');
    const playerLocale = preferences.locator('.nav-actions [data-locale-select]');
    await playerLocale.selectOption('en');
    await page.waitForFunction(() => globalThis.document.documentElement.lang === 'en');
    await readLongGreeting();
    await stage.getByRole('button', { name: 'Gửi một lời hồi đáp' }).click();
    await stage.getByLabel('Reply', { exact: true }).fill('Lời đáp đang nhập ở trang quà.');
    const replyInput = await stage.locator('textarea').elementHandle();
    await capture('locale-recipient-en-390.png');
    await playerLocale.selectOption('vi');
    await page.waitForFunction(() => globalThis.document.documentElement.lang === 'vi');
    await stage.getByLabel('Lời đáp', { exact: true }).waitFor();
    assert.equal(await stage.locator('textarea').evaluate((node, previous) => node === previous, replyInput), true);
    assert.equal(await stage.locator('textarea').inputValue(), 'Lời đáp đang nhập ở trang quà.');
    await preferences.close();
    console.log('PASS Browser locale: 390 px editor keeps input, caret, undo and Fabric canvas; gift keeps scene, author text and in-progress reply.');

    await page.goto(base + '/template/hai-phong-bi');
    await page.getByRole('button', { name: 'Xem thử' }).click();
    // Dialog phải mở thực sự trước khi bắt đầu kiểm thử điều hướng bàn phím.
    // Bắt đúng stage bên trong dialog để tránh trùng với trình phát quà cũ.
    const preview = page.locator('dialog.template-preview-dialog[open]');
    await preview.waitFor({ state: 'visible' });
    const previewStage = preview.locator('.gift-runtime-stage');
    for (const branch of ['Một lời chúc', 'Một kỷ niệm', 'Một kỷ niệm', 'Một lời chúc']) {
      const entry = previewStage.getByRole('button', { name: branch, exact: true });
      await entry.focus();
      await page.keyboard.press('Enter');
      await previewStage.getByRole('heading', { name: branch, exact: true }).waitFor();
      await previewStage.getByRole('button', { name: 'Về hai phong bì' }).click();
      await page.waitForFunction(() => {
        const stage = globalThis.document.querySelector('dialog.template-preview-dialog[open] .gift-runtime-stage');
        return stage && !stage.inert && stage.querySelector('[data-runtime-element="open-memory"]');
      });
    }
    await capture('two-envelopes-390.png');
  } finally { await browser.close(); }
}
