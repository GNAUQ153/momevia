import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { templates } from '../../src/modules/catalog/seed.mjs';
import { publicTemplate, CatalogService } from '../../src/modules/catalog/catalog.service.mjs';
import { eventMetadata } from '../../src/modules/catalog/event-metadata.mjs';
import { createDocument, templatePreviewDocument, canonicalStringify, validateDocument, duplicateDocument } from '../../web/js/shared/canvas/index.js';
import { requiresCanvasV2 } from '../../web/js/shared/canvas/schema.js';
import { serverText } from '../../src/shared/locale.mjs';
import { REFRESH_21 } from '../../web/js/shared/canvas/refresh-21-config.js';
const before = JSON.parse(fs.readFileSync(new URL('../fixtures/event-cards-before.json', import.meta.url)));
const ids = Object.keys(before.documents);

test('catalog metadata remains unchanged; presets outside the 21-item refresh retain approved hashes', () => {
  for (const old of before.templates.filter(t => !ids.includes(t.id))) {
    const { documentHash, ...metadata } = old;
    const template = templates.find(t => t.id === old.id);
    assert.deepEqual(template, metadata);
    if(!REFRESH_21[old.id]){
      const hash = createHash('sha256').update(canonicalStringify(createDocument({ template }))).digest('hex');
      assert.equal(hash, documentHash, old.id);
    }
  }
});

test('expanded event cards have 5/6 V2 scenes, private photo slots, both optional clocks and bilingual preview copy', () => {
  for (const id of ids) for (const locale of ['vi', 'en']) {
    const localize = key => serverText(locale, key);
    const draft = createDocument({ template: { id }, localize });
    assert.equal(draft.schemaVersion, 2); assert.equal(requiresCanvasV2(draft), true);
    assert.equal(draft.scenes.length, id === 'hai-phong-bi' ? 6 : 5); assert.equal(draft.assets.length, id === 'hai-phong-bi' ? 3 : 1);
    const album = draft.elements.find(e => e.id === 'event-album');
    assert.equal(publicTemplate(templates.find(t=>t.id===id)).personalization.photoFrames,3,'Catalog photo filter exposes all three upload slots');
    assert.equal(album.props.photos.length, 3); assert(album.props.photos.every(p => p.assetId === null));
    assert.equal(album.props.autoplay, true); assert.equal(album.props.optional, true);
    assert.deepEqual(draft.elements.filter(e => e.props.kind === 'event-countdown').map(e => [e.props.clockMode, e.props.eventAt]), [['countdown', null], ['elapsed', null]]);
    assert(draft.elements.some(e => e.type === 'image' && e.accessibility.decorative));
    assert(Object.values(draft.bindings).every(b => b.value === ''));
    const filled = structuredClone(draft);
    for (const b of Object.values(filled.bindings)) b.value = 'Nội dung riêng';
    assert.doesNotThrow(() => validateDocument(filled, { mode: 'publish' }), 'photos and dates are truly optional');
    const preview = templatePreviewDocument({ id }, localize);
    assert.equal(preview.bindings.message.value, localize(`templates.${id}.previewMessage`));
    assert.doesNotThrow(() => validateDocument(preview, { mode: 'publish' }));
    assert.doesNotThrow(() => validateDocument(duplicateDocument(preview)));
    assert.notDeepEqual(draft, before.documents[id]);
    if (id === 'hai-phong-bi') {
      assert.equal(draft.elements.find(e => e.id === 'envelope-memory').props.text, '');
      assert.equal(preview.elements.find(e => e.id === 'envelope-memory').props.text, localize('templates.hai-phong-bi.previewMemory'));
      const choices = draft.elements.filter(e => ['open-memory','open-wish'].includes(e.id));
      assert.deepEqual(choices[0].layout, { ...choices[1].layout, y: choices[0].layout.y });
    }
  }
});

test('optional event extensions do not weaken older album/date requirements or accept malformed options', () => {
  const d = templatePreviewDocument({ id: 'birthday-radiance' });
  const album = d.elements.find(e => e.id === 'event-album');
  for (const p of album.props.photos) p.assetId = null;
  const strict = structuredClone(d);
  const a = strict.elements.find(e => e.id === 'event-album');
  delete a.props.optional; delete a.props.autoplay;
  assert.throws(() => validateDocument(strict, { mode: 'publish' }), e => e.code === 'INTERACTION_PHOTO_REQUIRED');
  const noDate = structuredClone(d);
  const clock = noDate.elements.find(e => e.id === 'event-countdown'); clock.props.eventAt = null; delete clock.props.optional;
  assert.throws(() => validateDocument(noDate, { mode: 'publish' }));
  for (const mutate of [x => { x.elements.find(e => e.id === 'event-album').props.autoplay = 'yes'; },
    x => { x.elements.find(e => e.id === 'event-elapsed').props.clockMode = 'anything'; },
    x => { x.elements.find(e => e.id === 'event-countdown').props.eventAt = 'not-a-date'; }]) {
    const invalid = structuredClone(d); mutate(invalid); assert.throws(() => validateDocument(invalid));
  }
});

test('old and new Catalog find all occasions in VI/EN; projection never mutates stored custom values', async () => {
  for (const records of [before.templates, templates]) {
    const service = new CatalogService({ all: async () => records }, {});
    for (const [id, vi, en] of [['birthday-radiance', 'sinh nhật', 'birthday'], ['hai-phong-bi', 'đám cưới', 'wedding'], ['proud-of-you', 'tốt nghiệp', 'graduation']])
      for (const [locale, q] of [['vi', vi], ['en', en]]) assert((await service.search({ q, locale })).some(t => t.id === id), `${id} ${locale}`);
  }
  for (const old of before.templates.filter(t => ids.includes(t.id))) {
    const original = structuredClone(old);
    const projected = publicTemplate(old);
    assert.equal(projected.price, old.price); assert.equal(projected.status, old.status);
    assert.equal(projected.systemOwned, true); assert.deepEqual(old, original);
    const custom = { ...old, title: 'Tựa riêng', subtitle: 'Mô tả riêng', category: 'Dịp riêng', price: 12345, status: 'rejected', featured: false, scenes: 7 };
    assert.deepEqual(eventMetadata(custom), custom);
    assert.deepEqual(eventMetadata({ ...old, creatorId: 'another-owner' }), { ...old, creatorId: 'another-owner' });
    assert.equal(publicTemplate({ ...old, creatorId: 'another-owner' }).systemOwned, undefined);
  }
});
