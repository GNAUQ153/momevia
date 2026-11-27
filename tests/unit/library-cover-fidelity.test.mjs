import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildTemplatePreviews } from '../../scripts/build/template-previews.mjs';
import { BASIC_TEMPLATES } from '../../web/js/shared/canvas/basic-templates.js';
import { OPEN_ME_TEMPLATE_IDS } from '../../web/js/shared/canvas/open-me-templates.js';
import { builtinLibraryItems } from '../../src/modules/designs/library.seed.mjs';
import { CanvasLibraryService } from '../../src/modules/designs/library.service.mjs';
import { installLibrary, librarySnapshot } from '../../web/js/shared/canvas/library-state.js';
import { vectorParts } from '../../web/js/shared/canvas/artwork.js';
import { pinArtwork } from '../../web/js/shared/canvas/library-materialize.js';

test('DB cover images preserve birthday cake, both envelopes, graduation artwork and serif font in a release of the same revision', async t => {
  const rows = builtinLibraryItems(), before = librarySnapshot();
  const service = new CanvasLibraryService({ async execute() { return [rows.map(row => ({ ...row, sort_order: row.sortOrder }))]; } });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'momevia-cover-fidelity-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const birthday = rows.find(row => row.kind === 'template' && row.id === 'birthday-radiance');
  birthday.revision += 1;
  birthday.definition.title.en = 'A birthday just for you';
  birthday.definition.documents.en.elements.find(layer => layer.id === 'cover-title').props.text = 'Happy day, Alex!';
  buildTemplatePreviews({ library: rows, directory });
  try {
    for (const id of ['birthday-radiance','hai-phong-bi','proud-of-you']) for (const locale of ['vi','en']) {
      const svg = await service.cover(id, locale), source = rows.find(r => r.kind === 'template' && r.id === id).definition.documents[locale];
      const cover = source.scenes.find(s => s.id === source.entrySceneId);
      const images = source.elements.filter(e => e.type === 'image' && e.props.assetId && cover.elementIds.includes(e.id));
      assert.equal((svg.match(/<image\b/g) || []).length, images.length, `${id}/${locale} must keep every photographic layer`);
      assert.match(svg, /data:image\/webp;base64,/, `${id}/${locale} must embed actual media`);
      if (source.elements.some(e => cover.elementIds.includes(e.id) && e.props.fontToken === 'serif')) assert.match(svg, /data:font\/woff2;base64,/);
      const original = fs.readFileSync(path.join(directory, locale === 'en' ? 'en' : '', id + '.svg'), 'utf8');
      assert.equal(svg, original, `${id}/${locale} must render the original complete poster`);
      for (const variant of ['catalog','seasonal']) {
        const short = await service.cover(id,locale,variant);
        assert.equal(short, fs.readFileSync(path.join(directory,locale === 'en' ? 'en' : '',id+'-'+variant+'.svg'),'utf8'));
        assert.equal((short.match(/<image\b/g)||[]).length, images.length, 'retain owned photographic choices');
      }
      if (id === birthday.id && locale === 'en') {
        assert.match(svg, /aria-label="[^"]*A birthday just for you/);
        const headline = [...svg.matchAll(/<tspan [^>]+>([^<]*)<\/tspan>/g)].map(match => match[1]).join(' ');
        assert.ok(headline.includes('Happy day, Alex!'), 'retain the selected revision’s full headline across wrapped lines');
      }
    }
  } finally { installLibrary(before); }
});

test('all shipped cover renditions identify their locale, owning release bytes and intended viewport', () => {
  const root = new URL('../../web/assets/basic-templates/', import.meta.url);
  const release = JSON.parse(fs.readFileSync(new URL('cover-release.json', root)));
  const ids = [...Object.keys(BASIC_TEMPLATES), ...OPEN_ME_TEMPLATE_IDS];
  assert.deepEqual(Object.keys(release.templates).sort(), [...ids].sort());
  for (const id of ids) for (const locale of ['vi','en']) for (const [variant,height] of [['portrait',844],['catalog',330],['seasonal',466]]) {
    const suffix = variant === 'portrait' ? '' : '-' + variant;
    const svg = fs.readFileSync(new URL((locale === 'en' ? 'en/' : '') + id + suffix + '.svg', root), 'utf8');
    assert.equal(createHash('sha256').update(svg).digest('hex'), release.templates[id].covers[locale][variant]);
    assert.ok(svg.includes('viewBox="0 0 390 ' + height + '"'), id + '/' + variant);
    assert.ok(svg.includes('lang="' + locale + '"'));
    assert.match(svg, locale === 'en' ? /aria-label="[^"]*[A-Za-z][^"]+"/ : /aria-label="[^"]+"/);
    assert.doesNotMatch(svg, /aria-label="Bản xem trước mẫu quà Momevia"/);
  }
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
