import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASIC_TEMPLATES, templatePreviewDocument } from '../../web/js/shared/canvas/index.js';

import { previewSvg } from '../../web/js/shared/canvas/cover-svg.js';
import { serverText } from '../../src/shared/locale.mjs';
import { builtinCoverImages } from '../../src/modules/designs/builtin-media.mjs';
export { previewSvg };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function buildTemplatePreviews() {
  const directory = path.join(root, 'web/assets/basic-templates'); fs.mkdirSync(directory, { recursive: true });
  const english = path.join(directory, 'en');
  fs.mkdirSync(english, { recursive: true });
  const serifWoff2 = fs.readFileSync(path.join(root, 'web/assets/fonts/lora-cover.woff2')).toString('base64');
  const images = builtinCoverImages();
  const cover = doc => previewSvg(doc, undefined, images, { serifWoff2 });
  for (const id of Object.keys(BASIC_TEMPLATES)) {
    fs.writeFileSync(path.join(directory, `${id}.svg`), cover(templatePreviewDocument({ id })), 'utf8');
    fs.writeFileSync(path.join(english, `${id}.svg`),
      cover(templatePreviewDocument({ id }, (key, params) => serverText('en', key, params))), 'utf8');
  }
  console.log(`Built ${Object.keys(BASIC_TEMPLATES).length} editable-template cover previews.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildTemplatePreviews();
