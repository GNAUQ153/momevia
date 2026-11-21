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
const before = JSON.parse(fs.readFileSync(new URL('../fixtures/event-cards-before.json', import.meta.url)));
const ids = Object.keys(before.documents);

test('21 other presets and metadata stay unchanged from approved baseline', () => {
  for (const old of before.templates.filter(t => !ids.includes(t.id))) {
    const { documentHash, ...metadata } = old;
    const template = templates.find(t => t.id === old.id);
    assert.deepEqual(template, metadata);
    const hash = createHash('sha256').update(canonicalStringify(createDocument({ template }))).digest('hex');
    assert.equal(hash, documentHash, old.id);
  }
});

test('three cards are V1, with clean real bindings and occasion-specific preview copy in both locales', () => {
  for (const id of ids) for (const locale of ['vi', 'en']) {
    const localize = key => serverText(locale, key);
    const draft = createDocument({ template: { id }, localize });
    assert.equal(draft.schemaVersion, 1); assert.equal(requiresCanvasV2(draft), false);
    assert.equal(draft.scenes.length, 3); assert.equal(draft.assets.length, 1);
    assert(draft.elements.some(e => e.type === 'image' && e.accessibility.decorative));
    assert(Object.values(draft.bindings).every(b => b.value === ''));
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
    const custom = { ...old, title: 'Tựa riêng', subtitle: 'Mô tả riêng', category: 'Dịp riêng', price: 12345, status: 'rejected', featured: false };
    assert.deepEqual(eventMetadata(custom), custom);
    assert.deepEqual(eventMetadata({ ...old, creatorId: 'another-owner' }), { ...old, creatorId: 'another-owner' });
    assert.equal(publicTemplate({ ...old, creatorId: 'another-owner' }).systemOwned, undefined);
  }
});
