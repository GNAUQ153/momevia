import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { giftStatus, requireActiveGift } from '../../src/modules/gifts/access.mjs';
import { setGiftArchive } from '../../src/modules/gifts/lifecycle.mjs';
import { JsonDesignRepository } from '../../src/modules/designs/json.repository.mjs';
import { JsonRepository } from '../../src/shared/storage.mjs';
import { MySqlGiftsRepository } from '../../src/modules/gifts/mysql.repositories.mjs';
import { MySqlPublicationUnitOfWork } from '../../src/modules/designs/mysql-publication.mjs';
import { publicGiftView } from '../../src/modules/designs/designs.service.mjs';
import { createGiftViews } from '../../web/js/pages/gifts.js';
import { auditCssStyle } from '../../scripts/quality/check-css-style.mjs';

const now = Date.now();
const fixture = (extra = {}) => ({ id: 'gift', slug: 'abcdefghijklmnopqrstuvwx', userId: 'owner', templateId: 'sample', templateTitle: 'QA', theme: 'sage', createdAt: new Date(now - 2000).toISOString(), expiresAt: new Date(now - 1000).toISOString(), replyCount: 1, recipients: [{ id: 'r', rsvp: { status: 'attending' } }], ...extra });
const archive = (gift, archived = true, time = now) => setGiftArchive(gift, 'owner', { archived }, time);

test('Thời hạn lỗi hoặc thiếu bị đóng; đúng thời điểm hết hạn cũng bị đóng', () => {
  for (const expiresAt of [undefined, null, '', 'invalid', 1234, new Date(now).toISOString()]) {
    assert.equal(giftStatus({ expiresAt }, now), 'expired');
    assert.throws(() => requireActiveGift({ expiresAt }), { status: 410, code: 'GIFT_EXPIRED' });
  }
  assert.equal(giftStatus(fixture({ expiresAt: new Date(now + 1).toISOString() }), now), 'active');
  assert.equal(giftStatus(fixture({ revokedAt: new Date(now).toISOString(), expiresAt: new Date(now + 100000).toISOString() }), now), 'revoked');
});

test('Chỉ chủ thiệp được lưu trữ thiệp đã đóng; dữ liệu yêu cầu phải chính xác', () => {
  const active = fixture({ expiresAt: new Date(now + 100000).toISOString() });
  assert.throws(() => archive(active), { status: 409 });
  const expired = fixture();
  assert.throws(() => setGiftArchive(expired, 'other', { archived: true }, now), { status: 404 });
  for (const input of [{}, { archived: 'true' }, { archived: true, userId: 'other' }, null])
    assert.throws(() => setGiftArchive(expired, 'owner', input, now), { status: 422 });
  assert(!Object.hasOwn(expired, 'senderArchivedAt'));
});

test('Lưu trữ và khôi phục idempotent, không mở lại thiệp hoặc thay đổi RSVP', () => {
  const gift = fixture({ revokedAt: new Date(now - 500).toISOString() });
  const original = structuredClone(gift);
  const first = archive(gift);
  assert.deepEqual(archive(gift, true, now + 500), first);
  assert.equal(giftStatus(gift, now), 'revoked');
  assert(!Object.hasOwn(publicGiftView(gift), 'senderArchivedAt'));
  assert.deepEqual(archive(gift, false), { senderArchivedAt: null });
  assert.deepEqual(archive(gift, false), { senderArchivedAt: null });
  delete gift.senderArchivedAt;
  assert.deepEqual(gift, original);
});

test('JSON Legacy giữ metadata và dữ liệu cũ sau lưu trữ/khôi phục', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gift-lifecycle-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'gifts.json');
  const gift = fixture();
  const repository = new JsonRepository(file, [gift]);
  repository.mutate(gift.id, current => { archive(current); return current; });
  const restoredRepo = new JsonRepository(file);
  assert(restoredRepo.get(gift.id).senderArchivedAt);
  restoredRepo.mutate(gift.id, current => { archive(current, false); return current; });
  assert.deepEqual(restoredRepo.get(gift.id), { ...gift, senderArchivedAt: null });
});

test('JSON Canvas giữ snapshot và lời đáp sau thao tác ghi có khóa', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-lifecycle-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'canvas.json');
  const repository = new JsonDesignRepository(file);
  const gift = fixture({ documentSnapshot: { schemaVersion: 4 } });
  await repository.change(state => {
    state.publications.key = { ownerId: gift.userId, result: { gift }, assetIds: [] };
    state.replies[gift.id] = [{ id: 'reply', message: 'QA' }];
  });
  await Promise.all([repository.mutateGift(gift.id, current => archive(current)), repository.mutateGift(gift.id, current => archive(current, true, now + 5))]);
  const reopened = new JsonDesignRepository(file);
  assert((await reopened.findBySlug(gift.slug)).senderArchivedAt);
  assert.deepEqual((await reopened.findBySlug(gift.slug)).documentSnapshot, gift.documentSnapshot);
  assert.equal((await reopened.repliesForGift(gift.id))[0].message, 'QA');
  await reopened.mutateGift(gift.id, current => archive(current, false));
  assert.deepEqual(await reopened.findBySlug(gift.slug), { ...gift, senderArchivedAt: null });
});

test('MySQL dùng khóa bản ghi và không sửa cột thời hạn khi lưu trữ', async () => {
  const gift = fixture();
  const row = { id: gift.id, slug: gift.slug, user_id: gift.userId, template_id: gift.templateId, created_at: gift.createdAt, expires_at: gift.expiresAt, reply_count: gift.replyCount, payload: JSON.stringify(gift) };
  const calls = [];
  const client = { withTransaction: fn => fn({ execute: async (sql, params) => {
    calls.push([sql, params]);
    if (sql.startsWith('SELECT')) return [[row]];
    row.payload = params[0]; return [{ affectedRows: 1 }];
  } }) };
  const repository = new MySqlGiftsRepository(client);
  await assert.rejects(repository.mutateGift(gift.id, current => setGiftArchive(current, 'other', { archived: true })), { status: 404 });
  assert.equal(calls.length, 1);
  await repository.mutateGift(gift.id, current => archive(current));
  assert.match(calls[1][0], /FOR UPDATE/);
  assert.equal(calls[2][0], 'UPDATE gifts SET payload=? WHERE id=?');
  assert(JSON.parse(row.payload).senderArchivedAt);
  assert.equal(row.expires_at, gift.expiresAt);
  assert.deepEqual(JSON.parse(row.payload).recipients, gift.recipients);
});

test('MySQL pinned asset kiểm tra lại thu hồi và hết hạn trước khi trả tài nguyên', async () => {
  let row = { expires_at: new Date(now + 100000).toISOString(), gift_payload: JSON.stringify({ revokedAt: new Date(now).toISOString() }) };
  const repository = new MySqlPublicationUnitOfWork({ execute: async sql => { assert.match(sql, /g\.payload AS gift_payload/); return [[row]]; } });
  await assert.rejects(repository.pinnedAsset('slug', 'asset'), { status: 410, code: 'GIFT_REVOKED' });
  row = { expires_at: null, gift_payload: '{}' };
  await assert.rejects(repository.pinnedAsset('slug', 'asset'), { status: 410, code: 'GIFT_EXPIRED' });
});

test('Studio tách kho lưu trữ, giữ nút đọc phản hồi và không hiện nút mở thiệp đã đóng', () => {
  const views = createGiftViews({ state: {}, buttonLink: () => '', requireLogin: () => {} });
  const closed = fixture({ status: 'revoked', recipientMode: 'list', senderArchivedAt: new Date(now).toISOString() });
  const html = views.studioGifts({ gifts: [closed] });
  assert.match(html, /<details class="gift-archive">/);
  assert.match(html, /data-action="restore-gift-list"/);
  assert.match(html, /data-action="gift-inbox"/);
  assert.match(html, /data-action="recipient-results"/);
  assert.doesNotMatch(html, /data-action="copy-link"|data-action="archive-gift"/);
  assert.match(views.studioGifts({ gifts: [fixture({ status: 'expired' })] }), /data-action="archive-gift"/);
  assert.doesNotMatch(views.studioGifts({ gifts: [fixture({ status: 'active', url: 'https://example.test/g/abc' })] }), /data-action="archive-gift"/);
});

test('CSS kho thiệp giữ mỗi thuộc tính một dòng và không lặp khai báo', () => {
  const css = fs.readFileSync(new URL('../../web/css/role-workspace.css', import.meta.url), 'utf8');
  const added = css.slice(css.indexOf('/* Kho thiệp đã đóng'));
  assert.deepEqual(auditCssStyle(added, 'role-workspace.css').errors, []);
});
