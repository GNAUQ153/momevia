import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { builtinLibraryItems } from '../../src/modules/designs/library.seed.mjs';
import { CanvasLibraryService } from '../../src/modules/designs/library.service.mjs';
import { installLibrary, librarySnapshot } from '../../web/js/shared/canvas/library-state.js';
import { vectorParts } from '../../web/js/shared/canvas/artwork.js';
import { pinArtwork } from '../../web/js/shared/canvas/library-materialize.js';

test('DB cover images preserve birthday cake, both envelopes, graduation artwork and serif font', async () => {
  const rows = builtinLibraryItems(), before = librarySnapshot();
  const service = new CanvasLibraryService({ async execute() { return [rows.map(row => ({ ...row, sort_order: row.sortOrder }))]; } });
  try {
    for (const id of ['birthday-radiance','hai-phong-bi','proud-of-you']) for (const locale of ['vi','en']) {
      const svg = await service.cover(id, locale), source = rows.find(r => r.kind === 'template' && r.id === id).definition.documents[locale];
      const cover = source.scenes.find(s => s.id === source.entrySceneId);
      const images = source.elements.filter(e => e.type === 'image' && e.props.assetId && cover.elementIds.includes(e.id));
      assert.equal((svg.match(/<image\b/g) || []).length, images.length, `${id}/${locale} must keep every photographic layer`);
      assert.match(svg, /data:image\/webp;base64,/, `${id}/${locale} must embed actual media`);
      if (source.elements.some(e => cover.elementIds.includes(e.id) && e.props.fontToken === 'serif')) assert.match(svg, /data:font\/woff2;base64,/);
      const original = fs.readFileSync(new URL(`../../web/assets/basic-templates/${locale === 'en' ? 'en/' : ''}${id}.svg`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
      assert.equal(svg, original, `${id}/${locale} must render the original complete poster`);
    }
  } finally { installLibrary(before); }
});

test('frozen library paths preserve the original primitive stroke-scaling contract', () => {
  const rows = builtinLibraryItems(), before = librarySnapshot();
  try {
    installLibrary({ items: rows });
    for (const row of rows.filter(r => r.kind === 'element')) for (const model of row.definition.elements) {
      const original = vectorParts(model), frozen = vectorParts(pinArtwork([structuredClone(model)])[0]);
      if (['line','shape'].includes(model.type) && original) {
        assert.equal(frozen[0]['vector-effect'], original[0]['vector-effect'], row.id);
        assert.equal(frozen[0]['stroke-width'], original[0]['stroke-width'], row.id);
      }
    }
  } finally { installLibrary(before); }
});
