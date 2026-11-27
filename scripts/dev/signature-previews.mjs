// Xuất tài liệu và SVG nghiệm thu nội bộ; không gọi API hoặc ghi database.
import fs from 'node:fs';
import path from 'node:path';
import { signatureTemplateIds } from '../../web/js/shared/canvas/signature/templates.js';
import { createDocument, templatePreviewDocument } from '../../web/js/shared/canvas/presets.js';
import { previewSvg } from '../../web/js/shared/canvas/cover-svg.js';
import { serverText } from '../../src/shared/locale.mjs';

const root = path.resolve('dist/reports/signature-s4');
for (const locale of ['vi', 'en']) {
  const localize = (key, params) => serverText(locale, key, params);
  for (const id of signatureTemplateIds) {
    const output = path.join(root, locale, id);
    fs.mkdirSync(output, { recursive: true });
    const draft = createDocument({ template: { id }, localize });
    const preview = templatePreviewDocument({ id }, localize);
    fs.writeFileSync(path.join(output, 'draft.json'), JSON.stringify(draft, null, 2) + '\n');
    for (const scene of preview.scenes) {
      fs.writeFileSync(path.join(output, `${scene.id}.svg`), previewSvg(preview, scene.id), 'utf8');
    }
  }
}
console.log(`Signature S4: 12 tài liệu Canvas, 48 SVG nghiệm thu tại ${root}`);
