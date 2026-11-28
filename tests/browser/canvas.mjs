import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import jsQR from 'jsqr';
import sharp from 'sharp';
import { confirmGiftAccess } from './gift-access.mjs';
import { clickEditorTool, selectEditorLocale } from './editor-tools.mjs';
import { checkContextualCanvas } from './canvas-contextual.mjs';
import { checkCanvasGroups } from './canvas-element-groups.mjs';
import {catalog} from '../../web/js/features/canvas-editor/library.js';
import {filteredIds} from '../../web/js/features/canvas-editor/library-discovery.js';

// Public Canvas gifts have no shell links. Drive the SPA's browser-history
// entry point directly when testing pending navigation and return behavior.
async function visitHomeThroughHistory(page) {
  await page.evaluate(() => {
    globalThis.history.pushState(null, '', '/');
    globalThis.dispatchEvent(new globalThis.PopStateEvent('popstate'));
  });
}

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
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      for (const gift of gifts) {
        const card = page.locator('.my-gift').filter({ has: page.locator(`a[href="/g/${gift.slug}"]`) });
        const clipped = await card.locator('.my-gift-actions').evaluate(actions => {
          const row = actions.getBoundingClientRect();
          const left = Math.max(0, row.left);
          const right = Math.min(globalThis.document.documentElement.clientWidth, row.right);
          return Array.from(actions.children).filter(control => {
            const box = control.getBoundingClientRect();
            return box.left < left - 1 || box.right > right + 1;
          }).map(control => control.getAttribute('aria-label') || control.textContent.trim());
        });
        assert.deepEqual(clipped, [], `Studio gift controls overflow at ${width}px`);
        await card.getByRole('button', { name: 'Sao chép link' }).click();
        const manual = page.getByRole('dialog').locator('[data-copy-value]');
        assert.equal(await manual.inputValue(), gift.url);
        assert(await selected(manual));
        await page.keyboard.press('Escape');
      }
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
    // Canvas gifts stay immersive even while Auth/Catalog are unavailable.
    const canvasCta = page.getByRole('link', { name: /Tạo thiệp của riêng bạn/ });
    assert.equal(await canvasCta.count(), 0);
    assert.equal(await page.getByText('Tạo bằng Momevia', { exact: false }).count(), 0);
    assert.equal(await page.locator('.gift-runtime-navigation').count(), 0);
    assert.deepEqual(paths.filter(path => path.startsWith('/api/')), [`/api/gifts/gifts/${canvasGift.slug}`]);
    const catalogRequest = page.waitForRequest(request => request.url().endsWith('/api/catalog/templates'), { timeout: 5000 });
    await visitHomeThroughHistory(page);
    await catalogRequest;
    await catalogStarted.promise;
    assert(paths.includes('/api/catalog/templates'), 'The library started its catalog request');
    await page.evaluate(() => globalThis.history.back());
    await page.waitForURL(base + giftPath);
    await stage.waitFor({ timeout: 5000 });
    assert.equal(paths.filter(path => path === `/api/gifts/gifts/${canvasGift.slug}`).length, 2);
    releaseCatalog.resolve();
    await visitHomeThroughHistory(page);
    await page.locator('.hero a[href="/explore"]').first().click();
    await page.locator('#catalog-grid .template-card').first().waitFor();
    assert.equal(paths.filter(path => path === '/api/catalog/templates').length, 1);
    assert(paths.includes('/api/auth/me'), 'The account outage was exercised while opening the library');

    await page.goto(base + `/g/${legacyGift.slug}`);
    await page.getByRole('heading', { name: legacyGift.recipientName, exact: true }).waitFor();
    assert.equal(await page.locator('[data-recipient-stage="sealed"]').getAttribute('aria-current'), 'step');
    await page.locator('[data-action="open-gift"]').click();
    assert.equal(await page.locator('[data-recipient-stage="surprise"]').getAttribute('aria-current'), 'step');
    await page.locator('[data-action="reveal-gift"]').click();
    assert.equal(await page.locator('[data-recipient-stage="opened"]').getAttribute('aria-current'), 'step');
    await page.getByText(legacyGift.message, { exact: true }).waitFor();
    const legacyCta = page.getByRole('link', { name: /Tạo thiệp của riêng bạn/ });
    await legacyCta.waitFor();
    assert.equal(await legacyCta.getAttribute('href'), '/explore?source=recipient');
    assert.equal(await page.getByText('Tạo bằng Momevia', { exact: false }).count(), 1);
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
    await visitHomeThroughHistory(page);
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
    await page.locator('#auth-terms').check();
    await page.locator('#auth-privacy').check();
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
    // Ca kiểm thử danh sách phản hồi công khai cần chủ động cấp quyền đọc qua link.
    const legacy = await api('/gifts/gifts', {
      templateId: freeTemplate.id, senderName: 'An', recipientName: 'Mai legacy', message: 'Mở lại quà cũ',
      access: { open: 'link', send: 'link', read: 'link' },
    });
    assert.equal(legacy.status, 201);
    await checkShareInBrowser(browser, context, base, [blankGift, legacy.data.gift]);
    completed.push('canvas and legacy share across distinct hostnames; QR decoded; clipboard fallback and Studio actions fit at 320/390px');
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
    await page.locator('[data-editor-action="library-tab"][data-tab="add"]').click();
    await page.locator('[data-block="paragraph"]').click();
    await field('props.text').fill('Kỷ niệm của chúng mình ✨');
    await page.locator('.editor-geometry summary').click();
    await field('layout.y').fill('90'); await field('layout.y').dispatchEvent('change');
    await page.locator('[data-block="photo"]').click();
    const bytes = await sharp({ create: { width: 80, height: 60, channels: 3, background: '#b98adc' } }).png().toBuffer();
    await field('upload').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: bytes });
    await page.waitForFunction(() => globalThis.document.querySelector('.editor-save-status')?.textContent !== 'Ảnh đang xử lý…');
    await page.locator('.editor-geometry summary').click();
    await field('layout.y').fill('240'); await field('layout.y').dispatchEvent('change');
    await page.locator('[data-block="reply"]').click();
    await page.locator('.editor-geometry summary').click();
    await field('layout.y').fill('480'); await field('layout.y').dispatchEvent('change');
    await save();
    const first = (await api(`/designs/designs/${id}`)).data.design;
    assert.equal(first.document.elements.length, 3); assert.equal(first.document.assets.length, 1);
    await page.reload(); await field('binding.recipientName').waitFor(); assert.equal(await field('binding.recipientName').inputValue(), 'Ánh Mai');
    const loaded = (await api(`/designs/designs/${id}`)).data.design; assert.deepEqual(loaded.document, first.document);
    completed.push('blank Unicode + binary image + reply, save/reload stable IDs/layout');

    await control('zoom-in').click();
    await control('fit').click();
    assert(Number(await field('zoom').inputValue()) > 0, 'Vừa khung leaves a numeric zoom selected');
    const firstLayer = first.document.elements[0].id;
    const layer = page.locator(`.editor-artboard .editor-stage-element[data-element-id="${firstLayer}"]`);
    const layerIndex = await layer.evaluate(node => node.style.zIndex);
    await page.locator('[data-editor-action="library-tab"][data-tab="layers"]').click();
    await page.locator(`.editor-layers [data-id="${firstLayer}"]`).click();
    assert.equal(await layer.evaluate(node => node.style.zIndex), layerIndex);
    await page.locator('.editor-selection-outline').waitFor();
    await page.locator('[data-editor-action="library-tab"][data-tab="content"]').click();
    await page.locator('.editor-scenes .editor-thumbnail-surface .gift-runtime-image img').waitFor();
    completed.push('fit zoom displays its actual value; layer selection preserves stacking; scene thumbnails show draft media');

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
    const saveStatus = page.locator('.editor-save-status[data-tone="warning"]');
    const saveHint = page.locator('.editor-save-hint');
    await saveStatus.filter({ hasText: 'Mất kết nối' }).waitFor();
    await saveHint.filter({ hasText: 'Có bản nháp tạm' }).waitFor();
    await selectEditorLocale(page, 'en');
    await saveStatus.filter({ hasText: 'Offline' }).waitFor();
    await saveHint.filter({ hasText: 'A temporary draft is available in this tab' }).waitFor();
    assert.match(await saveStatus.getAttribute('title'), /A temporary draft/);
    assert.equal(await field('binding.message').inputValue(), 'Bản chưa có ACK mạng');
    await selectEditorLocale(page, 'vi');
    await saveStatus.filter({ hasText: 'Mất kết nối' }).waitFor();
    page.once('dialog', dialog => dialog.dismiss()); await control('studio').click(); assert.equal(new URL(page.url()).pathname, designPath);
    page.once('dialog', dialog => dialog.dismiss()); await page.evaluate(() => globalThis.history.back());
    await page.waitForURL(`**${designPath}`); assert.equal(await field('binding.message').inputValue(), 'Bản chưa có ACK mạng');
    await page.unroute('**/api/designs/designs/*/save'); await control('retry-save').click();
    await page.locator('.editor-save-status[data-tone="saved"]').filter({ hasText: 'Đã lưu trên máy chủ' }).waitFor();
    assert.match(await page.locator('.editor-save-status[data-tone="saved"]').getAttribute('title'), /Lần lưu được xác nhận/);
    assert.equal(await saveHint.isHidden(), true);
    completed.push('offline feedback in VI/EN, retry, and internal/Back navigation guard');

    for (const width of [320, 375, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      if (artifacts && [320, 390, 768, 1440].includes(width)) { fs.mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: path.join(artifacts, `canvas-editor-${width}.png`), fullPage: true }); }
      const overflow = await page.evaluate(() => ({ width: globalThis.document.documentElement.scrollWidth, viewport: globalThis.innerWidth, elements: [...globalThis.document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > globalThis.innerWidth + 1 && globalThis.getComputedStyle(e).position !== 'absolute').slice(0, 6).map(e => [e.tagName, e.className, e.getBoundingClientRect().right]) }));
      assert(overflow.width <= overflow.viewport + 1, `editor overflow ${width}: ${JSON.stringify(overflow)}`);
      if ([320, 390, 768].includes(width)) {
        const historyControls = page.locator('.editor-mobile-history');
        await historyControls.waitFor({ state: 'visible' });
        const mobileUndo = historyControls.locator('[data-editor-action="mobile-undo"]');
        const mobileRedo = historyControls.locator('[data-editor-action="mobile-redo"]');
        assert.equal(await mobileUndo.isVisible(), true);
        assert.equal(await mobileRedo.isVisible(), true);
        const desktopUndo = page.locator('.editor-top-actions [data-editor-action="undo"]');
        const desktopRedo = page.locator('.editor-top-actions [data-editor-action="redo"]');
        assert.equal(await desktopUndo.isVisible(), false);
        assert.equal(await desktopRedo.isVisible(), false);
        assert.equal(await mobileUndo.isDisabled(), await desktopUndo.isDisabled());
        assert.equal(await mobileRedo.isDisabled(), await desktopRedo.isDisabled());
        const bounds = await historyControls.locator('button').evaluateAll(buttons => buttons.map(node => {
          const box = node.getBoundingClientRect();
          return { left: box.left, right: box.right, height: box.height };
        }));
        assert(bounds.every(box => box.height >= 44 && box.left >= -1 && box.right <= width + 1),
          `mobile Undo/Redo overflow or small touch target at ${width}: ${JSON.stringify(bounds)}`);
        for (const kind of ['library', 'layers', 'inspector', 'scenes']) {
          const trigger = control(`sheet-${kind}`);
          await trigger.click();
          const opened = page.locator('.editor-sheet-open[aria-modal="true"]');
          const backdrop = page.locator('.editor-sheet-backdrop');
          assert.equal(await opened.count(), 1);
          assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
          assert.equal(await backdrop.isVisible(), true);
          assert.equal(await opened.evaluate(node => node.contains(node.ownerDocument.activeElement)), true);
          if (kind === 'library' && width === 390) {
            // Sheet mở tại nút đóng, Shift+Tab chuyển về cuối và Tab quay về đầu.
            await page.keyboard.press('Shift+Tab');
            assert.equal(await opened.evaluate(node => node.contains(node.ownerDocument.activeElement)), true);
            await page.keyboard.press('Tab');
            assert.equal(await opened.locator('[data-editor-action="close-sheet"]').evaluate(node => node === node.ownerDocument.activeElement), true);
          }
          if (kind === 'scenes') await backdrop.click({ position: { x: 15, y: 15 } });
          else await page.keyboard.press('Escape');
          assert.equal(await opened.count(), 0);
          assert.equal(await backdrop.isHidden(), true);
          assert(await trigger.evaluate(node => node === node.ownerDocument.activeElement));
        }
      }
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
    await page.getByRole('link', { name: 'Dùng mẫu' }).click();
    await page.locator('.editor-workspace').waitFor();
    await page.getByRole('heading', { name: 'Điền nội dung' }).waitFor({ timeout: 5000 });
    assert.equal(await control('scene-add').isVisible(), false);
    const quickDraft = new URL(page.url());
    assert.equal(quickDraft.searchParams.get('mode'), 'quick');
    const quickId = quickDraft.pathname.split('/').at(-1);
    const quickInitial=(await api(`/designs/designs/${quickId}`)).data.design;
    const beforeToggle = (await api('/designs/designs')).data.designs.length;
    await field('binding.recipientName').fill('Mai');
    await field('binding.senderName').fill('An');
    const quickGreeting = 'Một nháp trả phí, có ảnh kỷ niệm.';
    await field('binding.message').fill(quickGreeting);
    const uploadedPhoto=page.waitForResponse(r=>r.url().endsWith('/assets')&&r.request().method()==='POST'&&r.status()===201);
    await field('quick-photo').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: bytes });
    const uploadedAsset=(await (await uploadedPhoto).json()).asset;
    await page.locator(`.editor-artboard [data-element-id="photo-window-image"] img[src$="/${uploadedAsset.id}"]`).waitFor();
    await field('quick-photo').setInputFiles({ name: 'invalid.png', mimeType: 'image/png', buffer: Buffer.from('invalid PNG fixture') });
    await page.locator('.editor-error').waitFor();
    await page.locator(`.editor-artboard [data-element-id="photo-window-image"] img[src$="/${uploadedAsset.id}"]`).waitFor();
    await clickEditorTool(page, 'toggle-mode');
    assert.equal(new URL(page.url()).pathname, quickDraft.pathname);
    assert.equal(new URL(page.url()).searchParams.has('mode'), false);
    await control('sheet-scenes').click();
    assert.equal(await control('scene-add').isVisible(), true);
    await page.keyboard.press('Escape');
    await clickEditorTool(page, 'toggle-mode');
    assert.equal(await field('binding.message').inputValue(), quickGreeting);
    await save();
    await page.reload();
    assert.equal(await field('binding.message').inputValue(), quickGreeting);
    await page.locator(`.editor-artboard [data-element-id="photo-window-image"] img[src$="/${uploadedAsset.id}"]`).waitFor();
    await control('preview').click();
    const quickPreview = page.locator('dialog[open]');
    const sceneSelect = quickPreview.locator('.gift-runtime-scene-select');
    const greetingScene = await sceneSelect.locator('option').filter({ hasText: /Lời chúc/ }).getAttribute('value');
    assert(greetingScene, 'The compact scene selector retains the greeting scene');
    await sceneSelect.selectOption(greetingScene);
    await quickPreview.getByText(quickGreeting, { exact: true }).waitFor();
    await control('preview-close').click();
    const quickPersisted = (await api(`/designs/designs/${quickId}`)).data.design;
    assert.equal((await api('/designs/designs')).data.designs.length, beforeToggle);
    assert.equal(quickPersisted.source.templateId, 'polaroid');
    assert.deepEqual(quickPersisted.document.assets.map(a=>a.assetId).sort(),[...quickInitial.document.assets.map(a=>a.assetId),uploadedAsset.id].sort());
    assert(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth + 1));
    await page.route('**/api/checkout/payments/methods', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Lỗi methods giả lập' }) }));
    await control('preview').click(); await control('preview-send').click();
    await page.getByRole('heading', { name: 'Không tải được phương thức' }).waitFor();
    // Mô phỏng trường hợp không có phương thức thanh toán và không được mua thử.
    await page.unroute('**/api/checkout/payments/methods');
    await page.route('**/api/checkout/payments/methods', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ methods: [], demoPurchaseAvailable: false }) }));
    await page.locator('[data-action="retry-canvas-payment"]').click();
    await page.getByRole('heading', { name: 'Chưa có phương thức thanh toán' }).waitFor();
    assert.equal(await page.locator('[data-action="demo-buy"]').count(), 0);
    await page.keyboard.press('Escape');
    await page.unroute('**/api/checkout/payments/methods');
    assert.equal(await field('binding.message').inputValue(), quickGreeting);
    // Fixture thật bật cả hai cờ demo, không bật thanh toán thật.
    const methods = await api('/checkout/payments/methods');
    assert.equal(methods.status, 200);
    assert.deepEqual(methods.data.methods, []);
    assert.equal(methods.data.demoPurchaseAvailable, true);
    await control('preview').click(); await control('preview-send').click();
    await page.getByRole('heading', { name: 'Dùng thử mẫu có giá' }).waitFor();
    await page.getByRole('button', { name: 'Cấp quyền dùng thử' }).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await field('binding.message').inputValue(), quickGreeting);
    const grant = await api('/checkout/orders/demo-purchase', { templateId: 'polaroid' });
    assert.equal(grant.status, 201);
    await control('preview').click(); await control('preview-send').click();
    await confirmGiftAccess(page);
    await page.waitForURL('**/success/*');
    await page.goto(`${base}/template/polaroid`);
    await page.getByRole('link', { name: 'Chỉnh bố cục' }).click();
    await control('sheet-scenes').click();
    await control('scene-add').waitFor();
    assert.equal(new URL(page.url()).searchParams.has('mode'), false);
    completed.push('paid photo template: upload failure preserves image, mode switches share one draft, checkout returns to the saved draft, demo license permits quick publication');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + '/design/new');
    await control('create-celebration').waitFor();
    assert.deepEqual(await page.locator('.editor-start-options [data-preset]').evaluateAll(cards => cards.map(card => card.dataset.preset)), ['blank', 'envelope-basic', 'celebration']);
    assert.equal(await page.locator('.editor-start-options .editor-thumbnail').count(), 3);
    if (artifacts) await page.screenshot({ path: path.join(artifacts, 'canvas-starters-1440.png'), fullPage: true });
    await control('create-celebration').click();
    await page.locator('.editor-artboard .gift-runtime-gift-box').waitFor();
    const libraryId = new URL(page.url()).pathname.split('/').at(-1);
    const library = page.locator('.editor-library');
    const tab = key => library.locator(`[data-tab="${key}"]`);
    const block = key => library.locator(`[data-block="${key}"]`);
    const search = library.getByRole('searchbox');
    await field('binding.recipientName').fill('Ánh Mai');
    await field('binding.senderName').fill('An');
    await field('binding.message').fill('Mong bạn tìm được nhiều niềm vui mới.');
    await tab('add').click();
    await search.fill('ngoi sao');
    assert.deepEqual((await library.locator('[data-block]:visible').evaluateAll(nodes=>nodes.map(n=>n.dataset.block))).sort(),[...filteredIds(catalog,{query:'ngoi sao'})].sort());
    await block('star').click();
    const star = page.locator('.editor-artboard .gift-runtime-sticker');
    assert.equal(await star.textContent(), '★');
    const starFirst = await star.evaluate(node => [node.style.left, node.style.top]);
    await block('star').click();
    assert.notDeepEqual(await star.last().evaluate(node => [node.style.left, node.style.top]), starFirst);
    assert.equal(await page.locator('.editor-selection-outline').getAttribute('data-element-id'), await star.last().getAttribute('data-element-id'));
    await search.fill('cum hoa');
    const layerCount = await page.locator('.editor-artboard .editor-stage-element').count();
    await block('flowers').click();
    const flowerLayers = 6; // Five independent petals and the flower centre.
    assert.equal(await page.locator('.editor-artboard .editor-stage-element').count(), layerCount + flowerLayers);
    await control('undo').click();
    assert.equal(await page.locator('.editor-artboard .editor-stage-element').count(), layerCount);
    await control('redo').click();
    assert.equal(await page.locator('.editor-artboard .editor-stage-element').count(), layerCount + flowerLayers);
    await search.fill('doc tiep');
    await block('continue').click();
    await page.locator('.editor-artboard .editor-unlinked-action').waitFor();
    const actionId = await page.locator('.editor-selection-outline').getAttribute('data-element-id');
    await save();
    const libraryDraft = (await api(`/designs/designs/${libraryId}`)).data.design;
    const blocked = (await api(`/designs/designs/${libraryId}/preflight`, { expectedRevision: libraryDraft.revision })).data;
    assert.equal(blocked.canPublish, false);
    assert(blocked.blockers.some(blocker => blocker.path.includes('.actions.')));
    await page.locator('.editor-target-picker summary').click();
    const destination = page.locator('.editor-target-scenes').getByRole('button', { name: 'Lời chúc', exact: true });
    assert.equal(await destination.locator('.editor-thumbnail').count(), 1);
    await destination.click();
    assert.equal(await page.locator('.editor-artboard .editor-unlinked-action').count(), 0);
    await search.fill('xem lai');
    await block('replay').click();
    const replayId = await page.locator('.editor-selection-outline').getAttribute('data-element-id');
    await control('layer-down').click();
    await control('preview').click();
    const libraryPreview = page.locator('dialog[open] .gift-runtime-stage');
    const previewStar = libraryPreview.locator('.gift-runtime-sticker').first();
    assert.equal(await previewStar.textContent(), '★');
    const effectiveStar = await previewStar.evaluate(node => parseFloat(node.style.fontSize) / (node.parentElement.clientWidth / 390));
    assert(Math.abs(effectiveStar - parseFloat(await star.first().evaluate(node => node.style.fontSize))) < 0.1);
    const readNext = libraryPreview.locator(`[data-runtime-element="${actionId}"]`);
    const replay = libraryPreview.locator(`[data-runtime-element="${replayId}"]`);
    assert(Number(await replay.evaluate(node => node.style.zIndex)) < Number(await readNext.evaluate(node => node.style.zIndex)));
    await readNext.focus();
    await page.keyboard.press('Tab');
    assert(await replay.evaluate(node => node === node.ownerDocument.activeElement));
    await readNext.click();
    assert.equal(await libraryPreview.getAttribute('aria-label'), 'Lời chúc');
    await control('preview-close').click();
    await save();
    completed.push('three visual starters; Vietnamese search, exact star, staggered insertion, one undo for a motif, blocking incomplete action and choosing a scene by thumbnail');
    completed.push(await checkContextualCanvas({ page, base, browser, context, artifacts }));
    completed.push(await checkCanvasGroups(page, base));

    csp.push(...await page.evaluate(() => globalThis.__csp)); assert.deepEqual(csp, []); assert.deepEqual(errors, []);
    if (artifacts) fs.writeFileSync(path.join(artifacts, 'canvas-browser.json'), JSON.stringify({
      result: 'PASS', completed, metrics, platform: process.platform, browser: browser.version(),
      fixture: 'Headless at 390×844, synthetic JSON on loopback. Readable greeting measured on a one-scene text-only gift.',
      errors, csp,
    }, null, 2));
    console.log('PASS Browser canvas: ' + completed.join('; ')); console.log(JSON.stringify({ metrics }));
  } finally { await browser.close(); }
}
