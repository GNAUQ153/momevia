import test from 'node:test';
import assert from 'node:assert/strict';
import { quotaQaEnabled } from '../../src/modules/checkout/quota-config.mjs';
import { publicationAuthority, readPublicationAuthority, grantPublicationCredit, consumePublicationCredit, requireCreditSchema } from '../../src/modules/checkout/publication-credit.mjs';
import { MySqlGiftsRepository } from '../../src/modules/gifts/mysql.repositories.mjs';
import { MySqlPaymentRepository } from '../../src/modules/payments/mysql.repository.mjs';

const qa = { PUBLICATION_QUOTA_QA_ENABLED: 'true', NODE_ENV: 'test', PAYMENT_ENV: 'sandbox',
  MYSQL_HOST: '127.0.0.1', MYSQL_DATABASE: 'momevia_canvas_qa_credit', CANVAS_QA_MYSQL_ISOLATED: 'true',
  IDENTITY_STORAGE: 'mysql', CATALOG_STORAGE: 'mysql', CHECKOUT_STORAGE: 'mysql', GIFTS_STORAGE: 'mysql', DESIGNS_STORAGE: 'mysql' };
const available = { credit_id: 'credit', gift_id: null };
const used = { credit_id: 'credit', gift_id: 'gift' };
const legacy = { credit_id: null, gift_id: null };

test('Quota tắt mặc định và không thể bật nhầm trên production hoặc profile JSON', () => {
  assert.equal(quotaQaEnabled({}), false);
  assert.equal(quotaQaEnabled(qa), true);
  for (const override of [{ NODE_ENV: 'production' }, { RAILWAY_ENVIRONMENT_ID: 'qa' }, { PAYMENT_ENV: 'production' },
    { PAYMENT_LIVE_ENABLED: 'true' }, { MYSQL_HOST: 'mysql.railway.internal' }, { MYSQL_DATABASE: 'railway' },
    { CANVAS_QA_MYSQL_ISOLATED: 'false' }, { GIFTS_STORAGE: 'json' }]) assert.throws(() => quotaQaEnabled({ ...qa, ...override }), /QA/);
});

test('Credit đã dùng không được cấp quyền mới; quyền lịch sử không bị tiêu hao', () => {
  assert.deepEqual(publicationAuthority([]), { allowed: false, creditId: null, legacyUnlimited: false, remaining: 0, consumed: 0 });
  assert.deepEqual(publicationAuthority([available]), { allowed: true, creditId: 'credit', legacyUnlimited: false, remaining: 1, consumed: 0 });
  assert.equal(publicationAuthority([used]).allowed, false);
  assert.deepEqual(publicationAuthority([legacy, available]), { allowed: true, creditId: null, legacyUnlimited: true, remaining: 1, consumed: 0 });
});

test('Truy vấn quyền theo chủ và mẫu, khóa quyền hợp lệ, không tin payload', async () => {
  const calls = [];
  const db = { async execute(sql, args) { calls.push([sql, args]); return [[available]]; } };
  assert.equal((await readPublicationAuthority(db, 'buyer', 'template', { lock: true })).creditId, 'credit');
  assert.match(calls[0][0], /e\.revoked_at IS NULL/);
  assert.match(calls[0][0], /o\.user_id=e\.user_id AND o\.template_id=e\.template_id/);
  assert.match(calls[0][0], /FOR UPDATE$/);
  assert.deepEqual(calls[0][1], ['buyer', 'template']);
});

test('Schema thiếu thì từ chối; cấp và tiêu hao có điều kiện trong transaction', async () => {
  await assert.rejects(requireCreditSchema({ execute: async () => [[]] }), { status: 503 });
  const calls = [];
  const tx = { async execute(sql, params) { calls.push([sql, params]); return [{ affectedRows: 1 }]; } };
  await grantPublicationCredit(tx, 'credit');
  await consumePublicationCredit(tx, publicationAuthority([available]), 'gift');
  assert.deepEqual(calls.map(c => c[1]), [['credit'], ['gift', 'credit']]);
  assert.match(calls[1][0], /gift_id IS NULL AND consumed_at IS NULL/);
  await consumePublicationCredit(tx, publicationAuthority([legacy]), 'gift');
  assert.equal(calls.length, 2);
  await assert.rejects(consumePublicationCredit(tx, publicationAuthority([used]), 'gift'), { status: 402 });
  await assert.rejects(consumePublicationCredit({ execute: async () => [{ affectedRows: 0 }] }, publicationAuthority([available]), 'gift'), { status: 409 });
});

const gift = { id: 'gift', userId: 'buyer', templateId: 'template', slug: 'slug', recipientName: 'Mai', senderName: 'An',
  message: 'Hello', imageFile: null, createdAt: '2026-11-24T00:00:00.000Z', expiresAt: '2026-12-24T00:00:00.000Z' };
function giftFixture(rights, { price = 10000, existing = false, fail = false } = {}) {
  const calls = []; let committed = false;
  const db = { async withTransaction(work) {
    const result = await work({ async execute(sql) {
      calls.push(sql);
      if (sql.includes('FROM users')) return [[{ id: 'buyer' }]];
      if (sql.includes('FROM gifts WHERE')) return [existing ? [{ id: gift.id }] : []];
      if (sql.includes('FROM templates')) return [[{ price_vnd: price, status: 'published' }]];
      if (sql.includes('FROM template_entitlements')) return [rights];
      if (sql.includes('UPDATE publication_credits') && fail) return [{ affectedRows: 0 }];
      return [{ affectedRows: 1 }];
    } });
    committed = true; return result;
  } };
  return { repo: new MySqlGiftsRepository(db, { quotaEnabled: true }), calls, committed: () => committed };
}

test('Legacy ghi gift trước khi tiêu hao trong cùng transaction; lỗi tiêu hao không commit', async () => {
  for (const fail of [false, true]) {
    const f = giftFixture([available], { fail });
    if (fail) await assert.rejects(f.repo.insert(gift), { status: 409 });
    else assert.deepEqual(await f.repo.insert(gift), gift);
    assert.equal(f.committed(), !fail);
    assert(f.calls.findIndex(s => s.includes('INSERT INTO gifts')) < f.calls.findIndex(s => s.includes('UPDATE publication_credits')));
  }
});

test('Legacy chặn hết lượt, không tiêu hao mẫu free và không ghi lặp ID', async () => {
  const exhausted = giftFixture([used]);
  await assert.rejects(exhausted.repo.insert(gift), { status: 402 });
  assert(!exhausted.calls.some(s => s.includes('INSERT INTO gifts')));
  const free = giftFixture([], { price: 0 });
  await free.repo.insert(gift);
  assert(!free.calls.some(s => s.includes('publication_credits')));
  const replay = giftFixture([used], { existing: true });
  await assert.rejects(replay.repo.insert(gift), { status: 409 });
  assert(!replay.calls.some(s => s.includes('publication_credits')));
});

test('Xác nhận Sandbox cấp đúng một credit; replay không ghi và Live bị chặn trong QA', async () => {
  const calls = []; let paid = false;
  const repo = new MySqlPaymentRepository({ async withTransaction(work) {
    const result = await work({ async execute(sql, args) {
      calls.push([sql, args]);
      if (sql.includes('FROM payment_intents p JOIN orders o')) return [[{ id: 'intent', order_id: 'order', amount_vnd: 10000,
        is_test: 1, provider_reference: paid ? 'ref' : null, status: paid ? 'paid' : 'pending', order_status: paid ? 'paid' : 'pending_payment', user_id: 'buyer', template_id: 'template' }]];
      return [{ affectedRows: 1 }];
    } });
    paid = true; return result;
  } }, { quotaEnabled: true });
  const event = { provider: 'momo', code: 'code', amount: 10000, reference: 'ref', currency: 'VND', success: true };
  await assert.rejects(repo.settleVerified(event, false), { status: 503 });
  assert.equal(calls.length, 0);
  assert.equal((await repo.settleVerified(event, true)).replay, false);
  assert.equal((await repo.settleVerified(event, true)).replay, true);
  const grants = calls.filter(c => c[0].includes('INSERT INTO publication_credits'));
  const rights = calls.filter(c => c[0].includes('INSERT INTO template_entitlements'));
  assert.equal(grants.length, 1);
  assert.deepEqual(grants[0][1], [rights[0][1][0]]);
});

test('Demo MySQL cấp credit cùng entitlement; lỗi credit không commit đơn', async () => {
  const { MySqlCheckoutRepository } = await import('../../src/modules/checkout/mysql.repository.mjs');
  for (const fail of [false, true]) {
    const calls = []; let committed = false;
    const repo = new MySqlCheckoutRepository({ async withTransaction(work) {
      const result = await work({ async execute(sql, args) {
        calls.push([sql, args]);
        if (fail && sql.includes('INSERT INTO publication_credits')) throw new Error('credit failure');
        return [{ affectedRows: 1 }];
      } });
      committed = true; return result;
    } }, { quotaEnabled: true });
    const input = { userId: 'buyer', templateId: 'template', templateTitle: 'Demo', grossAmount: 10000 };
    if (fail) await assert.rejects(repo.purchaseDemo(input), /credit failure/);
    else assert.equal((await repo.purchaseDemo(input)).status, 'demo_paid');
    assert.equal(committed, !fail);
    assert.deepEqual(calls.find(c => c[0].includes('INSERT INTO publication_credits'))[1],
      [calls.find(c => c[0].includes('INSERT INTO template_entitlements'))[1][0]]);
  }
});

test('Canvas kiểm tra credit và tiêu hao trước khi lưu idempotency key; replay đi trước quota', async () => {
  const { MySqlPublicationUnitOfWork } = await import('../../src/modules/designs/mysql-publication.mjs');
  const design = { id: 'design', owner_id: 'buyer', source_kind: 'template', template_id: 'template',
    template_version_id: 'version', revision: 1, document_hash: 'hash', document: { assets: [] } };
  const request = { designId: 'design', expectedRevision: 1, expectedDocumentHash: 'hash', idempotencyKey: 'key' };
  const result = { gift: { ...gift, sourceKind: 'template' }, version: { id: 'version', designId: 'design', revision: 1,
    documentHash: 'hash', schemaVersion: 1, runtimeVersion: 1, document: design.document, createdAt: gift.createdAt } };
  for (const mode of ['available', 'used', 'replay', 'rollback', 'creator-price']) {
    const calls = []; let committed = false; let built = false;
    const repo = new MySqlPublicationUnitOfWork({ async withTransaction(work) {
      const value = await work({ async execute(sql) {
        calls.push(sql);
        if (sql.includes('FROM users')) return [[{ id: 'buyer' }]];
        if (sql.includes('FROM gift_publication_requests')) return [mode === 'replay' ? [{ id: gift.id, request_hash: 'request-hash', design_revision: 1, payload: {} }] : []];
        if (sql.includes('FROM designs')) return [[mode === 'creator-price' ? { ...design, provenance: { adapter: 'creator-v1', price: 10000 } } : design]];
        if (sql.includes('FROM templates')) return [[{ id: 'template', price_vnd: mode === 'creator-price' ? 0 : 10000, status: 'published' }]];
        if (sql.includes('FROM template_entitlements')) return [[mode === 'used' ? used : available]];
        if (sql.includes('FROM design_versions')) return [[]];
        if (mode === 'rollback' && sql.includes('INSERT INTO gift_publication_requests')) throw new Error('after-credit');
        return [{ affectedRows: 1 }];
      } });
      committed = true; return value;
    } }, { quotaEnabled: true });
    const run = () => repo.publish('buyer', request, 'request-hash', async () => { built = true; return result; });
    if (mode === 'used') await assert.rejects(run(), { status: 402 });
    else if (mode === 'rollback') await assert.rejects(run(), /after-credit/);
    else assert.equal((await run()).replayed, mode === 'replay');
    assert.equal(built, ['available', 'rollback', 'creator-price'].includes(mode));
    assert.equal(committed, ['available', 'replay', 'creator-price'].includes(mode));
    if (built) {
      const insert = calls.findIndex(s => s.includes('INSERT INTO gifts'));
      const consume = calls.findIndex(s => s.includes('UPDATE publication_credits'));
      assert(insert >= 0 && insert < consume && consume < calls.findIndex(s => s.includes('INSERT INTO gift_publication_requests')));
    } else assert(!calls.some(s => s.includes('UPDATE publication_credits')));
  }
});
