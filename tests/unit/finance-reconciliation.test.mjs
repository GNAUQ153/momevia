import test from 'node:test';
import assert from 'node:assert/strict';
import { PaymentService } from '../../src/modules/payments/payment.service.mjs';
import { ReconciliationAudit, sanitizeAuditRow } from '../../src/modules/payments/reconciliation-audit.mjs';
import { registerPaymentRoutes } from '../../src/modules/payments/routes.mjs';
import { adminPaymentsPage, adminReconciliationPanel } from '../../web/js/pages/admin-payments.js';
import { creatorFinancePanel } from '../../web/js/pages/creator.js';
import { readFile } from 'node:fs/promises';

const buyer = { sub: 'buyer-one', role: 'sender' };
const creator = { sub: 'creator-one', role: 'creator' };
const admin = { sub: 'admin-one', role: 'admin' };

function mockService() {
  const calls = [];
  const repository = { adminFinanceExceptions: async limit => {
    calls.push(limit);
    return { records: [], canRefund: false, canPayout: false, scanLimit: limit };
  } };
  return { calls, service: new PaymentService({ repository, env: { CHECKOUT_STORAGE: 'mysql' } }) };
}

test('Chỉ Admin có quyền xem ngoại lệ; Sender/Creator không được truy vấn repository', async () => {
  const { calls, service } = mockService();
  await assert.rejects(service.adminFinanceExceptions(buyer, 10), { status: 403 });
  await assert.rejects(service.adminFinanceExceptions(creator, 10), { status: 403 });
  assert.deepEqual(calls, []);
  const result = await service.adminFinanceExceptions(admin, 15);
  assert.equal(result.scanLimit, 15);
  assert.deepEqual(calls, [15]);
});

test('Không có MySQL thì không tạo số liệu giả hoặc mở API báo cáo', async () => {
  let touched = false;
  const service = new PaymentService({
    repository: { adminFinanceExceptions: () => { touched = true; } },
    env: { CHECKOUT_STORAGE: 'json' },
  });
  await assert.rejects(service.adminFinanceExceptions(admin), { status: 503 });
  assert.equal(touched, false);
});

test('Giới hạn đầu vào 1..100, chống SQL injection trước khi gọi DB', async () => {
  const { calls, service } = mockService();
  for (const invalid of ['0', '-1', '101', '1 UNION SELECT', '2.5', ' 10', '0001', '1; DROP TABLE']) {
    await assert.rejects(service.adminFinanceExceptions(admin, invalid), { status: 400 });
  }
  assert.deepEqual(calls, []);
  assert.equal((await service.adminFinanceExceptions(admin)).scanLimit, 50);
  assert.deepEqual(calls, [50]);
});

test('Truy vấn có parameter, chỉ paid PSP, không đọc PII; chỉ SELECT', async () => {
  const seen = [];
  const repo = new ReconciliationAudit({ execute: async (sql, params) => {
    seen.push({ sql, params });
    return [[{
      order_id: 'order-1', payment_provider: 'payos', is_test: 0, gross_vnd: 59000,
      created_at: '2026-11-21T09:00:00Z', intent_issue: 1, receipt_issue: 0,
      entitlement_issue: 1, creator_sale_issue: 0, split_issue: 0,
      user_id: 'sensitive', provider_reference: 'SECRET', buyer_email: 'x@example.org',
    }]];
  } });
  const result = await repo.exceptions(25);
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0].params, [25]);
  assert.match(seen[0].sql, /o\.status='paid'/);
  assert.match(seen[0].sql, /o\.payment_provider IN \('momo','payos'\)/);
  assert.match(seen[0].sql, /LEFT JOIN payment_receipts/);
  assert.match(seen[0].sql, /LEFT JOIN template_entitlements/);
  assert.match(seen[0].sql, /LEFT JOIN creator_ledger/);
  assert.match(seen[0].sql, /LIMIT \?/);
  assert.doesNotMatch(seen[0].sql, /\b(?:INSERT|UPDATE|DELETE|REPLACE)\b/i);
  assert.deepEqual(result.records[0].issues, ['intent', 'entitlement']);
  assert.equal(result.records[0].amountVnd, 59000);
  assert.equal(result.records[0].sandbox, false);
  assert.equal(result.canRefund, false);
  assert.equal(result.canPayout, false);
  for (const secret of ['sensitive', 'SECRET', 'x@example.org']) {
    assert(!JSON.stringify(result).includes(secret));
  }
});

test('Cờ đối soát đều ánh xạ theo whitelist; số tiền âm hoặc quá lớn bị từ chối', () => {
  const record = sanitizeAuditRow({
    order_id: 'x', payment_provider: 'momo', is_test: 1, gross_vnd: 39000,
    created_at: '2026-11-21', intent_issue: '0', receipt_issue: 1,
    entitlement_issue: 0, creator_sale_issue: 1, split_issue: 1,
    unknown_issue: 1,
  });
  assert.deepEqual(record.issues, ['receipt', 'creatorSale', 'split']);
  assert.equal(record.sandbox, true);
  assert.equal(record.provider, 'momo');
  for (const amount of [-1, Number.MAX_SAFE_INTEGER + 1, 'Infinity']) {
    assert.throws(() => sanitizeAuditRow({ gross_vnd: amount }), /Invalid financial amount/);
  }
});

test('Route Admin kiểm tra quyền từ phiên; bỏ qua role hoặc creatorId trong query', async () => {
  const handlers = new Map();
  const router = { on(method, path, fn) { handlers.set(method + ' ' + path, fn); } };
  let actor = buyer;
  const { service } = mockService();
  registerPaymentRoutes(router, { service, config: { jwtSecret: 'unused' }, resolveUser: async () => actor });
  const handler = handlers.get('GET /payments/admin/finance/exceptions');
  assert.equal(typeof handler, 'function');
  const makeRes = () => ({ writeHead(status) { this.status = status; }, end(body) { this.body = JSON.parse(body); } });
  const req = { headers: {} };
  const url = new URL('http://localhost/payments/admin/finance/exceptions?limit=15&role=admin&creatorId=spoofed');
  await assert.rejects(handler({ req, res: makeRes(), url }), { status: 403 });
  actor = admin;
  const res = makeRes();
  await handler({ req, res, url });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.audit.records, []);
  assert.equal(res.body.audit.scanLimit, 15);
});

test('UI Admin chỉ hiện trạng thái dữ liệu chưa tải; không đánh lừa bằng số 0', () => {
  const unavailable = adminReconciliationPanel(null);
  assert.match(unavailable, /Chưa truy vấn được/);
  assert.doesNotMatch(unavailable, /Không phát hiện sai lệch/);
  const empty = adminReconciliationPanel({ records: [], scanLimit: 50 });
  assert.match(empty, /Không phát hiện sai lệch/);
  const page = adminPaymentsPage([], { audit: null });
  assert.match(page, /Chưa truy vấn được/);
});

test('UI danh sách không chèn HTML không tin cậy và không có thao tác chi trả/hoàn tiền', () => {
  const audit = adminReconciliationPanel({ scanLimit: 10, records: [{
    orderId: '12345<svg/onload=alert(1)>', provider: '<iframe>', sandbox: true,
    amountVnd: 39000, createdAt: '2026-11-21T00:00:00Z', issues: ['receipt', '<script>'],
  }] });
  assert.doesNotMatch(audit, /<svg|<iframe|<script>/);
  assert.match(audit, /Giao dịch thử nghiệm/);
  assert.match(audit, /Thiếu biên nhận/);
  assert.doesNotMatch(audit, /data-action="(?:refund|pay|payout|mark-paid)"/);
});

test('UI Creator sử dụng báo cáo thật có lịch sử, escape tên mẫu; không hiển thị nút rút', () => {
  const summary = { live: { orders: 1, grossVnd: 59000, platformFeeVnd: 11800, creatorVnd: 47200 }, sandbox: { orders: 0, grossVnd: 0, platformFeeVnd: 0, creatorVnd: 0 } };
  const html = creatorFinancePanel({ summary, recent: [{
    templateId: 'template<script>alert(1)</script>', orderId: '00000000-0000-4000-8000-000000000001',
    creatorVnd: 47200, sandbox: false,
  }] });
  assert.match(html, /Giao dịch Creator gần đây/);
  assert.match(html, /47\.200/);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /data-action="(?:payout|withdraw|refund)"/);
});

test('Hai từ điển có cùng khóa và cùng bộ tham số nội suy', async () => {
  const vi = JSON.parse(await readFile(new URL('../../web/assets/locales/vi.json', import.meta.url)));
  const en = JSON.parse(await readFile(new URL('../../web/assets/locales/en.json', import.meta.url)));
  assert.deepEqual(Object.keys(vi).sort(), Object.keys(en).sort());
  for (const key of Object.keys(vi)) {
    const match = value => [...String(value).matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map(m => m[1]).sort();
    assert.deepEqual(match(vi[key]), match(en[key]), `Parameters of ${key} are different`);
  }
});
