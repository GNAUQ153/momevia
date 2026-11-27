import test from 'node:test';
import assert from 'node:assert/strict';
import { signatureTemplateIds, signatureTemplateDefinition } from '../../web/js/shared/canvas/signature/templates.js';
import { createDocument } from '../../web/js/shared/canvas/presets.js';
import { duplicateDocument, publicDocument } from '../../web/js/shared/canvas/schema.js';
import { signatureOpening, playSignatureOpening } from '../../web/js/features/gift-runtime/signature-opening.js';
import { createMotion } from '../../web/js/features/gift-runtime/effects.js';

const cover = doc => doc.scenes.find(scene => scene.id === doc.entrySceneId);
const fixture = id => createDocument({ template: { id } });
for (const id of signatureTemplateIds) {
  test(`${id}: opening uses independent layer IDs after duplication and publication`, () => {
    const original = fixture(id);
    const expected = signatureTemplateDefinition(id).opening;
    for (const doc of [original, duplicateDocument(original), publicDocument(duplicateDocument(original))]) {
      const plan = signatureOpening(doc, cover(doc));
      assert.equal(plan.kind, expected);
      assert(plan.duration <= 1000);
      assert(plan.tracks.length >= 3);
      assert.equal(new Set(plan.tracks.map(track => track.modelId)).size, plan.tracks.length);
      assert(doc.elements.some(model => model.id === plan.controlId && model.type === 'button'));
      assert(plan.tracks.every(track => cover(doc).elementIds.includes(track.modelId)));
      assert.equal(signatureOpening(doc, doc.scenes[1]), null);
    }
  });
}

test('Classic, missing/ambiguous anchors, deleted decoration and explicit reaction use normal navigation', () => {
  const doc = fixture(signatureTemplateIds[0]);
  const plan = signatureOpening(doc, cover(doc));
  const button = doc.elements.find(model => model.id === plan.controlId);
  button.effects = { reaction: { id: 'R03', speed: 'normal' } };
  assert.equal(signatureOpening(doc, cover(doc)), null);
  delete button.effects;
  const ambiguous = fixture('signature-garden-tea').elements.find(e => e.props.kind === 'signature-door-left');
  doc.elements.push(ambiguous);
  cover(doc).elementIds.push(ambiguous.id);
  assert.equal(signatureOpening(doc, cover(doc)), null);
  cover(doc).elementIds.pop();
  const decoration = doc.elements.find(model => model.props.kind === 'signature-cover-decoration');
  decoration.visible = false;
  assert.equal(signatureOpening(doc, cover(doc)), null);
  const classic = createDocument({ template: { id: 'loi-moi-ben-hien' } });
  assert.equal(signatureOpening(classic, cover(classic)), null);
});

function mockNodes(doc) {
  const attributes = new Map();
  const runs = [];
  const nodes = doc.elements.filter(model => cover(doc).elementIds.includes(model.id)).map(model => ({ model, node: {
    setAttribute(key, value) { attributes.set(key, value); },
    removeAttribute(key) { attributes.delete(key); },
    animate(frames, options) {
      let resolve, reject;
      const animation = { playState: 'running', finished: new Promise((yes, no) => { resolve = yes; reject = no; }),
        finish() { this.playState = 'finished'; resolve(); }, cancel() { this.playState = 'idle'; reject(new Error('cancelled')); },
      };
      runs.push({ model, animation, frames, options });
      return animation;
    },
  } }));
  return { nodes, runs, attributes };
}

test('Actual motion lifecycle preserves sender rotation/opacity, holds frame and releases on scene abort', async () => {
  const doc = fixture('signature-graduation-countdown');
  const model = doc.elements.find(e => e.props.kind === 'signature-peel');
  model.layout.rotation = 27;
  model.opacity = .4;
  const original = structuredClone(doc);
  const plan = signatureOpening(doc, cover(doc));
  const { nodes, runs, attributes } = mockNodes(doc);
  const controller = new AbortController();
  const motion = createMotion(() => true);
  const done = playSignatureOpening(plan, nodes, motion, controller.signal);
  assert.equal(attributes.get('aria-disabled'), 'true');
  const peel = runs.find(run => run.model.id === model.id);
  assert.equal(peel.frames[0].transform, 'rotate(27deg)');
  assert.equal(peel.frames[0].opacity, .4);
  assert.equal(peel.frames.at(-1).opacity, 0);
  runs.forEach(run => run.animation.finish());
  await done;
  assert(!attributes.has('aria-disabled'));
  assert.equal(motion.stats().pending, runs.length);
  controller.abort();
  assert.deepEqual(motion.stats(), { animations: 0, pending: 0 });
  assert.deepEqual(doc, original);
});

test('Reduced motion, absent WAAPI, cancelled scene and failed animation never trap the opening button', async () => {
  const doc = fixture('signature-secret-santa');
  const plan = signatureOpening(doc, cover(doc));
  const { nodes, runs, attributes } = mockNodes(doc);
  const controller = new AbortController();
  assert.equal(playSignatureOpening(plan, nodes, createMotion(() => false), controller.signal), null);
  assert.equal(playSignatureOpening(plan, [], createMotion(() => true), controller.signal), null);
  assert.equal(runs.length, 0);
  const motion = createMotion(() => true);
  const done = playSignatureOpening(plan, nodes, motion, controller.signal);
  controller.abort();
  await done;
  assert(!attributes.has('aria-disabled'));
  assert.deepEqual(motion.stats(), { animations: 0, pending: 0 });
  const fail = mockNodes(doc);
  fail.nodes.forEach(({ node }) => { node.animate = () => { throw new Error('unavailable'); }; });
  await playSignatureOpening(plan, fail.nodes, motion, new AbortController().signal);
  assert(!fail.attributes.has('aria-disabled'));
});
