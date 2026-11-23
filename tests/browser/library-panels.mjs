import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';

export async function runLibraryPanelChecks({ browser, base, cookie, directory }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'vi-VN', reducedMotion: 'reduce' });
  const split = cookie.indexOf('=');
  await context.addCookies([{ name: cookie.slice(0, split), value: cookie.slice(split + 1), url: base }]);
  await context.addInitScript(() => {
    globalThis.localStorage.setItem('momevia-locale', 'vi');
    const NativeAudio = globalThis.Audio;
    globalThis.__panelAudio = [];
    globalThis.Audio = class extends NativeAudio {
      constructor(...args) { super(...args); globalThis.__panelAudio.push(this); }
    };
    globalThis.__panelWheels = [];
    globalThis.addEventListener('wheel', event => globalThis.__panelWheels.push({
      y: globalThis.scrollY, target: event.target.outerHTML.slice(0, 250),
      chain: event.composedPath().filter(node => node instanceof globalThis.Element).map(node => ({ tag: node.tagName, class: node.className, overflow: globalThis.getComputedStyle(node).overflowY, overscroll: globalThis.getComputedStyle(node).overscrollBehaviorY, top: node.scrollTop, height: node.clientHeight, total: node.scrollHeight })),
    }), { passive: true });
  });
  const page = await context.newPage(), errors = [], dialogs = [];
  let navigations = 0, musicLoads = 0;
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++;
    if (request.method() === 'GET' && new URL(request.url()).pathname === '/api/designs/admin/music-library') musicLoads++;
  });
  page.on('dialog', dialog => { dialogs.push(dialog.message()); void dialog.dismiss(); });
  const tab = kind => page.locator(`[data-library-action="category"][data-kind="${kind}"]`);
  const list = page.locator('[data-library-list]'), fields = page.locator('[data-library-fields]'), preview = page.locator('[data-library-preview]');
  const musicList = page.locator('[data-music-admin-list]');
  const scrollTop = region => region.evaluate(node => node.scrollTop);
  const near = (actual, expected, label) => assert(Math.abs(actual - expected) <= 1, `${label}: ${actual} != ${expected}`);
  const settlePageScroll = () => page.evaluate(() => new Promise((resolve, reject) => {
    let previous = globalThis.scrollY;
    const started = globalThis.performance.now();
    let lastMovement = started;
    function tick() {
      const current = globalThis.scrollY, now = globalThis.performance.now();
      if (current !== previous) lastMovement = now;
      previous = current;
      // Let the previous wheel gesture end before testing a different region.
      // A few still frames can occur while the compositor retains that gesture.
      if (now - lastMovement >= 250) resolve();
      else if (globalThis.performance.now() - started > 3000) reject(new Error('Page scroll did not settle'));
      else globalThis.requestAnimationFrame(tick);
    }
    globalThis.requestAnimationFrame(tick);
  }));
  async function checkScrollChaining(regions) {
    const positions = await Promise.all(regions.map(async ([region]) => scrollTop(region)));
    await page.evaluate(() => globalThis.document.activeElement?.blur());
    for (const [region, name] of regions) {
      const siblings = regions.filter(([other]) => other !== region).map(([other]) => other);
      const siblingPositions = await Promise.all(siblings.map(scrollTop));
      const aim = async () => {
        const box = await region.boundingBox();
        const x = box.x + 6, y = box.y + Math.min(box.height / 2, 150);
        assert(await region.evaluate((node, point) => node.contains(globalThis.document.elementFromPoint(point.x, point.y)), { x, y }), `${name}: wheel target is inside the panel`);
        await page.mouse.move(x, y);
      };
      await settlePageScroll();
      await page.evaluate(() => globalThis.scrollTo({ top: 0, behavior: 'instant' }));
      const range = await region.evaluate(node => node.scrollHeight - node.clientHeight);
      if (range > 200) {
        await region.evaluate(node => { node.scrollTop = 50; });
        await aim(); await page.mouse.wheel(0, 60);
        await page.waitForFunction(node => node.scrollTop > 50, await region.elementHandle());
        await settlePageScroll();
        near(await page.evaluate(() => globalThis.scrollY), 0, `${name}: scrolling inside the range does not move the page`);
      }
      await region.evaluate(node => { node.scrollTop = node.scrollHeight; });
      await aim(); await page.mouse.wheel(0, 180); await page.mouse.wheel(0, 180);
      await page.waitForFunction(() => globalThis.scrollY > 0);
      await settlePageScroll();
      for (let index = 0; index < siblings.length; index++) near(await scrollTop(siblings[index]), siblingPositions[index], `${name}: reaching the bottom leaves sibling panels in place`);
      await page.evaluate(() => globalThis.scrollTo({ top: 180, behavior: 'instant' }));
      await region.evaluate(node => { node.scrollTop = 0; });
      const pageTop = await page.evaluate(() => globalThis.scrollY);
      assert(pageTop > 0, `${name}: the page can scroll upward`);
      await aim(); await page.mouse.wheel(0, -120); await page.mouse.wheel(0, -120);
      await page.waitForFunction(top => globalThis.scrollY < top, pageTop);
      await settlePageScroll();
      near(await scrollTop(region), 0, `${name}: the panel stays at its top while the page scrolls upward`);
      for (let index = 0; index < siblings.length; index++) near(await scrollTop(siblings[index]), siblingPositions[index], `${name}: reaching the top leaves sibling panels in place`);
    }
    await page.evaluate(() => globalThis.scrollTo({ top: 0, behavior: 'instant' }));
    for (let index = 0; index < regions.length; index++) await regions[index][0].evaluate((node, top) => { node.scrollTop = top; }, positions[index]);
  }
  try {
    const response = await context.request.get(base + '/api/designs/admin/library');
    assert.equal(response.status(), 200, 'Canvas panel QA must authenticate against its isolated library API');
    const { library } = await response.json();
    assert(Array.isArray(library?.items), 'Canvas panel QA requires a populated MySQL library; JSON returns library:null');
    const elements = library.items.filter(row => row.kind === 'element' && row.status === 'active');
    assert(elements.length >= 26, 'A full element library is required for deep scrolling');
    await page.goto(base + '/admin/library');
    await list.locator('button').nth(25).waitFor();
    assert.equal(await list.locator('button').count(), elements.length, 'The actual API library is fully rendered');
    const initialNavigations = navigations;
    assert.equal(await page.getByRole('tab').count(), 5);
    const panelSizes = await page.locator('.library-admin__grid > *').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
    assert(panelSizes.every(height => Math.abs(height - panelSizes[0]) <= 1), 'Desktop panels have independent equal bounds');
    await list.evaluate(node => { node.scrollTop = 650; });
    let key = await list.evaluate(node => {
      const bounds = node.getBoundingClientRect();
      const button = [...node.querySelectorAll('button')].find(button => {
        const rect = button.getBoundingClientRect(); return rect.top >= bounds.top + 5 && rect.bottom < Math.min(bounds.bottom, globalThis.innerHeight) - 5;
      });
      globalThis.__librarySelectedButton = button;
      return button.dataset.key;
    });
    const before = await scrollTop(list), documentTop = await page.evaluate(() => globalThis.scrollY);
    await list.locator(`[data-key="${key}"]`).click();
    near(await scrollTop(list), before, 'Selecting an element preserves the list position');
    assert(await list.locator(`[data-key="${key}"]`).evaluate(node => node === globalThis.__librarySelectedButton));
    assert(await list.locator(`[data-key="${key}"]`).evaluate(node => globalThis.document.activeElement === node));
    near(await page.evaluate(() => globalThis.scrollY), documentTop, 'Selection does not move the page');
    assert.equal(navigations, initialNavigations);
    await list.locator(`[data-key="${key}"]`).press('ArrowDown');
    key = await page.evaluate(() => globalThis.document.activeElement.dataset.key);
    const keyboardTop = await scrollTop(list);
    await page.keyboard.press('Enter');
    assert.equal(await list.locator(`[data-key="${key}"]`).getAttribute('aria-pressed'), 'true');
    near(await scrollTop(list), keyboardTop, 'Keyboard activation keeps the visible row in place');
    const advanced = fields.locator('[data-library-section="advanced"]');
    await advanced.evaluate(node => { node.open = true; });
    const layer = fields.locator('[data-operation="layer-select"]');
    const layerId = await layer.inputValue();
    await layer.selectOption(layerId);
    assert(await fields.locator('[data-library-section="advanced"]').evaluate(node => node.open), 'Structural edits preserve expanded sections');
    await fields.evaluate(node => { node.scrollTop = 180; });
    const editorTop = await scrollTop(fields);
    assert(editorTop > 0, 'The editor has its own scroll area');
    near(await scrollTop(list), before, 'Editor scrolling leaves the list in place');
    await preview.evaluate(node => { node.scrollTop = 70; });
    near(await scrollTop(list), before, 'Preview scrolling leaves the list in place');
    const canvasTop = await scrollTop(preview);
    await page.screenshot({ path: path.join(directory, 'canvas-panels-independent.png') });
    near(await scrollTop(fields), editorTop, 'Capturing evidence does not resize the scroll panels');
    await tab('audio').click();
    await musicList.locator('[data-audio-key]').nth(25).waitFor();
    assert.equal(await page.locator('[data-library-action="new"]').isVisible(), false);
    await musicList.evaluate(node => { node.scrollTop = 650; });
    const audioKey = await musicList.evaluate(node => {
      const bounds = node.getBoundingClientRect();
      const control = [...node.querySelectorAll('[data-music-admin="edit"]')].find(button => {
        const rect = button.getBoundingClientRect(); return rect.top >= bounds.top + 5 && rect.bottom < Math.min(bounds.bottom, globalThis.innerHeight) - 5;
      });
      globalThis.__audioSelectedButton = control;
      return control.dataset.key;
    });
    const audioTop = await scrollTop(musicList);
    await musicList.locator(`[data-key="${audioKey}"]`).click();
    near(await scrollTop(musicList), audioTop, 'Audio selection preserves the list position');
    assert(await musicList.locator(`[data-key="${audioKey}"]`).evaluate(node => node === globalThis.__audioSelectedButton));
    const input = page.locator('[data-audio-field="vi"]');
    const draftName = `${await input.inputValue()} QA`;
    await input.fill(draftName);
    const listen = page.locator(`[data-preview="${audioKey}"]`);
    await listen.click();
    await page.waitForFunction(key => globalThis.document.querySelector(`[data-preview="${key}"]`)?.getAttribute('aria-pressed') === 'true', audioKey);
    await tab('element').click();
    near(await scrollTop(list), before, 'Switching back preserves the canvas list');
    near(await scrollTop(fields), editorTop, 'Switching back preserves editor scroll');
    near(await scrollTop(preview), canvasTop, 'Switching back preserves preview scroll');
    assert(await page.evaluate(() => globalThis.__panelAudio.every(audio => audio.paused && !audio.getAttribute('src'))), 'Hidden audio tab stops and releases audio');
    await tab('audio').click();
    assert.equal(await input.inputValue(), draftName, 'An unfinished audio edit survives switching tabs');
    near(await scrollTop(musicList), audioTop, 'Audio scroll survives switching tabs');
    assert.equal(musicLoads, 1, 'Switching tabs does not reload the audio library');
    assert.equal(navigations, initialNavigations, 'Switching library tabs does not navigate');
    assert.deepEqual(dialogs, [], 'Switching tabs preserves drafts without asking to discard them');
    await page.locator('[data-music-admin="cancel"]').click();
    await tab('element').click();
    const layerName = fields.locator('input[data-field$=".name"]').first();
    const savedName = `${await layerName.inputValue()} QA panel`;
    const update = page.waitForResponse(response => response.request().method() === 'POST' && response.url().includes('/api/designs/admin/library/preview/'));
    await layerName.fill(savedName);
    assert.equal((await update).status(), 200);
    await page.waitForFunction(() => !globalThis.document.querySelector('[data-library-preview]')?.hasAttribute('aria-busy'));
    near(await scrollTop(list), before, 'Live preview updates leave the list in place');
    const saveTop = await scrollTop(fields), fieldKey = await layerName.getAttribute('data-field');
    await layerName.evaluate(node => { node.focus({ preventScroll: true }); node.setSelectionRange(1, 3); });
    const saved = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/designs/admin/library/' + key.replace(':', '/')));
    await page.keyboard.press('Control+s');
    assert.equal((await saved).status(), 200);
    await page.locator('#admin-library-workspace [data-library-save-state="clean"]').waitFor();
    near(await scrollTop(list), before, 'Saving leaves the list in place');
    near(await scrollTop(fields), saveTop, 'Saving leaves the form in place');
    assert.equal(await page.evaluate(() => globalThis.document.activeElement.dataset.field), fieldKey, 'Ctrl+S restores the focused field');
    assert.deepEqual(await layerName.evaluate(node => [node.selectionStart, node.selectionEnd]), [1, 3]);
    const reload = page.waitForResponse(response => response.request().method() === 'GET' && response.url().endsWith('/api/designs/admin/library'));
    await page.locator('.library-admin__header-actions [data-library-action="reload"]').click();
    assert.equal((await reload).status(), 200);
    assert.equal(await layerName.inputValue(), savedName, 'The saved field reloads from MySQL');
    near(await scrollTop(list), before, 'Reloading leaves the list in place');
    assert(await fields.locator('[data-library-section="advanced"]').evaluate(node => node.open));
    await page.setViewportSize({ width: 1440, height: 800 });
    await checkScrollChaining([[list, 'Canvas list'], [fields, 'Canvas information'], [preview, 'Canvas preview']]);
    await tab('audio').click();
    await page.setViewportSize({ width: 1440, height: 800 });
    await page.evaluate(() => new Promise(resolve => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve))));
    const audioEditor = page.locator('[data-music-admin-fields]');
    const audioName = `${await input.inputValue()} · ${'Kiểm tra tên bản nhạc dài và bố cục biểu mẫu. '.repeat(4)}`.slice(0, 155);
    await input.fill(audioName);
    assert.equal(await page.locator('[data-music-library] code').count(), 0, 'No checksums or internal variables are presented');
    await audioEditor.evaluate(node => { node.scrollTop = 40; });
    const audioEditorTop = await scrollTop(audioEditor);
    assert(audioEditorTop > 0, 'The audio form genuinely scrolls in a shorter desktop viewport');
    await input.evaluate(node => { node.focus({ preventScroll: true }); node.setSelectionRange(1, 3); });
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    let received;
    const committed = new Promise(resolve => { received = resolve; });
    const intercept = '**/api/designs/admin/music-library/*';
    await page.route(intercept, async route => { const response = await route.fetch(); received(); await gate; await route.fulfill({ response }); });
    await page.keyboard.press('Control+s');
    try { await committed; assert(await input.isDisabled(), 'Fields cannot accept edits while a save ACK is pending'); }
    finally { release(); }
    await page.getByRole('status').filter({ hasText: 'Đã lưu vào thư viện' }).waitFor();
    await page.unroute(intercept);
    assert.equal(await input.inputValue(), audioName);
    assert.deepEqual(await input.evaluate(node => [node.selectionStart, node.selectionEnd]), [1, 3]);
    assert.equal(await page.evaluate(() => globalThis.document.activeElement.dataset.audioField), 'vi');
    near(await scrollTop(audioEditor), audioEditorTop, 'Audio save preserves editor scroll');
    const originalStatus = await page.locator('[data-audio-field="status"]').inputValue();
    for (const expected of [originalStatus === 'active' ? 'disabled' : 'active', originalStatus]) {
      const toggled = page.waitForResponse(response => response.request().method() === 'POST' && response.url().includes('/api/designs/admin/music-library/'));
      await page.locator('[data-music-admin="toggle"]').click();
      assert.equal((await toggled).status(), 200);
      await page.waitForFunction(value => globalThis.document.querySelector('[data-audio-field="status"]')?.value === value, expected);
    }
    await page.locator('[data-music-admin="listen"]').click();
    await page.waitForFunction(() => globalThis.__panelAudio.some(audio => !audio.paused && audio.currentTime > 0));
    await page.getByRole('slider', { name: 'Âm lượng nghe thử', exact: true }).fill('30');
    assert(await page.evaluate(() => globalThis.__panelAudio.some(audio => !audio.paused && audio.volume === .3)));
    await page.locator('[data-preview]').click();
    assert(await page.evaluate(() => globalThis.__panelAudio.every(audio => audio.paused && !audio.getAttribute('src'))));
    await checkScrollChaining([[musicList, 'Audio list'], [audioEditor, 'Audio information'], [page.locator('.music-admin__preview-body'), 'Audio preview']]);
    await page.locator('[data-music-admin-filter="kind"]').selectOption('sfx');
    assert.equal(await musicList.locator('[data-audio-key]').count(), 50);
    await page.screenshot({ path: path.join(directory, 'canvas-audio-tab-desktop.png'), fullPage: true });
    await page.goto(base + '/admin/music-library');
    await musicList.locator('[data-audio-key]').nth(25).waitFor();
    assert.equal(await tab('audio').getAttribute('aria-selected'), 'true', 'The old audio URL opens the integrated tab');
    await page.locator('.music-admin__filter-more > summary').click();
    await page.locator('[data-music-admin-filter="market"]').selectOption('korea');
    assert.equal(await musicList.locator('[data-audio-key]').count(), 6);
    await page.locator('[data-music-admin-filter="vocals"]').selectOption('vocal');
    assert.equal(await musicList.locator('[data-audio-key]').count(), 1);
    await page.locator('.music-admin__filter-more > summary').click();
    await page.locator('#site-header [data-locale-select]:visible').selectOption('en');
    await page.getByRole('tab', { name: 'Audio', exact: true }).waitFor();
    assert.equal(await page.locator('[data-music-admin-filter="market"]').inputValue(), 'korea');
    await page.locator('#site-header [data-locale-select]:visible').selectOption('vi');
    await page.getByRole('tab', { name: 'Âm thanh', exact: true }).waitFor();
    for (const [width, height] of [[1024, 900], [390, 844]]) {
      await page.setViewportSize({ width, height });
      assert(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.document.documentElement.clientWidth + 1), `No audio overflow at ${width}px`);
      await page.screenshot({ path: path.join(directory, `canvas-audio-tab-${width}.png`), fullPage: true });
      await tab('element').click();
      assert(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.document.documentElement.clientWidth + 1), `No canvas overflow at ${width}px`);
      await page.screenshot({ path: path.join(directory, `canvas-panels-${width}.png`), fullPage: true });
      await tab('audio').click();
    }
    assert.deepEqual(errors, []);
  } catch (error) {
    fs.writeFileSync(path.join(directory, 'library-panels-trace.json'), JSON.stringify(await page.evaluate(() => ({
      scrolls: [...globalThis.document.querySelectorAll('[data-library-list], [data-library-fields], [data-library-preview], [data-music-admin-list], [data-music-admin-edit]')].map(node => ({ class: node.className, top: node.scrollTop, height: node.clientHeight, total: node.scrollHeight })),
      active: globalThis.document.activeElement.outerHTML.slice(0, 500),
      wheels: globalThis.__panelWheels,
    })), null, 2));
    await page.screenshot({ path: path.join(directory, 'library-panels-failure.png'), fullPage: true }).catch(() => {});
    throw error;
  } finally { await context.close(); }
}
