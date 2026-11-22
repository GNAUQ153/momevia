import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

export async function runAdminLibraryUi({ base, browser, admin, userId, cookie, request, artifacts }) {
  const denied = await fetch(base + '/api/designs/admin/library/preview/animation/E01', { method: 'POST',
    headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ definition: { engine: 'builtin', builtinId: 'E01' } }) });
  assert.equal(denied.status, 403);
  await admin.execute("UPDATE users SET role='admin' WHERE id=?", [userId]);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'vi-VN', reducedMotion: 'reduce' });
  const split = cookie.indexOf('='); await context.addCookies([{ name: cookie.slice(0, split), value: cookie.slice(split + 1), url: base }]);
  await context.addInitScript(() => { if (!localStorage.getItem('momevia-locale')) localStorage.setItem('momevia-locale', 'vi'); });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const action = name => page.locator(`[data-library-action="${name}"]`);
  const field = value => page.locator(`[data-field="${value}"]`);
  const saved = () => page.locator('[data-library-save-state="clean"]').waitFor();
  const choose = async name => { await page.locator('[data-library-search]').fill(name); await page.locator('[data-library-list] button').first().click(); };
  const category = name => page.locator(`[data-library-action="category"][data-kind="${name}"]`).click();
  try {
    await page.goto(base + '/admin');
    await page.locator('.role-workspace a[href="/admin/library"]').click();
    await page.locator('[data-library-form]').waitFor();
    await page.locator('[data-library-preview] .gift-runtime-stage').waitFor();
    if (artifacts) { fs.mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: path.join(artifacts, 'admin-library-overview-1440.png') }); }
    await action('new').click(); const elementId = await field('id').inputValue();
    await field('title.vi').fill('Hoa gió Admin'); await field('title.en').fill('Admin breeze');
    await field('definition.elements.0.props.text').fill('Nội dung tạo từ giao diện Admin');
    const [[beforePreview]] = await admin.execute('SELECT COUNT(*) n FROM canvas_library_items');
    await page.locator('[data-library-preview-status]').filter({ hasText: 'Bản xem thử đã cập nhật.' }).waitFor();
    assert(await page.locator('[data-library-preview]').innerText().then(s => s.includes('Nội dung tạo từ giao diện Admin')));
    const [[afterPreview]] = await admin.execute('SELECT COUNT(*) n FROM canvas_library_items'); assert.equal(beforePreview.n, afterPreview.n);
    await action('save').click(); await saved();
    await field('title.vi').fill('Hoa gió Admin đã sửa'); await action('toggle').click(); await saved();
    const [[off]] = await admin.execute("SELECT revision,status,definition FROM canvas_library_items WHERE kind='element' AND id=?", [elementId]);
    assert.equal(off.status, 'disabled'); assert.equal(off.revision, 2); assert.equal(JSON.parse(off.definition).title.en, 'Admin breeze');
    await page.reload(); await page.locator('[data-library-form]').waitFor(); await choose('Hoa gió Admin đã sửa');
    assert.equal(await field('status').inputValue(), 'disabled'); await action('toggle').click(); await saved();
    await action('duplicate').click();
    page.once('dialog', dialog => dialog.dismiss()); await category('animation');
    assert.equal(await page.locator('[data-library-action="category"][data-kind="element"]').getAttribute('aria-selected'), 'true');
    page.once('dialog', dialog => dialog.accept()); await category('animation');
    await action('new').click(); const animationId = await field('id').inputValue();
    await field('title.vi').fill('Chuyển động Admin'); await field('definition.duration').fill('900');
    await page.locator('[data-frame="0"][data-frame-field="rotate"]').fill('-8');
    await page.locator('[data-frame="1"][data-frame-field="rotate"]').fill('0');
    assert(await page.locator('[data-library-form]').evaluate(form => form.checkValidity()), 'Default keyframe controls must accept the stored decimal scale');
    await action('save').click(); await saved();
    await category('effect'); await action('new').click(); const effectId = await field('id').inputValue();
    await field('title.vi').fill('Hiệu ứng Admin'); await field('definition.animationId').selectOption(animationId);
    await field('definition.defaults.delay').selectOption('300'); await action('save').click(); await saved();
    await category('animation'); await choose('Chuyển động Admin'); await action('toggle').click();
    await page.locator('.library-admin__feedback[data-tone="error"]').waitFor();
    const [[dependency]] = await admin.execute("SELECT status FROM canvas_library_items WHERE kind='animation' AND id=?", [animationId]); assert.equal(dependency.status, 'active');
    page.once('dialog', dialog => dialog.accept()); await action('discard').click();
    await category('preset'); await action('new').click(); const presetId = await field('id').inputValue();
    await field('title.vi').fill('Bố cục Admin'); await action('add-layer').click();
    await field('definition.documents.vi.elements.0.props.text').fill('Một lời chúc từ Admin');
    await action('add-scene').click(); await field('add-type').selectOption('button'); await action('add-layer').click();
    assert.equal(await field('add-type').inputValue(), 'button');
    const buttonId = await field('layer-select').inputValue();
    await page.locator(`[data-library-preview] [data-runtime-element="${buttonId}"]`).waitFor();
    const target = page.locator('[data-path$="actions.0.targetSceneId"]'); await target.selectOption(await target.locator('option').nth(1).getAttribute('value'));
    await action('save').click(); await saved();
    await field('content-locale').selectOption('en'); const scene = field('scene-select'); await scene.selectOption(await scene.locator('option').first().getAttribute('value'));
    await field('definition.documents.en.elements.0.props.text').fill('A wish from Admin'); await action('save').click(); await saved();
    const [[preset]] = await admin.execute("SELECT definition FROM canvas_library_items WHERE kind='preset' AND id=?", [presetId]);
    const documents = JSON.parse(preset.definition).documents;
    assert.equal(documents.vi.elements[0].props.text, 'Một lời chúc từ Admin'); assert.equal(documents.en.elements[0].props.text, 'A wish from Admin');
    if (artifacts) { fs.mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: path.join(artifacts, 'admin-library-1440.png') }); }
    for (const width of [1024,768,390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForFunction(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth + 1, {}, { timeout: 5000 });
      await page.locator('.library-admin__preview').scrollIntoViewIfNeeded();
      await page.locator('[data-library-preview] .gift-runtime-stage').waitFor();
      if (artifacts) await page.screenshot({ path: path.join(artifacts, `admin-library-${width}.png`) });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + '/design/new'); await page.locator(`[data-preset="${presetId}"]`).click();
    await page.locator('[data-editor-field="title"]').waitFor();
    const designId = new URL(page.url()).pathname.split('/').at(-1);
    await page.locator('[data-editor-action="library-tab"][data-tab="add"]').click(); await page.locator(`[data-block="${elementId}"]`).click();
    await page.locator('.editor-inspector [data-editor-field="effect.entrance.id"]').selectOption(effectId);
    await page.locator('[data-editor-action="save"]').click(); await page.locator('.editor-save-status[data-tone="saved"]').waitFor();
    await page.reload(); await page.locator('[data-editor-field="title"]').waitFor();
    const persisted = (await request(`/api/designs/designs/${designId}`)).value.design;
    const inserted = persisted.document.elements.find(e => e.props.text === 'Nội dung tạo từ giao diện Admin');
    assert.equal(inserted.effects.entrance.id, effectId); assert.equal(inserted.effects.entrance.definition.animation.duration, 900);
    await page.goto(base + '/admin/library'); await page.locator('[data-library-form]').waitFor(); await category('effect'); await choose('Hiệu ứng Admin');
    await field('title.vi').fill('Thay đổi của tôi');
    const all = (await request('/api/designs/admin/library')).value.library.items, current = all.find(r => r.kind === 'effect' && r.id === effectId);
    await request(`/api/designs/admin/library/effect/${effectId}`, { expectedRevision: current.revision, definition: { ...current.definition, title: { vi: 'Bản khác', en: '' } } });
    await action('save').click(); await page.locator('.library-admin__conflict').waitFor(); assert.equal(await field('title.vi').inputValue(), 'Thay đổi của tôi');
    await action('duplicate-changes').click(); const copiedId = await field('id').inputValue();
    let aborted = false;
    await page.route(`**/api/designs/admin/library/effect/${copiedId}`, async route => { if (!aborted) { aborted = true; await route.abort(); } else await route.continue(); });
    await action('save').click(); await page.locator('.library-admin__feedback[data-tone="error"]').waitFor();
    assert.equal(await page.locator('[data-library-save-state]').getAttribute('data-library-save-state'), 'dirty');
    await action('save').click(); await saved();
    await page.locator('.nav-actions [data-locale-select]').selectOption('en');
    await page.getByRole('heading',{name:'Canvas library',exact:true}).waitFor();
    assert.equal(await page.locator('[data-admin-library] h1').innerText(), 'Canvas library');
    await admin.execute("UPDATE users SET role='sender' WHERE id=?", [userId]);
    await page.reload(); await page.getByText('You need administrator access to open this page.').waitFor();
    assert.equal(await page.locator('[data-admin-library]').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS Admin library UI: all four kinds create/edit/toggle/preview, preview read-only, VI/EN scenes, designer use/reload, dependency guard, unsaved guard, CAS and network retry, 4 viewports');
    return { elementId, animationId, effectId, presetId, previewReadOnly: true, conflictProtected: true, networkRetry: true, viewports: [1440,1024,768,390] };
  } catch (error) {
    if (artifacts) { fs.mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: path.join(artifacts, 'admin-library-failure.png'), fullPage: true }).catch(() => {}); }
    console.log('ADMIN UI FAILURE', { url: page.url(), errors, feedback: await page.locator('.library-admin__feedback').textContent().catch(() => ''),
      preview: await page.locator('[data-library-preview-status]').textContent().catch(() => ''), invalid: await page.locator('[data-library-form] :invalid').evaluateAll(nodes => nodes.map(n => ({ field: n.dataset.field, value: n.value, message: n.validationMessage }))).catch(() => []) });
    console.log('OVERFLOW', await page.evaluate(() => [...globalThis.document.querySelectorAll('body *')].filter(n => { const b = n.getBoundingClientRect(); return b.right > globalThis.innerWidth + 1 || b.left < -1; }).slice(0,15).map(n => ({ tag: n.tagName, className: n.className, right: n.getBoundingClientRect().right, width: n.getBoundingClientRect().width }))).catch(() => []));
    throw error;
  } finally { await context.close(); await admin.execute("UPDATE users SET role='sender' WHERE id=?", [userId]); }
}
