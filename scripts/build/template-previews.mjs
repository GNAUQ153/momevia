import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASIC_TEMPLATES, templatePreviewDocument } from '../../web/js/shared/canvas/index.js';
import { OPEN_ME_TEMPLATE_IDS } from '../../web/js/shared/canvas/open-me-templates.js';

import { previewSvg } from '../../web/js/shared/canvas/cover-svg.js';
import { serverText } from '../../src/shared/locale.mjs';
import { builtinCoverResources } from '../../src/modules/designs/builtin-media.mjs';
import { coverVariant } from '../../web/js/shared/canvas/refresh-21-config.js';
export { previewSvg };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function buildTemplatePreviews() {
  const directory = path.join(root, 'web/assets/basic-templates'); fs.mkdirSync(directory, { recursive: true });
  const english = path.join(directory, 'en');
  fs.mkdirSync(english, { recursive: true });
  const { images, serifWoff2 } = builtinCoverResources();
  const cover = doc => previewSvg(doc, undefined, images, { serifWoff2 });
  const ids = [...Object.keys(BASIC_TEMPLATES), ...OPEN_ME_TEMPLATE_IDS];
  for (const id of ids) {
    fs.writeFileSync(path.join(directory, `${id}.svg`), cover(templatePreviewDocument({ id })), 'utf8');
    fs.writeFileSync(path.join(english, `${id}.svg`),
      cover(templatePreviewDocument({ id }, (key, params) => serverText('en', key, params))), 'utf8');
    for (const variant of ['catalog','seasonal']) {
      fs.writeFileSync(path.join(directory, `${id}-${variant}.svg`), cover(coverVariant(templatePreviewDocument({id}),variant)), 'utf8');
      fs.writeFileSync(path.join(english, `${id}-${variant}.svg`), cover(coverVariant(templatePreviewDocument({id},(key,params)=>serverText('en',key,params)),variant)), 'utf8');
    }
  }
  console.log(`Built ${ids.length} editable-template cover previews.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildTemplatePreviews();
