import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import sharp from 'sharp';

export async function runCanvasBrowser(base) {
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  const errors = [], csp = [], metrics = {}, completed = [];
  const artifacts = process.env.BROWSER_ARTIFACT_DIR;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await context.addInitScript(() => { globalThis.__csp = []; globalThis.document.addEventListener('securitypolicyviolation', e => globalThis.__csp.push(`${e.violatedDirective}:${e.blockedURI}`)); });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  const control = name => page.locator(`[data-editor-action="${name}"]`);
  const field = name => page.locator(`[data-editor-field="${name}"]`);
  const save = async () => { await control('save').click(); await page.locator('.editor-save-status').filter({ hasText: 'Đã lưu' }).waitFor(); };
  const api = async (url, body) => { const response = body ? await page.request.post(`${base}/api${url}`, { data: body }) : await page.request.get(`${base}/api${url}`); return { status: response.status(), data: await response.json() }; };
  try {
    await page.goto(base + '/register');
    await page.locator('#register-form input[name="name"]').fill('Canvas Sender');
    await page.locator('#register-form input[name="email"]').fill(`${randomUUID()}@example.test`);
    await page.locator('#register-form input[name="password"]').fill('CanvasBrowser123');
    await page.locator('#register-form input[name="confirmPassword"]').fill('CanvasBrowser123');
    await page.locator('#register-form button[type="submit"]').click(); await page.waitForURL('**/studio');
    assert.equal((await api('/auth/me')).data.user.role, 'sender');
    const editorStart = Date.now();
    await page.getByRole('link', { name: 'Tự thiết kế', exact: false }).click(); await control('create-blank').click();
    await page.waitForURL('**/design/*'); await page.locator('.editor-workspace').waitFor();
    metrics.editorBlankReadyMs = Date.now() - editorStart;
    const designPath = new URL(page.url()).pathname; const id = designPath.split('/').at(-1);
    await field('binding.recipientName').fill('Ánh Mai'); await field('binding.senderName').fill('Đặng An'); await field('binding.message').fill('Chúc bạn một ngày thật vui!');
    await page.locator('[data-editor-action="add"][data-type="text"]').click();
    await field('props.text').fill('Kỷ niệm của chúng mình ✨');
    await field('layout.y').fill('90'); await field('layout.y').dispatchEvent('change');
    await page.locator('[data-editor-action="add"][data-type="image"]').click();
    const bytes = await sharp({ create: { width: 80, height: 60, channels: 3, background: '#b98adc' } }).png().toBuffer();
    await field('upload').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: bytes });
    await page.waitForFunction(() => globalThis.document.querySelector('.editor-save-status')?.textContent !== 'Ảnh đang xử lý…');
    await field('layout.y').fill('240'); await field('layout.y').dispatchEvent('change');
    await page.locator('[data-editor-action="add"][data-type="reply"]').click();
    await field('layout.y').fill('480'); await field('layout.y').dispatchEvent('change');
    await save();
    const first = (await api(`/designs/designs/${id}`)).data.design;
    assert.equal(first.document.elements.length, 3); assert.equal(first.document.assets.length, 1);
    await page.reload(); await field('binding.recipientName').waitFor(); assert.equal(await field('binding.recipientName').inputValue(), 'Ánh Mai');
    const loaded = (await api(`/designs/designs/${id}`)).data.design; assert.deepEqual(loaded.document, first.document);
    completed.push('blank Unicode + binary image + reply, save/reload stable IDs/layout');

    // Preview uses the same player and never writes replies.
    let replyPosts = 0; page.on('request', req => { if (req.method() === 'POST' && /\/gifts\/.*\/replies$/.test(req.url())) replyPosts++; });
    await control('preview').click();
    const preview = page.locator('dialog[open]'); await preview.locator('textarea[name="message"]').fill('Chỉ mô phỏng'); await preview.locator('button[type="submit"]').click();
    await preview.getByText('Đã mô phỏng lời đáp. Không gửi cho người tặng.').waitFor(); assert.equal(replyPosts, 0);
    await preview.locator('[data-editor-action="preview-close"]').click(); completed.push('preview side effects isolated');

    // A second tab updates the persisted revision. This tab must retain its local edit.
    const current = (await api(`/designs/designs/${id}`)).data.design;
    await api(`/designs/designs/${id}/save`, { expectedRevision: current.revision, mutationId: randomUUID(), title: 'Bản tab khác', document: current.document });
    await field('binding.recipientName').fill('Bản cục bộ giữ lại'); await control('save').click();
    await page.locator('.editor-save-status').filter({ hasText: 'Xung đột' }).waitFor(); assert.equal(await field('binding.recipientName').inputValue(), 'Bản cục bộ giữ lại');
    page.once('dialog', dialog => dialog.accept()); await control('server-reload').click();
    await page.locator('.editor-save-status').filter({ hasText: 'Đã lưu' }).waitFor(); completed.push('CAS conflict preserves local until explicit reload');

    // Broken save + route and Back guards leave the editor and recovery intact.
    await page.route('**/api/designs/designs/*/save', route => route.abort('internetdisconnected'));
    await field('binding.message').fill('Bản chưa có ACK mạng'); await control('save').click();
    await page.locator('.editor-save-status').filter({ hasText: 'Mất kết nối' }).waitFor();
    page.once('dialog', dialog => dialog.dismiss()); await control('studio').click(); assert.equal(new URL(page.url()).pathname, designPath);
    page.once('dialog', dialog => dialog.dismiss()); await page.evaluate(() => globalThis.history.back());
    await page.waitForURL(`**${designPath}`); assert.equal(await field('binding.message').inputValue(), 'Bản chưa có ACK mạng');
    await page.unroute('**/api/designs/designs/*/save'); await control('retry-save').click(); await page.locator('.editor-save-status').filter({ hasText: 'Đã lưu' }).waitFor(); completed.push('offline/retry and internal/Back navigation guard');

    for (const width of [320, 375, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      if (artifacts && [320, 390, 1440].includes(width)) { fs.mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: path.join(artifacts, `canvas-editor-${width}.png`), fullPage: true }); }
      const overflow = await page.evaluate(() => ({ width: globalThis.document.documentElement.scrollWidth, viewport: globalThis.innerWidth, elements: [...globalThis.document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > globalThis.innerWidth + 1 && globalThis.getComputedStyle(e).position !== 'absolute').slice(0, 6).map(e => [e.tagName, e.className, e.getBoundingClientRect().right]) }));
      assert(overflow.width <= overflow.viewport + 1, `editor overflow ${width}: ${JSON.stringify(overflow)}`);
    }
    completed.push('editor viewport 320/375/390/768/1024/1440 + reduced motion');
    await control('publish').click(); await page.waitForURL('**/success/*'); const slug = new URL(page.url()).pathname.split('/').at(-1);
    await page.locator('[data-action="qr"]').click(); await page.locator('.qr-image').waitFor(); assert((await page.locator('.qr-image').getAttribute('src')).startsWith('data:image/gif;base64,')); await page.keyboard.press('Escape');
    completed.push('publish and QR share');

    const recipient = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await recipient.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    const publicPage = await recipient.newPage(); publicPage.on('pageerror', error => errors.push(error.message));
    const modules = []; publicPage.on('request', req => { if (req.url().includes('/js/')) modules.push(req.url()); });
    const publicStart = Date.now(); await publicPage.goto(`${base}/g/${slug}`); await publicPage.locator('.gift-runtime-stage').waitFor(); metrics.publicReadableMs = Date.now() - publicStart;
    assert(!modules.some(url => /canvas-editor|pages\/designer/.test(url)), 'recipient loads no editor');
    assert.equal((await publicPage.request.get(`${base}/api/auth/me`).then(r => r.json())).user, null);
    await publicPage.locator('textarea[name="message"]').fill('Cảm ơn người gửi!'); await publicPage.locator('button[type="submit"]').click();
    await publicPage.getByText('Đã gửi lời đáp.', { exact: true }).waitFor();
    assert.equal((await publicPage.request.get(`${base}/api/gifts/gifts/${slug}/replies`).then(r => r.json())).replies.length, 1);
    if (artifacts) await publicPage.screenshot({ path: path.join(artifacts, 'canvas-recipient-390.png'), fullPage: true });
    await recipient.close(); completed.push('anonymous recipient/reply, no editor module');

    // Methods-error and methods-empty are intentionally distinct without merchant calls.
    await page.goto(base + '/explore'); const catalog = (await api('/catalog/templates')).data.templates; const paid = catalog.find(t => t.price > 0);
    await page.goto(`${base}/create/${paid.id}`); await field('binding.recipientName').fill('Mai'); await field('binding.senderName').fill('An'); await field('binding.message').fill('Một nháp trả phí'); await save();
    await page.route('**/api/checkout/payments/methods', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Lỗi methods giả lập' }) }));
    await control('publish').click(); await page.getByRole('heading', { name: 'Không tải được phương thức' }).waitFor();
    await page.unroute('**/api/checkout/payments/methods'); await page.locator('[data-action="retry-canvas-payment"]').click(); await page.getByRole('heading', { name: 'Chưa có phương thức thanh toán' }).waitFor();
    await page.keyboard.press('Escape'); completed.push('paid template methods-error vs methods-empty; saved draft retained');
    csp.push(...await page.evaluate(() => globalThis.__csp)); assert.deepEqual(csp, []); assert.deepEqual(errors, []);
    if (artifacts) fs.writeFileSync(path.join(artifacts, 'canvas-browser.json'), JSON.stringify({ result: 'PASS', completed, metrics, fixture: 'Windows Edge headless; JSON synthetic; 1 scene 3 nodes incl 80x60 PNG; warm app', errors, csp, nativeIME: 'NOT RUN; synthetic composition in spike' }, null, 2));
    console.log('PASS Browser canvas: ' + completed.join('; ')); console.log(JSON.stringify({ metrics }));
  } finally { await browser.close(); }
}
