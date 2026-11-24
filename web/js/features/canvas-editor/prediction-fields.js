import { message } from '../../core/i18n.js';
import { node, field } from './dom.js';
import { predictionFields } from '../../shared/canvas/prediction.js';

export function createPredictionFields(model, scope = 'content') {
  const p = model.props;
  const keyFor = key => `prediction.${model.id}.${key}`;
  const textField = key => field(message(`prediction.${key}`), node('textarea', {
    'data-editor-field': keyFor(key), maxlength: predictionFields[key], rows: key.startsWith('option') ? 2 : 3,
  }, p[key]));
  return node('fieldset', { class: 'editor-prediction-fields', 'data-prediction-fields': model.id },
    node('legend', {}, message('gift.interactions.kind.prediction-choice')),
    ...['question', 'optionA', 'optionB'].map(textField),
    node('fieldset', { class: 'editor-prediction-options' },
      node('legend', {}, message('prediction.prediction')),
      ...['A', 'B'].map(id => node('label', { class: 'editor-prediction-option' },
        node('input', { type: 'radio', name: `prediction-${scope}-${model.id}`, value: id,
          checked: p.prediction === id, 'data-editor-field': keyFor('prediction') }),
        node('span', { 'data-prediction-option': id }, `${id} - ${p['option' + id]}`),
      )),
    ),
    ...['reason', 'endingA', 'endingB'].map(textField),
  );
}
export function updatePredictionFields(root, doc) {
  for (const host of root.querySelectorAll('[data-prediction-fields]')) {
    const p = doc.elements.find(e => e.id === host.dataset.predictionFields)?.props;
    if (!p) continue;
    for (const control of host.querySelectorAll('[data-editor-field]')) {
      const key = control.dataset.editorField.split('.').at(-1);
      if (key === 'prediction') control.checked = p.prediction === control.value;
      else if (control !== document.activeElement) control.value = p[key] || '';
    }
    for (const label of host.querySelectorAll('[data-prediction-option]'))
      label.textContent = `${label.dataset.predictionOption} - ${p['option' + label.dataset.predictionOption]}`;
  }
}
