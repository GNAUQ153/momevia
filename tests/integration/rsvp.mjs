import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { editInvitation } from '../../web/js/shared/canvas/invitation.js';

// Chạy trên fixture HTTP cô lập có sẵn; không dùng tài khoản hoặc DB production.
export async function runRsvpApi(request, ownerCookie, otherCookie, prepareRenewal) {
  async function call(route, options = {}, expected = 200) {
    const result = await request(route, options);
    assert.equal(result.status, expected, `${route}: ${JSON.stringify(result.data)}`);
    return result.data;
  }
  const owner = { cookie: ownerCookie };
  const { design } = await call('/designs/designs', { ...owner, body: { source: { kind: 'template', templateId: 'loi-moi-ben-hien' }, mutationId: randomUUID() } }, 201);
  const doc = design.document;
  for (const binding of Object.values(doc.bindings)) binding.value = 'QA';
  doc.personalization = { version: 1, mode: 'list', names: [{ row: 2, name: 'Lan' }, { row: 3, name: 'Minh' }] };
  editInvitation(doc, 'enabled', true, design.invitationSlotIds);
  editInvitation(doc, 'zone', 'UTC');
  editInvitation(doc, 'date', new Date(Date.now() + 12 * 3600000).toISOString().slice(0, 16));
  editInvitation(doc, 'venue', 'Hội trường QA');
  const ack = await call(`/designs/designs/${design.id}/save`, { ...owner, body: { expectedRevision: design.revision, mutationId: randomUUID(), title: design.title, document: doc } });
  const { gift } = await call('/gifts/gifts/from-design', { ...owner, body: { designId: design.id, expectedRevision: ack.savedRevision, expectedDocumentHash: ack.documentHash, idempotencyKey: randomUUID(), access: { open: 'invite', send: 'invite', read: 'sender' } } }, 201);
  const publicPath = `/gifts/gifts/${gift.slug}`;
  const ownerPath = `/gifts/gifts/mine/${gift.slug}`;
  const { recipients } = await call(`${ownerPath}/recipients`, owner);
  assert.equal(recipients.length, 2);
  assert(recipients.every(row => row.rsvp?.status === null));
  const [a,b] = recipients.map(row => new URL(row.url));
  const read = async query => (await call(publicPath + query)).gift;
  const respond = (query, status, expected = 200) => call(`${publicPath}/rsvp${query}`, { body: { status } }, expected);
  await respond('', 'attending', 403);
  await respond(`?invite=${a.searchParams.get('invite')}`, 'attending', 403);
  await respond(`?r=${a.searchParams.get('r')}`, 'attending', 403);
  await respond(a.search, 'yes', 422);
  const [first, second] = await Promise.all([respond(a.search, 'attending'), respond(b.search, 'declined')]);
  assert.equal(first.rsvp.status, 'attending');
  assert.equal(second.rsvp.status, 'declined');
  assert.deepEqual(await respond(a.search, 'attending'), first);
  assert.equal((await respond(a.search, 'tentative')).rsvp.status, 'tentative');
  const own = await read(a.search);
  assert.equal(own.rsvp.status, 'tentative');
  assert.equal((await read(b.search)).rsvp.status, 'declined');
  assert(!Object.hasOwn(own, 'recipients'));
  assert(!JSON.stringify(own).includes(b.searchParams.get('r')));
  assert.equal(own.replyCount, undefined);
  await call(`${publicPath}/replies${a.search}`, {}, 403);
  await call(`${ownerPath}/recipients`, { cookie: otherCookie }, 404);
  await call(`${ownerPath}/recipients`, {}, 401);
  const result = (await call(`${ownerPath}/recipients`, owner)).recipients;
  assert.deepEqual(result.map(row => row.rsvp.status), ['tentative', 'declined']);
  assert(result.every(row => !Object.hasOwn(row, 'token')));
  // Thiệp còn xa hạn hoặc tắt gia hạn: kiểm tra quyền trước khi trả lỗi nghiệp vụ.
  await call(`${ownerPath}/renew`, { body: { expectedExpiresAt: gift.expiresAt } }, 401);
  await call(`${ownerPath}/renew`, { cookie: otherCookie, body: { expectedExpiresAt: gift.expiresAt } }, 404);
  await call(`${ownerPath}/renew`, { ...owner, body: { expectedExpiresAt: gift.expiresAt } }, 409);
  assert.equal((await call(ownerPath, owner)).gift.expiresAt, gift.expiresAt);
  if (prepareRenewal) {
    await prepareRenewal(gift.slug);
    const { gift: nearExpiry } = await call(ownerPath, owner);
    assert.equal(nearExpiry.expiringSoon, true);
    assert.equal(nearExpiry.renewalDays, 7);
    const request = { ...owner, body: { expectedExpiresAt: nearExpiry.expiresAt } };
    const renewed = await Promise.all([call(`${ownerPath}/renew`, request), call(`${ownerPath}/renew`, request)]);
    const expected = new Date(Date.parse(nearExpiry.expiresAt) + 7 * 86400_000).toISOString();
    assert.equal(renewed.filter(item => !item.replayed).length, 1);
    assert(renewed.every(item => item.expiresAt === expected));
    const { gift: updated } = await call(ownerPath, owner);
    assert.equal(updated.expiresAt, expected);
    assert.equal(updated.renewalDays, undefined);
    assert.equal((await read(a.search)).expiresAt, expected);
    assert.equal((await read(a.search)).rsvp.status, 'tentative');
    assert.deepEqual((await call(`${ownerPath}/recipients`, owner)).recipients, result);
    await call(`${ownerPath}/renew`, { ...owner, body: { expectedExpiresAt: expected } }, 409);
  }
  await call(`${ownerPath}/archive`, { ...owner, body: { archived: true } }, 409);
  await call(`${ownerPath}/revoke`, { ...owner, body: {} });
  await respond(a.search, 'declined', 410);
  // Lưu trữ không cấp quyền cho tài khoản khác và không xóa phản hồi/RSVP.
  await call(`${ownerPath}/archive`, { cookie: otherCookie, body: { archived: true } }, 404);
  const archived = await call(`${ownerPath}/archive`, { ...owner, body: { archived: true } });
  assert(archived.senderArchivedAt);
  assert.deepEqual(await call(`${ownerPath}/archive`, { ...owner, body: { archived: true } }), archived);
  const { gift: archivedGift } = await call(ownerPath, owner);
  assert.equal(archivedGift.senderArchivedAt, archived.senderArchivedAt);
  assert.equal(archivedGift.status, 'revoked');
  assert.deepEqual((await call(`${ownerPath}/recipients`, owner)).recipients, result);
  await call(publicPath + a.search, {}, 410);
  assert.equal((await call(`${ownerPath}/archive`, { ...owner, body: { archived: false } })).senderArchivedAt, null);
  const { gift: restored } = await call(ownerPath, owner);
  assert(!restored.senderArchivedAt);
  assert.equal(restored.status, 'revoked');
  await respond(a.search, 'declined', 410);

  // Cả luồng tạo thiệp Legacy và Canvas dùng cùng quyền lưu trữ.
  const { gift: legacy } = await call('/gifts/gifts', { ...owner, body: { templateId: 'loi-moi-ben-hien', recipientName: 'QA Legacy', senderName: 'QA', message: 'Kiểm thử kho thiệp' } }, 201);
  const legacyOwner = `/gifts/gifts/mine/${legacy.slug}`;
  await call(`${legacyOwner}/archive`, { ...owner, body: { archived: true } }, 409);
  await call(`${legacyOwner}/revoke`, { ...owner, body: {} });
  const stored = await call(`${legacyOwner}/archive`, { ...owner, body: { archived: true } });
  assert(stored.senderArchivedAt);
  assert.equal((await call(legacyOwner, owner)).gift.senderArchivedAt, stored.senderArchivedAt);
  await call(`/gifts/gifts/${legacy.slug}`, {}, 410);
  await call(`${legacyOwner}/archive`, { ...owner, body: { archived: false } });
  assert.equal((await call(legacyOwner, owner)).gift.status, 'revoked');
}
