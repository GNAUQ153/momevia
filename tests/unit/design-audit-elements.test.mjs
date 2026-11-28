import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from '../../web/js/shared/canvas/registry.js';
import { createDocument } from '../../web/js/shared/canvas/presets.js';
import { validateDocument, duplicateDocument, publicDocument } from '../../web/js/shared/canvas/schema.js';
import { vectorParts } from '../../web/js/shared/canvas/artwork.js';
import { catalog, placeBlock, bounds } from '../../web/js/features/canvas-editor/library.js';

test('sticker detail color survives save, duplicate and public projection while omitted values preserve old artwork', () => {
  const document = createDocument({ presetId: 'blank' });
  const element = createElement('sticker', { props: { stickerId: 'flower-bicycle', color: '#AA5275', strokeColor: '#FFF7EE' } });
  document.elements = [element];
  document.scenes[0].elementIds = [element.id];
  document.schemaVersion = document.registryVersion = 2;
  validateDocument(document);
  assert(vectorParts(element).some(part => part.stroke === '#FFF7EE'));
  assert.equal(duplicateDocument(document).elements[0].props.strokeColor, '#FFF7EE');
  assert.equal(publicDocument(document).elements[0].props.strokeColor, '#FFF7EE');
  delete element.props.strokeColor;
  assert(vectorParts(element).some(part => part.stroke === '#514463'));
});

test('insertion margin shrinks for a near-full-width image without shifting ordinary images to the edge', () => {
  for (const width of [64, 300, 366, 384, 390]) {
    const models = [createElement('image', { layout: { x: 0, y: 0, width, height: 200 } })];
    placeBlock(models, { left: 0, top: 0, right: 390, bottom: 844 }, []);
    assert(bounds(models).left >= 0 && bounds(models).right <= 390, String(width));
    if (width === 384) assert.equal(models[0].layout.x, 3);
    if (width <= 366) assert(models[0].layout.x >= 12);
  }
});

test('single Canvix graphics belong to the graphics collection alongside individual botanical assets', () => {
  const group = catalog.find(collection => collection.items.some(item => item.id === 'natural-open-canvix-tulip'));
  assert.equal(group.label, 'Đồ họa tự nhiên');
  assert(group.items.some(item => item.id === 'natural-open-canvix-leaf'));
  assert(!catalog.find(collection => collection.label === 'Cụm thiệp tự nhiên').items.some(item => item.id.startsWith('natural-open-canvix-')));
});
