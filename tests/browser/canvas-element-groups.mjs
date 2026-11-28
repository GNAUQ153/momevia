import assert from 'node:assert/strict';
import sharp from 'sharp';

export async function checkCanvasGroups(page, base) {
  const action = name => page.locator(`[data-editor-action="${name}"]`);
  const field = name => page.locator(`.editor-inspector [data-editor-field="${name}"]`);
  const board = page.locator('.editor-artboard'), layers = board.locator('.editor-stage-element');
  const outline = board.locator('.editor-selection-outline');
  const layout = () => layers.evaluateAll(nodes => nodes.map(node =>
    Object.fromEntries(['left','top','width','height'].map(key => [key, parseFloat(node.style[key])]))));
  await page.goto(base + '/design/new');
  await action('create-blank').click();
  await page.locator('[data-tab="add"]').click();
  const card = page.locator('[data-block="photo-diptych"]');
  await card.dragTo(board);
  await layers.nth(2).waitFor();
  assert.equal(await outline.count(), 1);
  const initial = await layout(), first = layers.nth(1);
  const geometry = await outline.boundingBox(), leftPhoto = await first.boundingBox();
  assert(geometry.width > 2 * leftPhoto.width, 'The selection includes the backing and both photos');
  await first.scrollIntoViewIfNeeded();
  const left = await first.boundingBox();
  await page.keyboard.down('Alt');
  await page.mouse.move(left.x + left.width / 2, left.y + left.height / 2);
  await page.mouse.down();
  await page.mouse.move(left.x + left.width / 2 + 28, left.y + left.height / 2 + 18, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up('Alt');
  const moved = await layout(), dx = moved[0].left - initial[0].left, dy = moved[0].top - initial[0].top;
  assert(dx > 1 && dy > 1);
  for (const [i, box] of moved.entries()) {
    assert(Math.abs(box.left - initial[i].left - dx) < 0.001);
    assert(Math.abs(box.top - initial[i].top - dy) < 0.001);
  }
  await action('undo').click();
  assert.deepEqual(await layout(), initial);
  await action('redo').click();
  assert.deepEqual(await layout(), moved);

  const handle = outline.locator('[data-editor-resize]');
  await handle.scrollIntoViewIfNeeded();
  const corner = await handle.boundingBox();
  await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2);
  await page.mouse.down();
  await page.mouse.move(corner.x - 27, corner.y - 19, { steps: 5 });
  await page.mouse.up();
  const smaller = await layout(), scale = smaller[0].width / moved[0].width;
  assert(scale < 0.99);
  smaller.forEach((box, i) => assert(Math.abs(box.width / moved[i].width - scale) < 0.001));
  await action('undo').click();
  assert.deepEqual(await layout(), moved);

  const image = await sharp({ create: { width: 80, height: 48, channels: 3, background: '#9159bf' } }).png().toBuffer();
  await first.click();
  await field('upload').setInputFiles({ name: 'group-photo.png', mimeType: 'image/png', buffer: image });
  await first.locator('img').waitFor();
  await field('props.caption').fill('Ngày đầu tiên');
  await field('props.caption').press('Tab');
  await field('crop.x').fill('29');
  await field('crop.x').press('Tab');
  assert.match(await layers.nth(2).innerText(), /Bây giờ/);
  const draftId = new URL(page.url()).pathname.split('/').at(-1);
  const read = async () => {
    await action('save').click();
    await page.locator('.editor-save-status').filter({ hasText: 'Đã lưu' }).waitFor();
    const response = await page.request.get(base + '/api/designs/designs/' + draftId);
    assert.equal(response.status(), 200);
    return (await response.json()).design.document;
  };
  const saved = await read();
  assert(saved.elements.every(e => e.groupId === saved.elements[0].id));
  assert.equal(saved.elements[1].props.caption, 'Ngày đầu tiên');
  assert.equal(saved.elements[1].props.focalPoint.x, .29);
  assert.equal(saved.elements[2].props.assetId, null);
  await page.reload();
  await first.locator('img').waitFor();
  assert.deepEqual(await layout(), moved);
  const selectLayer = id => page.locator(`.editor-layers [data-id="${id}"]`);
  await page.locator('[data-tab="layers"]').click();
  await selectLayer(saved.elements[1].id).click();
  await action('element-duplicate').click();
  const copied = await read();
  assert.equal(copied.elements.length, 6);
  assert(copied.elements.slice(3).every(e => e.groupId === copied.elements[3].id && e.groupId !== saved.elements[0].groupId));
  await action('element-delete').click();
  assert.equal(await layers.count(), 3);
  await action('undo').click();
  assert.equal(await layers.count(), 6);
  await action('redo').click();
  assert.equal(await layers.count(), 3);

  await page.locator('[data-tab="add"]').click();
  for (const id of ['rectangle','heading']) await page.locator(`[data-block="${id}"]`).click();
  const old = (await read()).elements.slice(3);
  assert(old.every(e => !e.groupId));
  await page.locator('[data-tab="layers"]').click();
  await selectLayer(old[0].id).click();
  await selectLayer(old[1].id).click({ modifiers: ['Shift'] });
  await action('element-group').click();
  assert.equal(await outline.count(), 1);
  const grouped = await read();
  assert(grouped.elements.slice(3).every(e => e.groupId === old[0].id));
  assert.deepEqual(grouped.elements.slice(0,3), saved.elements);
  return 'Diptych drag/drop, drag from a photo, proportional resize, undo/redo, crop and caption, save/reload, independent copy and legacy grouping';
}
