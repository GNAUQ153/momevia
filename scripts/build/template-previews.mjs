import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { BASIC_TEMPLATES } from '../../web/js/shared/canvas/basic-templates.js';
import { OPEN_ME_TEMPLATE_IDS } from '../../web/js/shared/canvas/open-me-templates.js';
import { installLibrary, librarySnapshot } from '../../web/js/shared/canvas/library-state.js';
import { builtinCoverResources } from '../../src/modules/designs/builtin-media.mjs';
import { builtinLibraryItems } from '../../src/modules/designs/library.seed.mjs';
import { renderTemplateCover } from '../../src/modules/designs/template-cover.mjs';
export { previewSvg } from '../../web/js/shared/canvas/cover-svg.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const digest = value => createHash('sha256').update(value).digest('hex');
export function readCoverLibrary(file) {
  return file ? JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) : undefined;
}

export function buildTemplatePreviews({ library, directory = path.join(root, 'web/assets/basic-templates') } = {}) {
  const selected = library === undefined ? builtinLibraryItems() : (Array.isArray(library) ? library : library?.items);
  if (!Array.isArray(selected)) throw new TypeError('Expected a canvas-library export with an items array.');
  const ids = [...Object.keys(BASIC_TEMPLATES), ...OPEN_ME_TEMPLATE_IDS];
  const resources = builtinCoverResources();
  const manifest = { version: 1, source: library === undefined ? 'builtin-seed' : 'library-export', templates: {} };
  for (const id of ids) {
    const row = selected.find(item => item.kind === 'template' && item.id === id && item.status === 'active');
    manifest.templates[id] = { revision: row?.revision ?? null, covers: { vi: {}, en: {} } };
  }
  const previous = librarySnapshot();
  try {
    installLibrary({ items: selected });
    for (const locale of ['vi', 'en']) {
      const target = locale === 'vi' ? directory : path.join(directory, 'en');
      fs.mkdirSync(target, { recursive: true });
      for (const id of ids) for (const variant of ['portrait', 'catalog', 'seasonal']) {
        const filename = variant === 'portrait' ? id + '.svg' : id + '-' + variant + '.svg';
        const svg = renderTemplateCover(id, locale, variant, resources);
        fs.writeFileSync(path.join(target, filename), svg, 'utf8');
        manifest.templates[id].covers[locale][variant] = digest(svg);
      }
    }
  } finally {
    installLibrary(previous);
  }
  fs.writeFileSync(path.join(directory, 'cover-release.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`Built ${ids.length} editable-template cover previews.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { library: { type: 'string' }, output: { type: 'string' } } });
  buildTemplatePreviews({ library: readCoverLibrary(values.library), directory: values.output });
}
