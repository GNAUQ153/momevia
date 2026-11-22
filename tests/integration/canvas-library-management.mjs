import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDocument } from '../../web/js/shared/canvas/presets.js';
import { createElement } from '../../web/js/shared/canvas/registry.js';

export async function runLibraryManagement({ base, cookie, admin, userId, request, browser }) {
  const originalPath = 'M50 2L98 98H2Z', nextPath = 'M50 2L98 50 50 98 2 50Z';
  const animation = { engine: 'keyframes', duration: 650, easing: 'ease-out', keyframes: [
    { opacity: .2, transform: 'rotate(-11deg)' }, { opacity: 1, transform: 'rotate(0deg)' }] };
  const text = createElement('text', { id: 'db-library-message', layout: { x: 20, y: 120, width: 340, height: 120, rotation: 0 },
    props: { text: 'Nội dung từ thư viện MySQL', fontSize: 28 } });
  const doc = createDocument(); doc.elements = [text]; doc.scenes[0].elementIds = [text.id];
  const vector = createElement('sticker', { props: { stickerId: 'db-ribbon', color: '#923467' }, layout: { x: 30, y: 300, width: 100, height: 100, rotation: 0 } });
  const entries = [
    ['animation', 'db-tilt', animation],
    ['animation', 'db-paper', { engine: 'surface', styles: { borderColor: '#923467', borderWidth: 3, borderRadius: 12, shadowColor: '#CCCCCC', shadowBlur: 16 } }],
    ['animation', 'db-particles', { engine: 'particles', glyphs: ['✦','❀'], colors: ['#923467','#E5C177'], duration: 700, count: 4, drift: -80 }],
    ['effect', 'db-entrance', { title: { vi: 'Nghiêng từ MySQL', en: 'Tilt from MySQL' }, family: 'entrance', animationId: 'db-tilt', targets: { types: ['text'] }, defaults: { speed: 'slow', delay: 150 } }],
    ['effect', 'db-surface', { title: { vi: 'Viền từ MySQL', en: 'Paper from MySQL' }, family: 'surface', animationId: 'db-paper', targets: { types: ['sticker','shape'] }, defaults: {} }],
    ['effect', 'db-ambience', { title: { vi: 'Hạt từ MySQL', en: 'Particles from MySQL' }, family: 'ambience', animationId: 'db-particles', targets: { scenes: true, types: [] }, defaults: { speed: 'normal', density: 'sparse', loop: true } }],
    ['artwork', 'sticker-db-ribbon', { target: 'sticker', key: 'db-ribbon', vector: { paths: [{ d: originalPath, fill: 'color' }] } }],
    ['element', 'db-sql-element', { title: { vi: 'Họa tiết từ MySQL', en: 'Shape from MySQL' }, group: { vi: 'Thư viện MySQL', en: 'MySQL library' }, keywords: 'database vector', elements: [vector] }],
    ['preset', 'db-start', { title: { vi: 'Bố cục từ MySQL', en: 'Start from MySQL' }, documents: { vi: doc, en: doc } }],
  ];
  const headers = { cookie, 'content-type': 'application/json' };
  const denied = await fetch(base + '/api/designs/admin/library', { headers: { cookie } }); assert.equal(denied.status, 403);
  const deniedWrite = await fetch(base + '/api/designs/admin/library/animation/no-rights', { method: 'POST', headers, body: JSON.stringify({ expectedRevision: 0, definition: animation }) });
  assert.equal(deniedWrite.status, 403);
  // This is deliberately SQL, not a new frontend/backend code registration.
  for (const [kind, id, definition] of entries) await admin.execute('INSERT INTO canvas_library_items(kind,id,revision,status,sort_order,definition) VALUES (?,?,1,\'active\',10000,?)', [kind, id, JSON.stringify(definition)]);
  const first = (await request('/api/designs/library')).value.library;
  assert.equal(first.items.filter(r => r.kind === 'element').length, 173);
  assert(first.items.some(r => r.id === 'db-start'));
  const templates = (await request('/api/catalog/templates')).value.templates;
  const template = templates.find(t => first.items.some(r => r.kind === 'template' && r.id === t.id)); assert(template);
  const templateRow = first.items.find(r => r.kind === 'template' && r.id === template.id), templateDefinition = structuredClone(templateRow.definition);
  for (const d of Object.values(templateDefinition.documents)) { d.elements.push({ ...structuredClone(text), id: 'db-template-proof' }); d.scenes[0].elementIds.push('db-template-proof'); }
  await admin.execute('UPDATE canvas_library_items SET definition=?,revision=revision+1 WHERE kind=\'template\' AND id=?', [JSON.stringify(templateDefinition), template.id]);
  const created = (await request('/api/designs/designs', { source: { kind: 'template', templateId: template.id }, mutationId: randomUUID() })).value.design;
  assert(created.document.elements.some(e => e.id === 'db-template-proof'));
  const cover = await fetch(`${base}/api/designs/library/templates/${template.id}/cover?locale=en`);
  assert.equal(cover.status, 200); assert.match(cover.headers.get('content-type'), /image\/svg\+xml/);
  assert((await cover.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').includes('Nội dung từ thư viện MySQL'));
  await admin.execute("UPDATE users SET role='admin' WHERE id=?", [userId]);
  const sample = first.items.find(r => r.kind === 'element' && r.id === 'heading').definition;
  await request('/api/designs/admin/library/element/db-api-element', { expectedRevision: 0, definition: sample });
  await request('/api/designs/admin/library/element/db-api-element', { expectedRevision: 1, definition: { ...sample, title: { vi: 'Sửa từ API', en: 'Updated through API' } } });
  const stale = await fetch(base + '/api/designs/admin/library/element/db-api-element', { method: 'POST', headers, body: JSON.stringify({ expectedRevision: 1, definition: sample }) }); assert.equal(stale.status, 409);
  const [[history]] = await admin.execute("SELECT COUNT(*) n FROM canvas_library_history WHERE kind='element' AND id='db-api-element'"); assert.equal(history.n, 1);

  const context = await browser.newContext({ locale: 'vi-VN', reducedMotion: 'no-preference', viewport: { width: 1440, height: 1000 } });
  const split = cookie.indexOf('='); await context.addCookies([{ name: cookie.slice(0, split), value: cookie.slice(split + 1), url: base }]);
  await context.addInitScript(() => {
    localStorage.setItem('momevia-locale', 'vi'); globalThis.__libraryAnimations = [];
    const animate = globalThis.Element.prototype.animate;
    globalThis.Element.prototype.animate = function (frames, options) { globalThis.__libraryAnimations.push({ frames, options }); return animate.call(this, frames, options); };
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(base + '/design/new');
    await page.locator('[data-preset="db-start"]').click();
    await page.locator('[data-editor-field="title"]').waitFor();
    const designId = new URL(page.url()).pathname.split('/').at(-1);
    await page.locator('[data-editor-action="library-tab"][data-tab="add"]').click();
    assert.equal(await page.locator('[data-block="db-sql-element"]').innerText(), 'Họa tiết từ MySQL');
    await page.locator('[data-block="db-sql-element"]').click();
    const field = key => page.locator(`.editor-inspector [data-editor-field="${key}"]`);
    await field('props.stickerId').selectOption('heart');
    await field('props.stickerId').selectOption('db-ribbon');
    await field('effect.surface.id').selectOption('db-surface');
    await page.locator('[data-editor-action="library-tab"][data-tab="layers"]').click();
    await page.locator(`.editor-layers [data-id="${text.id}"]`).click();
    await field('effect.entrance.id').selectOption('db-entrance');
    await page.locator('[data-editor-action="save"]').click(); await page.locator('.editor-save-status[data-tone="saved"]').waitFor();
    await page.locator('[data-editor-action="effect-preview"][data-family="entrance"]').click();
    await page.waitForFunction(() => globalThis.__libraryAnimations.some(a => a.frames.some(f => f.transform === 'rotate(-11deg)')));
    await page.locator('[data-editor-action="preview-close"]').click();
    await page.reload(); await page.locator('[data-editor-field="title"]').waitFor();
    let d = (await request(`/api/designs/designs/${designId}`)).value.design;
    const pinnedText = d.document.elements.find(e => e.id === text.id), pinnedVector = d.document.elements.find(e => e.props.stickerId === 'db-ribbon');
    assert.deepEqual(pinnedText.effects.entrance.definition.animation, animation);
    assert.equal(pinnedVector.artwork.paths[0].d, originalPath);
    assert.equal(pinnedVector.effects.surface.definition.animation.engine, 'surface');
    for (const [key, value] of Object.entries({ recipientName: 'Người nhận QA', senderName: 'Người gửi QA', message: 'Thử thư viện MySQL' })) d.document.bindings[key].value = value;
    const ambient = first.items.find(r => r.kind === 'effect' && r.id === 'db-ambience');
    d.document.scenes[0].effects = { ambience: { id: 'db-ambience', ...ambient.definition.defaults, definition: {
      id: ambient.id, revision: ambient.revision, family: 'ambience', title: ambient.definition.title, targets: ambient.definition.targets,
      animation: first.items.find(r => r.kind === 'animation' && r.id === 'db-particles').definition } } };
    await request(`/api/designs/designs/${designId}/save`, { expectedRevision: d.revision, mutationId: randomUUID(), title: d.title, document: d.document });
    d = (await request(`/api/designs/designs/${designId}`)).value.design;
    const published = (await request('/api/gifts/gifts/from-design', { designId, expectedRevision: d.revision, expectedDocumentHash: d.documentHash, idempotencyKey: randomUUID() })).value;
    const frozen = (await request(`/api/gifts/gifts/${published.gift.slug}`)).value.gift.documentSnapshot;
    await admin.execute("UPDATE canvas_library_items SET definition=?,revision=revision+1 WHERE kind='animation' AND id='db-tilt'", [JSON.stringify({ ...animation, keyframes: [{ transform: 'rotate(77deg)' }, { transform: 'rotate(0deg)' }] })]);
    await admin.execute("UPDATE canvas_library_items SET definition=?,revision=revision+1 WHERE kind='artwork' AND id='sticker-db-ribbon'", [JSON.stringify({ target: 'sticker', key: 'db-ribbon', vector: { paths: [{ d: nextPath, fill: 'color' }] } })]);
    await request('/api/designs/admin/library/effect/db-entrance', { expectedRevision: 1, status: 'disabled' });
    await request('/api/designs/admin/library/preset/db-start', { expectedRevision: 1, status: 'disabled' });
    const disabled = await fetch(base + '/api/designs/designs', { method: 'POST', headers, body: JSON.stringify({ source: { kind: 'blank' }, presetId: 'db-start', mutationId: randomUUID() }) }); assert.equal(disabled.status, 422);
    assert.deepEqual((await request(`/api/gifts/gifts/${published.gift.slug}`)).value.gift.documentSnapshot, frozen);
    await page.goto(base + '/g/' + published.gift.slug);
    await page.waitForFunction(() => globalThis.__libraryAnimations.some(a => a.frames.some(f => f.transform === 'rotate(-11deg)')));
    assert(!(await page.evaluate(() => globalThis.__libraryAnimations)).some(a => a.frames.some(f => f.transform === 'rotate(77deg)')));
    await page.locator('[data-gift-effect="db-ambience"]').waitFor();
    assert(await page.locator('svg path').evaluateAll((nodes, d) => nodes.some(node => node.getAttribute('d') === d), originalPath));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => !globalThis.document.querySelector('[data-gift-effect="db-ambience"]'));
    assert.deepEqual(errors, []);
    console.log('PASS SQL-only new element/vector/preset/keyframes/surface/particles/template, Admin CRUD/CAS/history, editor save/reload, frozen public player after DB edit/disable, reduced motion');
    return { sqlOnlyDefinitions: entries.length, adminHistory: true, frozenAfterLibraryChanges: true, browser: true };
  } finally { await context.close(); await admin.execute("UPDATE users SET role='sender' WHERE id=?", [userId]); }
}
