import assert from 'node:assert/strict';
import path from 'node:path';
import sharp from 'sharp';
import { confirmGiftAccess } from './gift-access.mjs';

export async function checkContextualCanvas({ page, base, browser, context, artifacts }) {
  const control = name => page.locator(`[data-editor-action="${name}"]`);
  const field = name => page.locator(`[data-editor-field="${name}"]`);
  const board = page.locator('.editor-artboard');
  const layer = id => board.locator(`.editor-stage-element[data-element-id="${id}"]`);
  const tab = name => page.locator(`[data-tab="${name}"]`);
  const selection = () => board.locator('.editor-selection-outline').getAttribute('data-element-id');
  const save = async () => {
    await control('save').click();
    await page.locator('.editor-save-status').filter({ hasText: 'Đã lưu' }).waitFor();
  };
  await page.goto(base + '/design/new');
  await control('create-blank').click();
  await field('binding.recipientName').waitFor();
  const id = new URL(page.url()).pathname.split('/').at(-1);
  const endpoint = `${base}/api/designs/designs/${id}`;
  const read = () => page.request.get(endpoint).then(res => res.json()).then(data => data.design);
  await field('binding.recipientName').fill('Nguyễn Ánh Mai');
  await field('binding.senderName').fill('Đặng An');
  await field('binding.message').fill('Hôm nay là một ngày để nhớ.');
  await tab('add').click();
  await page.locator('[data-block-search]').fill('polaroid');
  const card = page.locator('[data-block="polaroid"]');
  await card.click();
  const first = await selection();
  await field('element.name').fill('Khung ảnh kỷ niệm');
  await card.click();
  const second = await selection();
  assert.notEqual(first, second);
  await field('element.name').fill('Khung bên phải');
  await save();
  const empty = await read();
  assert.equal(empty.document.elements.filter(model => model.type === 'image').length, 0);
  const beforePhoto = await page.request.post(endpoint + '/preflight', { data: { expectedRevision: empty.revision } }).then(res => res.json());
  assert.equal(beforePhoto.canPublish, true, JSON.stringify(beforePhoto.blockers));

  await page.locator('.editor-scene-menu summary').click();
  await control('scene-duplicate').click();
  assert.equal(await board.locator('.editor-stage-element').count(), 6);
  assert.notEqual(await board.locator('.editor-stage-element').first().getAttribute('data-element-id'), empty.document.elements[0].id);
  await control('undo').click();
  assert.equal(await control('scene-select').count(), 1);
  await control('redo').click();
  assert.equal(await control('scene-select').count(), 2);
  await control('undo').click();

  const firstCaption = empty.document.elements.find(model => model.type === 'text').id;
  await tab('layers').click();
  const selectLayer = id => page.locator(`.editor-layers [data-id="${id}"]`).click();
  await selectLayer(firstCaption);
  await control('inline-text').click();
  const inline = board.getByRole('textbox', { name: 'Chữ trên thiệp' });
  await inline.press('Control+a');
  const cdp = await context.newCDPSession(page);
  const composed = 'Chiều ấy, mình nhớ mãi những điều tử tế.';
  await cdp.send('Input.imeSetComposition', { text: 'Chiều', selectionStart: 5, selectionEnd: 5 });
  await cdp.send('Input.insertText', { text: composed });
  assert.equal(await inline.inputValue(), composed);
  await inline.press('Control+Enter');
  await board.getByText(composed, { exact: true }).waitFor();
  await control('undo').click();
  assert.equal(await layer(firstCaption).textContent(), 'Ngày mình nhớ');
  await control('redo').click();
  assert.equal(await layer(firstCaption).textContent(), composed);
  await selectLayer(firstCaption);
  await page.locator('[data-font="heading"]').click();
  await page.locator('[data-align="right"]').click();
  await field('props.lineHeight').fill('1.7');
  await field('props.lineHeight').press('Tab');
  await field('element.opacity').fill('25');
  await field('element.opacity').press('Tab');
  assert.equal(await layer(firstCaption).evaluate(node => node.style.opacity), '0.75');

  const band = await sharp({ create: { width: 90, height: 180, channels: 3, background: '#ffca8a' } }).png().toBuffer();
  const wide = await sharp({ create: { width: 270, height: 180, channels: 3, background: '#463089' } }).composite([{ input: band, left: 180, top: 0 }]).png().toBuffer();
  const tall = await sharp({ create: { width: 100, height: 220, channels: 3, background: '#78b9a8' } }).png().toBuffer();
  const upload = async (id, bytes, name) => {
    await selectLayer(id);
    const old = await layer(id).locator('img').getAttribute('src', { timeout: 150 }).catch(() => null);
    await field('upload').setInputFiles({ name, mimeType: 'image/png', buffer: bytes });
    await page.waitForFunction(({ id, old }) => {
      const img = globalThis.document.querySelector(`.editor-stage-element[data-element-id="${id}"] img`);
      return img && img.getAttribute('src') !== old;
    }, { id, old });
    const current = await layer(id).locator('img').getAttribute('src');
    assert.notEqual(current, old);
    return current;
  };
  let firstImage = await upload(first, wide, 'synthetic-wide.png');
  const secondImage = await upload(second, tall, 'synthetic-tall.png');
  assert.notEqual(firstImage, secondImage);
  assert.equal(await layer(first).locator('img').getAttribute('src'), firstImage);
  await selectLayer(first);
  assert.equal(await field('accessibility.alt').getAttribute('maxlength'), '240');
  await field('accessibility.alt').fill('Ảnh tổng hợp hai mảng màu để kiểm tra điểm lấy nét.');
  await field('accessibility.decorative').check();
  assert(await field('accessibility.alt').isDisabled());
  await field('accessibility.decorative').uncheck();
  await field('props.fit').selectOption('contain');
  assert.equal(await layer(first).locator('img').evaluate(node => node.style.objectFit), 'contain');
  await field('props.fit').selectOption('cover');
  await field('props.radius').fill('24');
  await field('props.radius').press('Tab');
  await field('crop.x').fill('18');
  await field('crop.x').press('Tab');
  assert.equal(await layer(first).locator('img').evaluate(node => node.style.objectPosition), '18% 50%');
  const surface = page.locator('.editor-crop-surface.is-editable');
  await surface.scrollIntoViewIfNeeded();
  const box = await surface.boundingBox();
  await page.mouse.move(box.x + box.width * .18, box.y + box.height * .50);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .86, box.y + box.height * .29, { steps: 6 });
  await page.mouse.up();
  const position = await layer(first).locator('img').evaluate(node => node.style.objectPosition);
  assert(parseFloat(position) > 82, position);
  assert.equal(await layer(second).locator('img').evaluate(node => node.style.objectPosition), '50% 50%');
  await control('undo').click();
  assert.equal(await layer(first).locator('img').evaluate(node => node.style.objectPosition), '18% 50%');
  await control('redo').click();
  assert.equal(await layer(first).locator('img').evaluate(node => node.style.objectPosition), position);
  await tab('assets').click();
  const firstThumb = page.locator(`.editor-assets [data-runtime-element="${first}"]`);
  assert.equal(await firstThumb.locator('img').evaluate(node => node.style.objectPosition), position);
  assert.equal(await firstThumb.locator('img').evaluate(node => node.style.objectFit), 'cover');
  assert.equal(await firstThumb.evaluate(node => node.style.borderRadius), '24px');
  await save();
  const saved = await read();
  await page.reload();
  await layer(first).locator('img').waitFor();
  assert.deepEqual((await read()).document, saved.document);
  assert.equal(await layer(second).locator('img').getAttribute('src'), secondImage);
  await tab('layers').click();
  await selectLayer(second);
  await control('element-duplicate').click();
  const duplicate = await selection();
  assert.notEqual(duplicate, second);
  assert.equal(await layer(duplicate).locator('img').getAttribute('src'), secondImage);
  await control('undo').click();
  assert.equal(await layer(duplicate).count(), 0);

  const originalX = await layer(first).evaluate(node => node.style.left);
  await layer(first).scrollIntoViewIfNeeded();
  const frame = await layer(first).boundingBox();
  await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
  await page.mouse.down();
  await layer(first).evaluate(node => {
    for (const type of ['pointerdown', 'pointercancel', 'lostpointercapture']) {
      node.dispatchEvent(new globalThis.PointerEvent(type, {
        bubbles: true, pointerId: 71, pointerType: 'touch', button: 0,
      }));
    }
  });
  await page.mouse.move(frame.x + frame.width / 2 + 27, frame.y + frame.height / 2 + 12, { steps: 6 });
  await page.mouse.up();
  assert.notEqual(await layer(first).evaluate(node => node.style.left), originalX);
  await control('undo').click();
  assert.equal(await layer(first).evaluate(node => node.style.left), originalX);

  await selectLayer(second);
  const geometry = page.locator('.editor-geometry');
  await geometry.locator('summary').click();
  const firstGroup = saved.document.elements.find(model => model.id === first).groupId;
  assert(firstGroup);
  const firstLayout = saved.document.elements.find(model => model.id === firstGroup).layout;
  let movedAxes = 0;
  for (const coordinate of ['x', 'y']) {
    const control = field('layout.' + coordinate);
    if (Number(await control.inputValue()) === firstLayout[coordinate]) continue;
    await control.fill(String(firstLayout[coordinate]));
    await control.press('Tab');
    movedAxes++;
  }
  const hit = () => layer(first).evaluate(node => {
    const { x, y, width, height } = node.getBoundingClientRect();
    return globalThis.document.elementFromPoint(x + width / 2, y + height / 2)?.closest('.editor-stage-element')?.dataset.elementId;
  });
  await selectLayer(first);
  assert.equal(await hit(), second, 'Selecting the lower image does not paint it in front');
  const documentOrder = () => board.locator('.editor-stage-element').evaluateAll(nodes => nodes.map(node => node.dataset.elementId));
  const originalOrder = await documentOrder();
  await control('layer-up').click();
  assert.equal(await hit(), first);
  assert.deepEqual(await documentOrder(), originalOrder, 'Stack changes preserve document order');
  for (let step = 0; step < 1 + movedAxes; step++) await control('undo').click();
  assert.equal(await layer(second).locator('img').getAttribute('src'), secondImage);

  const priorFirst = firstImage;
  firstImage = await upload(first, wide, 'replacement-wide.png');
  assert.notEqual(firstImage, priorFirst);
  assert.equal(await layer(second).locator('img').getAttribute('src'), secondImage);
  const replacementSecond = await upload(second, tall, 'replacement-tall.png');
  assert.notEqual(replacementSecond, secondImage);
  assert.equal(await layer(first).locator('img').getAttribute('src'), firstImage);
  assert.equal(await layer(first).locator('img').evaluate(node => node.style.objectPosition), position);
  await save();
  await selectLayer(first);
  if (artifacts) {
    await page.locator('.editor-crop-surface').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(artifacts, 'canvas-crop-1440.png'), fullPage: true });
  }
  await control('preview').click();
  const player = page.locator('dialog[open] .gift-runtime-stage');
  assert.equal(await player.locator(`[data-runtime-element="${first}"] img`).evaluate(node => node.style.objectPosition), position);
  assert.equal(await player.locator(`[data-runtime-element="${firstCaption}"]`).textContent(), composed);
  await control('preview-close').click();
  const publish = page.waitForResponse(response => response.url().endsWith('/gifts/gifts/from-design') && response.status() === 201);
  await control('publish').click();
  await confirmGiftAccess(page);
  const { gift } = await (await publish).json();
  await page.waitForURL('**/success/*');

  const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  try {
    await touch.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    const receiver = await touch.newPage();
    await receiver.goto(`${base}/g/${gift.slug}`);
    const received = receiver.locator(`.gift-runtime-stage [data-runtime-element="${first}"] img`);
    await received.waitFor();
    assert.equal(await received.evaluate(node => node.style.objectPosition), position);
    assert.equal(await receiver.request.get(base + firstImage).then(response => response.status()), 401);
    if (artifacts) await receiver.screenshot({ path: path.join(artifacts, 'canvas-polaroid-recipient-390.png'), fullPage: true });
    await touch.addCookies((await context.cookies(base)).map(({ name, value }) => ({ name, value, url: base })));
    await receiver.goto(`${base}/design/${id}`);
    await receiver.locator('[data-editor-action="sheet-library"]').tap();
    await receiver.locator('[data-block-search]').fill('ngoi sao');
    if (artifacts) await receiver.screenshot({ path: path.join(artifacts, 'canvas-library-390.png'), fullPage: true });
    await receiver.locator('[data-block="star"]').tap();
    assert.equal(await receiver.locator('.editor-sheet-open').count(), 0);
    assert.equal(await receiver.locator('.editor-artboard .gift-runtime-sticker').textContent(), '★');
    assert.equal(await receiver.locator('.editor-selection-outline').getAttribute('data-element-id'),
      await receiver.locator('.editor-artboard .gift-runtime-sticker').getAttribute('data-element-id'));
    await receiver.locator('[data-editor-action="sheet-layers"]').tap();
    await receiver.locator(`.editor-layers [data-id="${first}"]`).tap();
    await receiver.keyboard.press('Escape');
    await receiver.locator('[data-editor-action="sheet-inspector"]').tap();
    const mobileCrop = receiver.locator('.editor-crop-surface.is-editable');
    await mobileCrop.scrollIntoViewIfNeeded();
    const target = await mobileCrop.boundingBox();
    const session = await touch.newCDPSession(receiver);
    const point = (x, y) => [{ x: Math.round(target.x + target.width * x), y: Math.round(target.y + target.height * y) }];
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(.86, .29) });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(.30, .55) });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert(Number(await receiver.locator('[data-editor-field="crop.x"]').inputValue()) < 35);
    if (artifacts) await receiver.screenshot({ path: path.join(artifacts, 'canvas-crop-390.png'), fullPage: true });
  } finally {
    await touch.close();
  }
  return 'Vietnamese IME and history, optional Polaroids and independent replacement after duplicate/undo/reload, drag in one step, overlapping layers, crop parity including public link, touch insertion and crop';
}
