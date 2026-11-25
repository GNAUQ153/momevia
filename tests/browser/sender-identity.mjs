import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { chromium } from 'playwright';
import { confirmGiftAccess } from './gift-access.mjs';
import { selectEditorLocale } from './editor-tools.mjs';

export async function runSenderIdentity(base) {
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined) });
  try {
    const [admin, creator, sender, guest] = await Promise.all(Array.from({ length: 4 }, async () => {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
      const page = await context.newPage();
      const api = async (endpoint, body, expected = 200) => {
        const response = body === undefined ? await context.request.get(base + '/api' + endpoint)
          : await context.request.post(base + '/api' + endpoint, { data: body });
        assert.equal(response.status(), expected, endpoint);
        return response.json();
      };
      return { page, api };
    }));
    const idOf = page => new URL(page.url()).pathname.split('/').at(-1);
    const editor = (page, name) => page.locator(`[data-editor-action="${name}"]`);
    const register = (actor, name) => actor.api('/auth/register', {
      name, email: `${randomUUID()}@example.test`, password: 'SyntheticOnly123', confirmPassword: 'SyntheticOnly123',
    }, 201);
    const capture = async (page, name) => {
      if (process.env.BROWSER_ARTIFACT_DIR) await page.screenshot({ path: path.join(process.env.BROWSER_ARTIFACT_DIR, name) });
    };
    await admin.api('/auth/demo-admin', { code: 'synthetic-admin' });
    const { user } = await register(creator, 'Tác giả QA tên');
    await admin.api(`/auth/admin/users/${user.id}/role`, { role: 'creator' });
    const senderProfile = (await register(sender, 'Người gửi QA tên')).user;
    await creator.page.goto(base + '/creator');
    await creator.page.getByLabel('Tên mẫu').fill('Sinh nhật giới hạn lời chúc');
    await creator.page.getByLabel('Mô tả ngắn').fill('Fixture xác minh nguồn tên.');
    await creator.page.getByRole('button', { name: 'Tạo nháp mẫu' }).click();
    await creator.page.waitForURL('**/design/*');
    const id = idOf(creator.page);
    const creatorDesign = `/designs/designs/${id}`;
    const workspace = `/catalog/creator/workspaces/${id}`;
    const { design: draft } = await creator.api(creatorDesign);
    const blocked = await creator.api(workspace + '/submit', { expectedRevision: draft.revision, bindings: ['message'] }, 422);
    assert.match(blocked.error, /lớp tên/);
    for (const element of draft.document.elements) {
      const neutral = { recipientName: 'Dành cho bạn', senderName: 'Thân mến' }[element.props.textBinding];
      if (!neutral) continue;
      delete element.props.textBinding;
      element.props.text = neutral;
    }
    await creator.api(creatorDesign + '/save', { expectedRevision: draft.revision, mutationId: randomUUID(), title: draft.title, document: draft.document });
    await creator.page.reload();
    await editor(creator.page, 'submit-template').click();
    const dialog = creator.page.getByRole('dialog', { name: 'Gửi phiên bản để duyệt' });
    assert.equal(await dialog.getByLabel('Nguồn ảnh và quyền phân phối trong mẫu, quà').count(), 0);
    await dialog.getByRole('button', { name: 'Gửi duyệt' }).click();
    await creator.page.waitForURL('**/creator');
    await admin.page.goto(base + '/admin');
    await admin.page.locator(`a[href^="/admin/review/${id}/"]`).click();
    await admin.page.getByRole('button', { name: 'Duyệt phiên bản' }).click();
    await admin.page.waitForURL('**/admin');
    await sender.page.context().clearCookies();
    await sender.page.goto(`${base}/template/${id}`);
    const start = sender.page.getByRole('link', { name: 'Dùng mẫu' });
    const version = new URL(await start.getAttribute('href'), base).searchParams.get('version');
    assert(version);
    await sender.page.getByRole('link', { name: 'Dùng mẫu' }).click();
    await sender.page.waitForURL('**/login');
    const secondTab = await sender.page.context().newPage();
    await secondTab.goto(base + '/create/hai-phong-bi?mode=layout');
    await secondTab.waitForURL('**/login');
    await sender.page.reload();
    await sender.page.locator('#email-login-form input[name="email"]').fill(senderProfile.email);
    await sender.page.locator('#email-login-form input[name="password"]').fill('WrongPassword123');
    await sender.page.locator('#email-login-form button[type="submit"]').click();
    await sender.page.locator('#email-login-form [role="alert"]').waitFor();
    await sender.page.locator('#email-login-form input[name="password"]').fill('SyntheticOnly123');
    await sender.page.locator('#email-login-form button[type="submit"]').click();
    await sender.page.waitForURL('**/design/*');
    await secondTab.reload();
    await secondTab.waitForURL('**/design/*');
    const secondDraft = await sender.api(`/designs/designs/${idOf(secondTab)}`);
    assert.equal(secondDraft.design.source.templateId, 'hai-phong-bi');
    assert.equal(new URL(secondTab.url()).searchParams.get('mode'), null, 'Layout mode stays selected in the second tab.');
    await secondTab.close();
    const blockedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      await blockedContext.addInitScript(() => {
        Object.defineProperty(globalThis, 'sessionStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
      });
      const blockedPage = await blockedContext.newPage();
      await blockedPage.goto(base + '/create/hai-phong-bi?mode=quick');
      await blockedPage.waitForURL('**/login');
      await blockedPage.locator('#email-login-form input[name="email"]').fill(senderProfile.email);
      await blockedPage.locator('#email-login-form input[name="password"]').fill('SyntheticOnly123');
      await blockedPage.locator('#email-login-form button[type="submit"]').click();
      await blockedPage.waitForURL('**/design/*?mode=quick');
      const res = await blockedContext.request.get(base + `/api/designs/designs/${idOf(blockedPage)}`);
      assert.equal((await res.json()).design.source.templateId, 'hai-phong-bi');
    } finally { await blockedContext.close(); }
    const input = sender.page.locator('[data-editor-field="binding.message"]');
    assert.equal(new URL(sender.page.url()).searchParams.get('mode'), 'quick');
    const greeting = 'Một lời chúc do Sender viết.';
    await input.fill(greeting);
    await selectEditorLocale(sender.page, 'en');
    assert.equal(await input.inputValue(), greeting);
    await editor(sender.page, 'preview').click();
    await sender.page.getByRole('dialog', { name: 'Preview as recipient' }).waitFor();
    await sender.page.keyboard.press('Escape');
    await selectEditorLocale(sender.page, 'vi');
    await editor(sender.page, 'save').click();
    await sender.page.locator('.editor-save-status').filter({ hasText: 'Đã lưu' }).waitFor();
    const draftEndpoint = `/designs/designs/${idOf(sender.page)}`;
    const { design } = await sender.api(draftEndpoint);
    assert.equal(design.source.templateVersionId, version);
    await editor(sender.page, 'preview').click();
    await sender.page.locator('.editor-preview-player').getByText('Dành cho bạn', { exact: true }).waitFor();
    await capture(sender.page, 'identity-sender-preview.png');
    const preflight = await sender.api(draftEndpoint + '/preflight', { expectedRevision: design.revision });
    assert.equal(preflight.canPublish, true, JSON.stringify(preflight.blockers));
    await editor(sender.page, 'preview-send').click();
    await confirmGiftAccess(sender.page, { open: 'link', send: 'link', read: 'sender' });
    await sender.page.waitForURL('**/success/*');
    const slug = idOf(sender.page);
    await guest.page.goto(base + '/g/' + slug);
    await guest.page.locator('.gift-runtime-stage').getByText('Dành cho bạn', { exact: true }).waitFor();
    await capture(guest.page, 'identity-recipient-cover.png');
    assert.equal(await guest.page.locator('.gift-runtime-navigation').count(), 0);
    await guest.page.locator('.gift-runtime-stage:not([inert]) [data-runtime-element="open-gift"]').click();
    await guest.page.locator('.gift-runtime-stage:not([inert]) [data-runtime-element="to-message"]').click();
    await guest.page.locator('.gift-runtime-stage').getByText('Thân mến', { exact: true }).waitFor();
    await guest.page.locator('.gift-runtime-stage').getByText('Một lời chúc do Sender viết.', { exact: true }).waitFor();
    await capture(guest.page, 'identity-recipient-message.png');
    const publicGift = (await guest.api('/gifts/gifts/' + slug)).gift;
    assert.equal(publicGift.recipientName, '', 'The public gift must exclude the demo recipient name.');
    assert.equal(publicGift.senderName, '', 'The public gift must exclude the demo signature.');
    await sender.page.goto(base + '/studio');
    await sender.page.getByText('QUÀ KHÔNG GHI TÊN NGƯỜI NHẬN', { exact: true }).waitFor();
    await creator.page.getByRole('link', { name: 'Mở nháp' }).click();
    await creator.page.getByLabel('Tên thiết kế').fill('Sinh nhật giữ một quyền V2');
    await editor(creator.page, 'submit-template').click();
    const submitAgain = creator.page.getByRole('dialog', { name: 'Gửi phiên bản để duyệt' });
    await submitAgain.waitFor();
    assert.deepEqual(await submitAgain.locator('input[name="binding"]:checked').evaluateAll(items => items.map(input => input.value)), ['message']);
    await submitAgain.getByText('Quyền chỉnh chữ và thay ảnh của Sender giữ nguyên.').waitFor();
    await submitAgain.getByRole('button', { name: 'Gửi duyệt' }).click();
    await creator.page.waitForURL('**/creator');
    assert.equal(design.document.bindings.recipientName.value, '');
    assert.equal(design.document.bindings.senderName.value, '');
  } finally {
    await browser.close();
  }
}
