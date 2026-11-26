import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenMeTemplate, OPEN_ME_TEMPLATE_IDS, OPEN_ME_TEMPLATE_META } from '../../web/js/shared/canvas/open-me-templates.js';
import { validateDocument } from '../../web/js/shared/canvas/schema.js';
import { invitationDateText, invitationIssue, editInvitation } from '../../web/js/shared/canvas/invitation.js';
import { registry } from '../../web/js/shared/canvas/registry.js';

// Identity copy exercises the shared canvas schema independently of Catalog publication.
const localize = key => key;
for (const row of OPEN_ME_TEMPLATE_META) {
  test(`${row.id} is an isolated, editable, publishable canvas document`, () => {
    const document = createOpenMeTemplate(row.id, localize);
    assert.equal(document.scenes.length, row.scenes);
    assert.equal(document.schemaVersion, 2);
    assert.deepEqual(document.assets, []);
    assert.deepEqual(Object.keys(document.bindings).sort(), ['message', 'recipientName', 'senderName']);
    assert(document.elements.every(element => Object.hasOwn(registry, element.type) && element.locked !== true));
    const used = new Set(document.elements.map(element => element.props.textBinding).filter(Boolean));
    assert.deepEqual([...used].sort(), ['message', 'recipientName', 'senderName']);
    assert.equal(new Set(document.elements.map(element => element.id)).size, document.elements.length);
    for (const element of document.elements) {
      assert(Object.values(element.layout).every(Number.isFinite));
      if (element.actions?.length) {
        assert(element.layout.y + element.layout.height <= document.artboard.baseSize.height, 'source controls stay inside the editable artboard');
        assert(element.layout.height * 320 / document.artboard.baseSize.width >= 44, 'source primary controls meet 44px at 320px before text reflow');
      }
      for (const action of element.actions || []) if (action.type === 'goToScene') assert(document.scenes.some(scene => scene.id === action.targetSceneId));
    }
    const first = document.elements.find(element => element.id === 'open-gift');
    assert.equal(first.type, 'envelope');
    assert(first.layout.width >= 280 && first.layout.height >= 200);
    for (const [key, binding] of Object.entries(document.bindings)) binding.value = key === 'message' ? 'Một lời nhắn dài.\n\nĐoạn thứ hai vẫn có dấu tiếng Việt.' : 'Nguyễn Khánh An Nhiên';
    assert.deepEqual(validateDocument(document, { mode: 'publish' }), document);
    const fresh = createOpenMeTemplate(row.id, localize);
    assert.equal(fresh.bindings.message.value, '');
    assert.notDeepEqual(fresh, document);
  });
}

test('Invitation metadata and text slots keep one authoritative date; greeting has no RSVP event', () => {
  for (const id of OPEN_ME_TEMPLATE_IDS.slice(0, 2)) {
    const document = createOpenMeTemplate(id, localize);
    assert.equal(invitationIssue(document, true), null);
    const date = document.elements.find(element => element.id === document.invitation.dateElementId);
    assert.equal(date.props.text, invitationDateText(document.invitation.eventAt, document.invitation.timeZone));
    editInvitation(document, 'date', '2026-12-24T18:30');
    assert.equal(invitationIssue(document, true), null);
    assert.match(date.props.text, /^2026-12-24 18:30/);
    assert(document.elements.some(element => element.id === 'to-rsvp' && element.actions[0].targetSceneId === 'scene-reply'));
  }
  assert.equal(createOpenMeTemplate(OPEN_ME_TEMPLATE_IDS[2], localize).invitation, undefined);
});

test('supported birthday and Christmas interactions retain keyboard alternatives and independent intent', () => {
  const club = createOpenMeTemplate(OPEN_ME_TEMPLATE_IDS[0], localize);
  const cozy = createOpenMeTemplate(OPEN_ME_TEMPLATE_IDS[1], localize);
  assert(club.elements.some(element => element.props.kind === 'light-a-candle'));
  assert(club.elements.some(element => element.props.kind === 'scratch-ticket'));
  const wishes = cozy.elements.find(element => element.props.kind === 'wish-pick');
  assert.equal(wishes.props.entries.length, 3);
  assert.equal(wishes.actions, undefined);
  assert(cozy.elements.some(element => element.props.kind === 'scratch-ticket'));
  assert.equal(Object.hasOwn(cozy, 'rsvp'), false);
});

test('new factories never reinterpret old template IDs or mutate another document', () => {
  assert.equal(createOpenMeTemplate('winter-wishes-2026'), null);
  assert.equal(createOpenMeTemplate('birthday-radiance'), null);
  assert.equal(createOpenMeTemplate('__proto__'), null);
  const first = createOpenMeTemplate(OPEN_ME_TEMPLATE_IDS[0], localize);
  const snapshot = JSON.stringify(first);
  const second = createOpenMeTemplate(OPEN_ME_TEMPLATE_IDS[0], localize);
  second.elements[0].props.text = 'Changed';
  assert.equal(JSON.stringify(first), snapshot);
});
