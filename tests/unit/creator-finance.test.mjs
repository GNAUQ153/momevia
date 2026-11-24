import test from 'node:test';
import assert from 'node:assert/strict';
import { PaymentService } from '../../src/modules/payments/payment.service.mjs';
import { MySqlPaymentRepository } from '../../src/modules/payments/mysql.repository.mjs';
import { FinanceReport } from '../../src/modules/payments/finance-report.mjs';
import { registerPaymentRoutes } from '../../src/modules/payments/routes.mjs';
import { creatorFinancePanel } from '../../web/js/pages/creator.js';
import { adminFinancePanel } from '../../web/js/pages/admin-payments.js';

const creator = { sub: 'creator-a', role: 'creator' };
const admin = { sub: 'admin-a', role: 'admin' };
const buyer = { sub: 'buyer-a', role: 'sender' };
const sampleSummary = {
  live: { orders: 1, grossVnd: 59000, platformFeeVnd: 11800, creatorVnd: 47200 },
  sandbox: { orders: 2, grossVnd: 78000, platformFeeVnd: 15600, creatorVnd: 62400 },
};

function paymentService() {
  const calls = [];
  const repo = {
    async creatorStatement(id, limit) { calls.push(['creator', id, limit]); return { summary: sampleSummary }; },
    async adminFinance() { calls.push(['admin']); return { summary: sampleSummary }; },
  };
  return { calls, service: new PaymentService({ repository: repo, env: { CHECKOUT_STORAGE: 'mysql' } }) };
}

test('Quyền Creator: từ chối Sender; không cho truy vấn báo cáo của người khác', async () => {
  const { calls, service } = paymentService();
  await assert.rejects(service.creatorStatement(buyer), { status: 403 });
  await assert.rejects(service.adminFinance(creator), { status: 403 });
  assert.deepEqual(calls, []);
  await service.creatorStatement(creator, '15');
  assert.deepEqual(calls, [['creator', creator.sub, 15]]);
  await service.adminFinance(admin);
  assert.deepEqual(calls[1], ['admin']);
});

test('Trạng thái JSON/demo không đọc hoặc giả lập số tiền Creator', async () => {
  const service = new PaymentService({ repository: { creatorStatement: () => { throw Error('forbidden db'); } }, env: { CHECKOUT_STORAGE: 'json' } });
  await assert.rejects(service.creatorStatement(creator), { status: 503 });
  await assert.rejects(service.adminFinance(admin), { status: 503 });
});

test('Giới hạn báo cáo và xác thực phiên xảy ra trước truy vấn SQL', async () => {
  const { calls, service } = paymentService();
  for (const v of ['0', '101', '1 UNION SELECT', '-1', '1.5']) {
    await assert.rejects(service.creatorStatement(creator, v), { status: 400 });
  }
  assert.deepEqual(calls, []);
  await service.creatorStatement(admin, 100);
  assert.deepEqual(calls, [['creator', admin.sub, 100]]);
});

test('Report SQL dùng tham số id, tổng số đơn không bị giới hạn theo phân trang, tách live/sandbox', async () => {
  const seen = [];
  const fake = { execute: async (sql, params) => {
    seen.push([sql, params]);
    if (sql.includes('COUNT(*) AS order_count')) return [[
      { is_test: 0, order_count: 1, gross_vnd: 59000, platform_fee_vnd: 11800, creator_vnd: 47200 },
      { is_test: 1, order_count: 2, gross_vnd: 78000, platform_fee_vnd: 15600, creator_vnd: 62400 },
    ]];
    return [[{ order_id: 'order-1', template_id: 'template-1', gross_vnd: 59000,
      platform_fee_vnd: 11800, amount_vnd: 47200, is_test: 0,
      created_at: '2026-11-21 10:00:00', user_id: 'should-not-leak', email: 'private@example.com', checkout_url: 'secret' }]];
  } };
  const report = await new FinanceReport(fake).creatorStatement(creator.sub, 10);
  assert.deepEqual(report.summary, sampleSummary);
  assert.equal(report.canPayout, false);
  assert.equal(report.recent[0].creatorVnd, 47200);
  assert.equal(report.recent[0].sandbox, false);
  assert(!JSON.stringify(report).includes('private@example.com'));
  assert(!JSON.stringify(report).includes('should-not-leak'));
  assert(!JSON.stringify(report).includes('secret'));
  assert(seen.every(([sql, args]) => sql.includes('l.creator_id=?') && sql.includes("l.category='sale'") && sql.includes("o.status='paid'") && sql.includes('JOIN payment_receipts') && args[0] === creator.sub));
  assert.deepEqual(seen[1][1], [creator.sub, 10]);
});

test('Admin chỉ đếm đơn đã có biên nhận, phát hiện thiếu sale ledger', async () => {
  const seen = [];
  const fake = { execute: async (sql) => {
    seen.push(sql);
    if (sql.includes('COUNT(*) AS order_count')) return [[{ is_test: 0,
      order_count: 1, gross_vnd: 59000, platform_fee_vnd: 11800, creator_vnd: 47200 }]];
    return [[{ missing_count: 2 }]];
  } };
  const overview = await new FinanceReport(fake).adminOverview();
  assert.equal(overview.summary.live.orders, 1);
  assert.equal(overview.summary.sandbox.orders, 0);
  assert.equal(overview.missingSaleEntries, 2);
  assert.equal(overview.canPayout, false);
  assert(seen[0].includes('JOIN payment_receipts'));
  assert(seen[1].includes('LEFT JOIN creator_ledger'));
});

test('Webhook ghi sale đúng một lần, cùng transaction cấp quyền và biên nhận', async () => {
  const all = [];
  let paid = false;
  const client = { withTransaction: async work => {
    const run = [];
    const tx = { execute: async (sql, args = []) => {
      run.push([sql, args]);
      if (sql.includes('FROM payment_intents p JOIN orders o')) return [[{
        id: 'intent-a', order_id: '00000000-0000-4000-8000-000000000001',
        provider: 'momo', status: paid ? 'paid' : 'pending',
        order_status: paid ? 'paid' : 'pending_payment',
        amount_vnd: 59000, user_id: 'buyer-a', template_id: 'template-a',
        creator_amount_vnd: 47200, seller_id: 'creator-a', is_test: 0,
      }]];
      return [{ affectedRows: 1 }];
    } };
    const result = await work(tx);
    all.push(...run);
    if (!result.replay) paid = true;
    return result;
  } };
  const repo = new MySqlPaymentRepository(client);
  const event = { provider: 'momo', code: '123456', reference: 'provider-txn-a', amount: 59000, currency: 'VND', success: true };
  assert.equal((await repo.settleVerified(event, false)).replay, false);
  assert.equal((await repo.settleVerified(event, false)).replay, true);
  assert.equal(all.filter(([sql]) => sql.includes('INSERT INTO creator_ledger')).length, 1);
  assert.equal(all.filter(([sql]) => sql.includes('INSERT INTO template_entitlements')).length, 1);
  assert.equal(all.filter(([sql]) => sql.includes('INSERT INTO payment_receipts')).length, 1);
  const row = all.find(([sql]) => sql.includes('INSERT INTO creator_ledger'))[1];
  assert.deepEqual(row, ['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','creator-a',47200]);
});

test('Webhook template hệ thống không sinh sale ledger', async () => {
  const writes = [];
  const tx = { execute: async (sql, args = []) => {
    writes.push([sql, args]);
    if (sql.includes('FROM payment_intents p JOIN orders o')) return [[{
      id: 'intent', order_id: 'order', amount_vnd: 25000,
      status: 'pending', order_status: 'pending_payment',
      user_id: 'buyer', template_id: 'system', is_test: 1,
      creator_amount_vnd: 20000, seller_id: null,
    }]];
    return [{ affectedRows: 1 }];
  } };
  const repo = new MySqlPaymentRepository({ withTransaction: work => work(tx) });
  await repo.settleVerified({ provider: 'momo', code: 'test', reference: '123', amount: 25000, currency: 'VND', success: true }, true);
  assert.equal(writes.filter(([sql]) => sql.includes('INSERT INTO creator_ledger')).length, 0);
});

test('Endpoint API không đọc query creatorId/role được client giả mạo', async () => {
  const handlers = new Map();
  const router = { on(method, path, handler) { handlers.set(`${method} ${path}`, handler); } };
  let actor = buyer;
  const { service } = paymentService();
  registerPaymentRoutes(router, { service, config: { jwtSecret: 'test' }, resolveUser: async () => actor });
  const handler = handlers.get('GET /payments/creator/statement');
  assert.equal(typeof handler, 'function');
  const res = () => ({ writeHead(status) { this.status = status; }, end(body) { this.body = JSON.parse(body); } });
  const req = { headers: {} };
  const url = new URL('http://localhost/payments/creator/statement?creatorId=admin-a&role=admin&limit=10');
  await assert.rejects(handler({ req, res: res(), url }), { status: 403 });
  actor = creator;
  const reply = res();
  await handler({ req, res: reply, url });
  assert.equal(reply.status, 200);
  assert.deepEqual(reply.body.statement.summary, sampleSummary);
});

test('UI Creator/Admin hiển thị tiền thật và thử nghiệm riêng, không có nút rút tiền', () => {
  const statement = { summary: sampleSummary };
  const html = creatorFinancePanel(statement);
  const adminHtml = adminFinancePanel({ summary: sampleSummary, missingSaleEntries: 3 });
  for (const view of [html, adminHtml]) {
    assert.match(view, /Giao dịch thật/);
    assert.match(view, /Giao dịch thử nghiệm/);
    assert.match(view, /59\.000/);
    assert.doesNotMatch(view, /data-action="(?:withdraw|refund|mark-paid|payout)"/);
  }
  assert.match(adminHtml, /3 đơn/);
});
