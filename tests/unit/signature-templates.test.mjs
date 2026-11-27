import test from 'node:test';
import assert from 'node:assert/strict';
import { signatureTemplateIds, signatureTemplateDefinition } from '../../web/js/shared/canvas/signature/templates.js';
import { createDocument, templatePreviewDocument } from '../../web/js/shared/canvas/presets.js';
import { validateDocument, duplicateDocument, publicDocument } from '../../web/js/shared/canvas/schema.js';
import { invitationSlots, editInvitation, publicInvitation } from '../../web/js/shared/canvas/invitation.js';
import { previewSvg } from '../../web/js/shared/canvas/cover-svg.js';
import { createSignatureArtwork } from '../../web/js/shared/canvas/signature/art.js';
import { templates, addedSystemTemplates } from '../../src/modules/catalog/seed.mjs';
import { serverText } from '../../src/shared/locale.mjs';

for (const id of signatureTemplateIds) {
  test(`${id}: dữ liệu VI/EN ổn định, artwork riêng, bốn cảnh có thể chỉnh sửa`, () => {
    const meta = signatureTemplateDefinition(id);
    const localize = locale => (key, params) => serverText(locale, key, params);
    const vi = createDocument({ template: { id }, localize: localize('vi') });
    const en = createDocument({ template: { id }, localize: localize('en') });
    assert.deepEqual(vi, createDocument({ template: { id }, localize: localize('vi') }));
    assert.deepEqual(vi.elements.map(e => e.id), en.elements.map(e => e.id));
    assert.deepEqual(vi.scenes.map(s => s.id), ['scene-cover', 'scene-event', 'scene-memory', 'scene-finish']);
    assert(vi.elements.every(e => ['text', 'image', 'shape', 'button', 'reply'].includes(e.type)));
    assert(vi.elements.filter(e => e.type === 'shape').every(e => e.props.kind.startsWith('signature-') && e.artwork.paths.length));
    const art = vi.elements.filter(e => e.id.startsWith('cover-signature-'));
    assert.deepEqual(art.map(e => [e.layout, e.artwork]), createSignatureArtwork(meta.conceptId).map(e => [e.layout, e.artwork]));
    assert(vi.elements.filter(e => e.type === 'image').every(e => e.props.optional && e.props.assetId === null));
    assert.deepEqual(Object.values(vi.bindings).map(binding => binding.value), ['', '', '']);
    assert.equal(vi.invitation, undefined);
    assert.doesNotMatch(JSON.stringify(vi), /<script|data:image|https?:\/\/|localStorage|signature\.templates\./i);
    assert.equal(vi.elements.find(e => e.id === 'open-gift').actions[0].targetSceneId, 'scene-event');
    assert.equal(vi.elements.find(e => e.id === 'to-memory').actions[0].targetSceneId, 'scene-memory');
    assert.equal(vi.elements.find(e => e.id === 'to-finish').actions[0].targetSceneId, 'scene-finish');
    assert.equal(vi.elements.find(e => e.id === 'replay-gift').actions[0].type, 'replay');
    for (const locale of ['vi', 'en']) {
      const preview = templatePreviewDocument({ id }, localize(locale));
      assert.doesNotThrow(() => validateDocument(preview, { mode: 'publish' }));
      assert.doesNotThrow(() => validateDocument(duplicateDocument(preview)));
      for (const scene of preview.scenes) {
        const svg = previewSvg(preview, scene.id);
        assert.match(svg, /<svg/);
        assert.doesNotMatch(svg, /<script|signature\.templates\./);
      }
    }
  });

  test(`${id}: slot sự kiện và cá nhân hóa không ghi đè mẫu`, () => {
    const doc = createDocument({ template: { id } });
    const slots = invitationSlots(doc);
    assert.equal(slots.date.id, 'event-date');
    assert.equal(slots.venue.id, 'event-location');
    editInvitation(doc, 'enabled', true);
    assert.equal(publicInvitation(doc), undefined);
    editInvitation(doc, 'date', '2027-06-01T17:00');
    editInvitation(doc, 'venue', 'Hội trường A');
    assert.deepEqual(publicInvitation(doc), { eventAt: '2027-06-01T10:00:00.000Z', timeZone: 'Asia/Ho_Chi_Minh', venue: 'Hội trường A' });
    doc.bindings.recipientName.value = 'Người nhận';
    doc.bindings.senderName.value = 'Người gửi';
    doc.bindings.message.value = 'Lời mời riêng';
    const vector = doc.elements.find(e => e.artwork);
    vector.props.color = '#112233';
    assert.doesNotThrow(() => validateDocument(doc, { mode: 'publish' }));
    assert.equal(publicDocument(doc).elements.find(e => e.id === vector.id).props.color, '#112233');
    assert.notEqual(createDocument({ template: { id } }).elements.find(e => e.id === vector.id).props.color, '#112233');
  });
}

test('S4 không kích hoạt mẫu chưa nghiệm thu trong Catalog hoặc thêm giá thương mại', () => {
  assert.equal(signatureTemplateIds.length, 6);
  assert(signatureTemplateIds.every(id => !templates.some(row => row.id === id) && !addedSystemTemplates.some(row => row.id === id)));
  assert.equal(signatureTemplateDefinition('unknown'), null);
});
