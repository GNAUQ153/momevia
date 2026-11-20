import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stickerArt, vectorParts } from '../../web/js/shared/canvas/artwork.js';
import { STICKERS } from '../../web/js/shared/canvas/registry.js';

// Bảo đảm icon legacy không chuyển thành emoji trên hệ điều hành khác nhau.
test('Các sticker legacy được dựng từ đường vẽ vector nội bộ', () => {
  for (const stickerId of ['balloon', 'cake', 'gift']) {
    assert(Array.isArray(stickerArt[stickerId]));
    assert.equal(STICKERS[stickerId], '');
    const shape = vectorParts({ type: 'sticker', props: { stickerId, color: '#AA66BB' } });
    assert(shape.some(part => typeof part.d === 'string' && part.d.length > 12));
  }
});

test('Mã frontend không dùng glyph emoji cho UI', () => {
  for (const name of ['registry', 'interactions']) {
    const code = readFileSync(new URL(`../../web/js/shared/canvas/${name}.js`, import.meta.url), 'utf8');
    assert.doesNotMatch(code, /[\u{1F300}-\u{1FAFF}]/u);
  }
  const renderer = readFileSync(new URL('../../web/js/features/gift-runtime/renderer.js', import.meta.url), 'utf8');
  assert.doesNotMatch(renderer, /[\u{1F300}-\u{1FAFF}]/u);
  assert.match(renderer, /gift-control-illustration/);
});
