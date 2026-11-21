import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import sharp from 'sharp';
import jsQR from 'jsqr';
import path from 'node:path';
import { confirmGiftAccess } from './gift-access.mjs';

const image = color => sharp({ create: { width: 36, height: 24, channels: 3, background: color } }).png().toBuffer();
const field = (page, name) => page.locator(`[data-editor-field="${name}"]`);
const action = (page, name) => page.locator(`[data-editor-action="${name}"]`);
const giftPath = url => new URL(url).pathname + new URL(url).search;

// Đo diện tích phần tử thực sự nằm trong viewport; Playwright Locator không có isInViewport().
const visibleInViewport = async (page, locator, minRatio = 0.1) => {
  const rect = await locator.boundingBox();
  const viewport = page.viewportSize();
  if (!rect || !viewport || rect.width <= 0 || rect.height <= 0) return false;
  const width = Math.max(0, Math.min(rect.x + rect.width, viewport.width) - Math.max(rect.x, 0));
  const height = Math.max(0, Math.min(rect.y + rect.height, viewport.height) - Math.max(rect.y, 0));
  return width * height >= rect.width * rect.height * minRatio;
};

export async function runCreatorJourney(base) {
  const channel = process.env.BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined);
  const browser = await chromium.launch({ headless: true, channel });
  const capture = async (page, name) => {
    if (process.env.BROWSER_ARTIFACT_DIR) await page.screenshot({ path: path.resolve(process.env.BROWSER_ARTIFACT_DIR, `birthday-${name}.png`) });
  };
  const loaded = page => page.waitForFunction(() => {
    const img = globalThis.document.querySelector('.gift-runtime-stage img');
    return img?.complete && img.naturalWidth > 0;
  });
  async function client(viewport = { width: 1440, height: 1000 }) {
    const context = await browser.newContext({ viewport });
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    const page = await context.newPage();
    const ask = (endpoint, data) => data === undefined ? context.request.get(`${base}/api${endpoint}`) : context.request.post(`${base}/api${endpoint}`, { data });
    const call = async (endpoint, data, status = 200) => {
      const res = await ask(endpoint, data);
      assert.equal(res.status(), status, endpoint);
      return res.json();
    };
    const register = name => call('/auth/register', {
      name, email: `${randomUUID()}@example.test`, password: 'SyntheticOnly123', confirmPassword: 'SyntheticOnly123',
    }, 201);
    return { page, call, ask, register };
  }
  try {
    const [admin, rival, creator, other, sender, guest, denied] = await Promise.all([
      client(), client(), client(), client(), client({ width: 390, height: 844 }), client({ width: 390, height: 844 }), client(),
    ]);
    await admin.call('/auth/demo-admin', { code: 'synthetic-admin' });
    const profiles = await Promise.all([rival.register('Admin khác'), creator.register('Tác giả mẫu QA'), other.register('Tác giả khác'), sender.register('Người gửi QA')]);
    for (const [index, role] of ['admin', 'creator', 'creator'].entries())
      await admin.call(`/auth/admin/users/${profiles[index].user.id}/role`, { role });
    const page = creator.page;
    const title = 'Sinh nhật bên khung ảnh';
    await page.goto(base + '/creator');
    await page.getByLabel('Tên mẫu').fill(title);
    await page.getByLabel('Mô tả ngắn').fill('Mẫu kiểm thử sinh nhật có ảnh.');
    await page.getByRole('button', { name: 'Tạo nháp mẫu' }).click();
    await page.waitForURL('**/design/*');
    const id = new URL(page.url()).pathname.split('/').at(-1);
    const designEndpoint = `/designs/designs/${id}`;
    const workspace = `/catalog/creator/workspaces/${id}`;
    await other.call(designEndpoint, undefined, 404);
    const otherDraft = await other.call('/catalog/creator/workspaces', {
      mutationId: randomUUID(), title: 'Mẫu riêng thứ hai', subtitle: 'Tác giả khác trong fixture.',
    }, 201);
    await creator.call(`/designs/designs/${otherDraft.id}`, undefined, 404);
    assert.deepEqual((await sender.call('/designs/designs')).designs, []);

    await page.locator('[data-editor-action="library-tab"][data-tab="add"]').click();
    await page.locator('[data-block="photo"]').click();
    await field(page, 'upload').setInputFiles({ name: 'demo.png', mimeType: 'image/png', buffer: await image('#945ad1') });
    await page.locator('.editor-artboard img').waitFor();
    await action(page, 'save').click();
    await page.locator('.editor-save-status').filter({ hasText: 'Đã lưu' }).waitFor();
    const draft = (await creator.call(designEndpoint)).design;
    const photo = draft.document.elements.find(element => element.type === 'image');
    const photoId = photo.id;
    const first = { expectedRevision: draft.revision, bindings: ['recipientName', 'senderName', 'message'], photoId, rights: 'Ảnh màu tổng hợp tạo cho QA, quyền phân phối đã cấp.' };
    await action(page, 'submit-template').click();
    const submit = page.getByRole('dialog', { name: 'Gửi phiên bản để duyệt' });
    await submit.getByLabel('Khung ảnh Sender được thay').selectOption(photoId);
    await submit.getByLabel('Nguồn ảnh và quyền phân phối trong mẫu, quà').fill(first.rights);
    await capture(page, 'creator-submit');
    await submit.getByRole('button', { name: 'Gửi duyệt' }).click();
    await page.waitForURL('**/creator');
    const [retry, retryAgain] = await Promise.all([creator.call(workspace + '/submit', first), creator.call(workspace + '/submit', first)]);
    assert.equal(retry.version.id, retryAgain.version.id);
    const v1 = retry.version.id;
    const reviewEndpoint = `/catalog/admin/templates/${id}/versions/${v1}`;
    await other.call(reviewEndpoint, undefined, 403);
    await page.getByRole('link', { name: 'Mở nháp' }).click();
    await page.getByLabel('Tên thiết kế').fill('Nháp V2 đang chỉnh');
    await action(page, 'save').click();
    await page.locator('.editor-save-status').filter({ hasText: 'Đã lưu' }).waitFor();
    const reviewed = admin.page;
    await reviewed.setViewportSize({ width: 390, height: 844 });
    await reviewed.route('**/api/catalog/admin/pending', route => route.fulfill({ status: 503, json: { error: 'QA outage' } }), { times: 1 });
    await reviewed.goto(base + '/admin');
    await reviewed.getByRole('alert').filter({ hasText: 'Chưa tải được hàng đợi mẫu cũ.' }).waitFor();
    const reviewLink = reviewed.locator(`a[href="/admin/review/${id}/${v1}"]`);
    await reviewLink.focus();
    await reviewed.keyboard.press('Enter');
    await reviewed.getByRole('heading', { name: title, exact: true }).waitFor();
    await loaded(reviewed);
    await reviewed.getByLabel('Tên người nhận thử').fill('Tên Admin thử');
    await reviewed.getByLabel('Thử thay ảnh trên thiết bị').setInputFiles({ name: 'review.png', mimeType: 'image/png', buffer: await image('#00aa80') });
    await reviewed.getByRole('button', { name: 'Cập nhật bản xem thử' }).click();
    await reviewed.locator('.gift-runtime-stage').getByText('Tên Admin thử', { exact: true }).waitFor();
    await reviewed.locator('.gift-runtime-stage img[src^="data:image/png;base64,"]').waitFor();
    await loaded(reviewed);
    await capture(reviewed, 'admin-review');
    await reviewed.getByRole('button', { name: 'Duyệt phiên bản' }).click();
    await reviewed.getByRole('alert').filter({ hasText: 'Xác nhận quyền phân phối' }).waitFor();
    await reviewed.getByLabel('Đã xác nhận quyền phân phối ảnh demo trong mẫu và quà').check();
    await reviewed.getByRole('button', { name: 'Duyệt phiên bản' }).click();
    await reviewed.waitForURL('**/admin');
    await rival.call(reviewEndpoint, { action: 'revise', reason: 'Yêu cầu đến sau' }, 409);
    const detail = (await guest.call(`/catalog/templates/${id}`)).template;
    assert.equal(detail.title, title);
    assert.equal(detail.versionId, v1);
    assert(detail.thumbnail.includes(v1));
    const coverSvg = await (await guest.ask(detail.thumbnail.slice('/api'.length))).text();
    assert.match(coverSvg, /href="data:image\/webp;base64,/);

    const phone = sender.page;
    await phone.context().addInitScript(() => {
      Object.defineProperty(globalThis.navigator, 'share', { value: async ({ url }) => { globalThis.fixtureShares = url; } });
      Object.defineProperty(globalThis.navigator, 'canShare', { value: () => true });
      Object.defineProperty(globalThis.navigator.clipboard, 'writeText', { value: async url => { globalThis.fixtureClipboard = url; } });
    });
    await phone.goto(base + '/explore');
    // Bộ sưu tập vẫn có thể thấy ở đầu trang sau nhóm tìm kiếm và lọc.
    const seasonalShelf = phone.locator('.seasonal-shelf');
    await seasonalShelf.waitFor();
    assert(await visibleInViewport(phone, seasonalShelf), 'Bộ sưu tập mùa lễ phải xuất hiện trong màn hình đầu');
    assert.equal(await seasonalShelf.getAttribute('open'), null);
    await seasonalShelf.locator('summary').click();
    await phone.locator('.seasonal-shelf__card').first().waitFor();
    await capture(phone, 'catalog-390');
    await seasonalShelf.locator('summary').click();
    const firstCard = phone.locator('#catalog-grid .template-card').first();
    await firstCard.waitFor();
    await firstCard.scrollIntoViewIfNeeded();
    assert(await visibleInViewport(phone, firstCard), 'Danh sách mẫu chính phải cuộn tới được trên mobile');
    const search = phone.getByRole('searchbox', { name: 'Tìm kiếm mẫu' });
    await search.fill('sinh nhat ben khung anh');
    await phone.getByRole('checkbox', { name: 'Miễn phí' }).check();
    await phone.getByRole('checkbox', { name: 'Thay được ảnh' }).check();
    assert.equal(await phone.locator('#catalog-grid .template-card').count(), 1);
    await phone.getByRole('button', { name: 'Bỏ lọc' }).click();
    assert.equal(await search.inputValue(), 'sinh nhat ben khung anh');
    const startedAt = Date.now();
    await phone.locator('#catalog-grid').getByRole('link', { name: title, exact: true }).click();
    const start = phone.getByRole('link', { name: 'Dùng mẫu' });
    await start.waitFor();
    for (const width of [320, 390, 1440]) {
      await phone.setViewportSize({ width, height: 844 });
      const position = await start.boundingBox();
      assert(position.y + position.height < 844, `Dùng mẫu not visible in the first ${width}px viewport`);
      assert(await phone.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth));
      await capture(phone, `detail-${width}`);
    }
    await phone.setViewportSize({ width: 390, height: 844 });
    await phone.evaluate(() => { globalThis.document.documentElement.style.fontSize = '200%'; });
    assert(await phone.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth));
    await capture(phone, 'detail-zoom-200');
    await phone.evaluate(() => { globalThis.document.documentElement.style.fontSize = ''; });
    const heading = phone.locator('.detail-info h1');
    await heading.evaluate(item => { item.textContent = item.textContent.repeat(5); });
    assert(await phone.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth));
    await heading.evaluate(item => { item.textContent = item.textContent.slice(0, item.textContent.length / 5); });
    const previewVersion = `**/api/catalog/templates/${id}/versions/${v1}`;
    let versionRequests = 0;
    phone.on('request', request => {
      if (request.url().endsWith(`/api/catalog/templates/${id}/versions/${v1}`)) versionRequests++;
    });
    await phone.route(previewVersion, route => route.fulfill({ status: 503 }), { times: 1 });
    await phone.getByRole('button', { name: 'Xem thử' }).click();
    await phone.getByRole('dialog').getByRole('alert').getByText('Chưa mở được bản xem thử.').waitFor();
    await phone.getByRole('dialog').getByRole('button', { name: 'Thử lại' }).click();
    await phone.locator('.template-preview-player').getByText('Mai', { exact: true }).waitFor();
    const previewLocale = phone.getByRole('dialog').locator('[data-locale-select]');
    await previewLocale.selectOption('en');
    await phone.waitForFunction(() => globalThis.document.documentElement.lang === 'en');
    await phone.locator('.template-preview-player').getByText('Mai', { exact: true }).waitFor();
    assert.equal(versionRequests, 2);
    await previewLocale.selectOption('vi');
    await phone.waitForFunction(() => globalThis.document.documentElement.lang === 'vi');
    await loaded(phone);
    await phone.getByRole('button', { name: 'Đóng', exact: true }).click();
    let releasePreview;
    const holdPreview = new Promise(resolve => { releasePreview = resolve; });
    await phone.route(previewVersion, async route => {
      await holdPreview;
      await route.continue().catch(() => {});
    }, { times: 1 });
    const pending = phone.waitForRequest(previewVersion);
    await phone.getByRole('button', { name: 'Xem thử' }).click();
    await pending;
    await phone.getByRole('dialog').getByRole('status').getByText('Đang mở bản xem thử…').waitFor();
    try {
      await phone.goBack();
      await phone.locator('#catalog-grid').waitFor();
    } finally { releasePreview(); }
    assert.equal(await phone.getByRole('dialog').count(), 0);
    await phone.goForward();
    await phone.getByRole('link', { name: 'Dùng mẫu' }).click();
    await field(phone, 'binding.recipientName').fill('Mai');
    await field(phone, 'binding.senderName').fill('An');
    const greeting = 'Lời chúc riêng của An dành cho Mai.';
    await field(phone, 'binding.message').fill(greeting);
    // The image is on the cover, so the quick editor can verify the new pixels without changing scene.
    const upload = phone.waitForResponse(response => response.url().endsWith('/assets') && response.request().method() === 'POST');
    await field(phone, 'quick-photo').setInputFiles({ name: 'private.png', mimeType: 'image/png', buffer: await image('#e16020') });
    const uploaded = await (await upload).json();
    await action(phone, 'save').click();
    await phone.locator('.editor-save-status').filter({ hasText: 'Đã lưu' }).waitFor();
    const senderId = new URL(phone.url()).pathname.split('/').at(-1);
    const senderDesign = (await sender.call(`/designs/designs/${senderId}`)).design;
    assert.equal(senderDesign.source.templateVersionId, v1);
    assert.equal(senderDesign.document.elements.find(element => element.id === photoId).props.assetId, uploaded.asset.id);
    const invalidLayout = structuredClone(senderDesign.document);
    invalidLayout.elements[0].layout.x += 1;
    await sender.call(`/designs/designs/${senderId}/save`, { expectedRevision: senderDesign.revision, mutationId: randomUUID(), title, document: invalidLayout }, 403);
    assert.equal((await creator.ask(`/designs/designs/${senderId}/assets/${uploaded.asset.id}`)).status(), 404);
    await action(phone, 'preview').click();
    await capture(phone, 'sender-preview-390');
    await action(phone, 'preview-send').click();
    let publishIntent;
    await phone.route('**/api/gifts/gifts/from-design', async route => {
      publishIntent = route.request().postDataJSON().idempotencyKey;
      assert.equal((await route.fetch()).status(), 201);
      await route.abort('failed');
    }, { times: 1 });
    const missingPublishAck = phone.waitForEvent('requestfailed', request => request.url().endsWith('/from-design'));
    await confirmGiftAccess(phone, { open: 'link', send: 'invite', read: 'sender' });
    await missingPublishAck;
    await action(phone, 'preview').click();
    await action(phone, 'preview-send').click();
    const publishRetry = phone.waitForRequest(request => request.url().endsWith('/from-design'));
    await confirmGiftAccess(phone, { open: 'link', send: 'invite', read: 'sender' });
    assert.equal((await publishRetry).postDataJSON().idempotencyKey, publishIntent);
    await phone.waitForURL('**/success/*');
    assert.equal((await sender.call('/gifts/gifts/mine')).gifts.length, 1);
    console.log(`Creator flow synthetic choose-to-link ms=${Date.now() - startedAt}`);
    const url = await phone.getByLabel('Đường link quà tặng').inputValue();
    const inviteUrl = await phone.getByLabel('Link mời riêng').inputValue();
    const slug = new URL(url).pathname.split('/').at(-1);
    const recipientEndpoint = `/gifts/gifts/${slug}`;
    const inviteQuery = new URL(inviteUrl).search;
    assert.notEqual(url, inviteUrl);
    const regularShare = phone.locator('.share-option').filter({ has: phone.getByRole('heading', { name: 'Link thường' }) });
    const inviteShare = phone.locator('.share-option').filter({ has: phone.getByRole('heading', { name: 'Link mời riêng' }) });
    await regularShare.getByText('Mở được quà. Cần link mời để gửi lời đáp. Chỉ người gửi quà đọc được lời đáp.').waitFor();
    await inviteShare.getByText('Mở được quà. Gửi được lời đáp. Chỉ người gửi quà đọc được lời đáp.').waitFor();
    await capture(phone, 'share-permissions-390');
    await inviteShare.getByRole('button', { name: 'Chia sẻ link mời riêng' }).click();
    assert.equal(await phone.evaluate(() => globalThis.fixtureShares), inviteUrl);
    await inviteShare.getByRole('button', { name: 'Sao chép' }).click();
    assert.equal(await phone.evaluate(() => globalThis.fixtureClipboard), inviteUrl);
    await inviteShare.getByRole('button', { name: 'Mã QR link mời' }).click();
    const qrDownload = phone.waitForEvent('download');
    await phone.getByRole('link', { name: 'Tải mã QR' }).click();
    const { data: qrBytes, info: qrInfo } = await sharp(await (await qrDownload).path()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(jsQR(new Uint8ClampedArray(qrBytes), qrInfo.width, qrInfo.height)?.data, inviteUrl);
    await phone.keyboard.press('Escape');
    await denied.call(recipientEndpoint + '/replies', { message: 'Không có link mời' }, 403);
    await denied.call(recipientEndpoint + '/replies', undefined, 403);
    await other.call(`/gifts/gifts/mine/${slug}/replies`, undefined, 404);
    const receiver = guest.page;
    await receiver.goto(base + giftPath(inviteUrl));
    await receiver.locator('.gift-runtime-stage img').first().waitFor();
    await receiver.getByRole('button', { name: /Lời chúc/ }).click();
    await receiver.locator('.gift-runtime-stage').getByText(greeting, { exact: true }).waitFor();
    await receiver.getByText('Chỉ người gửi quà đọc được lời đáp.').waitFor();
    await capture(receiver, 'recipient-390');
    await receiver.getByLabel('Lời đáp', { exact: true }).fill('Cảm ơn Linh vì tấm ảnh!');
    let originalIntent;
    await receiver.route(`**/api${recipientEndpoint}/replies?*`, async route => {
      if (route.request().method() !== 'POST') return route.continue();
      originalIntent = route.request().postDataJSON().intentId;
      assert.equal((await route.fetch()).status(), 201);
      await route.abort('failed');
    }, { times: 1 });
    const lostAck = receiver.waitForEvent('requestfailed', request => request.method() === 'POST' && request.url().includes('/replies'));
    await receiver.getByRole('button', { name: 'Gửi lời đáp' }).click();
    await lostAck;
    await receiver.reload();
    await receiver.getByRole('button', { name: /Lời chúc/ }).click();
    await receiver.getByLabel('Lời đáp', { exact: true }).fill('Cảm ơn Linh vì tấm ảnh!');
    const retryReply = receiver.waitForRequest(request => request.method() === 'POST' && request.url().includes('/replies'));
    await receiver.getByRole('button', { name: 'Gửi lời đáp' }).click();
    assert.equal((await retryReply).postDataJSON().intentId, originalIntent);
    await receiver.getByText('Đã gửi lời đáp.').waitFor();
    await guest.call(recipientEndpoint + '/replies' + inviteQuery, undefined, 403);
    const before = (await guest.call(recipientEndpoint + inviteQuery)).gift;
    assert.equal(before.recipientName, 'Mai');
    assert.equal(before.senderName, 'An');
    const originalPhoto = await (await guest.ask(`${recipientEndpoint}/assets/${uploaded.asset.id}${inviteQuery}`)).body();
    const inbox = (await sender.call(`/gifts/gifts/mine/${slug}/replies`)).replies;
    assert.equal(inbox[0].message, 'Cảm ơn Linh vì tấm ảnh!');
    await receiver.getByRole('button', { name: 'Báo cáo món quà' }).click();
    const report = receiver.locator('#support-form');
    await report.getByLabel('Họ tên').fill('Khách thử');
    await report.getByLabel('Email liên hệ').fill('guest@example.test');
    await report.getByLabel('Nội dung', { exact: true }).fill('Đây là báo cáo tổng hợp khi thử beta.');
    await report.getByRole('button', { name: 'Gửi yêu cầu' }).click();
    await receiver.getByRole('heading', { name: 'Đã ghi nhận yêu cầu' }).waitFor();
    const ticket = (await admin.call('/support/admin/requests')).requests.find(item => item.reportTarget === before.id);
    assert.equal(ticket.reportKind, 'gift');
    assert(!JSON.stringify(ticket).includes(inviteQuery));
    await admin.call(`/support/admin/requests/${ticket.id}/resolve`, { action: 'claim' });
    await rival.call(`/support/admin/requests/${ticket.id}/resolve`, { action: 'resolve', resolution: 'Không đúng người' }, 409);
    await admin.call(`/support/admin/requests/${ticket.id}/resolve`, { action: 'resolve', resolution: 'Đã đối chiếu dữ liệu QA.' });
    const builtIn = (await guest.call('/catalog/templates')).templates.find(template => template.price === 0 && !template.versionId);
    const legacy = (await sender.call('/gifts/gifts', {
      templateId: builtIn.id, recipientName: 'Mai', senderName: 'An', message: 'Quà legacy có ảnh.',
      photoDataUrl: `data:image/png;base64,${(await image('#614aba')).toString('base64')}`,
    }, 201)).gift;
    assert.equal((await guest.ask(`/gifts/gifts/${legacy.slug}/photo`)).status(), 200);
    await sender.call(`/gifts/gifts/mine/${legacy.slug}/revoke`, {});
    await guest.call(`/gifts/gifts/${legacy.slug}/photo`, undefined, 410);
    const activeLegacy = (await sender.call('/gifts/gifts', {
      templateId: builtIn.id, recipientName: 'Mai', senderName: 'An', message: 'Quà legacy cho kiểm tra khôi phục.',
      photoDataUrl: `data:image/png;base64,${(await image('#364206')).toString('base64')}`,
    }, 201)).gift;
    const legacyPhoto = await (await guest.ask(`/gifts/gifts/${activeLegacy.slug}/photo`)).body();

    await action(page, 'submit-template').click();
    await submit.waitFor();
    assert.deepEqual(await submit.locator('input[name="binding"]:checked').evaluateAll(list => list.map(input => input.value)), first.bindings);
    assert.equal(await submit.getByLabel('Khung ảnh Sender được thay').inputValue(), photoId);
    assert.equal(await submit.getByLabel('Nguồn ảnh và quyền phân phối trong mẫu, quà').inputValue(), first.rights);
    await submit.getByText(/Tên mẫu từ/).waitFor();
    await submit.getByText('Quyền chỉnh chữ và thay ảnh của Sender giữ nguyên.').waitFor();
    await submit.getByLabel('Cảnh dùng làm bìa mẫu').selectOption('scene-message');
    await submit.getByText('Đổi cảnh dùng làm bìa mẫu.').waitFor();
    await capture(page, 'creator-submit-v2');
    const v2Response = page.waitForResponse(response => response.url().endsWith('/submit') && response.request().method() === 'POST');
    await submit.getByRole('button', { name: 'Gửi duyệt' }).click();
    const v2 = (await (await v2Response).json()).version.id;
    await page.waitForURL('**/creator');
    assert.notEqual(v2, v1);
    await reviewed.goto(`${base}/admin/review/${id}/${v2}`);
    await reviewed.getByText(/Tên mẫu từ/).waitFor();
    await reviewed.getByText('Quyền chỉnh chữ và thay ảnh của Sender giữ nguyên.').waitFor();
    await reviewed.getByText('Đổi cảnh dùng làm bìa mẫu.').waitFor();
    const pendingCover = await admin.ask(`/catalog/admin/templates/${id}/versions/${v2}/cover`);
    assert.equal(pendingCover.status(), 200);
    assert.match(pendingCover.headers()['content-type'], /image\/svg\+xml/);
    assert.equal((await guest.ask(`/catalog/templates/${id}/versions/${v2}/cover`)).status(), 409);
    await capture(reviewed, 'admin-review-v2');
    const [verdictA, verdictB] = await Promise.all([
      admin.ask(`/catalog/admin/templates/${id}/versions/${v2}`, { action: 'revise', reason: 'Kiểm tra lại bố cục bìa.' }),
      rival.ask(`/catalog/admin/templates/${id}/versions/${v2}`, { action: 'revise', reason: 'Kiểm tra lại bố cục bìa.' }),
    ]);
    assert.deepEqual([verdictA.status(), verdictB.status()].sort(), [200, 409]);
    await page.goto(base + '/creator');
    // Xác nhận phản hồi của Admin hiển thị trong khu vực thông báo Creator.
    // Không chấp nhận text chỉ tồn tại trong DOM nhưng bị ẩn khỏi người dùng.
    const reviewFeedback = page.locator('[data-creator-review-notice]');
    await reviewFeedback.getByText(/Kiểm tra lại bố cục bìa/).waitFor({ state: 'visible' });
    assert.equal(await reviewFeedback.isVisible(), true);
    assert.equal(await page.locator('#creator-list .my-gift-detail').filter({ hasText: /Kiểm tra lại bố cục bìa/ }).count() > 0, true);
    const newDemo = await page.context().request.post(`${base}/api${designEndpoint}/assets`, {
      data: await image('#5c9074'),
      headers: { 'content-type': 'image/png', 'x-mutation-id': randomUUID() },
    });
    assert.equal(newDemo.status(), 201);
    const replacement = (await newDemo.json()).asset.id;
    async function updateCreatorImage(assetId) {
      const { design: current } = await creator.call(designEndpoint);
      const target = current.document.elements.find(element => element.id === photoId);
      if (assetId) target.props.assetId = assetId;
      else {
        current.document.elements = current.document.elements.filter(element => element.id !== photoId);
        const scene = current.document.scenes.find(item => item.elementIds.includes(photoId));
        scene.elementIds = scene.elementIds.filter(id => id !== photoId);
      }
      current.document.assets = assetId ? [{ assetId, kind: 'image' }] : [];
      await creator.call(designEndpoint + '/save', {
        expectedRevision: current.revision, mutationId: randomUUID(), title: current.title, document: current.document,
      });
      await page.goto(`${base}/design/${id}`);
      await action(page, 'submit-template').click();
      await submit.waitFor();
    }
    await updateCreatorImage(replacement);
    assert.equal(await submit.getByLabel('Khung ảnh Sender được thay').inputValue(), photoId);
    assert.equal(await submit.getByLabel('Nguồn ảnh và quyền phân phối trong mẫu, quà').inputValue(), '');
    await submit.getByText('Có ảnh demo mới cần kiểm tra quyền phân phối.').waitFor();
    await submit.getByRole('button', { name: 'Quay lại' }).click();
    await updateCreatorImage(null);
    assert.equal(await submit.getByLabel('Khung ảnh Sender được thay').inputValue(), '');
    await submit.getByText('Có ảnh demo từ bản trước đã bị xóa hoặc thay.').waitFor();
    await submit.getByRole('button', { name: 'Quay lại' }).click();
    const preview = (await guest.call(`/catalog/templates/${id}/versions/${v1}`)).version;
    assert(!JSON.stringify(preview).includes(greeting));
    assert(!JSON.stringify(preview).includes(uploaded.asset.id));
    assert(!JSON.stringify(preview).includes(inbox[0].message));
    const roleEndpoint = `/auth/admin/users/${profiles[1].user.id}/role`;
    await admin.call(roleEndpoint, { role: 'sender' });
    await guest.call(`/catalog/templates/${id}`, undefined, 404);
    await creator.call(designEndpoint, undefined, 403);
    const existingPreflight = await sender.call(`/designs/designs/${senderId}/preflight`, { expectedRevision: senderDesign.revision });
    assert.equal(existingPreflight.canPublish, true);
    await admin.call(roleEndpoint, { role: 'creator' });
    // A published Creator template can be regifted while it is still available.
    const regiftEndpoint = `/gifts/gifts/mine/${slug}/regift`;
    const regiftInput = { mutationId: randomUUID() };
    await other.call(regiftEndpoint, regiftInput, 404);
    const { design: clean } = await sender.call(regiftEndpoint, regiftInput, 201);
    assert.equal((await sender.call(regiftEndpoint, regiftInput)).design.id, clean.id);
    assert.equal(clean.source.templateVersionId, v1);
    assert.deepEqual(Object.values(clean.document.bindings).map(item => item.value), ['', '', '']);
    assert(!JSON.stringify(clean).includes(uploaded.asset.id));
    const cleanEndpoint = `/designs/designs/${clean.id}`;
    clean.document.bindings.recipientName.value = 'Người nhận mới';
    clean.document.bindings.senderName.value = 'Người gửi cũ';
    clean.document.bindings.message.value = 'Lời chúc của quà mới.';
    const cleanAck = await sender.call(cleanEndpoint + '/save', {
      expectedRevision: clean.revision, mutationId: randomUUID(), title: clean.title, document: clean.document,
    });
    const newGift = (await sender.call('/gifts/gifts/from-design', {
      designId: clean.id, expectedRevision: cleanAck.savedRevision, expectedDocumentHash: cleanAck.documentHash, idempotencyKey: randomUUID(),
      access: { open: 'invite', send: 'disabled', read: 'sender' },
    }, 201)).gift;
    assert.notEqual(newGift.slug, slug);
    assert.notEqual(new URL(newGift.inviteUrl).search, inviteQuery);
    assert.deepEqual((await sender.call(`/gifts/gifts/mine/${newGift.slug}/replies`)).replies, []);
    assert.equal((await sender.call(`/gifts/gifts/mine/${slug}/replies`)).replies.length, 1);
    // The original gift remains readable; a NEW regift must be blocked after withdrawal.
    await creator.call(workspace + '/withdraw', {});
    await guest.call(`/catalog/templates/${id}`, undefined, 404);
    await sender.call(regiftEndpoint, { mutationId: randomUUID() }, 403);
    await sender.call(`/designs/designs/${senderId}/preflight`, { expectedRevision: senderDesign.revision });
    assert.deepEqual((await guest.call(recipientEndpoint + inviteQuery)).gift.documentSnapshot, before.documentSnapshot);
    assert.deepEqual(await (await guest.ask(`${recipientEndpoint}/assets/${uploaded.asset.id}${inviteQuery}`)).body(), originalPhoto);
    const { gift: restoreGift } = await sender.call('/gifts/gifts/from-design', {
      designId: senderId, expectedRevision: senderDesign.revision, expectedDocumentHash: senderDesign.documentHash,
      idempotencyKey: randomUUID(), access: { open: 'invite', send: 'disabled', read: 'invite' },
    }, 201);
    const restorePath = `/gifts/gifts/${restoreGift.slug}`;
    const restoreOwner = (await sender.call(`/gifts/gifts/mine/${restoreGift.slug}`)).gift;
    const restoreQuery = new URL(restoreOwner.inviteUrl).search;
    await denied.call(restorePath, undefined, 403);
    await denied.call(`${restorePath}/assets/${uploaded.asset.id}`, undefined, 403);
    await guest.call(restorePath + '/replies' + restoreQuery, { message: 'Hồi đáp đã tắt' }, 403);

    const revokeEndpoint = `/gifts/gifts/mine/${slug}/revoke`;
    await other.call(revokeEndpoint, {}, 404);
    const calls = [];
    await phone.route('**/api/checkout/orders', async route => {
      calls.push('orders');
      if (calls.length === 1) await route.fulfill({ status: 503, json: { error: 'QA outage' } });
      else await route.continue();
    });
    await phone.goto(base + '/studio');
    const ordersSection = phone.locator('#studio-orders-section');
    await ordersSection.getByRole('alert').filter({ hasText: 'Chưa tải được lịch sử đơn hàng.' }).waitFor();
    assert.equal(calls.length, 1);
    await phone.locator('.my-gift').filter({ has: phone.locator(`a[href="/success/${slug}"]`) }).getByRole('button', { name: /Hồi đáp/ }).click();
    await phone.getByRole('dialog').getByText('Cảm ơn Linh vì tấm ảnh!').waitFor();
    await phone.getByRole('dialog').getByRole('button', { name: 'Đóng' }).click();
    await ordersSection.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await ordersSection.getByText('Chưa có biên nhận thanh toán.').waitFor();
    assert.equal(calls.length, 2);
    await phone.unroute('**/api/checkout/orders');
    const resume = phone.locator(`#studio-drafts a[href="/design/${senderId}"]`);
    await resume.click();
    await field(phone, 'binding.recipientName').waitFor();
    await phone.getByRole('button', { name: 'Chỉnh bố cục' }).waitFor();
    await phone.goto(`${base}/design/${senderId}?mode=layout`);
    await phone.getByRole('button', { name: 'Cá nhân hóa nhanh' }).waitFor();
    await action(phone, 'sheet-layers').click();
    await phone.locator(`.editor-layers [data-id="${photoId}"]`).click();
    await phone.keyboard.press('Escape');
    await action(phone, 'sheet-inspector').click();
    assert(await field(phone, 'upload').isEnabled());
    assert(await field(phone, 'props.radius').isDisabled());
    assert(await action(phone, 'layer-lock').isDisabled());
    assert.equal(await phone.locator('.editor-crop-surface.is-editable').count(), 0);
    await phone.getByText(/Vùng mẫu có khóa/).waitFor();
    await capture(phone, 'sender-locked-layout');
    await phone.keyboard.press('Escape');
    await phone.goto(base + '/studio');
    const draftCard = phone.locator('.my-gift').filter({ has: phone.locator(`a[href="/design/${senderId}"]`) });
    phone.once('dialog', dialog => dialog.accept());
    await draftCard.getByRole('button', { name: 'Lưu trữ bản nháp' }).click();
    await draftCard.waitFor({ state: 'detached' });
    await guest.call(recipientEndpoint + inviteQuery);
    const giftCard = phone.locator('.my-gift').filter({ has: phone.locator(`a[href="/success/${slug}"]`) });
    await giftCard.getByText(/Đang hoạt động · Hết hạn ngày/).waitFor();
    await giftCard.getByRole('button', { name: /Hồi đáp/ }).click();
    await phone.getByRole('dialog').getByText('Cảm ơn Linh vì tấm ảnh!').waitFor();
    await phone.getByRole('dialog').getByRole('checkbox', { name: 'Chưa đọc' }).waitFor();
    await phone.getByRole('dialog').getByRole('button', { name: 'Đóng' }).click();
    phone.once('dialog', dialog => dialog.accept());
    await giftCard.getByRole('button', { name: 'Ngừng chia sẻ món quà' }).click();
    await phone.getByText(/Đã thu hồi · Hết hạn ngày/).waitFor();
    await sender.call(revokeEndpoint, {});
    if (await receiver.locator('#modal-root .dialog').isVisible())
      await receiver.getByRole('button', { name: 'Đóng', exact: true }).click();
    if (await receiver.getByLabel('Lời đáp', { exact: true }).isVisible()) {
      await receiver.getByLabel('Lời đáp', { exact: true }).fill('Gửi sau khi đã thu hồi.');
      await receiver.getByRole('button', { name: 'Gửi lời đáp' }).click();
    }
    await receiver.getByText('Người gửi đã ngừng chia sẻ món quà này.').waitFor();
    for (const endpoint of [recipientEndpoint, recipientEndpoint + '/replies', `${recipientEndpoint}/assets/${uploaded.asset.id}`])
      await guest.call(endpoint + inviteQuery, undefined, 410);
    await guest.call(recipientEndpoint + '/replies' + inviteQuery, { message: 'Không được ghi sau khi thu hồi' }, 410);
    assert.equal((await sender.call(`/gifts/gifts/mine/${slug}/replies`)).replies.length, 1);
    console.log('PASS Creator V1/V2 browser: role/ownership, fixed version, approved demo ACL, Sender photo, anonymous invite/reply, reports, concurrent review, withdrawal, revoke and offline-safe history.');
    return { slug: restoreGift.slug, query: restoreQuery, assetId: uploaded.asset.id, greeting, originalPhoto, templateId: id,
      templateVersionId: v1, legacy: { slug: activeLegacy.slug, photo: legacyPhoto } };
  } finally { await browser.close(); }
}
