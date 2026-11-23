import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID,createHash } from 'node:crypto';
import { templates, addedSystemTemplates } from '../../src/modules/catalog/seed.mjs';
import { BASIC_TEMPLATES, createDocument, createBasicTemplate, templatePreviewDocument, validateDocument, canonicalStringify, duplicateDocument, insertPhotoFrame, LIMITS } from '../../web/js/shared/canvas/index.js';
import { materializeTemplateStart } from '../../web/js/features/canvas-editor/template-start.js';
import { previewSvg } from '../../scripts/build/template-previews.mjs';
import { builtinCoverImages } from '../../src/modules/designs/builtin-media.mjs';
import {EVENT_MEDIA,NATURAL_ARTWORK_LABEL} from '../../web/js/shared/canvas/event-media.js';
const personalPhotos=doc=>doc.elements.filter(e=>e.type==='image'&&!(e.accessibility.decorative&&e.accessibility.label===NATURAL_ARTWORK_LABEL));

const fill = d => { for (const [key, value] of Object.entries({ recipientName: 'Nguyễn Mai', senderName: 'Trần An', message: 'Chúc một tuổi mới bình an và thật nhiều niềm vui.' })) d.bindings[key].value = value; return d; };
function contrast(a, b) {
  const luminance = value => { const rgb = value.match(/[a-f\d]{2}/gi).map(s => parseInt(s, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722; };
  const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}

test('all 12 original shared IDs retain distinct editable compositions and publish budgets', () => {
  const original = structuredClone(templates), signatures = new Set();
  assert.equal(Object.keys(BASIC_TEMPLATES).length, 28);
  const addedIds = new Set(addedSystemTemplates.map(template => template.id));
  for (const template of templates.filter(item => !addedIds.has(item.id))) {
    const d = createDocument({ template }); assert.equal(d.scenes.length, 3); assert(d.elements.length >= 18);
    assert.deepEqual(d, createDocument({ template })); assert.deepEqual(d, createBasicTemplate(template));
    assert(d.elements.some(e => e.type === 'reply'));
    const cover=d.scenes.find(s=>s.id===d.entrySceneId);
    assert(d.elements.some(e=>cover.elementIds.includes(e.id)&&e.accessibility.label&&e.actions?.some(a=>a.type==='goToScene'&&d.scenes.some(s=>s.id===a.targetSceneId))), 'a named real control opens a valid scene');
    assert.deepEqual(new Set(d.elements.filter(e => e.props.textBinding).map(e => e.props.textBinding)), new Set(['recipientName', 'senderName', 'message']));
    assert(d.assets.every(ref=>Object.hasOwn(EVENT_MEDIA,ref.assetId)&&!EVENT_MEDIA[ref.assetId].previewOnly),'every default asset is immutable and distributable without a personal upload');
    assert.equal(personalPhotos(d).length,0,'a personal photo is never required');
    assert(new TextEncoder().encode(JSON.stringify(d)).length < LIMITS.documentBytes);
    assert.deepEqual(validateDocument(fill(structuredClone(d)), { mode: 'publish' }), fill(structuredClone(d)));
    const duplicate = duplicateDocument(d); assert.notEqual(duplicate.entrySceneId, d.entrySceneId); assert.doesNotThrow(() => validateDocument(duplicate));
    signatures.add(canonicalStringify(d));
  }
  assert.equal(signatures.size, 12); assert.deepEqual(templates, original);
  assert.equal(createBasicTemplate({ id: 'creator-metadata-only' }), null);
  assert.equal(createDocument({ template: { id: 'creator-metadata-only', theme: 'sky' } }).scenes.length, 3, 'legacy custom template fallback stays supported');
});

test('free memory cover and two-envelope branching validate independently', () => {
  const [memory, envelopes] = ['mot-ky-niem', 'hai-phong-bi'].map(id => {
    const template = templates.find(item => item.id === id);
    assert.equal(template.price, 0);
    return validateDocument(fill(createDocument({ template })), { mode: 'publish' });
  });
  assert.equal(personalPhotos(memory).length,0);assert(memory.assets.every(ref=>Object.hasOwn(EVENT_MEDIA,ref.assetId)&&!EVENT_MEDIA[ref.assetId].previewOnly));
  assert(memory.elements.some(item => item.id === 'photo-caption'));
  const cover = envelopes.scenes.find(scene => scene.id === envelopes.entrySceneId);
  const forward = envelopes.elements.filter(item => cover.elementIds.includes(item.id) && ['open-memory','open-wish'].includes(item.id));
  assert.deepEqual(forward.map(item => item.props.label), ['Một kỷ niệm', 'Một lời chúc']);
  assert.equal(new Set(forward.map(item => item.actions[0].targetSceneId)).size, 2);
  for (const envelope of forward) {
    const destination = envelopes.scenes.find(scene => scene.id === envelope.actions[0].targetSceneId);
    assert(envelopes.elements.some(item => destination.elementIds.includes(item.id)
      && item.actions?.some(action => action.targetSceneId === cover.id)));
  }
});

test('body/button contrast stays readable on the scene background, including long-message reflow', () => {
  for (const [id, p] of Object.entries(BASIC_TEMPLATES)) {
    const d = templatePreviewDocument({ id });
    assert(contrast(p.ink, p.bg) >= 4.5, `${id} cover contrast`);
    assert(contrast('#FFFFFF', p.button) >= 4.5, `${id} button contrast`);
    const scene = d.scenes[1] || d.scenes[0], message = d.elements.find(e => e.id === 'text-message') || d.elements.find(e => e.id === 'cover-title');
    assert(contrast(message.props.color, scene.background.color) >= 4.5, `${id} message remains readable beyond decoration bounds`);
    for (const node of d.elements.filter(e => e.type !== 'shape' && e.type !== 'line' && e.type !== 'sticker' && !(e.type==='image'&&e.accessibility.decorative&&e.accessibility.label===NATURAL_ARTWORK_LABEL))) {
      assert(node.layout.x >= 0 && node.layout.y >= 0 && node.layout.x + node.layout.width <= 390 && node.layout.y + node.layout.height <= 844, `${id} interactive/content bounds ${node.id}`);
    }
  }
});

test('metadata-only published templates preview the same layout as their drafts', () => {
  const template = { id: 'creator-metadata-only', theme: 'sky' };
  const draft = createDocument({ template });
  const preview = templatePreviewDocument(template);
  assert.deepEqual(preview.scenes, draft.scenes);
  assert.deepEqual(preview.elements, draft.elements);
  assert(Object.values(preview.bindings).every(binding => binding.value.trim()));
  assert(Object.values(draft.bindings).every(binding => binding.value === ''));
});

test('an optional polaroid photo keeps frame layout, crop, reading IDs and caption stacking when replaced', () => {
  const original = templatePreviewDocument({ id: 'polaroid' }); const frame = original.elements.find(e => e.id === 'photo-window');
  const first = insertPhotoFrame(original, 'asset-one'); let photo = first.elements.find(e => e.id === 'photo-window-image');
  assert.deepEqual(photo.layout, frame.layout); assert.equal(personalPhotos(original).length,0);assert.equal(first.assets.length,original.assets.length+1);
  const ids = first.scenes.find(s=>s.elementIds.includes(frame.id)).elementIds; assert(ids.indexOf(photo.id) > ids.indexOf(frame.id)); assert(ids.indexOf(photo.id) < ids.indexOf('photo-caption'));
  photo.props.focalPoint = { x: .2, y: .8 }; const second = insertPhotoFrame(first, 'asset-two'); photo = second.elements.find(e => e.id === 'photo-window-image');
  assert.deepEqual(photo.props.focalPoint, { x: .2, y: .8 }); assert.equal(photo.props.assetId, 'asset-two'); assert.equal(personalPhotos(second).length, 1);
  assert.doesNotThrow(() => validateDocument(second, { mode: 'publish' }));
  const copied = duplicateDocument(second), copiedFrame = copied.elements.find(e => e.name === 'Khung ảnh kỷ niệm'), originalPhotoId = personalPhotos(copied)[0].id;
  const replacedCopy = insertPhotoFrame(copied, 'asset-three', copiedFrame.id);
  assert.equal(personalPhotos(replacedCopy).length, 1); assert.equal(personalPhotos(replacedCopy)[0].id, originalPhotoId); assert.deepEqual(personalPhotos(replacedCopy)[0].props.focalPoint, { x: .2, y: .8 });
  const emptyCopy = duplicateDocument(original), frameCopy = emptyCopy.elements.find(e => e.name === 'Khung ảnh kỷ niệm');
  const filledCopy = insertPhotoFrame(emptyCopy, 'asset-new-copy', frameCopy.id), layerIds = filledCopy.scenes.find(s=>s.elementIds.includes(frameCopy.id)).elementIds;
  assert(layerIds.indexOf(`${frameCopy.id}-image`) > layerIds.indexOf(frameCopy.id));
  assert(layerIds.indexOf(`${frameCopy.id}-image`) < layerIds.indexOf(filledCopy.elements.find(e => e.name === 'Chú thích ảnh').id));
  assert.throws(() => insertPhotoFrame(createDocument(), 'asset-one'), /Khung ảnh/);
});

test('managed cover SVGs match validated layouts and escape text without scripts/remote media', () => {
  const images = builtinCoverImages();
  const serifWoff2 = fs.readFileSync(new URL('../../web/assets/fonts/lora-cover.woff2', import.meta.url)).toString('base64');
  const fontRule = `<style>@font-face{font-family:"Momevia Cover";src:url(data:font/woff2;base64,${serifWoff2}) format("woff2")}</style>`;
  for (const id of Object.keys(BASIC_TEMPLATES)) {
    const doc = templatePreviewDocument({ id });
    const defaultSvg = previewSvg(doc);
    const svg = previewSvg(doc, undefined, images, { serifWoff2 });
    assert.equal(fs.readFileSync(new URL(`../../web/assets/basic-templates/${id}.svg`, import.meta.url), 'utf8'), svg);
    assert.equal(svg.includes(fontRule), defaultSvg.includes('Georgia,serif'));
    assert.doesNotMatch(svg.replace(fontRule, ''), /<style|url\(["']?(?:https?:|data:)/i);
    assert.doesNotMatch(defaultSvg, /Momevia Cover/);
    assert.doesNotMatch(svg.replace(/href="data:image\/webp;base64,[A-Za-z0-9+/=]+"/g, ''), /<script|foreignObject|onload=|href=|style=/i);
    assert.equal(/viewBox="0 0 390 844"/.test(svg), true);
  }
  const doc = templatePreviewDocument({ id: 'love-letter' }); doc.bindings.recipientName.value = '<script>alert(1)</script>';
  const svg = previewSvg(doc); assert.doesNotMatch(svg, /<script>/); assert(svg.includes('&lt;script&gt;'));
  doc.elements[0].props.color = '#fff" onload="alert(1)'; assert.throws(() => previewSvg(doc), { status: 422 });
});

const initializerAliases=new Map();
const initializerMedia={fetchMedia:async url=>new Response(fs.readFileSync(new URL('../../web'+url,import.meta.url))),uploadMedia:async blob=>{const sha=createHash('sha256').update(Buffer.from(await blob.arrayBuffer())).digest('hex'),source=Object.keys(EVENT_MEDIA).find(id=>EVENT_MEDIA[id].sha256===sha),id='owned-'+sha.slice(0,16);assert(source);initializerAliases.set(id,source);return{id,status:'ready'};}};
function originalInitializerAssets(document){const copy=structuredClone(document);for(const ref of copy.assets)ref.assetId=initializerAliases.get(ref.assetId)||ref.assetId;for(const e of copy.elements)if(e.type==='image')e.props.assetId=initializerAliases.get(e.props.assetId)||e.props.assetId;return copy;}
function legacyDesign() {
  return { id: randomUUID(), title: 'Nháp mới', source: { kind: 'template', templateId: 'sunny-wishes', templateVersionId: randomUUID() }, policy: { kind: 'sender-basic', lockedElements: {} }, revision: 1, document: createDocument({ presetId: 'envelope-basic' }), documentHash: 'server-original-hash' };
}
test('a refreshed library initializes a legacy server draft through owner CAS without changing source/policy', async () => {
  const original = legacyDesign(); let stored = structuredClone(original); const calls = [];
  const request = async (url, body) => {
    calls.push({ url, body: structuredClone(body) });
    if (body) { assert.equal(body.expectedRevision, 1); assert.equal(stored.revision, 1); assert.deepEqual(Object.keys(body).sort(), ['document', 'expectedRevision', 'mutationId', 'title']); validateDocument(body.document); stored = { ...stored, document: body.document, revision: 2 }; return { savedRevision: 2, mutationId: body.mutationId }; }
    return { design: structuredClone(stored) };
  };
  const loaded = await materializeTemplateStart(original, { template: { id: 'sunny-wishes' }, createMutationId: randomUUID(), request,...initializerMedia });
  assert.equal(loaded.revision, 2); assert.deepEqual(originalInitializerAssets(loaded.document),createBasicTemplate({id:'sunny-wishes'}));assert(loaded.document.assets.every(ref=>ref.assetId.startsWith('owned-')));
  assert.deepEqual(loaded.source, original.source); assert.deepEqual(loaded.policy, original.policy); assert.equal(calls.length, 2);
});

test('template initialization preserves saved drafts, personal content, media and locked policy', async () => {
  const cases = [d => { d.revision = 2; }, d => { d.document.bindings.message.value = 'Nội dung riêng'; }, d => { d.document.assets.push({ assetId: 'already-uploaded', kind: 'image' }); }, d => { d.policy.lockedElements.x = {}; }, d => { d.source.kind = 'blank'; }, d => { d.source.templateId = 'other-template'; }];
  for (const mutate of cases) {
    const d = legacyDesign(); mutate(d); const before = structuredClone(d);
    assert.deepEqual(await materializeTemplateStart(d, { template: { id: 'sunny-wishes' }, createMutationId: randomUUID(), request() { assert.fail('must not overwrite existing/locked/private draft'); } }), before);
  }
  const d = legacyDesign(); d.document = createBasicTemplate({ id: 'sunny-wishes' });
  assert.equal(await materializeTemplateStart(d, { template: { id: 'sunny-wishes' }, createMutationId: randomUUID(), request() { assert.fail('current server preset needs no second save'); } }), d);
});

test('lost initialization ACK retries identical mutation/body and reloads the latest revision', async () => {
  const d = legacyDesign(), key = randomUUID(), writes = []; let stored = structuredClone(d);
  const request = async (_url, body) => {
    if (!body) return { design: stored };
    writes.push(structuredClone(body));
    if (writes.length === 1) { stored = { ...stored, revision: 2, document: body.document }; throw new Error('lost ACK after commit'); }
    assert.deepEqual(writes[1], writes[0]); stored = { ...stored, revision: 3, title: 'Bản mới ở tab khác' }; return { savedRevision: 2, replayed: true };
  };
  await assert.rejects(materializeTemplateStart(d, { template: { id: 'sunny-wishes' }, createMutationId: key, request,...initializerMedia }), /lost ACK/);
  const recovered = await materializeTemplateStart(d, { template: { id: 'sunny-wishes' }, createMutationId: key, request,...initializerMedia }); assert.equal(recovered.revision, 3); assert.equal(recovered.title, 'Bản mới ở tab khác');
});
