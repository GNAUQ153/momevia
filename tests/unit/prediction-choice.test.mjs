import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, templatePreviewDocument, validateDocument, publicDocument, duplicateDocument } from '../../web/js/shared/canvas/index.js';
import { cleanGiftLayout } from '../../web/js/shared/canvas/clean-layout.js';
import { predictionCard, predictionFields, predictionResult, emptyPrediction } from '../../web/js/shared/canvas/prediction.js';
import { previewSvg } from '../../web/js/shared/canvas/cover-svg.js';
const template = { id: 'to-doan-cau-se-chon' };
const sample = () => templatePreviewDocument(template);
const publish = doc => validateDocument(doc, { mode: 'publish', requiredBindings: [] });

test('prediction draft is blank, allows incomplete writing, and blocks each missing publish field', () => {
  const blank = createDocument({ template });
  assert.equal(blank.schemaVersion, 2); assert.equal(blank.scenes.length, 1);
  assert.deepEqual(Object.fromEntries([...Object.keys(predictionFields), 'prediction'].map(k => [k, predictionCard(blank).props[k]])), emptyPrediction());
  assert.doesNotThrow(() => validateDocument(blank));
  for (const key of Object.keys(predictionFields)) {
    const doc = sample(); predictionCard(doc).props[key] = '  \n ';
    assert.doesNotThrow(() => validateDocument(doc));
    assert.throws(() => publish(doc), e => e.details[0].path === `elements.4.props.${key}`);
  }
  for (const value of [null, '', ['A', 'B'], 'C', false]) {
    const doc = sample(); predictionCard(doc).props.prediction = value;
    assert.throws(() => publish(doc), e => e.details[0].path.endsWith('.prediction'));
    if (value !== null) assert.throws(() => validateDocument(doc));
  }
});
test('choices are distinct after whitespace normalization; lengths and extra data fail closed', () => {
  const doc = sample(), p = predictionCard(doc).props;
  p.optionA = 'Quán mì'; p.optionB = '  Quán  \n mì  ';
  assert.doesNotThrow(() => validateDocument(doc));
  assert.throws(() => publish(doc), { code: 'PREDICTION_DUPLICATE_CHOICES' });
  p.optionB = 'Vào bếp'; assert.doesNotThrow(() => publish(doc));
  p.chosen = 'B'; assert.throws(() => validateDocument(doc)); delete p.chosen;
  for (const [key, max] of Object.entries(predictionFields)) {
    const long = sample(); predictionCard(long).props[key] = 'x'.repeat(max+1);
    assert.throws(() => validateDocument(long));
  }
});
for (const prediction of ['A', 'B']) for (const choice of ['A', 'B']) test(`frozen ${prediction}, picked ${choice}: separate prediction and choice ending`, () => {
  const doc = sample(), p = predictionCard(doc).props;
  p.prediction = prediction; p.endingA = 'KẾT A · ở quán'; p.endingB = 'KẾT B · không hành';
  p.optionA = 'Nhãn A vừa sửa';
  const result = predictionResult(p, choice);
  assert.equal(result.prediction, prediction); assert.equal(result.choice, choice);
  assert.equal(result.predictedLabel, p['option'+prediction]);
  assert.equal(result.chosenLabel, p['option'+choice]);
  assert.equal(result.ending, choice === 'A' ? 'KẾT A · ở quán' : 'KẾT B · không hành');
  assert.equal(result.reason, p.reason);
  const snapshot = publicDocument(doc); p.prediction = prediction === 'A' ? 'B' : 'A';
  assert.equal(predictionCard(snapshot).props.prediction, prediction);
  assert.deepEqual(predictionCard(duplicateDocument(snapshot)).props, predictionCard(snapshot).props);
});
test('regifting clears names and all private story fields, public projection preserves frozen content', () => {
  const original = sample(), before = structuredClone(original);
  const cleaned = cleanGiftLayout(original);
  assert.deepEqual(original, before);
  assert(Object.values(cleaned.bindings).every(binding => binding.value === ''));
  const p = predictionCard(cleaned).props;
  assert.deepEqual(Object.fromEntries([...Object.keys(predictionFields), 'prediction'].map(k => [k,p[k]])), emptyPrediction());
  assert.doesNotThrow(() => validateDocument(cleaned)); assert.throws(() => publish(cleaned));
  assert.deepEqual(predictionCard(publicDocument(original)).props, predictionCard(original).props);
  const svg = previewSvg(original);
  assert(svg.includes('Quán mì hồi năm nhất')); assert(!svg.includes('không hành')); assert(!svg.includes('Lần nào đi ngang'));
});
