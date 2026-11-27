import test from 'node:test';
import assert from 'node:assert/strict';
import { stationeryFlow, paperSlices } from '../../web/js/shared/canvas/stationery-flow.js';
import { createDocument } from '../../web/js/shared/canvas/presets.js';
import { validateDocument, duplicateDocument, publicDocument, canonicalStringify } from '../../web/js/shared/canvas/schema.js';
import { layoutFromFabric } from '../../web/js/features/canvas-editor/fabric-adapter.js';

test('opt-in text expansion grows its enclosing paper and shifts the signature and following controls without rewriting source', () => {
  const document = createDocument({ template: { id: 'polaroid' } });
  const scene = document.scenes.find(s => s.id === 'scene-surprise');
  const before = canonicalStringify(document);
  const result = stationeryFlow(scene, document.elements, new Map([['text-message', 1000], ['message-to', 100]]));
  const original = id => document.elements.find(e => e.id === id).layout;
  assert(result.growth >= 814);
  const message = result.layouts.get('text-message'), sender = result.layouts.get('text-sender');
  assert(sender.y >= message.y + message.height);
  const paper = result.layouts.get('photo-strip-paper');
  assert(paper.y + paper.height > sender.y + sender.height);
  assert.equal(result.layouts.get('to-message').y, original('to-message').y + result.growth);
  assert(!result.layouts.has('photo-window-default'), 'the photograph above the letter keeps its original dimensions');
  assert.equal(canonicalStringify(document), before);
  const legacy = structuredClone(scene); delete legacy.flow;
  assert.equal(stationeryFlow(legacy, document.elements, new Map([['text-message', 1000]])).growth, 0);
});

test('stationery metadata survives duplication and public projection and rejects malformed values and V1 use', () => {
  const document = createDocument({ template: { id: 'love-letter' } });
  for (const value of Object.values(document.bindings)) value.value = 'Một lời gửi bạn';
  const scene = document.scenes.find(s => s.flow);
  assert.deepEqual(duplicateDocument(document).scenes.find(s => s.flow).flow, scene.flow);
  assert.deepEqual(publicDocument(document).scenes.find(s => s.flow).flow, scene.flow);
  for (const mutate of [s => { s.flow.version = 2; }, s => { s.flow.region.width = 0; }, s => { s.flow.region.y = Infinity; }, s => { s.flow.region.remoteUrl = 'https://example.com'; }]) {
    const invalid = structuredClone(document); mutate(invalid.scenes.find(s => s.flow));
    assert.throws(() => validateDocument(invalid));
  }
  const version1 = createDocument({ presetId: 'blank' });
  version1.scenes[0].flow = { version: 1, region: { x: 0, y: 0, width: 100, height: 100 } };
  assert.throws(() => validateDocument(version1), /phiên bản 2/);
});

test('applying untouched flowed Fabric text and surfaces preserves authored layouts', () => {
  const document = createDocument({ template: { id: 'polaroid' } });
  const scene = document.scenes.find(s => s.id === 'scene-surprise');
  const result = stationeryFlow(scene, document.elements, new Map([['text-message', 1000]]));
  for (const id of ['text-sender', 'photo-strip-paper']) {
    const element = document.elements.find(e => e.id === id), box = result.layouts.get(id);
    const shape = { width: box.width, height: box.height, scaleX: 1, scaleY: 1, angle: 0,
      left: box.x + box.width / 2, top: box.y + box.height / 2,
      momeviaFlowHeightRatio: box.height / element.layout.height, momeviaFlowOffsetY: box.y - element.layout.y };
    if (element.type === 'text') shape.momeviaBaseHeight = element.layout.height;
    assert.deepEqual(layoutFromFabric(element, shape), element.layout);
  }
});

test('paper nine-slice retains a constant display border while its centre can grow independently', () => {
  const short=paperSlices(600,800,340,420),long=paperSlices(600,800,340,2200);
  assert.equal(short.length,9);assert.equal(long.length,9);
  for(const at of [0,2,6,8]){
    assert.equal(short[at].sw,120);assert.equal(long[at].sh,120);
    assert.equal(short[at].width,20);assert.equal(long[at].height,20);
  }
  assert.equal(long[4].height-short[4].height,1780);
  assert.equal(long[8].y+long[8].height,2200);
  assert.equal(short[8].x+short[8].width,340);
});

test('explicit themed reply colors remain valid and optional, with strict hex validation', () => {
  const themed=createDocument({template:{id:'hai-phong-bi'}});
  const reply=themed.elements.find(e=>e.type==='reply');
  assert.match(reply.props.color,/^#[\da-f]{6}$/i);
  assert.equal(publicDocument({...themed,bindings:Object.fromEntries(Object.entries(themed.bindings).map(([key,value])=>[key,{...value,value:'An'}]))}).elements.find(e=>e.type==='reply').props.color,reply.props.color);
  reply.props.color='url(https://example.com)';
  assert.throws(()=>validateDocument(themed));
  const legacy=createDocument({presetId:'celebration'});
  assert.equal(Object.hasOwn(legacy.elements.find(e=>e.type==='reply').props,'color'),false);
  assert.doesNotThrow(()=>validateDocument(legacy));
});
