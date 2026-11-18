import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASIC_TEMPLATES, templatePreviewDocument } from '../../web/js/shared/canvas/index.js';

import { previewSvg } from '../../web/js/shared/canvas/cover-svg.js';
export { previewSvg };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function buildTemplatePreviews() {
  const directory = path.join(root, 'web/assets/basic-templates'); fs.mkdirSync(directory, { recursive: true });
  for (const id of Object.keys(BASIC_TEMPLATES)) fs.writeFileSync(path.join(directory, `${id}.svg`), previewSvg(templatePreviewDocument({ id })), 'utf8');
  console.log(`Built ${Object.keys(BASIC_TEMPLATES).length} editable-template cover previews.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildTemplatePreviews();
