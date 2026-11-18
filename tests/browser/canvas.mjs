import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import jsQR from 'jsqr';
import sharp from 'sharp';
import { confirmGiftAccess } from './gift-access.mjs';

async function checkShareInBrowser(browser, context, base, gifts) {
  const alias = base.replace('127.0.0.1', 'localhost');
  const alternate = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    await alternate.route('**/*', route => new URL(route.request().url()).origin === alias ? route.continue() : route.abort());
    const cookies = await context.cookies(base);
    await alternate.addCookies(cookies.map(({ name, value }) => ({ name, value, url: alias })));
    await alternate.addInitScript(() => {
      Object.defineProperty(globalThis.navigator, 'share', { value: async ({ url }) => {
        globalThis.sharedGiftUrl = url;
        throw new DOMException('Share canceled', 'AbortError');
      } });
      Object.defineProperty(globalThis.navigator, 'canShare', { value: () => true });
      Object.defineProperty(globalThis.navigator.clipboard, 'writeText', {
        value: async value => {
          if (globalThis.denyClipboard) throw new DOMException('Clipboard denied in fixture', 'NotAllowedError');
          globalThis.copiedGiftUrl = value;
        },
      });
    });
    const page = await alternate.newPage();
    const selected = input => input.evaluate(field => field === globalThis.document.activeElement && field.selectionStart === 0 && field.selectionEnd === field.value.length);
    for (const gift of gifts) {
      const url = `${base}/g/${gift.slug}`;
      assert.equal(gift.url, url);
      await page.goto(`${alias}/success/${gift.slug}`);
      await page.reload();
      const input = page.locator('#share-link');
      assert.equal(await input.inputValue(), url);
      await page.getByRole('button', { name: 'Chia sẻ link' }).click();
      assert.equal(await page.evaluate(() => globalThis.sharedGiftUrl), url);
      assert.equal(await page.evaluate(() => globalThis.copiedGiftUrl), undefined);
      await page.locator('.share-link [data-action="copy-link"]').click();
      await page.waitForFunction(expected => globalThis.copiedGiftUrl === expected, url);
      await page.evaluate(() => { globalThis.denyClipboard = true; });
      await page.locator('.share-link [data-action="copy-link"]').click();
      await page.getByText('Hãy sao chép thủ công nội dung đã chọn.').waitFor();
      assert(await selected(input));
      await page.locator('[data-action="qr"]').click();
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('link', { name: 'Tải mã QR' }).click();
      const download = await downloadPromise;
      assert.equal(download.suggestedFilename(), 'momevia-qr.gif');
      const { data, info } = await sharp(await download.path()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.equal(jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data, url);
      await page.locator('.qr-modal [data-action="copy-link"]').click();
      const qrInput = page.locator('.qr-modal [data-copy-value]');
      await qrInput.waitFor();
      assert.equal(await qrInput.inputValue(), url);
      assert(await selected(qrInput));
      await page.keyboard.press('Escape');
    }
    await page.goto(alias + '/studio');
    await page.evaluate(() => { globalThis.denyClipboard = true; });
    for (const gift of gifts) {
      const card = page.locator('.my-gift').filter({ has: page.locator(`a[href="/g/${gift.slug}"]`) });
      await card.getByRole('button', { name: 'Sao chép link' }).click();
      const manual = page.getByRole('dialog').locator('[data-copy-value]');
      assert.equal(await manual.inputValue(), gift.url);
      assert(await selected(manual));
      await page.keyboard.press('Escape');
    }
  } finally { await alternate.close(); }
}

async function checkRecipientDependencies(browser, base, canvasGift, legacyGift, expiredSlug, greeting) {
  const guest = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const catalogStarted = Promise.withResolvers();
  const releaseCatalog = Promise.withResolvers();
  const releaseLegacyReplies = Promise.withResolvers();
  const paths = [], errors = [];
  try {
    await guest.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    await guest.route('**/api/catalog/templates', async route => {
      catalogStarted.resolve();
      await releaseCatalog.promise;
      await route.continue();
    });
    await guest.route('**/api/auth/*', route => route.fulfill({
      status: 503, json: { error: 'Dịch vụ tài khoản tạm thời không khả dụng.' },
    }));
    await guest.route(`**/api/gifts/gifts/${legacyGift.slug}/replies`, async route => {
      await releaseLegacyReplies.promise;
      await route.continue();
    });
    const page = await guest.newPage();
    page.on('request', request => paths.push(new URL(request.url()).pathname));
    page.on('pageerror', error => errors.push(error.message));
    assert.deepEqual(await guest.cookies(), []);
    const giftPath = `/g/${canvasGift.slug}`;
    const stage = page.locator('.gift-runtime-stage').getByText(greeting, { exact: true });
    await page.goto(base + giftPath);
    await stage.waitFor({ timeout: 5000 });
    assert.deepEqual(paths.filter(path => path.startsWith('/api/')), [`/api/gifts/gifts/${canvasGift.slug}`]);
    const catalogRequest = page.waitForRequest(request => request.url().endsWith('/api/catalog/templates'), { timeout: 5000 });
    await page.locator('#main a[href="/"]').click();
    await catalogRequest;
    await catalogStarted.promise;
    assert(paths.includes('/api/catalog/templates'), 'The library started its catalog request');
    await page.evaluate(() => globalThis.history.back());
    await page.waitForURL(base + giftPath);
    await stage.waitFor({ timeout: 5000 });
    assert.equal(paths.filter(path => path === `/api/gifts/gifts/${canvasGift.slug}`).length, 2);
    releaseCatalog.resolve();
    await page.locator('#main a[href="/"]').click();
    await page.locator('.hero a[href="/explore"]').first().click();
    await page.locator('#catalog-grid .template-card').first().waitFor();
    assert.equal(paths.filter(path => path === '/api/catalog/templates').length, 1);
    assert(paths.includes('/api/auth/me'), 'The account outage was exercised while opening the library');

    await page.goto(base + `/g/${legacyGift.slug}`);
    await page.getByRole('heading', { name: legacyGift.recipientName, exact: true }).waitFor();
    await page.locator('[data-action="open-gift"]').click();
    await page.locator('[data-action="reveal-gift"]').click();
    await page.getByText(legacyGift.message, { exact: true }).waitFor();
    await page.getByText('Đang tải lời hồi đáp…').waitFor();
    releaseLegacyReplies.resolve();
    await page.locator('#reply-list .no-replies').waitFor();
    await page.locator('#reply-form textarea').fill('Lời hồi đáp quà legacy.');
    await page.locator('#reply-form button[type="submit"]').click();
    await page.locator('#reply-list').getByText('Lời hồi đáp quà legacy.', { exact: true }).waitFor();
    await page.goto(base + `/g/${expiredSlug}`);
    await page.getByText('Món quà đã hết thời gian hoạt động.').waitFor();
    await page.goto(base + '/g/missing-synthetic-gift');
    await page.getByText('Không tìm thấy món quà.').waitFor();
    assert.deepEqual(errors, []);
  } finally {
    releaseCatalog.resolve();
    releaseLegacyReplies.resolve();
    await guest.close();
  }
}

async function measureGiftReadability(browser, base, { slug }, greeting) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['https://fonts.googleapis.com/*', 'https://fonts.gstatic.com/*'] });
    const requests = [];
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.origin === base && url.pathname.startsWith('/api/')) requests.push(url.pathname);
    });
    const url = `${base}/g/${slug}`;
    const readable = page.locator('.gift-runtime-stage').getByText(greeting, { exact: true });
    const measure = async open => {
      const from = requests.length;
      const start = performance.now();
      await open();
      await page.waitForURL(url);
      await readable.waitFor();
      const apiRequests = requests.slice(from);
      assert.deepEqual(apiRequests, [`/api/gifts/gifts/${slug}`]);
      return { readableMs: Math.round(performance.now() - start), giftRequests: apiRequests.length };
    };
    const firstOpen = await measure(() => page.goto(url, { waitUntil: 'commit' }));
    await page.locator('#main a[href="/"]').click();
    await page.locator('.hero').waitFor();
    const spaReturn = await measure(() => page.evaluate(() => globalThis.history.back()));
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    const cacheDisabledReload = await measure(() => page.reload({ waitUntil: 'commit' }));
    return { firstOpen, spaReturn, cacheDisabledReload };
  } finally { await context.close(); }
}

export async function runCanvasBrowser(base, expiredSlug) {
  const channel = process.env.BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined);
  const browser = await chromium.launch({ headless: true, channel });
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
    await page.goto(base + '/design/new');
    await control('create-blank').click();
    const greeting = 'Chúc bạn một ngày thật vui từ trang trống!';
    await field('binding.recipientName').fill('Ánh Mai');
    await field('binding.senderName').fill('Đặng An');
    await field('binding.message').fill(greeting);
    await save();
    const blankId = new URL(page.url()).pathname.split('/').at(-1);
    assert.equal((await api(`/designs/designs/${blankId}`)).data.design.document.elements.length, 0);
    await control('publish').click();
    await page.getByRole('alert').filter({ hasText: 'Thiết kế chưa có nội dung hiển thị.' }).waitFor();
    assert.equal(new URL(page.url()).pathname, `/design/${blankId}`);
    await control('insert-greeting').click();
    await page.locator('.editor-artboard').getByText(greeting, { exact: true }).waitFor();
    await control('undo').click();
    assert.equal(await page.locator('.editor-artboard').getByText(greeting, { exact: true }).count(), 0);
    await control('redo').click();
    await control('preview').click();
    await page.locator('dialog[open] .gift-runtime-stage').getByText(greeting, { exact: true }).waitFor();
    await control('preview-close').click();
    const publication = page.waitForResponse(response => response.url().endsWith('/gifts/gifts/from-design') && response.status() === 201);
    await control('publish').click();
    await confirmGiftAccess(page);
    await page.waitForURL('**/success/*');
    const { gift: blankGift } = await (await publication).json();
    assert.equal(await page.locator('#share-link').inputValue(), blankGift.url);
    const blankSlug = new URL(page.url()).pathname.split('/').at(-1);
    const guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const guestPage = await guest.newPage();
      await guestPage.goto(`${base}/g/${blankSlug}`);
      await guestPage.locator('.gift-runtime-stage').getByText(greeting, { exact: true }).waitFor();
    } finally { await guest.close(); }
    completed.push('blank draft blocked; bound greeting insertion, undo/redo, preview and anonymous publication');
    const freeTemplate = (await api('/catalog/templates')).data.templates.find(template => template.price === 0);
    const legacy = await api('/gifts/gifts', { templateId: freeTemplate.id, senderName: 'An', recipientName: 'Mai legacy', message: 'Mở lại quà cũ' });
    assert.equal(legacy.status, 201);
    await checkShareInBrowser(browser, context, base, [blankGift, legacy.data.gift]);
    completed.push('canvas and legacy share across distinct hostnames; QR decoded; clipboard success and manual copy');
    await checkRecipientDependencies(browser, base, blankGift, legacy.data.gift, expiredSlug, greeting);
    completed.push('anonymous gift ready during held catalog and auth outage; explore, legacy, expired and missing links');
    metrics.readableGreeting = await measureGiftReadability(browser, base, blankGift, greeting);
    await page.goto(base + '/studio');
    await page.locator('.dashboard-heading').first().waitFor();
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
    await control('publish').click(); await confirmGiftAccess(page); await page.waitForURL('**/success/*'); const slug = new URL(page.url()).pathname.split('/').at(-1);
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
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/template/polaroid`);
    await page.getByRole('link', { name: 'Cá nhân hóa nhanh' }).click();
    await page.locator('.editor-workspace').waitFor();
    await page.getByRole('heading', { name: 'Điền nội dung' }).waitFor({ timeout: 5000 });
    assert.equal(await control('scene-add').isVisible(), false);
    const quickDraft = new URL(page.url());
    assert.equal(quickDraft.searchParams.get('mode'), 'quick');
    const quickId = quickDraft.pathname.split('/').at(-1);
    const beforeToggle = (await api('/designs/designs')).data.designs.length;
    await field('binding.recipientName').fill('Mai');
    await field('binding.senderName').fill('An');
    const quickGreeting = 'Một nháp trả phí, có ảnh kỷ niệm.';
    await field('binding.message').fill(quickGreeting);
    await field('quick-photo').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: bytes });
    await page.locator('.editor-artboard img').waitFor();
    await field('quick-photo').setInputFiles({ name: 'invalid.png', mimeType: 'image/png', buffer: Buffer.from('invalid PNG fixture') });
    await page.locator('.editor-error').waitFor();
    await page.locator('.editor-artboard img').waitFor();
    await control('toggle-mode').click();
    assert.equal(new URL(page.url()).pathname, quickDraft.pathname);
    assert.equal(new URL(page.url()).searchParams.has('mode'), false);
    assert.equal(await control('scene-add').isVisible(), true);
    await control('toggle-mode').click();
    assert.equal(await field('binding.message').inputValue(), quickGreeting);
    await save();
    await page.reload();
    assert.equal(await field('binding.message').inputValue(), quickGreeting);
    await page.locator('.editor-artboard img').waitFor();
    await control('preview').click();
    const quickPreview = page.locator('dialog[open]');
    await quickPreview.getByRole('button', { name: /Lời chúc/ }).click();
    await quickPreview.getByText(quickGreeting, { exact: true }).waitFor();
    await control('preview-close').click();
    const quickPersisted = (await api(`/designs/designs/${quickId}`)).data.design;
    assert.equal((await api('/designs/designs')).data.designs.length, beforeToggle);
    assert.equal(quickPersisted.source.templateId, 'polaroid');
    assert.equal(quickPersisted.document.assets.length, 1);
    assert(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth + 1));
    await page.route('**/api/checkout/payments/methods', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Lỗi methods giả lập' }) }));
    await control('preview').click(); await control('preview-send').click();
    await page.getByRole('heading', { name: 'Không tải được phương thức' }).waitFor();
    await page.unroute('**/api/checkout/payments/methods'); await page.locator('[data-action="retry-canvas-payment"]').click(); await page.getByRole('heading', { name: 'Chưa có phương thức thanh toán' }).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await field('binding.message').inputValue(), quickGreeting);
    const grant = await api('/checkout/orders/demo-purchase', { templateId: 'polaroid' });
    assert.equal(grant.status, 201);
    await control('preview').click(); await control('preview-send').click();
    await confirmGiftAccess(page);
    await page.waitForURL('**/success/*');
    await page.goto(`${base}/template/polaroid`);
    await page.getByRole('link', { name: 'Chỉnh bố cục' }).click();
    await control('scene-add').waitFor();
    assert.equal(new URL(page.url()).searchParams.has('mode'), false);
    completed.push('paid photo template: upload failure preserves image, mode switches share one draft, checkout returns to the saved draft, demo license permits quick publication');
    csp.push(...await page.evaluate(() => globalThis.__csp)); assert.deepEqual(csp, []); assert.deepEqual(errors, []);
    if (artifacts) fs.writeFileSync(path.join(artifacts, 'canvas-browser.json'), JSON.stringify({
      result: 'PASS', completed, metrics, platform: process.platform, browser: browser.version(),
      fixture: 'Headless at 390×844, synthetic JSON on loopback. Readable greeting measured on a one-scene text-only gift.',
      errors, csp,
    }, null, 2));
    console.log('PASS Browser canvas: ' + completed.join('; ')); console.log(JSON.stringify({ metrics }));
  } finally { await browser.close(); }
}
