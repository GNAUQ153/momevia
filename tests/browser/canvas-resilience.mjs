import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { createElement } from '../../web/js/shared/canvas/index.js';
import { syntheticPhoto } from '../integration/canvas-expanded.mjs';
import { clickEditorTool } from './editor-tools.mjs';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const json = (route, value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
async function bounded(promise, label) { let timer; try { return await Promise.race([promise, new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), 15000); })]); } finally { clearTimeout(timer); } }

// Drafts and authentication use the real JSON HTTP app. Only gateway responses are
// browser-injected; this gate does not prove MySQL settlement or merchant/provider E2E.
export async function runCanvasResilience(base) {
  const channel = process.env.BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined);
  const browser = await chromium.launch({ headless: true, channel });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const completed = [], errors = [], csp = [], external = [], paymentTraffic = [], mockErrors = [], gates = [], artifacts = process.env.BROWSER_ARTIFACT_DIR;
  const gate = () => { const item = deferred(); gates.push(item); return item; };
  await context.route('**/*', route => { if (new URL(route.request().url()).origin === base) return route.continue(); external.push(route.request().url()); return route.abort(); });
  await context.exposeBinding('__recordCanvasResilienceCsp', (source, violation) => csp.push(violation));
  await context.addInitScript(() => { globalThis.__canvasResilienceCsp = []; globalThis.document.addEventListener('securitypolicyviolation', event => { globalThis.__canvasResilienceCsp.push(event.violatedDirective); globalThis.__recordCanvasResilienceCsp(event.violatedDirective); }); });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  let giftPosts = 0; page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/gifts/gifts/from-design')) giftPosts++; });
  const control = name => page.locator(`[data-editor-action="${name}"]`);
  const field = name => page.locator(`[data-editor-field="${name}"]`);
  const api = async (url, body, expected = 200) => {
    const response = body === undefined ? await context.request.get(base + '/api' + url) : await context.request.post(base + '/api' + url, { data: body });
    const data = await response.json(); assert.equal(response.status(), expected, JSON.stringify(data)); return data;
  };
  const login = account => api('/auth/login', { email: account.email, password: account.password });
  const account = prefix => ({ name: `${prefix} Sender`, email: `${randomUUID()}@example.test`, password: 'CanvasResilience123', confirmPassword: 'CanvasResilience123' });
  const create = async (title, templateId) => {
    let design = (await api('/designs/designs', { source: templateId ? { kind: 'template', templateId } : { kind: 'blank' }, presetId: 'envelope-basic', title, mutationId: randomUUID() }, 201)).design;
    design.document.bindings.recipientName.value = 'Mai QA'; design.document.bindings.senderName.value = 'An QA'; design.document.bindings.message.value = title + ' – lời chúc riêng';
    await api(`/designs/designs/${design.id}/save`, { title, document: design.document, expectedRevision: design.revision, mutationId: randomUUID() });
    return (await api(`/designs/designs/${design.id}`)).design;
  };
  const open = async design => { await page.goto(`${base}/design/${design.id}`); await field('binding.message').waitFor(); };
  const save = async () => { await control('save').click(); await page.locator('.editor-save-status').filter({ hasText: 'Đã lưu' }).waitFor(); };
  try {
    const senderA = account('Resilience A'); const senderB = account('Resilience B');
    const userA = (await api('/auth/register', senderA, 201)).user;
    const designA = await create('Draft A – phản hồi chậm'), designB = await create('Draft B – phiên đang mở');
    await open(designA);

    // The real server commits A, but ACK is held until B has mounted.
    const ackSeen = gate(), releaseAck = gate(), ackFinished = gate();
    const delayedSave = `**/api/designs/designs/${designA.id}/save`;
    await page.route(delayedSave, async route => {
      try { const response = await route.fetch(); ackSeen.resolve(await response.json()); await releaseAck.promise; await route.fulfill({ response }); }
      catch (error) { if (!/closed|handled|aborted|canceled/i.test(error.message)) mockErrors.push(error.message); }
      finally { ackFinished.resolve(); }
    });
    await field('binding.message').fill('A đã commit nhưng ACK đến muộn'); await control('save').click(); const heldAck = await bounded(ackSeen.promise, 'real save ACK held');
    assert.equal(heldAck.savedRevision, designA.revision + 1);
    page.once('dialog', dialog => dialog.accept()); await control('studio').click(); await page.waitForURL('**/studio');
    await page.locator(`a[href="/design/${designB.id}"]`).click(); await field('binding.message').waitFor();
    releaseAck.resolve(); await bounded(ackFinished.promise, 'late ACK handler finished'); await page.unroute(delayedSave);
    await page.evaluate(() => new Promise(globalThis.requestAnimationFrame));
    assert.equal(new URL(page.url()).pathname, `/design/${designB.id}`); assert.equal(await field('binding.message').inputValue(), designB.document.bindings.message.value);
    completed.push('C24 real save commit/lost delayed ACK; dispose A then mount B retains B document');

    // Real save is blocked before it reaches server. Refresh accepts the browser
    // warning and the recovery confirmation; no unload-save guarantee is assumed.
    await open(designA);
    const blockedSave = '**/api/designs/designs/*/save'; await page.route(blockedSave, route => route.abort('internetdisconnected'));
    const recoverText = 'RECOVERY_PRIVATE_A – chỉ tài khoản A';
    await field('binding.message').fill(recoverText); await control('save').click(); await page.locator('.editor-save-status').filter({ hasText: 'Mất kết nối' }).waitFor();
    const recoveryDialogs = []; const acceptRecovery = async dialog => { recoveryDialogs.push({ type: dialog.type(), message: dialog.message() }); await dialog.accept(); }; page.on('dialog', acceptRecovery);
    await page.reload(); await field('binding.message').waitFor(); await page.waitForFunction(value => globalThis.document.querySelector('[data-editor-field="binding.message"]')?.value === value, recoverText);
    page.off('dialog', acceptRecovery); assert(recoveryDialogs.some(dialog => dialog.type === 'confirm' && /bản chỉnh sửa cục bộ/i.test(dialog.message)));
    await page.unroute(blockedSave); await save(); assert.equal((await api(`/designs/designs/${designA.id}`)).design.document.bindings.message.value, recoverText);
    completed.push('C07 offline refresh recovery accepted explicitly, persisted after reconnect');

    // Keep another local recovery, switch actual server session in the same browser
    // storage, and prove B neither sees A content nor receives A recovery prompt.
    await page.route(blockedSave, route => route.abort('internetdisconnected'));
    const privateText = 'PRIVATE_UNSAVED_OWNER_A_7a9f'; await field('binding.message').fill(privateText); await control('save').click(); await page.locator('.editor-save-status').filter({ hasText: 'Mất kết nối' }).waitFor();
    page.once('dialog', dialog => dialog.accept()); await control('studio').click(); await page.waitForURL('**/studio'); await page.unroute(blockedSave);
    await api('/auth/logout', {}); const userB = (await api('/auth/register', senderB, 201)).user; assert.notEqual(userA.id, userB.id);
    const ownB = await create('Owner B independent draft');
    const unexpectedDialogs = []; const dismissUnexpected = async dialog => { unexpectedDialogs.push(dialog.message()); await dialog.dismiss(); }; page.on('dialog', dismissUnexpected);
    await open(ownB); assert.equal(await field('binding.message').inputValue(), ownB.document.bindings.message.value); assert(!(await page.locator('body').innerText()).includes(privateText)); assert.deepEqual(unexpectedDialogs, []);
    page.off('dialog', dismissUnexpected); await api(`/designs/designs/${designA.id}`, undefined, 404);
    await page.goto(`${base}/design/${designA.id}`); await page.locator('.editor-load-failed').waitFor(); assert.equal(await page.locator('.editor-workspace').count(), 0); assert(!(await page.locator('body').innerText()).includes(privateText));
    await api('/auth/logout', {}); await login(senderA);
    page.on('dialog', acceptRecovery); await open(designA); await page.waitForFunction(value => globalThis.document.querySelector('[data-editor-field="binding.message"]')?.value === value, privateText); page.off('dialog', acceptRecovery); await save();
    completed.push('C07/C08 recovery keys owner/design scoped; same-origin account B cannot read A draft or recovery UI');

    // Mỗi trường hợp dùng một asset mới. Ảnh ở stage bị chặn có chủ đích
    // để tránh Chrome lấy ảnh đã cache và bỏ qua request của Fabric Studio.
    // Kiểm thử vẫn giữ nguyên yêu cầu: đóng dialog khi request Fabric đang treo.
    for (const [scenarioIndex, closeBy] of ['button', 'escape', 'route'].entries()) {
      const fabricDraft = await create(`Fabric lifetime QA ${closeBy}`);
      const fabricPath = `/designs/designs/${fabricDraft.id}`;
      const imageResponse = await context.request.post(base + '/api' + fabricPath + '/assets', {
        data: await syntheticPhoto(scenarioIndex),
        headers: { 'content-type': 'image/png', 'x-mutation-id': randomUUID() },
      });
      assert.equal(imageResponse.status(), 201);
      const { asset } = await imageResponse.json();
      fabricDraft.document.assets.push({ assetId: asset.id, kind: 'image' });
      fabricDraft.document.elements.push(createElement('image', {
        id: 'late-image', props: { assetId: asset.id },
      }));
      fabricDraft.document.scenes[0].elementIds.push('late-image');
      await api(fabricPath + '/save', {
        title: fabricDraft.title, document: fabricDraft.document,
        expectedRevision: fabricDraft.revision, mutationId: randomUUID(),
      });
      const lateAsset = '**' + fabricPath + '/assets/' + asset.id;
      const stageBlocked = gate();
      await page.route(lateAsset, route => {
        stageBlocked.resolve();
        return route.abort('failed');
      });
      await open(fabricDraft);
      await bounded(stageBlocked.promise, `stage image isolated (${closeBy})`);
      await page.unroute(lateAsset);

      const arrived = gate(), release = gate(), finished = gate();
      await page.route(lateAsset, async route => {
        arrived.resolve();
        await release.promise;
        try { await route.continue(); } catch { /* Dialog đã hủy yêu cầu ảnh. */ }
        finally { finished.resolve(); }
      });
      try {
        await control('advanced-design').evaluate(node => { node.click(); node.click(); });
        await bounded(arrived.promise, `Fabric image request (${closeBy})`);
        const fabric = page.locator('.editor-fabric-dialog[open]');
        assert.equal(await fabric.count(), 1);
        if (closeBy === 'button') await fabric.locator('[data-editor-action="fabric-close"]').last().click();
        else if (closeBy === 'escape') await page.keyboard.press('Escape');
        else {
          await control('studio').evaluate(node => node.click());
          await page.waitForURL('**/studio');
        }
        await fabric.waitFor({ state: 'detached' });
      } finally {
        // Luôn giải phóng request bị giữ, kể cả khi assertion thất bại.
        release.resolve();
      }
      await bounded(finished.promise, `aborted Fabric image release (${closeBy})`);
      await page.unroute(lateAsset);
      assert.equal((await api(fabricPath)).design.revision, fabricDraft.revision + 1);
    }
    completed.push('Fabric double-open yields one modal, Close, Escape and route disposal dismiss before image response with no save');

    const catalog = (await api('/catalog/templates')).templates, paid = catalog.find(template => template.price > 0);
    assert(paid, 'paid seed fixture');
    const paidA = await create('Checkout draft A', paid.id), paidB = await create('Checkout draft B', paid.id);
    let expectedPaidBMessage = paidB.document.bindings.message.value;
    const orderId = randomUUID(), contexts = [], contextRequests = [], createRequests = [];
    let methodsState = 'error', paymentStatus = 'pending', receiptError = true, failAttachOnce = true, createMode = 'normal', createGate = null, createStarted = null, createFinished = null;
    const intentAmount = Math.max(1000, paid.price - 1000);
    const payment = () => ({ orderId, status: paymentStatus, amount: intentAmount, method: 'payos', provider: 'payos', checkoutUrl: 'https://merchant.invalid/test-only-no-network', qrPayload: 'MOMEVIA_SYNTHETIC_QR_ONLY' });
    await page.route('**/api/checkout/payments/**', async route => {
      try {
        const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.replace('/api/checkout/payments', '');
        paymentTraffic.push({ method: request.method(), endpoint });
        if (endpoint === '/methods') return methodsState === 'error' ? json(route, { error: 'Methods unavailable synthetic' }, 503) : json(route, { methods: methodsState === 'empty' ? [] : [{ id: 'payos', label: 'payOS synthetic local' }] });
        if (endpoint === '/create') {
          const body = request.postDataJSON(); createRequests.push(body); assert.deepEqual(Object.keys(body).sort(), ['method', 'templateId']); assert.equal(body.templateId, paid.id);
          if (createMode === 'delayed') { createStarted.resolve(); await createGate.promise; try { await json(route, { payment: payment() }); } finally { createFinished.resolve(); } return; }
          return json(route, { payment: payment() }, 201);
        }
        if (endpoint === `/orders/${orderId}/design-contexts`) {
          if (request.method() === 'GET') return json(route, { contexts: contexts.map(context => ({ ...context, available: true })) });
          const body = request.postDataJSON(); contextRequests.push(structuredClone(body));
          const persisted = (await api(`/designs/designs/${body.designId}`)).design;
          assert.equal(body.expectedRevision, persisted.revision); assert.equal(body.expectedDocumentHash, persisted.documentHash); assert.equal(persisted.source.templateId, paid.id);
          const existing = contexts.find(context => context.mutationId === body.mutationId);
          const record = existing || { contextId: randomUUID(), orderId, designId: body.designId, designRevision: body.expectedRevision, documentHash: body.expectedDocumentHash, source: persisted.source, resumePath: `/design/${body.designId}`, title: persisted.title, mutationId: body.mutationId };
          if (!existing) contexts.push(record);
          if (failAttachOnce) { failAttachOnce = false; return route.abort('connectionfailed'); }
          return json(route, { context: { ...record, replayed: Boolean(existing) } }, 201);
        }
        if (endpoint === `/orders/${orderId}`) return json(route, { payment: payment() });
        if (endpoint === `/orders/${orderId}/receipt`) return receiptError ? json(route, { error: 'Receipt unavailable synthetic' }, 503) : json(route, { receipt: { receiptNo: 'SYNTHETIC-ONLY-RECEIPT', templateTitle: paid.title, amountVnd: intentAmount, provider: 'payos', transactionReference: 'TEST-REFERENCE', testPayment: true, note: 'Not a real payment' } });
        if (endpoint.startsWith(`/orders/${orderId}/design-contexts/`)) {
          const record = contexts.find(context => context.contextId === endpoint.split('/').at(-1)); assert(record, 'remembered context must exist');
          const persisted = (await api(`/designs/designs/${record.designId}`)).design;
          return json(route, { context: { ...record, available: true, changed: persisted.revision !== record.designRevision || persisted.documentHash !== record.documentHash } });
        }
        // Mô phỏng API đọc trạng thái yêu cầu hoàn tiền.
        if (endpoint === `/orders/${orderId}/refund-request`) {
          // Chỉ cho phép GET, không giả lập thao tác hoàn tiền.
          assert.equal(request.method(), 'GET');

          return json(route, {
            request: null
          });
        }
        throw new Error(`Unexpected payment mock route ${request.method()} ${endpoint}`);
      } catch (error) { mockErrors.push(error.message); try { await json(route, { error: 'Payment fixture contract failed' }, 500); } catch {/* Browser may have closed the route during a failed assertion. */ } }
    });
    await open(paidA);
    await control('publish').click(); await page.getByRole('heading', { name: 'Không tải được phương thức' }).waitFor(); assert.equal(await page.locator('[data-action="demo-buy"]').count(), 0); assert.equal(createRequests.length, 0);
    methodsState = 'empty'; await page.locator('[data-action="retry-canvas-payment"]').click(); await page.getByRole('heading', { name: 'Chưa có phương thức thanh toán' }).waitFor(); assert.equal(await page.locator('[data-action="demo-buy"]').count(), 0); assert.equal(createRequests.length, 0); await page.keyboard.press('Escape');
    completed.push('C12 methods error and legitimate empty are separate, neither falls back to demo/create');

    methodsState = 'ready'; await control('publish').click(); await page.getByRole('heading', { name: 'Mua quyền sử dụng mẫu' }).waitFor();
    await page.locator('[data-action="start-payment"]').click(); await page.locator('.toast--error').filter({ hasText: 'Không thể kết nối' }).waitFor();
    assert.equal(contexts.length, 1); assert.equal(contexts[0].designId, paidA.id);
    createMode = 'delayed'; createGate = gate(); createStarted = gate(); createFinished = gate();
    const modalLocale = page.locator('#modal-root [data-locale-select]');
    const paymentButton = await page.locator('[data-action="start-payment"]').elementHandle();
    await page.locator('[data-action="start-payment"]').click();
    await bounded(createStarted.promise, 'localized checkout create started');
    await modalLocale.selectOption('en');
    await page.getByRole('heading', { name: 'Buy a template license' }).waitFor();
    assert.equal(await page.locator('[data-action="start-payment"]').evaluate((node, previous) => node === previous && node.disabled, paymentButton), true);
    createGate.resolve();
    await bounded(createFinished.promise, 'localized checkout create completed');
    createMode = 'normal';
    await page.getByRole('heading', { name: 'Scan VietQR to pay' }).waitFor();
    const qrBeforeLanguageSwitch = await page.locator('.qr-image').getAttribute('src');
    await modalLocale.selectOption('vi');
    await page.getByRole('heading', { name: 'Quét VietQR để thanh toán' }).waitFor();
    assert.equal(await page.locator('.qr-image').getAttribute('src'), qrBeforeLanguageSwitch);
    assert.equal(contexts.length, 1); assert.deepEqual(contextRequests[0], contextRequests[1]); assert.equal(contextRequests[1].designId, paidA.id);
    assert((await page.locator('.qr-modal').innerText()).includes(intentAmount.toLocaleString('vi-VN')));
    await page.locator('[data-action="payment-status"]').click(); await page.getByRole('heading', { name: 'Đang xác nhận thanh toán' }).waitFor(); assert.equal(giftPosts, 0);
    assert.equal(await page.locator(`a.btn--outline[href="/design/${paidA.id}"]`).count(), 1); assert.equal(await page.locator(`a.btn--dark[href="/design/${paidA.id}"]`).count(), 1); assert(!(await page.locator('.success-card').innerText()).includes('bản đã thanh toán'));
    completed.push('C14 attach lost ACK retries identical context mutation; server intent amount displayed; pending return never publishes');

    await open(paidB); await clickEditorTool(page, 'toggle-mode'); await control('preview').click(); await control('preview-send').click(); await page.locator('[data-action="start-payment"]').click(); await page.getByRole('heading', { name: 'Quét VietQR để thanh toán' }).waitFor();
    await page.locator('[data-action="payment-status"]').click(); await page.getByRole('heading', { name: 'Đang xác nhận thanh toán' }).waitFor();
    assert.equal(contexts.length, 2); assert.deepEqual(new Set(contexts.map(context => context.designId)), new Set([paidA.id, paidB.id])); assert.equal(await page.locator(`a.btn--outline[href="/design/${paidA.id}"]`).count(), 1); assert.equal(await page.locator(`a.btn--outline[href="/design/${paidB.id}?mode=quick"]`).count(), 1); assert.equal(await page.locator(`a.btn--dark[href="/design/${paidB.id}?mode=quick"]`).count(), 1);
    const changedB = (await api(`/designs/designs/${paidB.id}`)).design; expectedPaidBMessage = 'Draft B vừa chỉnh ở tab khác trước khi quay lại'; changedB.document.bindings.message.value = expectedPaidBMessage;
    await api(`/designs/designs/${paidB.id}/save`, { expectedRevision: changedB.revision, mutationId: randomUUID(), title: changedB.title, document: changedB.document });
    const createsBeforeReturn = createRequests.length; paymentStatus = 'paid'; await page.locator('[data-action="refresh-payment"]').click(); await page.getByRole('heading', { name: 'Thanh toán thành công' }).waitFor(); await page.getByRole('alert').filter({ hasText: 'Biên nhận chưa tải được' }).waitFor(); await page.getByText('Nháp đã được chỉnh sửa ở phiên khác. Mở bản mới để xem trước và kiểm tra lại quyền.').waitFor();
    assert.equal(giftPosts, 0); assert.equal(createRequests.length, createsBeforeReturn); assert.equal(await page.locator('[data-action="print-receipt"]').count(), 0);
    receiptError = false; await page.getByRole('button', { name: 'Thử tải biên nhận' }).click(); await page.locator('#payment-receipt').waitFor(); assert.equal(await page.locator('[data-action="print-receipt"]').count(), 1); assert.equal(giftPosts, 0); assert.equal(createRequests.length, createsBeforeReturn);
    const trafficBeforeLocale = paymentTraffic.length;
    const pageLocale = page.locator('.nav-actions [data-locale-select]');
    await pageLocale.selectOption('en');
    await page.getByRole('heading', { name: 'Receipt SYNTHETIC-ONLY-RECEIPT' }).waitFor();
    assert.match(await page.locator('#payment-receipt').innerText(), /Transaction reference: TEST-REFERENCE/);
    assert.equal(paymentTraffic.length, trafficBeforeLocale);
    assert.equal(new URL(page.url()).pathname, `/payment-result/${orderId}`);
    if (artifacts) {
      fs.mkdirSync(artifacts, { recursive: true });
      await page.screenshot({ path: path.join(artifacts, 'locale-receipt-en.png'), fullPage: true });
    }
    await pageLocale.selectOption('vi');
    await page.getByRole('heading', { name: 'Biên nhận SYNTHETIC-ONLY-RECEIPT' }).waitFor();
    completed.push('VI/EN during delayed fake checkout keeps the same disabled control and order, QR source unchanged, receipt translated without refetch.');
    await page.getByRole('link', { name: 'Tiếp tục nháp vừa liên kết' }).click(); await field('binding.message').waitFor(); assert.equal(await field('binding.message').inputValue(), expectedPaidBMessage); assert.equal(new URL(page.url()).searchParams.get('mode'), 'quick'); assert.equal(giftPosts, 0);
    completed.push('C14/C15 same order keeps two explicit draft choices; paid and receipt-error distinct, receipt retry never charges/publishes');

    // A pending provider response arriving after modal close/route change must
    // not attach the old context, redirect, or overwrite the new design.
    paymentStatus = 'pending'; await open(paidA); await control('publish').click(); await page.getByRole('heading', { name: 'Mua quyền sử dụng mẫu' }).waitFor();
    createMode = 'delayed'; createGate = gate(); createStarted = gate(); createFinished = gate();
    const attachmentsBefore = contextRequests.length;
    await page.locator('[data-action="start-payment"]').click(); await bounded(createStarted.promise, 'delayed payment create started');
    await page.locator('#modal-root [aria-label="Đóng"]').click(); await control('studio').click(); await page.waitForURL('**/studio'); await page.locator(`a[href="/design/${paidB.id}"]`).click(); await field('binding.message').waitFor();
    createGate.resolve(); await bounded(createFinished.promise, 'delayed payment create completed'); await page.evaluate(() => new Promise(globalThis.requestAnimationFrame));
    assert.equal(new URL(page.url()).pathname, `/design/${paidB.id}`); assert.equal(await field('binding.message').inputValue(), expectedPaidBMessage); assert.equal(contextRequests.length, attachmentsBefore); assert.equal(await page.locator('#modal-root>*').count(), 0); assert.equal(giftPosts, 0); assert(!external.some(url => url.includes('merchant.invalid')));
    completed.push('C24 closing checkout during delayed create then opening B prevents stale attach/modal/redirect');
    assert.deepEqual(errors, []); assert.deepEqual(mockErrors, []); assert.deepEqual(csp, []); assert.deepEqual(await page.evaluate(() => globalThis.__canvasResilienceCsp), []);
    if (artifacts) { fs.mkdirSync(artifacts, { recursive: true }); fs.writeFileSync(path.join(artifacts, 'canvas-resilience.json'), JSON.stringify({ result: 'PASS', completed, scope: { real: 'JSON authentication + draft create/read/save/owner enforcement', mocked: 'Browser-only payment methods/create/status/receipt/contexts; context fixture validates real draft revision/hash', notProven: 'MySQL settlement, merchant E2E, physical OS IME' }, recoveryDialogs, paymentTraffic, blockedExternal: external.map(url => new URL(url).hostname), errors, mockErrors, csp }, null, 2)); }
    console.log('PASS Browser resilience: ' + completed.join('; '));
  } finally { for (const item of gates) item.resolve(); await browser.close(); }
}
