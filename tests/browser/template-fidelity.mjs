import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { EVENT_MEDIA } from '../../web/js/shared/canvas/event-media.js';
import { photoSlots } from '../../web/js/shared/canvas/interactions.js';
import { publicDocument } from '../../web/js/shared/canvas/schema.js';

const ids = ['birthday-radiance','hai-phong-bi','proud-of-you'];
async function imageReady(locator) {
  locator = locator.first();
  await locator.waitFor();
  assert(await locator.evaluate(img => {
    if (img.complete) return img.naturalWidth > 0;
    return new Promise(resolve => {
      const timer = setTimeout(() => resolve(false), 5000);
      img.addEventListener('load', () => { clearTimeout(timer); resolve(img.naturalWidth > 0); }, { once: true });
      img.addEventListener('error', () => { clearTimeout(timer); resolve(false); }, { once: true });
    });
  }));
}
async function coverHasPhoto(img, document, model) {
  const coverage = await img.evaluate((image, { box, color }) => {
    const canvas = globalThis.document.createElement('canvas'); canvas.width = 390; canvas.height = 844;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0, 390, 844);
    const bytes = context.getImageData(...box).data, rgb = color.match(/\w\w/g).map(v => parseInt(v, 16));
    let different = 0; for (let i = 0; i < bytes.length; i += 4) if (rgb.some((v, j) => Math.abs(v - bytes[i + j]) > 35)) different++;
    return different / (bytes.length / 4);
  }, { box: ['x','y','width','height'].map(k => Math.round(model.layout[k])), color: document.scenes[0].background.color.slice(1) });
  assert(coverage > .04, `${model.id} actual cover pixels must contain artwork, not empty paper (${coverage})`);
  return coverage;
}
export async function runTemplateFidelity({ base, cookie, browser, request, artifacts }) {
  const rows = (await request('/api/designs/library')).value.library.items, report = { covers: [], createdTemplates: [], motion: [] };
  for (const locale of ['vi','en']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: locale === 'vi' ? 'vi-VN' : 'en-US', reducedMotion: 'no-preference' });
    await context.addInitScript(value => {
      localStorage.setItem('momevia-locale', value); globalThis.__templateEffects = [];
      const collect = n => { if (n.nodeType !== 1) return; if (n.dataset.giftEffect) globalThis.__templateEffects.push(n.dataset.giftEffect);
        for (const c of n.querySelectorAll('[data-gift-effect]')) globalThis.__templateEffects.push(c.dataset.giftEffect); };
      new globalThis.MutationObserver(records => { for (const r of records) { if (r.type === 'attributes') { if (r.oldValue) globalThis.__templateEffects.push(r.oldValue); collect(r.target); }
        else for (const n of r.addedNodes) collect(n); } }).observe(globalThis.document, { subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: ['data-gift-effect'] });
    }, locale);
    const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    try {
      for (const id of ids) {
        const document = rows.find(r => r.kind === 'template' && r.id === id).definition.documents[locale];
        const cover = document.scenes.find(s => s.id === document.entrySceneId), photos = document.elements.filter(e => cover.elementIds.includes(e.id) && e.type === 'image');
        const response = await fetch(`${base}/api/designs/library/templates/${id}/cover?locale=${locale}`), svg = await response.text();
        assert.equal(response.status, 200); assert.equal((svg.match(/<image\b/g) || []).length, photos.length); assert.match(svg, /data:image\/webp;base64,/);
        await page.goto(`${base}/template/${id}`);
        const image = page.locator(`img[src*="/library/templates/${id}/cover"]`).first(); await imageReady(image);
        const pixels = []; for (const photo of photos) pixels.push(await coverHasPhoto(image, document, photo));
        await page.locator('[data-template-preview]').first().click();
        const dialog = page.locator('.template-preview-dialog'); await dialog.locator('[data-runtime-element]').first().waitFor();
        for (const photo of photos) await imageReady(dialog.locator(`[data-runtime-element="${photo.id}"] img`));
        const principal = photos[0];
        await page.waitForFunction(effect => globalThis.__templateEffects.includes(effect), principal.effects.entrance.id);
        await page.waitForFunction(effect => globalThis.__templateEffects.includes(effect), principal.effects.emphasis.id);
        const atmosphere = Object.entries(cover.effects.celebrations).find(([, v]) => v.enabled)?.[0];
        await page.waitForFunction(effect => globalThis.__templateEffects.includes(effect), atmosphere);
        await page.waitForFunction(modelId => !globalThis.document.querySelector(`.template-preview-dialog [data-runtime-element="${modelId}"][data-gift-effect]`), principal.id);
        if (artifacts) { fs.mkdirSync(artifacts, { recursive: true }); await dialog.screenshot({ path: path.join(artifacts, `${id}-${locale}-preview.png`) }); }
        const opener = document.elements.find(e => cover.elementIds.includes(e.id) && e.actions?.[0]?.targetSceneId);
        await dialog.locator(`[data-runtime-element="${opener.id}"]`).click();
        await page.waitForFunction(effect => globalThis.__templateEffects.includes(effect), opener.effects.reaction.id);
        const next = document.scenes.find(s => s.id === opener.actions[0].targetSceneId);
        await page.waitForFunction(effect => globalThis.__templateEffects.includes(effect), next.effects.transition.id);
        report.covers.push({ id, locale, photos: photos.length, photoPixelCoverage: pixels });
        report.motion.push({ id, locale, entrance: principal.effects.entrance.id, emphasis: principal.effects.emphasis.id, atmosphere, reaction: opener.effects.reaction.id, transition: next.effects.transition.id });
      }
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  for (const id of ids) {
    const definition = rows.find(r => r.kind === 'template' && r.id === id).definition.documents.vi;
    const created = (await request('/api/designs/designs', { source: { kind: 'template', templateId: id }, mutationId: randomUUID() })).value.design;
    const normalized = structuredClone(created.document), aliases = new Map();
    for (const asset of normalized.assets) {
      const media = await fetch(`${base}/api/designs/designs/${created.id}/assets/${asset.assetId}`, { headers: { cookie } }); assert.equal(media.status, 200);
      const hash = createHash('sha256').update(Buffer.from(await media.arrayBuffer())).digest('hex');
      const original = Object.entries(EVENT_MEDIA).find(([, spec]) => spec.sha256 === hash); assert(original); aliases.set(asset.assetId, original[0]); asset.assetId = original[0];
    }
    for (const model of normalized.elements) for (const photo of photoSlots(model)) if (photo.assetId) photo.assetId = aliases.get(photo.assetId) || photo.assetId;
    assert.deepEqual(normalized, definition, `${id}: every layout, element, artwork and effect must survive template creation`);
    const doc = structuredClone(created.document); for (const [key, value] of Object.entries({ recipientName: 'Người nhận kiểm tra', senderName: 'Nguồn mẫu', message: 'Kiểm tra ảnh và hiệu ứng của mẫu' })) doc.bindings[key].value = value;
    const ack = (await request(`/api/designs/designs/${created.id}/save`, { expectedRevision: created.revision, mutationId: randomUUID(), title: created.title, document: doc })).value;
    assert.deepEqual((await request(`/api/designs/designs/${created.id}`)).value.design.document, doc);
    const gift = (await request('/api/gifts/gifts/from-design', { designId: created.id, expectedRevision: ack.savedRevision, expectedDocumentHash: ack.documentHash, idempotencyKey: randomUUID() })).value.gift;
    assert.deepEqual((await request(`/api/gifts/gifts/${gift.slug}`)).value.gift.documentSnapshot, publicDocument(doc));
    const context = await browser.newContext({ reducedMotion: 'no-preference' }), page = await context.newPage();
    try {
      await page.goto(base + '/g/' + gift.slug);
      const coverIds = new Set(doc.scenes.find(s => s.id === doc.entrySceneId).elementIds);
      for (const photo of doc.elements.filter(e => e.type === 'image' && coverIds.has(e.id))) await imageReady(page.locator(`[data-runtime-element="${photo.id}"] img`));
    } finally { await context.close(); }
    report.createdTemplates.push({ id, elements: doc.elements.length, scenes: doc.scenes.length, elementEffects: doc.elements.filter(e => e.effects).length, sceneEffects: doc.scenes.filter(s => s.effects).length,
      privateAssetBytesVerified: aliases.size, fullDocumentRoundTrip: true, publicSnapshotRoundTrip: true });
  }
  if (artifacts) fs.writeFileSync(path.join(artifacts, 'template-fidelity.json'), JSON.stringify(report, null, 2));
  console.log('PASS stock template fidelity: 3 photographic covers VI/EN, real artwork pixels, live entrance/emphasis/atmosphere/reaction/transition, complete create/save/reload/public snapshots');
  return report;
}
