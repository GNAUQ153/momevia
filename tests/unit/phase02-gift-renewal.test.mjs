import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { giftRenewalDays, renewalView, renewGift } from '../../src/modules/gifts/renewal.mjs';
import { JsonRepository } from '../../src/shared/storage.mjs';
import { JsonDesignRepository } from '../../src/modules/designs/json.repository.mjs';
import { MySqlGiftsRepository } from '../../src/modules/gifts/mysql.repositories.mjs';
import { publicGiftView } from '../../src/modules/designs/designs.service.mjs';
import { createGiftViews } from '../../web/js/pages/gifts.js';

const day = 86400_000, now = Date.parse('2027-01-01T10:00:00.000Z');
const iso = time => new Date(time).toISOString();
const fixture = (extra = {}) => ({ id: 'gift', slug: 'abcdefghijklmnopqrstuvwx', userId: 'owner', templateId: 'sample', templateTitle: 'QA', theme: 'sage', createdAt: iso(now - 100 * day), expiresAt: iso(now + day), replyCount: 1, access: { open: 'invite', send: 'invite', read: 'sender' }, inviteToken: 'private-token', recipients: [{ id: 'r', rsvp: { status: 'attending' } }], ...extra });
const body = gift => ({ expectedExpiresAt: gift.expiresAt });
const renew = (gift, input = body(gift), days = 7) => renewGift(gift, 'owner', input, days, now);

test('Cấu hình gia hạn mặc định tắt; chỉ nhận số nguyên từ 0 đến 30', () => {
  assert.equal(giftRenewalDays(undefined), 0);
  assert.equal(giftRenewalDays(''), 0);
  for (const n of [0, 1, 7, 30]) assert.equal(giftRenewalDays(String(n)), n);
  for (const n of ['-1', '31', 'NaN', '1.5', 'true', '1e1']) assert.throws(() => giftRenewalDays(n));
});

test('Cảnh báo trong 7 ngày cuối, kể cả khi chưa bật gia hạn; không cảnh báo thiệp đã đóng', () => {
  assert.deepEqual(renewalView(fixture(), 0, now), { expiringSoon: true });
  assert.deepEqual(renewalView(fixture({ expiresAt: iso(now + 7 * day) }), 7, now), { expiringSoon: true, renewalDays: 7 });
  assert.deepEqual(renewalView(fixture({ expiresAt: iso(now + 7 * day + 1) }), 7, now), {});
  for (const extra of [{ revokedAt: iso(now) }, { expiresAt: iso(now) }, { expiresAt: 'invalid' }, { senderArchivedAt: iso(now) }]) assert.deepEqual(renewalView(fixture(extra), 7, now), {});
});

test('Gia hạn một lần theo hạn cũ, retry không cộng thêm ngày và giữ nguyên nội dung riêng tư', () => {
  const gift = fixture(), before = structuredClone(gift), request = body(gift);
  assert.deepEqual(renew(gift, request), { expiresAt: iso(now + 8 * day), replayed: false });
  assert.deepEqual(renew(gift, request), { expiresAt: iso(now + 8 * day), replayed: true });
  assert.throws(() => renew(gift), { status: 409 });
  assert(!Object.hasOwn(publicGiftView(gift), 'senderRenewal'));
  assert(!Object.hasOwn(publicGiftView(gift), 'renewalDays'));
  assert(!Object.hasOwn(renewalView(gift, 7, now + 7 * day), 'renewalDays'));
  delete gift.senderRenewal; gift.expiresAt = before.expiresAt;
  assert.deepEqual(gift, before);
});

test('Backend chặn chủ khác, input dư, hạn sai, tắt cờ và thiệp không đủ điều kiện', () => {
  const gift = fixture(), before = structuredClone(gift);
  assert.throws(() => renewGift(gift, 'other', body(gift), 7, now), { status: 404 });
  for (const request of [null, {}, { expectedExpiresAt: 'bad' }, { ...body(gift), days: 30 }]) assert.throws(() => renew(gift, request), { status: 422 });
  assert.throws(() => renew(gift, body(gift), 0), { status: 409 });
  assert.throws(() => renew(gift, { expectedExpiresAt: iso(now + 2 * day) }), { status: 409 });
  assert.deepEqual(gift, before);
  for (const extra of [{ revokedAt: iso(now) }, { expiresAt: iso(now) }, { expiresAt: 'invalid' }, { senderArchivedAt: iso(now) }, { expiresAt: iso(now + 8 * day) }]) {
    const closed = fixture(extra);
    assert.throws(() => renew(closed, body(gift)), { status: 409 });
    assert(!closed.senderRenewal);
  }
});

test('JSON Legacy lưu hạn mới và kết quả retry qua lần mở lại kho dữ liệu', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'renew-legacy-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'gifts.json'), gift = fixture(), request = body(gift);
  const repository = new JsonRepository(file, [gift]);
  repository.mutate(gift.id, current => { renew(current, request); return current; });
  const reopened = new JsonRepository(file);
  assert.equal(reopened.get(gift.id).expiresAt, iso(now + 8 * day));
  reopened.mutate(gift.id, current => { assert(renew(current, request).replayed); return current; });
  assert.deepEqual(reopened.get(gift.id).recipients, gift.recipients);
});

test('JSON Canvas hai yêu cầu đồng thời chỉ gia hạn một lần, giữ snapshot và RSVP', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'renew-canvas-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'canvas.json'), gift = fixture({ documentSnapshot: { schemaVersion: 4 } }), request = body(gift);
  const repository = new JsonDesignRepository(file);
  await repository.change(state => { state.publications.key = { ownerId: gift.userId, result: { gift }, assetIds: [] }; });
  const results = await Promise.all([repository.mutateGift(gift.id, current => renew(current, request)), repository.mutateGift(gift.id, current => renew(current, request))]);
  assert.equal(results.filter(r => !r.replayed).length, 1);
  const persisted = await new JsonDesignRepository(file).findBySlug(gift.slug);
  assert.equal(persisted.expiresAt, iso(now + 8 * day));
  assert.deepEqual(persisted.documentSnapshot, gift.documentSnapshot);
  assert.deepEqual(persisted.recipients, gift.recipients);
});

test('MySQL khóa hàng và ghi cột expires_at cùng payload, retry không đổi hạn', async () => {
  const gift = fixture(), row = { id: gift.id, slug: gift.slug, user_id: gift.userId, template_id: gift.templateId, created_at: gift.createdAt, expires_at: gift.expiresAt, reply_count: gift.replyCount, payload: JSON.stringify(gift) }, calls = [];
  const repository = new MySqlGiftsRepository({ withTransaction: fn => fn({ execute: async (sql, params) => {
    calls.push([sql, params]);
    if (sql.startsWith('SELECT')) return [[row]];
    if (sql.includes('expires_at=?')) { row.expires_at = params[0]; row.payload = params[1]; }
    else row.payload = params[0];
    return [{ affectedRows: 1 }];
  } }) });
  assert.equal((await repository.mutateGift(gift.id, current => renew(current, body(gift)))).replayed, false);
  assert.match(calls[0][0], /FOR UPDATE/);
  assert.equal(calls[1][0], 'UPDATE gifts SET expires_at=?,payload=? WHERE id=?');
  assert.equal(JSON.parse(row.payload).expiresAt, iso(now + 8 * day));
  assert.equal(new Date(row.expires_at.replace(' ', 'T') + 'Z').toISOString(), iso(now + 8 * day));
  assert((await repository.mutateGift(gift.id, current => renew(current, body(gift)))).replayed);
  assert.equal(calls[3][0], 'UPDATE gifts SET payload=? WHERE id=?');
});

test('Studio chỉ hiện nút gia hạn khi backend cấp quyền, cảnh báo không phụ thuộc cờ', () => {
  const views = createGiftViews({ state: {}, buttonLink: () => '', requireLogin: () => {} });
  const gift = fixture({ status: 'active', url: 'https://example.test/g/abc', inviteUrl: 'https://example.test/g/abc?invite=token', expiringSoon: true });
  const html = views.studioGifts({ gifts: [gift] });
  assert.match(html, /role="status"/);
  assert.doesNotMatch(html, /data-action="renew-gift"/);
  assert.match(views.studioGifts({ gifts: [{ ...gift, renewalDays: 7 }] }), /data-action="renew-gift"/);
  assert.doesNotMatch(views.studioGifts({ gifts: [{ ...gift, status: 'revoked', renewalDays: 7 }] }), /data-action="renew-gift"/);
});
