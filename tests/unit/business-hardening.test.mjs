import test from 'node:test';
import assert from 'node:assert/strict';
import { CreatorTemplates } from '../../src/modules/catalog/creator-templates.mjs';
import { PaymentService, paymentMethods } from '../../src/modules/payments/payment.service.mjs';
import { MySqlSupportRepository } from '../../src/modules/support/mysql.repository.mjs';
import { SupportService } from '../../src/modules/support/support.service.mjs';
import { createAdminViews } from '../../web/js/pages/admin.js';

const sandbox = {
  PAYMENT_ENABLED: 'true', PAYMENT_ENV: 'sandbox', PAYMENT_LIVE_ENABLED: 'false',
  CHECKOUT_STORAGE: 'mysql', IDENTITY_STORAGE: 'mysql', CATALOG_STORAGE: 'mysql',
  PUBLIC_BASE_URL: 'https://momevia.test.example',
  MOMO_PARTNER_CODE: 'test-partner', MOMO_ACCESS_KEY: 'test-access', MOMO_SECRET_KEY: 'test-secret',
};
const buyer = { sub: 'buyer' };
const catalog = { getTemplate: async () => ({ id: 'template', title: 'Gift', price: 25000 }) };

function paymentService(repository, env = sandbox, providers = {}) {
  return new PaymentService({ repository, env, providers, catalog, checkout: { hasLicense: async () => false } });
}

test('payment live is explicitly gated regardless of NODE_ENV and sandbox is disabled on production host', () => {
  assert.deepEqual(paymentMethods({ ...sandbox, PAYMENT_ENV: 'production', NODE_ENV: 'development' }), []);
  assert.deepEqual(paymentMethods({ ...sandbox, NODE_ENV: 'production' }), []);
  assert.deepEqual(paymentMethods({ ...sandbox, PAYMENT_ENV: 'unexpected' }), []);
  assert.deepEqual(paymentMethods({ ...sandbox, PAYMENT_ENV: 'production', PAYMENT_LIVE_ENABLED: 'true', NODE_ENV: 'production' }), [
    { id: 'momo', label: 'Ví MoMo' },
  ]);
});

test('payment create does not silently return a cached QR from a different provider', async () => {
  let created = 0;
  const repo = { async createPending() { created++; return {
    id: 'p', orderId: 'o', code: '10012', status: 'pending', provider: 'payos',
    amount: 25000, checkoutUrl: 'https://pay.payos.vn/previous',
  }; } };
  await assert.rejects(paymentService(repo).create(buyer, 'template', 'momo'), { status: 409 });
  assert.equal(created, 1);
});

test('completed or failed intents never masquerade as freshly created pending checkouts', async () => {
  for (const status of ['paid', 'failed', 'cancelled']) {
    const repo = { createPending: async () => ({ status, provider: 'momo' }) };
    await assert.rejects(paymentService(repo).create(buyer, 'template', 'momo'), { status: 409 });
  }
});

test('owner gets an advisory for long-pending orders; no automatic cancellation or lock release', async () => {
  const old = new Date(Date.now() - 45 * 60_000).toISOString();
  let write = false;
  const repo = { async forUser() { return {
    orderId: 'order-42', createdAt: old, status: 'pending', amount: 25000,
    provider: 'momo', checkoutUrl: 'https://test-payment.momo.vn/checkout', isTest: true,
  }; }, async releaseKey() { write = true; } };
  const service = paymentService(repo);
  const status = await service.status(buyer, 'order-42');
  assert.equal(status.needsReview, true);
  assert.match(status.notice, /không thanh toán lại/);
  assert.equal(status.pendingSince, old);
  assert.equal(write, false);
});

test('signed production webhooks may settle in-flight orders when new live payments have been disabled', async () => {
  const verified = { provider: 'momo', code: 'a', amount: 25000, reference: 'ref', success: true };
  let accepted = false;
  const service = paymentService({ async settleVerified(value, scope) { accepted = value === verified && scope === false; return { settled: true }; } },
    { ...sandbox, PAYMENT_ENV: 'production', NODE_ENV: 'production', PAYMENT_LIVE_ENABLED: 'false' },
    { momo: { async verifyWebhook() { return verified; } } });
  assert.deepEqual(await service.webhook('momo', {}), { settled: true });
  assert.equal(accepted, true);
  await assert.rejects(paymentService({}, { ...sandbox, NODE_ENV: 'production' },
    { momo: { async verifyWebhook() { return verified; } } }).webhook('momo', {}), { status: 503 });
});

test('withdrawn Creator template blocks NEW reuse even if an old version was approved', async () => {
  const version = { id: 'version-1', status: 'approved', assets: {}, rightsConfirmed: true };
  const store = { template: { id: 'template-1', creatorDesignId: 'design-1', creatorId: 'owner', status: 'rejected', withdrawn: true,
    title: 'Một mẫu', price: 0, versions: [version] } };
  const service = new CreatorTemplates({ get: async () => store.template }, {
    getDraft: async () => {}, getAsset: async () => {}, canCreate: async () => true,
  });
  await assert.rejects(service.reusable('template-1', 'version-1'), { status: 403 });
  store.template = { ...store.template, withdrawn: false, status: 'published' };
  assert.equal((await service.reusable('template-1', 'version-1')).version.id, version.id);
});

function supportFixture() {
  const rows = [
    { id: 'normal', topic: 'Hỗ trợ tài khoản', status: 'new', createdAt: '2026-11-18T10:00:00.000Z' },
    { id: 'report', topic: 'Báo cáo', reportKind: 'gift', status: 'new', createdAt: '2026-11-18T10:00:00.000Z' },
  ];
  const repository = {
    all: async () => rows.map(row => ({ ...row })),
    mutate: async (id, work) => {
      const row = rows.find(r => r.id === id);
      if (!row) return null;
      const patch = work(row);
      if (patch) Object.assign(row, patch);
      return { ...row };
    },
  };
  return { service: new SupportService({ repository, attempts: { consume: () => true } }), rows };
}

test('Admin can claim and resolve normal support tickets as well as abuse reports', async () => {
  const { service, rows } = supportFixture();
  const admin = { role: 'admin', sub: 'admin-1' };
  assert.deepEqual(await service.updateRequest(admin, 'normal', { action: 'claim' }), { status: 'in_progress' });
  assert.equal(rows[0].assignedTo, 'admin-1');
  await assert.rejects(service.updateRequest({ role: 'sender', sub: 'other' }, 'normal', { action: 'resolve', resolution: 'yes' }), { status: 403 });
  await assert.rejects(service.updateRequest({ role: 'admin', sub: 'admin-2' }, 'normal', { action: 'resolve', resolution: 'yes' }), { status: 409 });
  await assert.rejects(service.updateRequest(admin, 'normal', { action: 'resolve', resolution: '  ' }), { status: 400 });
  assert.equal((await service.updateRequest(admin, 'normal', { action: 'resolve', resolution: 'Đã hỗ trợ.' })).status, 'resolved');
  assert.equal((await service.updateReport(admin, 'report', { action: 'claim' })).status, 'in_progress');
});

test('Support MySQL update uses optimistic status/assignee check for all tickets', async () => {
  const queries = [];
  const repo = new MySqlSupportRepository({ execute: async (sql, params) => {
    queries.push([sql, params]); return [{ affectedRows: 1 }];
  } });
  const updated = await repo.updateRequest('normal', { status: 'in_progress', assignedTo: 'admin', resolution: null },
    { status: 'new', assignedTo: null });
  assert.equal(updated, true);
  assert.match(queries[0][0], /status=\? AND assigned_to <=> \?/);
  assert.doesNotMatch(queries[0][0], /report_kind IS NOT NULL/);
  assert.deepEqual(queries[0][1], ['in_progress', 'admin', null, 'normal', 'new', null]);
});

test('Admin UI includes claim and resolve actions for non-report support tickets', () => {
  const html = createAdminViews().adminPage([], [{ id: 'normal', topic: 'Tài khoản', status: 'new',
    code: 'HT-001', name: 'An', email: 'an@example.com', message: 'Không đăng nhập được',
    createdAt: '2026-11-18T10:00:00.000Z' }], { id: 'admin', name: 'Admin' }, []);
  assert.match(html, /data-action="claim-report" data-id="normal"/);
  assert.match(html, /Trạng thái: Mới/);
});
