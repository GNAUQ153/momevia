import test from 'node:test';
import assert from 'node:assert/strict';
import { setText } from '../../web/js/core/i18n.js';
import { updateElementCopy } from '../../web/js/features/gift-runtime/renderer.js';

test('refreshing authored captions and interactive copy uses the same NFC text as the initial render', () => {
  const value = 'Ở Huế, gửi Nguyễn một lời chúc.';
  const raw = value.normalize('NFD');
  const fields = new Map();
  function field(selector) {
    if (!fields.has(selector)) fields.set(selector, { textContent: '' });
    return fields.get(selector);
  }
  const fold = { querySelector: field };
  const root = { querySelector: field, querySelectorAll: () => [fold], dataset: { albumIndex: 0 } };
  const check = (model, selectors) => {
    const snapshot = structuredClone(model);
    for (const selector of selectors) setText(field(selector), raw);
    for (const selector of selectors) assert.equal(field(selector).textContent, value);
    for (const selector of selectors) field(selector).textContent = 'Earlier copy';
    updateElementCopy(root, model, {});
    for (const selector of selectors) assert.equal(field(selector).textContent, value);
    assert.deepEqual(model, snapshot);
  };
  check({type:'image',props:{caption:raw}}, ['.gift-runtime-photo-caption']);
  check({type:'interaction',props:{kind:'foldout-letter',entries:[{heading:raw,body:raw}]}}, ['summary','p']);
  check({type:'interaction',props:{kind:'light-a-candle',entries:[{heading:raw,body:raw}]}}, ['.gift-interaction-button','.gift-interaction-copy']);
  check({type:'interaction',props:{kind:'event-countdown',optional:true,entries:[{heading:raw,body:raw}]}}, ['h3','.gift-interaction-copy']);
  check({type:'interaction',props:{kind:'swipe-album',optional:true,photos:[{assetId:'photo',caption:raw}]}}, ['figcaption']);
});
