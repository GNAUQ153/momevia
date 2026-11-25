import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { JsonRepository } from '../../src/shared/storage.mjs';
import { CatalogService } from '../../src/modules/catalog/catalog.service.mjs';
import { templates } from '../../src/modules/catalog/seed.mjs';
import { CheckoutService } from '../../src/modules/checkout/checkout.service.mjs';
import { DesignsService, publicGiftView } from '../../src/modules/designs/designs.service.mjs';
import { JsonDesignRepository } from '../../src/modules/designs/json.repository.mjs';
import { RoleService } from '../../src/modules/identity/roles.service.mjs';
import { requireGiftPermission, giftStatus } from '../../src/modules/gifts/access.mjs';
import { setGiftArchive } from '../../src/modules/gifts/lifecycle.mjs';
import { renewGift } from '../../src/modules/gifts/renewal.mjs';
import { updateRsvp } from '../../src/modules/gifts/rsvp.mjs';
import { editInvitation } from '../../web/js/shared/canvas/invitation.js';
import { rsvpCounts } from '../../web/js/shared/rsvp.js';

const day = 86400_000;
const access = { open: 'invite', send: 'invite', read: 'sender' };
const demoEnv = { NODE_ENV: 'test', PAYMENT_ENABLED: 'false', PAYMENT_LIVE_ENABLED: 'false' };

// Tất cả repository dùng thư mục tạm riêng, không đọc .env hoặc kết nối provider/MySQL.
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'momevia-business-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const sender = { sub: randomUUID(), role: 'sender', name: 'QA Sender' };
  const other = { sub: randomUUID(), role: 'sender', name: 'QA Other' };
  const creator = { sub: randomUUID(), role: 'creator', name: 'QA Creator' };
  const admin = { sub: randomUUID(), role: 'admin', name: 'QA Admin' };
  const users = new JsonRepository(path.join(dir, 'users.json'), [sender, other, creator, admin].map(u => ({ id: u.sub, role: u.role, name: u.name })));
  const catalogRepo = new JsonRepository(path.join(dir, 'catalog.json'), structuredClone(templates));
  const catalog = new CatalogService(catalogRepo);
  const orders = new JsonRepository(path.join(dir, 'orders.json'));
  const checkout = new CheckoutService({ repository: orders, catalog: { getTemplate: id => catalog.publicOne(id) },
    config: { demoEnabled: true, demoTemplateCheckout: true }, env: { ...demoEnv } });
  const filename = path.join(dir, 'canvas.json');
  const repository = new JsonDesignRepository(filename);
  const designs = new DesignsService({ repository, publication: repository, catalog: { getTemplate: id => catalog.publicOne(id) },
    checkout, config: { giftTtlDays: 30 }, flags: { edit: true, publish: true },
    profile: { supported: true, mode: 'json', checkoutMode: 'json' }, mediaRoot: path.join(dir, 'assets'), orders: user => checkout.orders(user) });
  return { sender, other, creator, admin, users, roles: new RoleService(users), catalog, catalogRepo, orders, checkout, repository, designs, filename };
}

async function readyDesign(f, user, templateId, edit = () => {}) {
  const { design } = await f.designs.create(user, { source: { kind: 'template', templateId }, mutationId: randomUUID() });
  const document = structuredClone(design.document);
  for (const binding of Object.values(document.bindings)) binding.value = 'QA';
  edit(document, design);
  await f.designs.save(user, design.id, { expectedRevision: design.revision, mutationId: randomUUID(), title: design.title, document });
  return f.designs.get(user, design.id);
}

function publication(design) {
  return { designId: design.id, expectedRevision: design.revision, expectedDocumentHash: design.documentHash, idempotencyKey: randomUUID(), access };
}

test('BR01 Guest, Creator và Admin: mẫu chờ duyệt không được dùng để mua hoặc thiết kế', async t => {
  const f = fixture(t);
  const input = { title: 'Mẫu QA', subtitle: 'Mẫu chờ duyệt', theme: 'sage', price: 59000 };
  await assert.rejects(f.catalog.createDraft(f.sender, input), { status: 403 });
  const draft = await f.catalog.createDraft(f.creator, input);
  assert.equal(draft.status, 'pending');
  assert(!(await f.catalog.publicList()).some(row => row.id === draft.id));
  await assert.rejects(f.checkout.purchase(f.sender, draft.id), { status: 404 });
  await assert.rejects(f.designs.create(f.sender, { source: { kind: 'template', templateId: draft.id }, mutationId: randomUUID() }), { status: 404 });
  await assert.rejects(f.catalog.approve(f.creator, draft.id), { status: 403 });
  assert.equal(f.catalogRepo.get(draft.id).status, 'pending');
  assert((await f.catalog.pending(f.admin)).some(row => row.id === draft.id));
  await f.catalog.approve(f.admin, draft.id);
  assert.equal((await f.catalog.publicOne(draft.id)).status, 'published');
  assert.equal((await f.checkout.accessFor(f.sender, draft.id)).licensed, false);
  assert.equal(f.orders.all().length, 0);
  assert.equal((await f.repository.listForUser(f.sender.sub)).length, 0);
});

test('BR02 Free: lưu nháp, xuất bản, retry và quyền truy cập không tạo đơn Premium', async t => {
  const f = fixture(t);
  const design = await readyDesign(f, f.sender, 'sunny-wishes');
  assert.equal((await f.checkout.accessFor(f.sender, 'sunny-wishes')).free, true);
  assert.equal((await f.designs.check(design)).canPublish, true);
  const request = publication(design);
  const first = await f.designs.publish(f.sender, request);
  const replay = await f.designs.publish(f.sender, request);
  assert.equal(replay.replayed, true);
  assert.equal(replay.gift.id, first.gift.id);
  await assert.rejects(f.designs.publish(f.other, request), { status: 404 });
  const stored = await new JsonDesignRepository(f.filename).findBySlug(first.gift.slug);
  assert.equal(stored.id, first.gift.id);
  assert.throws(() => requireGiftPermission(stored, null), { status: 403 });
  assert.equal(requireGiftPermission(stored, stored.inviteToken).canOpen, true);
  assert.throws(() => requireGiftPermission(stored, stored.inviteToken, 'canRead'), { status: 403 });
  assert.equal((await f.repository.listForUser(f.sender.sub)).length, 1);
  assert.equal((await f.repository.listForUser(f.other.sub)).length, 0);
  assert.equal(f.orders.all().length, 0);
});

test('BR03 Premium: kiểm tra lại entitlement lúc publish, mua demo chỉ cấp cho chủ đơn', async t => {
  const f = fixture(t);
  const id = 'midnight-bloom';
  const design = await readyDesign(f, f.sender, id);
  const otherDesign = await readyDesign(f, f.other, id);
  const request = publication(design);
  assert.equal((await f.designs.check(design)).authorization.status, 'needs_template_license');
  await assert.rejects(f.designs.publish(f.sender, request), { status: 402 });
  assert.equal((await f.repository.listForUser(f.sender.sub)).length, 0);
  const order = await f.checkout.purchase(f.sender, id);
  assert.equal((await f.checkout.purchase(f.sender, id)).id, order.id);
  assert.equal(f.orders.all().length, 1);
  assert.equal((await f.checkout.entitlementDetails(f.sender, id)).sources.demo.active, 1);
  assert.equal((await f.checkout.accessFor(f.other, id)).licensed, false);
  assert.deepEqual(await f.checkout.orders(f.other), []);
  await assert.rejects(f.designs.publish(f.other, publication(otherDesign)), { status: 402 });
  assert.equal((await f.designs.check(design)).canPublish, true);
  // Dữ liệu thay đổi sau preflight: publish phải kiểm tra quyền hiện hành, không tin kết quả cũ.
  f.orders.update(order.id, { status: 'refunded' });
  await assert.rejects(f.designs.publish(f.sender, request), { status: 402 });
  assert.equal((await f.repository.listForUser(f.sender.sub)).length, 0);
  f.orders.update(order.id, { status: 'demo_paid' });
  const published = await f.designs.publish(f.sender, request);
  assert.equal((await f.designs.publish(f.sender, request)).gift.id, published.gift.id);
  assert.equal((await f.repository.listForUser(f.sender.sub)).length, 1);
  assert.equal(f.orders.all().length, 1);
  f.checkout.env.NODE_ENV = 'production';
  await assert.rejects(f.checkout.purchase(f.other, id), { status: 503 });
  assert.equal(f.orders.all().length, 1);
});

test('BR04 Invitation: RSVP riêng tư, gia hạn không mở lại RSVP, thu hồi/lưu trữ không mất dữ liệu', async t => {
  const f = fixture(t);
  const eventAt = new Date(Date.now() + 2 * day).toISOString().slice(0, 16);
  const design = await readyDesign(f, f.sender, 'loi-moi-ben-hien', (doc, view) => {
    doc.personalization = { version: 1, mode: 'list', names: [{ row: 2, name: 'Lan' }, { row: 3, name: 'Lan' }] };
    editInvitation(doc, 'enabled', true, view.invitationSlotIds);
    editInvitation(doc, 'zone', 'UTC');
    editInvitation(doc, 'date', eventAt);
    editInvitation(doc, 'venue', 'Hội trường QA');
  });
  const { gift } = await f.designs.publish(f.sender, publication(design));
  const initial = await f.repository.findBySlug(gift.slug);
  const [a, b] = initial.recipients;
  const accept = () => {};
  await Promise.all([f.repository.mutateGift(gift.id, g => updateRsvp(g, g.inviteToken, a.token, { status: 'attending' }, accept)),
    f.repository.mutateGift(gift.id, g => updateRsvp(g, g.inviteToken, b.token, { status: 'declined' }, accept))]);
  const now = Date.now();
  const expiresAt = new Date(now + 3 * day).toISOString();
  await f.repository.mutateGift(gift.id, g => { g.expiresAt = expiresAt; });
  const renew = () => f.repository.mutateGift(gift.id, g => renewGift(g, f.sender.sub, { expectedExpiresAt: expiresAt }, 7, now));
  const renewed = await Promise.all([renew(), renew()]);
  assert.equal(renewed.filter(row => !row.replayed).length, 1);
  assert(renewed.every(row => row.expiresAt === new Date(now + 10 * day).toISOString()));
  const active = await f.repository.findBySlug(gift.slug);
  assert.equal(active.inviteToken, initial.inviteToken);
  assert.deepEqual(active.documentSnapshot, initial.documentSnapshot);
  assert.throws(() => updateRsvp(active, active.inviteToken, a.token, { status: 'declined' }, accept, Date.parse(active.documentSnapshot.invitation.eventAt)), { status: 409 });
  await assert.rejects(f.repository.revoke(f.other.sub, gift.id, new Date().toISOString()), { status: 404 });
  await f.repository.revoke(f.sender.sub, gift.id, new Date().toISOString());
  await f.repository.mutateGift(gift.id, g => setGiftArchive(g, f.sender.sub, { archived: true }));
  await f.repository.mutateGift(gift.id, g => setGiftArchive(g, f.sender.sub, { archived: false }));
  const restored = await new JsonDesignRepository(f.filename).findBySlug(gift.slug);
  assert.equal(giftStatus(restored), 'revoked');
  assert.throws(() => requireGiftPermission(restored, restored.inviteToken), { status: 410 });
  assert.deepEqual(rsvpCounts(restored.recipients), { attending: 1, declined: 1, tentative: 0, unanswered: 0 });
  const view = publicGiftView(restored);
  assert(!Object.hasOwn(view, 'recipients'));
  assert(!JSON.stringify(view).includes(b.token));
});

test('BR05 Admin hạ quyền Creator: không đọc lại nháp Creator hoặc hàng đợi Admin', async t => {
  const f = fixture(t);
  const { design } = await f.designs.create(f.creator, { source: { kind: 'blank' }, purpose: 'creator', mutationId: randomUUID() });
  assert.equal((await f.designs.get(f.creator, design.id)).id, design.id);
  await assert.rejects(f.designs.check(await f.designs.get(f.creator, design.id)), { status: 403 });
  assert.throws(() => f.roles.change(f.creator.sub, f.creator.sub, 'admin'), { status: 403 });
  f.roles.change(f.admin.sub, f.creator.sub, 'sender');
  const current = { ...f.creator, role: f.users.get(f.creator.sub).role };
  await assert.rejects(f.designs.get(current, design.id), { status: 403 });
  await assert.rejects(f.catalog.pending(current), { status: 403 });
  await assert.rejects(f.checkout.adminEntitlementSummary(current), { status: 403 });
  assert.equal((await f.checkout.adminEntitlementSummary(f.admin)).totals.active, 0);
  assert.equal((await f.repository.get(f.creator.sub, design.id)).id, design.id);
});
