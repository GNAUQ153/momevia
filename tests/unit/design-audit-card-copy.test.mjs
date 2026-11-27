import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, templatePreviewDocument } from '../../web/js/shared/canvas/presets.js';
import { serverText } from '../../src/shared/locale.mjs';
import { validateDocument } from '../../web/js/shared/canvas/schema.js';

test('occasion previews use their own sample message while new drafts keep all personal fields empty', () => {
  const ids = ['gentle-apology', 'thank-you-bloom', 'ban-do-ngay-ra-truong', 'loi-moi-ben-hien', 'cuon-phim-ngay-ay', 'calm-light', 'faraway-hug', 'polaroid', 'greenhouse'];
  for (const id of ids) for (const language of ['vi', 'en']) {
    const localize = (key, values) => serverText(language, key, values);
    const preview = templatePreviewDocument({ id }, localize);
    assert.equal(preview.bindings.message.value, localize(`templates.${id}.previewMessage`));
    assert.notEqual(preview.bindings.message.value, localize('templates.preview.greeting'));
    assert.doesNotThrow(() => validateDocument(preview, { mode: 'publish' }));
    const draft = createDocument({ template: { id }, localize });
    assert(Object.values(draft.bindings).every(binding => binding.value === ''));
    if (id === 'loi-moi-ben-hien') {
      assert.match(draft.elements.find(e => e.id === 'event-location').props.text, /sẵn sàng|ready/);
      assert.equal(preview.elements.find(e => e.id === 'event-location').props.text, localize('templates.loi-moi-ben-hien.previewPlace'));
    }
    if (id === 'ban-do-ngay-ra-truong') {
      assert.equal(preview.elements.find(e => e.id === 'milestone-1-body').props.text, localize('templates.ban-do-ngay-ra-truong.previewMilestone1'));
      assert.notEqual(draft.elements.find(e => e.id === 'milestone-1-body').props.text, preview.elements.find(e => e.id === 'milestone-1-body').props.text);
    }
  }
});

test('generic envelope and birthday presets retain separate occasion semantics and valid scene actions', () => {
  for (const language of ['vi', 'en']) {
    const localize = (key, values) => serverText(language, key, values);
    const generic = createDocument({ presetId: 'envelope-basic', localize });
    const birthday = createDocument({ presetId: 'celebration', localize });
    assert.equal(generic.elements.find(e => e.id === 'birthday-title').props.text, localize('templates.preset.special'));
    assert.equal(birthday.elements.find(e => e.id === 'birthday-title').props.text, localize('templates.preset.birthday'));
    assert.equal(generic.elements.find(e => e.id === 'birthday-cake').props.stickerId, 'flower');
    assert.equal(generic.schemaVersion, 1);
    assert.equal(birthday.elements.find(e => e.id === 'birthday-cake').props.stickerId, 'cake');
    for (const doc of [generic, birthday]) {
      assert.doesNotThrow(() => validateDocument(doc));
      for (const e of doc.elements) for (const action of e.actions || []) if (action.type === 'goToScene') assert(doc.scenes.some(s => s.id === action.targetSceneId));
    }
  }
});
