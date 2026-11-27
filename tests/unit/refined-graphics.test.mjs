import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { NATURAL_MEDIA_IDS } from '../../web/js/shared/canvas/natural-media.js';
import { REFINED_MEDIA, REFINED_MEDIA_IDS } from '../../web/js/shared/canvas/refined-media.js';
import { EVENT_MEDIA } from '../../web/js/shared/canvas/event-media.js';
import { builtinLibraryItems } from '../../src/modules/designs/library.seed.mjs';

test('refined media retain legacy hashes and safe transparent margins at every rendition size', async () => {
  for (const id of ['event-natural-element-open-kit-cloud-2f1bbabd6c09', 'event-natural-element-open-vintage-flower-f64025de5762']) {
    const media = EVENT_MEDIA[id];
    const bytes = fs.readFileSync(new URL('../../web/assets/event-cards/' + media.file, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), media.sha256);
  }
  for (const [key, id] of Object.entries(REFINED_MEDIA_IDS)) {
    assert.equal(NATURAL_MEDIA_IDS[key], id);
    for (const item of [REFINED_MEDIA[id], REFINED_MEDIA[id].cover, REFINED_MEDIA[id].thumbnail]) {
      const bytes = fs.readFileSync(new URL('../../web/assets/event-cards/' + item.file, import.meta.url));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256);
      const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.equal(info.width, item.width);
      assert.equal(info.height, item.height);
      let painted = 0;
      let edgeInk = 0;
      for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
        const alpha = data[(y * info.width + x) * 4 + 3];
        if (alpha >= 32) painted++;
        if ((x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) && alpha >= 32) edgeInk++;
      }
      assert(painted > info.width * info.height * 0.03, item.file);
      assert.equal(edgeInk, 0, item.file);
    }
  }
});

test('cloud shadow can be disabled independently of its contiguous source image', () => {
  const row = builtinLibraryItems().find(item => item.kind === 'element' && item.id === 'natural-open-kit-cloud');
  assert.equal(row.definition.elements.length, 1);
  const model = row.definition.elements[0];
  assert.equal(model.props.assetId, REFINED_MEDIA_IDS['element-open-kit-cloud']);
  assert.equal(model.effects.surface.id, 'paper-shadow-v2');
  delete model.effects.surface;
  assert.equal(model.props.assetId, REFINED_MEDIA_IDS['element-open-kit-cloud']);
});
