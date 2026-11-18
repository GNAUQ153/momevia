import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import sharp from 'sharp';
import path from 'node:path';
import { confirmGiftAccess } from './gift-access.mjs';

const image = color => sharp({ create: { width: 36, height: 24, channels: 3, background: color } }).png().toBuffer();
const field = (page, name) => page.locator(`[data-editor-field="${name}"]`);
const action = (page, name) => page.locator(`[data-editor-action="${name}"]`);
const giftPath = url => new URL(url).pathname + new URL(url).search;

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

    await page.locator('[data-editor-action="add"][data-type="image"]').click();
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
    await reviewed.goto(base + '/admin');
    await reviewed.getByRole('link', { name: 'Mở phiên bản để duyệt' }).click();
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

    const phone = sender.page;
    await phone.goto(`${base}/template/${id}`);
    await phone.getByRole('button', { name: /Trải nghiệm mẫu/ }).click();
    await phone.locator('.template-preview-player').getByText('Mai', { exact: true }).waitFor();
    await loaded(phone);
    await phone.getByRole('button', { name: 'Đóng', exact: true }).click();
    await phone.getByRole('link', { name: 'Cá nhân hóa nhanh' }).click();
    await field(phone, 'binding.recipientName').fill('Bảo');
    await field(phone, 'binding.senderName').fill('Linh');
    const greeting = 'Lời chúc riêng của Linh dành cho Bảo.';
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
    await confirmGiftAccess(phone, { open: 'link', send: 'invite', read: 'sender' });
    await phone.waitForURL('**/success/*');
    const url = await phone.getByLabel('Đường link quà tặng').inputValue();
    const inviteUrl = await phone.getByLabel('Link mời riêng').inputValue();
    const slug = new URL(url).pathname.split('/').at(-1);
    const recipientEndpoint = `/gifts/gifts/${slug}`;
    const inviteQuery = new URL(inviteUrl).search;
    assert.notEqual(url, inviteUrl);
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
    await receiver.getByRole('button', { name: 'Gửi lời đáp' }).click();
    await receiver.getByText('Đã gửi lời đáp.').waitFor();
    await guest.call(recipientEndpoint + '/replies' + inviteQuery, undefined, 403);
    const before = (await guest.call(recipientEndpoint + inviteQuery)).gift;
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

    const changed = (await creator.call(designEndpoint)).design;
    const v2 = (await creator.call(workspace + '/submit', { ...first, expectedRevision: changed.revision })).version.id;
    assert.notEqual(v2, v1);
    const [verdictA, verdictB] = await Promise.all([
      admin.ask(`/catalog/admin/templates/${id}/versions/${v2}`, { action: 'revise', reason: 'Kiểm tra lại bố cục bìa.' }),
      rival.ask(`/catalog/admin/templates/${id}/versions/${v2}`, { action: 'revise', reason: 'Kiểm tra lại bố cục bìa.' }),
    ]);
    assert.deepEqual([verdictA.status(), verdictB.status()].sort(), [200, 409]);
    await page.goto(base + '/creator');
    await page.getByText(/Kiểm tra lại bố cục bìa/).waitFor();
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
    await creator.call(workspace + '/withdraw', {});
    await guest.call(`/catalog/templates/${id}`, undefined, 404);
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
