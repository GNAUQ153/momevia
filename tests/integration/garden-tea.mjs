import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { startSfxFixture } from './sfx-fixture.mjs';
import { loadEnvironment } from '../../src/shared/config.mjs';
import { editInvitation } from '../../web/js/shared/canvas/invitation.js';

const sql = process.argv.includes('--mysql-local');
if (sql) loadEnvironment();
const fixture = await startSfxFixture({ label: 'garden-tea', sql, externalSql: sql });
const { request, register } = fixture;
const owner = await register('Garden Tea sender');
const completed = [];
async function api(route, body, actor = owner, expected = 200) {
  const r = await request(route, { body, cookie: actor?.cookie });
  assert.equal(r.status, expected, route + ' ' + JSON.stringify(r.data)); return r.data;
}
async function save(d) {
  await api(`/designs/designs/${d.id}/save`, { title: d.title, document: d.document, expectedRevision: d.revision, mutationId: randomUUID() });
  return (await api(`/designs/designs/${d.id}`)).design;
}
try {
  let { design } = await api('/designs/designs', { source: { kind: 'template', templateId: 'garden-tea' }, mutationId: randomUUID() }, owner, 201);
  assert.equal(design.document.invitation.eventAt, null);
  assert.equal(design.document.personalization.mode, 'self', 'new attendance templates start with a real recipient receipt');
  assert.equal(design.document.bindings.senderName.value, '');
  assert.equal(design.document.schemaVersion,4);
  assert.equal(design.document.assets.length,3,'watercolor branches, roses and wildflowers are materialized');
  assert(design.document.assets.every(a=>!a.assetId.startsWith('event-natural-')),'published gifts use owned assets');
  assert(design.document.elements.find(e=>e.id.includes('garden-porcelain-cup-cup')).artwork.paths.length===11);
  const image = await sharp({ create: { width: 160, height: 200, channels: 3, background: '#e9c9c6' } }).png().toBuffer();
  const uploaded = await request(`/designs/designs/${design.id}/assets`, { cookie: owner.cookie, bytes: image, headers: { 'content-type': 'image/png', 'x-mutation-id': randomUUID() } });
  assert.equal(uploaded.status, 201);
  const photo = design.document.elements.find(e => e.id === 'hero-photo');
  photo.props.assetId = uploaded.data.asset.assetId;
  photo.accessibility = { alt: 'Garden Tea test portrait' };
  design.document.assets.push({ assetId: photo.props.assetId, kind: 'image' });
  design.document.bindings.senderName.value = 'Minh Anh';
  design.document.bindings.message.value = 'Mời bạn ghé vườn uống trà cùng mình.';
  design.document.personalization = { version: 1, mode: 'list', names: [{ row: 2, name: 'Khánh An' }, { row: 3, name: 'Khánh An' }] };
  editInvitation(design.document, 'zone', 'UTC');
  editInvitation(design.document, 'date', new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 16));
  editInvitation(design.document, 'venue', 'Vườn Ngọc Lan — địa điểm kiểm thử');
  design = await save(design);
  assert.equal(design.document.elements.find(e => e.id === 'hero-photo').props.assetId, photo.props.assetId);
  completed.push('personalized template, image upload and draft readback');
  const body = { designId: design.id, expectedRevision: design.revision, expectedDocumentHash: design.documentHash, idempotencyKey: randomUUID(), access: { open: 'link', send: 'link', read: 'sender' } };
  const { gift } = await api('/gifts/gifts/from-design', body, owner, 201);
  const { gift: replay } = await api('/gifts/gifts/from-design', body, owner, 200);
  assert.equal(replay.id, gift.id);
  const { recipients } = await api(`/gifts/gifts/mine/${gift.slug}/recipients`);
  assert.equal(recipients.length, 2); assert.notEqual(recipients[0].url, recipients[1].url);
  const query = new URL(recipients[0].url).search, queryB = new URL(recipients[1].url).search;
  const endpoint = `/gifts/gifts/${gift.slug}`;
  let publicGift = (await api(endpoint + query, undefined, null)).gift;
  assert.equal(publicGift.recipientName, 'Khánh An');
  assert.equal(publicGift.documentSnapshot.elements.find(e => e.id === 'event-clock').props.eventAt, design.document.invitation.eventAt);
  assert.equal(publicGift.documentSnapshot.bindings.senderName.value, 'Minh Anh');
  const rsvp = { status: 'attending', partySize: 3, note: 'Mình mang một bó hoa nhỏ.' };
  const first = (await api(endpoint + '/rsvp' + query, rsvp, null)).rsvp;
  const again = (await api(endpoint + '/rsvp' + query, rsvp, null)).rsvp;
  assert.deepEqual(first, again);
  assert.equal((await api(endpoint + queryB, undefined, null)).gift.rsvp.status, null);
  const roster = (await api(`/gifts/gifts/mine/${gift.slug}/recipients`)).recipients;
  assert.equal(roster[0].rsvp.partySize, 3); assert.equal(roster[0].rsvp.note, rsvp.note);
  assert.equal(roster[1].rsvp.status, null);
  completed.push('publish replay, recipient isolation and durable RSVP with party size/note');
  await api(endpoint + '/rsvp' + query, { ...rsvp, partySize: 6 }, null, 422);
  await api(endpoint + '/rsvp' + query, { ...rsvp, recipientId: recipients[1].id }, null, 422);
  const noToken = await request(endpoint + '/rsvp', { body: rsvp }); assert([403, 404].includes(noToken.status));
  completed.push('invalid counts, spoofed identity and missing receipt token rejected');
  const realNow = Date.now;
  try {
    const cutoff = Date.parse(design.document.invitation.eventAt) + 1;
    Date.now = () => cutoff;
    publicGift = (await api(endpoint + query, undefined, null)).gift;
    assert.equal(publicGift.rsvp.canRespond, false);
    await api(endpoint + '/rsvp' + query, { ...rsvp, status: 'declined' }, null, 409);
    assert.equal(publicGift.rsvp.status, 'attending');
  } finally { Date.now = realNow; }
  completed.push('past event remains readable, stored RSVP preserved, new RSVP rejected');
  // Editing the sender draft cannot rewrite the already published event or media.
  const originalEvent = design.document.invitation.eventAt;
  editInvitation(design.document, 'venue', 'Changed after publication');
  design = await save(design);
  const snapshot = (await api(endpoint + query, undefined, null)).gift.documentSnapshot;
  assert.equal(snapshot.elements.find(e => e.id === 'event-clock').props.eventAt, originalEvent);
  assert.notEqual(snapshot.elements.find(e => e.id === 'event-location').props.text, 'Changed after publication');
  completed.push('published snapshot preserved after later draft edits');
  console.log(JSON.stringify({ passed: completed, storage: sql ? 'isolated local MySQL schema' : 'isolated JSON profile', root: fixture.directory }, null, 2));
} finally { await fixture.close(); }
