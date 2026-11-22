import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

export async function runAdminLibraryDeepAudit({ base, browser, admin, userId, cookie, request, items, artifacts }) {
  await admin.execute("UPDATE users SET role='admin' WHERE id=?", [userId]);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'vi-VN', reducedMotion: 'reduce' });
  const split = cookie.indexOf('='); await context.addCookies([{ name: cookie.slice(0, split), value: cookie.slice(split + 1), url: base }]);
  await context.addInitScript(() => { if (!localStorage.getItem('momevia-locale')) localStorage.setItem('momevia-locale', 'vi'); });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const action = name => page.locator(`[data-library-action="${name}"]`);
  const field = name => page.locator(`[data-field="${name}"]`);
  const saved = () => page.locator('[data-library-save-state="clean"]').waitFor();
  const category = kind => page.locator(`[data-library-action="category"][data-kind="${kind}"]`).click();
  const choose = async (kind, id) => { await category(kind); await page.locator('[data-library-search]').fill(id); await page.locator('[data-library-list] button').first().click(); };
  const openAdmin = async () => { await page.goto(base + '/admin/library'); await page.locator('[data-library-form]').waitFor(); };
  const getRow = async (kind, id) => (await request('/api/designs/admin/library')).value.library.items.find(row => row.kind === kind && row.id === id);
  const previewReady = () => page.locator('[data-library-preview-status]').filter({ hasText: 'Bản xem thử đã cập nhật.' }).waitFor();
  const confirm = () => page.once('dialog', dialog => dialog.accept());
  const createCanvas = async () => {
    await page.goto(base + '/design/new'); await page.locator(`[data-preset="${items.presetId}"]`).click();
    await page.locator('[data-editor-field="title"]').waitFor(); const id = new URL(page.url()).pathname.split('/').at(-1);
    await page.locator('[data-editor-action="library-tab"][data-tab="add"]').click();
    await page.locator(`[data-block="${items.elementId}"]`).click();
    await page.locator('.editor-inspector [data-editor-field="effect.entrance.id"]').selectOption(items.effectId);
    await page.locator('[data-editor-action="save"]').click(); await page.locator('.editor-save-status[data-tone="saved"]').waitFor();
    return (await request(`/api/designs/designs/${id}`)).value.design;
  };
  async function loseAck(id, kind = 'effect') {
    const pattern = `**/api/designs/admin/library/${kind}/${id}`;
    let committed = false;
    const handler = async route => {
      const response = await route.fetch(); assert.equal(response.status(), 200);
      committed = true; await route.abort();
    };
    await page.route(pattern, handler); await action('save').click();
    await page.locator('.library-admin__feedback[data-tone="error"]').waitFor(); assert(committed);
    const first = await getRow(kind, id); await page.unroute(pattern, handler);
    await action('save').click(); await saved();
    assert.equal((await getRow(kind, id)).revision, first.revision, 'Retry after lost ACK must not write a second revision');
    assert(await page.locator('.library-admin__conflict').isHidden());
    return first;
  }
  const report = {};
  try {
    await openAdmin();
    await action('new').click(); const abandoned = await field('id').inputValue(); await field('title.vi').fill('Bản mới sẽ bỏ');
    confirm(); await action('discard').click();
    assert.notEqual(await field('id').inputValue(), abandoned); assert.equal(await field('id').getAttribute('readonly'), 'true');
    assert(!(await request('/api/designs/admin/library')).value.library.items.some(row => row.id === abandoned));
    report.newDraftDiscard = true;

    await choose('effect', items.effectId); await field('title.vi').fill('Đã ghi nhưng mất phản hồi');
    const old = await getRow('effect', items.effectId), lostUpdate = await loseAck(items.effectId);
    assert.equal(lostUpdate.revision, old.revision + 1); assert.equal(lostUpdate.definition.title.vi, 'Đã ghi nhưng mất phản hồi');
    await action('new').click(); const lostCreateId = await field('id').inputValue(); await field('title.vi').fill('Tạo mới mất phản hồi');
    const lostCreate = await loseAck(lostCreateId); assert.equal(lostCreate.revision, 1);
    report.committedAckLoss = { create: true, update: true };

    const initialCanvas = await createCanvas(), original = structuredClone(initialCanvas.document);
    const originalElement = original.elements.find(e => e.effects?.entrance?.id === items.effectId); assert(originalElement);
    assert.equal(originalElement.effects.entrance.definition.animation.duration, 900);
    await openAdmin();
    for (const [kind, id] of [['element',items.elementId],['preset',items.presetId],['effect',items.effectId]]) {
      await choose(kind, id); await action('toggle').click(); await saved(); assert.equal((await getRow(kind, id)).status, 'disabled');
    }
    const related = (await request('/api/designs/admin/library')).value.library.items.filter(row => row.kind === 'effect' && row.status === 'active' && row.definition.animationId === items.animationId);
    for (const row of related) { await choose('effect', row.id); await action('toggle').click(); await saved(); }
    await choose('animation', items.animationId); await action('toggle').click(); await saved();
    await choose('effect', items.effectId); await previewReady();
    assert.equal((await getRow('animation', items.animationId)).status, 'disabled');
    const enable = await fetch(`${base}/api/designs/admin/library/effect/${items.effectId}`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ expectedRevision: (await getRow('effect',items.effectId)).revision, status: 'active' }) }); assert.equal(enable.status, 422);
    assert.deepEqual((await request(`/api/designs/designs/${initialCanvas.id}`)).value.design.document, original);
    await page.goto(base + '/design/new'); await page.locator('[data-preset="blank"]').waitFor(); assert.equal(await page.locator(`[data-preset="${items.presetId}"]`).count(), 0);
    await page.goto(`${base}/design/${initialCanvas.id}`); await page.locator('[data-editor-field="title"]').waitFor();
    await page.locator('[data-editor-action="library-tab"][data-tab="add"]').click(); assert.equal(await page.locator(`[data-block="${items.elementId}"]`).count(), 0);
    await page.locator('[data-editor-action="library-tab"][data-tab="layers"]').click(); await page.locator(`.editor-layers [data-id="${originalElement.id}"]`).click();
    assert.equal(await page.locator('.editor-inspector [data-editor-field="effect.entrance.id"]').inputValue(), items.effectId);
    await page.locator('.editor-inspector [data-editor-field="props.color"]').evaluate(el => { el.value = '#654321'; el.dispatchEvent(new globalThis.Event('change', { bubbles: true })); });
    await page.locator('[data-editor-action="save"]').click(); await page.locator('.editor-save-status[data-tone="saved"]').waitFor(); await page.reload();
    await page.locator('[data-editor-field="title"]').waitFor();
    const preserved = (await request(`/api/designs/designs/${initialCanvas.id}`)).value.design;
    assert.equal(preserved.document.elements.find(e => e.id === originalElement.id).props.color, '#654321');
    assert.deepEqual(preserved.document.elements.find(e => e.id === originalElement.id).effects, originalElement.effects);
    report.disabledItems = { hiddenFromNewCanvas: true, oldCanvasEditableAndFrozen: true, disabledDependencyPreview: true, saveGuardRetained: true };

    await openAdmin(); await choose('animation', items.animationId); await action('toggle').click(); await saved();
    await field('definition.duration').fill('1400'); await page.locator('[data-frame="0"][data-frame-field="y"]').fill('35');
    await page.locator('[data-frame="0"][data-frame-field="rotate"]').fill('-15'); await action('save').click(); await saved();
    const updatedAnimation = await getRow('animation', items.animationId);
    assert.equal(updatedAnimation.definition.keyframes[0].transform, 'translateY(35px) scale(0.96) rotate(-15deg)');
    for (const [kind, id] of [['effect',items.effectId],['element',items.elementId],['preset',items.presetId]]) {
      await choose(kind, id); await action('toggle').click(); await saved();
    }

    await field('content-locale').selectOption('en');
    await field('scene-select').selectOption(await field('scene-select').locator('option').last().getAttribute('value'));
    await action('remove-scene').click(); await action('save').click(); await saved();
    await field('content-locale').selectOption('vi'); await field('scene-select').selectOption(await field('scene-select').locator('option').last().getAttribute('value'));
    await field('content-locale').selectOption('en');
    const onlyEnglishScene = await field('scene-select').locator('option').first().getAttribute('value'); assert.equal(await field('scene-select').inputValue(), onlyEnglishScene);
    await field('add-type').selectOption('text'); await action('add-layer').click();
    await page.locator('textarea[data-path$=".props.text"]').fill('EN additional layer'); await action('save').click(); await saved();
    await field('content-locale').selectOption('vi'); await field('scene-select').selectOption(await field('scene-select').locator('option').first().getAttribute('value'));
    await action('add-layer').click(); await page.locator('textarea[data-path$=".props.text"]').fill('Lớp thứ hai');
    await action('add-layer').click(); await page.locator('textarea[data-path$=".props.text"]').fill('Lớp thứ ba');
    const moved = await field('layer-select').inputValue(); await action('layer-up').click(); assert.equal(await field('layer-select').inputValue(), moved);
    const expectedOrder = await field('layer-select').locator('option').evaluateAll(options => options.map(option => option.value));
    await action('save').click(); await saved(); await page.reload(); await page.locator('[data-library-form]').waitFor(); await choose('preset', items.presetId);
    const translated = (await getRow('preset', items.presetId)).definition.documents;
    assert.equal(translated.en.scenes.length, 1); assert.equal(translated.vi.scenes.length, 2);
    assert.deepEqual(translated.vi.scenes[0].elementIds, expectedOrder);
    assert.deepEqual(await field('layer-select').locator('option').evaluateAll(options => options.map(option => option.value)), expectedOrder);
    report.languageAndStacking = { independentSceneCounts: true, selectionClamped: true, layerOrderRoundTrips: true };

    const latestCanvas = await createCanvas();
    assert.equal(latestCanvas.document.elements.find(e => e.effects?.entrance?.id === items.effectId).effects.entrance.definition.animation.duration, 1400);
    assert.equal((await request(`/api/designs/designs/${initialCanvas.id}`)).value.design.document.elements.find(e => e.id === originalElement.id).effects.entrance.definition.animation.duration, 900);
    report.libraryVersionPinning = { newCanvas: 1400, existingCanvas: 900 };

    async function animation(engine, title) {
      await openAdmin(); await category('animation'); await action('new').click(); const id = await field('id').inputValue();
      await field('title.vi').fill(title); await field('definition.engine').selectOption(engine);
      if (engine === 'particles') await field('definition.duration').fill('600');
      await action('save').click(); await saved(); return id;
    }
    async function effect(family, animationId, title) {
      await category('effect'); await action('new').click(); const id = await field('id').inputValue();
      await field('title.vi').fill(title); await field('definition.family').selectOption(family); await field('definition.animationId').selectOption(animationId);
      if (family === 'ambience') await page.locator('[data-path="definition.defaults.loop"]').check();
      await action('save').click(); await saved(); return id;
    }
    const surfaceAnimation = await animation('surface', 'Bề mặt tạo trong Admin'), surfaceEffect = await effect('surface', surfaceAnimation, 'Viền tạo trong Admin');
    const particleAnimation = await animation('particles', 'Hạt tạo trong Admin'), particleEffect = await effect('ambience', particleAnimation, 'Không khí tạo trong Admin');
    await page.goto(`${base}/design/${latestCanvas.id}`); await page.locator('[data-editor-field="title"]').waitFor();
    await page.locator('[data-editor-action="library-tab"][data-tab="add"]').click(); await page.locator('[data-block="photo"]').click();
    await page.locator('.editor-inspector [data-editor-field="effect.surface.id"]').selectOption(surfaceEffect);
    await page.locator('[data-editor-action="scene-select"]').first().click();
    await page.locator('.editor-inspector [data-editor-field="effect.ambience.id"]').selectOption(particleEffect);
    await page.locator('[data-editor-action="save"]').click(); await page.locator('.editor-save-status[data-tone="saved"]').waitFor(); await page.reload();
    await page.locator('[data-editor-field="title"]').waitFor();
    const styled = (await request(`/api/designs/designs/${latestCanvas.id}`)).value.design.document;
    assert.equal(styled.scenes[0].effects.ambience.definition.animation.engine, 'particles'); assert.equal(styled.scenes[0].effects.ambience.loop, true);
    const photo = styled.elements.find(e => e.effects?.surface?.id === surfaceEffect); assert(photo); assert.equal(photo.effects.surface.definition.animation.engine, 'surface');
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.locator('[data-editor-action="preview"]').click();
    await page.getByRole('dialog', { name: 'Xem trước món quà' }).locator(`[data-gift-effect="${particleEffect}"]`).waitFor();
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForFunction(id => !globalThis.document.querySelector(`dialog [data-gift-effect="${id}"]`), particleEffect);
    await page.locator('[data-editor-action="preview-close"]').click();
    report.surfaceAndParticles = { createdThroughAdmin: true, savedAndReloadedInCanvas: true, playback: true, reducedMotionStops: true };
    assert.deepEqual(errors, []);
    if (artifacts) fs.writeFileSync(path.join(artifacts, 'deep-audit-results.json'), JSON.stringify(report, null, 2));
    console.log('PASS deep Admin audit: committed ACK loss/create+update, draft discard, disabled chains/preview, frozen vs updated canvas, VI/EN scene divergence, stacking, surface/particle UI creation/playback');
    return report;
  } catch (error) {
    if (artifacts) { fs.mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: path.join(artifacts, 'deep-audit-failure.png'), fullPage: true }).catch(() => {}); }
    console.log('DEEP AUDIT FAILURE', { url: page.url(), errors, feedback: await page.locator('.library-admin__feedback').textContent().catch(() => '') }); throw error;
  } finally { await context.close(); await admin.execute("UPDATE users SET role='sender' WHERE id=?", [userId]); }
}
