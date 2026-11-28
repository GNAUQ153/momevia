import test from 'node:test';
import assert from 'node:assert/strict';
import { createBasicTemplate } from '../../web/js/shared/canvas/basic-templates.js';
import { validateDocument, duplicateDocument } from '../../web/js/shared/canvas/schema.js';
import { editInvitation, invitationIssue } from '../../web/js/shared/canvas/invitation.js';
import { gardenDoorSide, isGardenDocument } from '../../web/js/shared/canvas/garden-tea.js';
import { updateRsvp, rsvpView } from '../../src/modules/gifts/rsvp.mjs';
import { NATURAL_MEDIA_IDS } from '../../web/js/shared/canvas/natural-media.js';
import { EVENT_MEDIA } from '../../web/js/shared/canvas/event-media.js';
import { builtinLibraryItems } from '../../src/modules/designs/library.seed.mjs';
import { materializeModels } from '../../web/js/shared/canvas/library-materialize.js';
import { GARDEN_ELEMENT_SPECS } from '../../web/js/shared/canvas/garden-elements.js';
import { groupElements } from '../../web/js/shared/canvas/element-groups.js';

const garden = () => createBasicTemplate({ id: 'garden-tea' });
test('Garden Tea remains editable and empty until sender supplies names, photo and event', () => {
  const doc = garden();
  assert.equal(doc.scenes.length, 9);
  assert(doc.elements.every(e => e.locked !== true));
  assert.deepEqual(doc.assets.map(a=>a.assetId).sort(), ['element-eucalyptus','element-rose','element-wildflowers'].map(key=>NATURAL_MEDIA_IDS[key]).sort());
  assert(doc.assets.every(a=>EVENT_MEDIA[a.assetId]&&!EVENT_MEDIA[a.assetId].previewOnly));
  assert(doc.elements.filter(e=>e.type==='image'&&e.props.optional).every(e=>e.props.assetId===null));
  assert(Object.values(doc.bindings).every(b => b.value === ''));
  assert.equal(doc.invitation.eventAt, null);
  assert.equal(invitationIssue(doc, true), 'date');
  editInvitation(doc, 'date', '2027-01-09T15:00'); editInvitation(doc, 'venue', 'A quiet garden');
  for (const b of Object.values(doc.bindings)) b.value = 'Nguyễn Ánh';
  assert.equal(invitationIssue(doc, true), null);
  assert.doesNotThrow(() => validateDocument(doc, { mode: 'publish' }));
  assert.equal(garden().invitation.eventAt, null);
});
test('nine scenes keep their colors and entrances, then settle so the invitation stays readable', () => {
  const doc = garden();
  assert.equal(doc.schemaVersion,4);
  assert.equal(new Set(doc.scenes.map(s=>s.background.color)).size,9);
  for(const s of doc.scenes){
    if(s===doc.scenes[0])assert(s.effects.ambience.definition.animation.engine==='particles');
    else assert.equal(s.effects.ambience,undefined);
    assert(s.elementIds.some(id=>doc.elements.find(e=>e.id===id)?.motions?.rows.length),s.id);
    if(s!==doc.scenes[0])for(const id of s.elementIds){const e=doc.elements.find(n=>n.id===id);assert((e.motions?.rows||[]).every(row=>row.iterations!== 'infinite'));}
  }
  const photo=doc.elements.find(e=>e.id==='hero-photo');
  assert.equal(photo.props.mask,'arch');assert.equal(photo.props.radius,0);
  assert.equal(doc.elements.find(e=>e.id==='hero-photo-frame').props.kind,'arch');
  const petals=doc.elements.filter(e=>e.id.startsWith('scene-dress-garden-petal-drift-petal-'));
  assert.equal(petals.length,4);
  assert(petals.every(e=>e.artwork.paths.length===3&&e.motions.rows[0].tracks[0].frames.some(f=>f.rotation===23)));
  assert(petals.every(e=>e.layout.x<30||e.layout.x>330),'decorative petals leave the dress heading and copy clear');
});
test('all 13 Garden library compositions retain their groups, motion and assets after insertion', () => {
  const rows = builtinLibraryItems();
  for(const [id]of GARDEN_ELEMENT_SPECS){
    const source=rows.find(r=>r.kind==='element'&&r.id===id).definition;
    const a=groupElements(materializeModels(source.elements)),b=groupElements(materializeModels(source.elements));
    assert.equal(a.length,source.elements.length);
    assert(a.every(e=>!b.some(n=>n.id===e.id)));
    for(const e of a)if(e.groupId)assert(a.some(n=>n.id===e.groupId),id);
    assert.deepEqual(a.map(e=>e.motions),source.elements.map(e=>e.motions));
    assert.deepEqual(a.map(e=>e.props.assetId),source.elements.map(e=>e.props.assetId));
    assert.deepEqual(JSON.parse(JSON.stringify(a)),a);
  }
});
test('door animation finds both editable groups after ID remapping and serialization', () => {
  const doc = duplicateDocument(garden());
  assert(isGardenDocument(doc));
  const panels = doc.elements.filter(gardenDoorSide);
  assert.deepEqual(panels.map(gardenDoorSide).sort(), ['left', 'right']);
  for (const panel of panels) {
    assert.equal(panel.id, panel.groupId);
    assert(doc.elements.filter(e => e.groupId === panel.groupId).length > 5);
  }
  assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(doc))), doc);
});
test('countdown follows invitation metadata without a second stored date, including past events', () => {
  const doc = garden(), clock = doc.elements.find(e => e.props.clockSource === 'invitation');
  editInvitation(doc, 'date', '2020-01-01T15:00'); editInvitation(doc, 'venue', 'Garden');
  for (const b of Object.values(doc.bindings)) b.value = 'QA';
  assert.equal(clock.props.eventAt, null);
  assert.equal(invitationIssue(doc, true), null);
  assert.doesNotThrow(() => validateDocument(doc, { mode: 'publish' }));
  clock.props.clockSource = 'javascript';
  assert.throws(() => validateDocument(doc));
});
const now = Date.now(), token = 'a'.repeat(43), otherToken = 'b'.repeat(43);
const fixture = () => {
  const doc = garden(); editInvitation(doc, 'date', '2030-01-01T15:00'); editInvitation(doc, 'venue', 'Garden');
  return { recipientMode: 'list', documentSnapshot: doc, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 86400000).toISOString(),
    access: { open: 'link', send: 'link', read: 'sender' }, recipients: [{ id: 'a', token, name: 'An', source: 'list' }, { id: 'b', token: otherToken, name: 'An', source: 'list' }] };
};
test('party size and note persist per receipt, retries are idempotent, edits update once', () => {
  const gift = fixture(); let uses = 0;
  const body = { status: 'attending', partySize: 3, note: '  Trà hoa nhé  ' }, accept = () => uses++;
  const first = updateRsvp(gift, null, token, body, accept, now);
  const retry = updateRsvp(gift, null, token, body, accept, now + 1000);
  assert.deepEqual(first, retry); assert.equal(uses, 1); assert.equal(first.note, 'Trà hoa nhé');
  assert.equal(rsvpView(gift, gift.recipients[1], true, now).status, null);
  updateRsvp(gift, null, token, { ...body, partySize: 2 }, accept, now + 2000);
  assert.equal(uses, 2); assert.equal(gift.recipients[0].rsvp.partySize, 2);
  // Older clients can still change a status without erasing the RSVP details.
  const legacy = updateRsvp(gift, null, token, { status: 'tentative' }, accept, now + 3000);
  assert.equal(legacy.partySize, 2); assert.equal(legacy.note, 'Trà hoa nhé');
});
test('RSVP rejects invalid details, foreign tokens and updates at/after the event', () => {
  const gift = fixture();
  for (const body of [{ partySize: 0 }, { partySize: 6 }, { partySize: 1.5 }, { note: 'x'.repeat(141) }, { note: null }, { recipientId: 'b' }])
    assert.throws(() => updateRsvp(gift, null, token, { status: 'attending', ...body }, () => {}, now), { status: 422 });
  assert.throws(() => updateRsvp(gift, null, 'z'.repeat(43), { status: 'attending' }, () => {}, now), { status: 403 });
  const cutoff = Date.parse(gift.documentSnapshot.invitation.eventAt);
  assert.equal(rsvpView(gift, gift.recipients[0], true, cutoff).canRespond, false);
  assert.throws(() => updateRsvp(gift, null, token, { status: 'attending', partySize: 2, note: '' }, () => {}, cutoff), { status: 409 });
});
