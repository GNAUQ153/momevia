import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createDocument, createElement, validateDocument, canonicalStringify, duplicateDocument, publicDocument, assetIds, registry, LIMITS } from '../../web/js/shared/canvas/index.js';
import { templates } from '../../src/modules/catalog/seed.mjs';

function complete(presetId = 'envelope-basic') {
  const d = createDocument({ presetId });
  for (const [name, value] of Object.entries({ recipientName: 'Nguyễn Mai', senderName: 'Trần An', message: 'Chúc bạn bình an! ♥' })) d.bindings[name].value = value;
  return d;
}
function add(d, element) { d.elements.push(element); d.scenes[0].elementIds.push(element.id); return d; }

test('canvas schema is lossless, Unicode-safe and accepts all 24 presets without mutating templates', () => {
  const original = structuredClone(templates);
  for (const template of templates) {
    const d = createDocument({ template }); assert.equal(d.scenes.length, 3);
    for (const [key, b] of Object.entries(complete().bindings)) d.bindings[key] = b;
    assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(d)), { mode: 'publish' }), d);
  }
  assert.deepEqual(templates, original);
  assert.equal(createDocument().scenes.length, 1);
  assert.equal(Object.values(registry).filter(type => type.capability === 'basic').length, 9);
  assert.equal(registry.interaction.capability, 'extended');
});

test('canonical serialization has fixed key order, preserves array order and a stable SHA-256 fixture', () => {
  assert.equal(canonicalStringify({ z: 1, a: { b: 'Việt', a: [2, 1] } }), '{"a":{"a":[2,1],"b":"Việt"},"z":1}');
  assert.equal(canonicalStringify({ a: 2, b: 1 }), canonicalStringify({ b: 1, a: 2 }));
  assert.equal(createHash('sha256').update(canonicalStringify({ a: 2, b: 1 })).digest('hex'), 'd3626ac30a87e6f7a6428233b3c68299976865fa5508e4267c5415c76af7a772');
});

test('schema rejects unknown/private fields, unsupported versions, URLs, code and nonfinite/deep/cyclic data', () => {
  const mutations = [
    d => { d.owner = 'attacker'; }, d => { d.source = { kind: 'blank' }; }, d => { d.schemaVersion = 2; },
    d => { d.elements[0].elementVersion = 99; }, d => { d.elements[0].type = '__proto__'; },
    d => { d.elements[0].props.innerHTML = '<img onerror=alert(1)>'; }, d => { d.elements[0].props.url = 'javascript:alert(1)'; },
    d => { d.elements[0].layout.x = Infinity; }, d => { d.elements[0].layout.width = 0; },
    d => { d.elements[0].props.color = 'red; background:url(https://evil.test)'; }, d => { d.elements[0].props.fontToken = 'https://font.test'; },
    d => { d.elements[1].actions[0].type = 'navigate'; }, d => { d.scenes[0].elementIds.push(d.scenes[0].elementIds[0]); },
    d => { d.elements[1].actions[0].targetSceneId = 'missing'; }, d => { d.entrySceneId = 'missing'; },
    d => { d.elements[0].accessibility.role = 'button'; },
  ];
  for (const mutate of mutations) { const d = complete(); mutate(d); assert.throws(() => validateDocument(d), error => error.status === 422 && Boolean(error.details[0].path)); }
  const cyclic = complete(); cyclic.cycle = cyclic; assert.throws(() => validateDocument(cyclic));
  assert.throws(() => canonicalStringify({ x: undefined }));
  let deep = {}; for (let i = 0; i < LIMITS.depth + 2; i++) deep = { x: deep }; assert.throws(() => canonicalStringify(deep));
});

test('draft placeholders differ from publish completeness without permitting dangling references', () => {
  const d = add(complete(), createElement('image', { id: 'photo' }));
  assert.doesNotThrow(() => validateDocument(d)); assert.throws(() => validateDocument(d, { mode: 'publish' }));
  d.assets.push({ assetId: 'asset-1', kind: 'image' }); d.elements.at(-1).props.assetId = 'asset-1';
  assert.deepEqual(assetIds(d), ['asset-1']); assert.doesNotThrow(() => validateDocument(d, { mode: 'publish' }));
  d.elements.at(-1).props.assetId = 'missing'; assert.throws(() => validateDocument(d));
  const action = add(complete(), createElement('button', { id: 'button-placeholder' }));
  assert.doesNotThrow(() => validateDocument(action)); assert.throws(() => validateDocument(action, { mode: 'publish' }));
});

test('duplicate remaps node IDs and all internal action targets while keeping asset and binding identities', () => {
  const d = complete(); let seq = 0;
  const copy = duplicateDocument(d, { idFactory: () => `copied-${++seq}` });
  assert.equal(copy.entrySceneId, copy.scenes[0].id); assert.notEqual(copy.scenes[0].id, d.scenes[0].id);
  assert.equal(copy.elements[1].actions[0].targetSceneId, copy.scenes[1].id);
  assert.deepEqual(copy.bindings, d.bindings); assert.deepEqual(copy.assets, d.assets);
  assert.equal(copy.elements.at(-1).actions[0].type, 'replay'); assert.deepEqual(validateDocument(copy), copy);
  assert.deepEqual(d, complete());
});

test('public document removes editor locks/names and unused assets via an explicit allowlist', () => {
  const d = complete(); d.elements[0].locked = true; d.elements[0].name = 'Private layer'; d.assets.push({ assetId: 'unused', kind: 'image' });
  const projected = publicDocument(d);
  assert.equal(projected.elements[0].locked, undefined); assert.equal(projected.elements[0].name, undefined); assert.deepEqual(projected.assets, []);
  assert.equal(projected.bindings.message.value, d.bindings.message.value);
});

test('resource safety limits are technical budgets and do not impose a three-scene ceiling', () => {
  const d = complete(); for (let i = 0; i < 5; i++) d.scenes.push({ id: `extra-${i}`, name: 'Thêm', background: { kind: 'solid', color: '#FFFFFF' }, elementIds: [] });
  assert.equal(validateDocument(d).scenes.length, 8);
  d.elements[0].props.text = 'x'.repeat(LIMITS.text + 1); delete d.elements[0].props.textBinding; assert.throws(() => validateDocument(d));
  const budget = complete(); budget.bindings.message.value = 'x'.repeat(1001); assert.throws(() => validateDocument(budget));
});
