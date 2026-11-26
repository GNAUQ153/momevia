import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  RefundReviewRepository, RefundReviewService, publicRefundRow,
  validRefundRequest, validRefundTransition,
} from '../../src/modules/payments/refund-review.mjs';
import { refundBuyerPanel, refundAdminPanel, refundHistoryPanel } from '../../web/js/pages/refund-review.js';

const buyer = { sub: '0a4698da-2046-4cb3-9c24-7e1d7b942b21', role: 'sender' };
const admin = { sub: '897d0107-e85b-45af-90ee-7124a5a4b489', role: 'admin' };
const other = { sub: 'df4931aa-b435-43da-82d2-f9903b40955b', role: 'sender' };
const orderId = '13bfbb5e-9429-4d1f-8555-d5fd2906a7ad';
const payload = { reasonCode: 'technical_problem', detail: 'Giao diện gặp lỗi khi mở quà tặng.' };

class StubClient {
  constructor() {
    this.requests = [];
    this.events = [];
    this.statements = [];
    this.order = { id: orderId, user_id: buyer.sub, status: 'paid', payment_provider: 'payos',
      is_test: 1, gross_vnd: 59000 };
    this.receiptConsistent = true;
  }
  row(request) {
    return { ...request, payment_provider: this.order.payment_provider,
      is_test: this.order.is_test, gross_vnd: this.order.gross_vnd };
  }
  async execute(sql, params = []) {
    this.statements.push({ sql, params });
    if (sql.includes('FROM schema_migrations')) return [[]];
    if (sql.includes('FROM orders o JOIN payment_receipts r')) {
      const [id, requester] = params;
      return [[id === this.order.id && requester === this.order.user_id && this.order.status === 'paid' && this.receiptConsistent
        ? { ...this.order, receipt_order: orderId } : []].flat()];
    }
    if (sql.includes('INSERT INTO refund_review_requests')) {
      const [id, order_id, requester_id, reason_code, reason_detail] = params;
      if (this.requests.some(r => r.order_id === order_id)) throw Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' });
      this.requests.push({ id, order_id, requester_id, reason_code, reason_detail,
        status: 'submitted', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      return [{ affectedRows: 1 }];
    }
    if (sql.includes('INSERT INTO refund_review_events')) {
      const [request_id, actor_id, from_status, to_status, note] = params.length === 3
        ? [params[0], params[1], null, 'submitted', params[2]] : params;
      this.events.push({ id: this.events.length + 1, request_id, actor_id, from_status,
        to_status, note, created_at: new Date().toISOString() });
      return [{ affectedRows: 1 }];
    }
    if (sql.includes('FROM refund_review_requests r JOIN orders o') && sql.includes('r.order_id=?')) {
      const [order_id, requester_id] = params;
      return [this.requests.filter(r => r.order_id === order_id && r.requester_id === requester_id).map(r => this.row(r))];
    }
    if (sql.includes('FROM refund_review_requests r JOIN orders o') && sql.includes('r.id=? FOR UPDATE')) {
      return [this.requests.filter(r => r.id === params[0]).map(r => this.row(r))];
    }
    if (sql.includes('FROM refund_review_requests r JOIN orders o') && sql.includes('ORDER BY r.created_at')) {
      return [this.requests.slice(0, params[0]).map(r => this.row(r))];
    }
    if (sql.includes('FROM refund_review_events e')) {
      return [this.events.filter(r => r.request_id === params[0]).slice(-params[1]).reverse()];
    }
    if (sql.includes('UPDATE refund_review_requests SET status=?')) {
      const [status, id, expected] = params;
      const row = this.requests.find(r => r.id === id && r.status === expected);
      if (row) row.status = status;
      return [{ affectedRows: Number(Boolean(row)) }];
    }
    throw new Error(`Unrecognised mock SQL: ${sql.slice(0, 100)}`);
  }
  async withTransaction(work) { return work({ execute: (sql, params = []) => this.execute(sql, params) }); }
}

const setup = () => {
  const client = new StubClient();
  const repo = new RefundReviewRepository(client);
  const service = new RefundReviewService({ repository: repo, env: { CHECKOUT_STORAGE: 'mysql' } });
  return { client, service };
};

test('Payload chỉ chấp nhận mã lý do whitelist và mô tả đủ dài', () => {
  assert.deepEqual(validRefundRequest(payload), payload);
  assert.throws(() => validRefundRequest({ reasonCode: '=IMPORTDATA()', detail: payload.detail }), { status: 400 });
  assert.throws(() => validRefundRequest({ reasonCode: 'other', detail: 'ngắn' }), { status: 400 });
  assert.throws(() => validRefundRequest({ reasonCode: 'other', detail: 1 }), { status: 400 });
});

test('Trạng thái chỉ chuyển trong đồ thị nội bộ, không có trạng thái refunded/paid', () => {
  assert.deepEqual(validRefundTransition({ expectedStatus: 'submitted', status: 'in_review', note: 'Đã kiểm tra biên nhận.' }),
    { expectedStatus: 'submitted', status: 'in_review', note: 'Đã kiểm tra biên nhận.' });
  for (const status of ['refunded', 'paid', 'closed_completed', 'submitted'])
    assert.throws(() => validRefundTransition({ expectedStatus: 'submitted', status, note: 'Nhân viên kiểm tra.' }), { status: 400 });
  assert.throws(() => validRefundTransition({ expectedStatus: 'closed_declined', status: 'in_review', note: 'Thử mở lại.' }), { status: 400 });
});

test('Storage JSON phải báo không khả dụng, không ghi yêu cầu tài chính vào JSON demo', async () => {
  const service = new RefundReviewService({ repository: { createBuyerRequest: () => assert.fail('wrote') }, env: { CHECKOUT_STORAGE: 'json' } });
  await assert.rejects(service.buyerCreate(buyer, orderId, payload), { status: 503 });
});

test('Admin-only list/transition/history; không tin role do client khai', async () => {
  const { service } = setup();
  await assert.rejects(service.adminList(other, 10), { status: 403 });
  await assert.rejects(service.adminMove(other, orderId, { expectedStatus: 'submitted', status: 'in_review', note: 'Đã kiểm tra biên nhận.' }), { status: 403 });
  await assert.rejects(service.adminHistory(other, orderId, 10), { status: 403 });
  await assert.rejects(service.adminList(admin, '101'), { status: 400 });
});

test('Buyer không được gửi thay đơn người khác hoặc id không hợp lệ', async () => {
  const { service } = setup();
  await assert.rejects(service.buyerCreate(other, orderId, payload), { status: 404 });
  await assert.rejects(service.buyerCreate(buyer, 'not-an-order-id', payload), { status: 400 });
});

test('Chỉ nhận đơn verified paid có receipt; không tự ghi ledger, entitlement hoặc refund', async () => {
  const { service, client } = setup();
  const created = await service.buyerCreate(buyer, orderId, payload);
  assert.equal(created.status, 'submitted');
  assert.equal(created.sandbox, true);
  assert.equal(client.requests.length, 1);
  assert.equal(client.events.length, 1);
  assert.equal(client.events[0].to_status, 'submitted');
  const sql = client.statements.map(x => x.sql).join('\n');
  assert.match(sql, /JOIN payment_receipts r/);
  assert.match(sql, /JOIN payment_intents p/);
  assert.match(sql, /BINARY r.provider_reference=BINARY p.provider_reference/);
  assert.doesNotMatch(sql, /UPDATE orders|UPDATE creator_ledger|UPDATE payment_intents|UPDATE template_entitlements/i);
});

test('Replay POST cùng đơn không tạo hồ sơ hay sự kiện lặp', async () => {
  const { service, client } = setup();
  const first = await service.buyerCreate(buyer, orderId, payload);
  const replay = await service.buyerCreate(buyer, orderId, payload);
  assert.equal(first.id, replay.id);
  assert.equal(client.requests.length, 1);
  assert.equal(client.events.length, 1);
});

test('POST cùng đơn nhưng đổi lý do hoặc nội dung phải trả 409, không âm thầm giữ hồ sơ cũ', async () => {
  const { service, client } = setup();
  const first = await service.buyerCreate(buyer, orderId, payload);
  await assert.rejects(service.buyerCreate(buyer, orderId, {
    ...payload, reasonCode: 'other',
  }), { status: 409, messageKey: 'refund.errors.duplicatePayload' });
  await assert.rejects(service.buyerCreate(buyer, orderId, {
    ...payload, detail: 'Tôi muốn bổ sung một mô tả khác cho giao dịch này.',
  }), { status: 409, messageKey: 'refund.errors.duplicatePayload' });
  assert.equal(client.requests.length, 1);
  assert.equal(client.events.length, 1);
  assert.equal((await service.buyerGet(buyer, orderId)).id, first.id);
  assert.equal((await service.buyerGet(buyer, orderId)).detail, payload.detail);
});

test('Buyer chỉ đọc hồ sơ của chính mình', async () => {
  const { service } = setup();
  await service.buyerCreate(buyer, orderId, payload);
  assert.equal((await service.buyerGet(buyer, orderId)).status, 'submitted');
  assert.equal(await service.buyerGet(other, orderId), null);
});

test('Admin đổi trạng thái và nhật ký được ghi; CAS ngăn hai Admin cập nhật stale', async () => {
  const { service, client } = setup();
  const created = await service.buyerCreate(buyer, orderId, payload);
  const move = { expectedStatus: 'submitted', status: 'in_review', note: 'Đã đối chiếu đơn và biên nhận.' };
  assert.equal((await service.adminMove(admin, created.id, move)).status, 'in_review');
  await assert.rejects(service.adminMove(admin, created.id, move), { status: 409 });
  assert.equal(client.events.length, 2);
  const events = await service.adminHistory(admin, created.id, 50);
  assert.equal(events[0].toStatus, 'in_review');
  assert.equal(events[0].actorId, admin.sub);
});

test('API Admin trả metadata whitelist, không lộ payload ngân hàng', async () => {
  const { service } = setup();
  await service.buyerCreate(buyer, orderId, payload);
  const records = await service.adminList(admin, 100);
  assert.equal(records.length, 1);
  assert.equal(records[0].canRefund, false);
  const text = JSON.stringify(records);
  assert(!text.includes('provider_reference'));
  assert(!text.includes('checkout_url'));
  assert.deepEqual(Object.keys(publicRefundRow({ id: 'id', order_id: 'id', reason_code: 'other', reason_detail: 'ok',
    status: 'submitted', is_test: 1, gross_vnd: 59000, payment_provider: 'payos' })).sort(),
  ['id','orderId','status','reasonCode','detail','provider','sandbox','amountVnd','createdAt','updatedAt','canRefund'].sort());
});

test('Giao diện escape mô tả/ghi chú người dùng, trạng thái không gọi là hoàn tiền thành công', () => {
  const unsafe = '<img src=x onerror=alert(1)>';
  assert.doesNotMatch(refundAdminPanel([{ id: orderId, orderId, status: 'submitted', reasonCode: 'other', detail: unsafe,
    amountVnd: 59000, sandbox: false }]), /<img src=x/);
  assert.match(refundAdminPanel([{ id: orderId, orderId, status: 'submitted', reasonCode: 'other', detail: unsafe,
    amountVnd: 59000, sandbox: false }]), /&lt;img/);
  assert.doesNotMatch(refundHistoryPanel([{ toStatus: 'in_review', note: unsafe, createdAt: '2026-11-21' }]), /<img src=x/);
  assert.match(refundBuyerPanel({ status: 'paid', orderId }, null), /id="refund-request-form"/);
  assert.doesNotMatch(refundBuyerPanel({ status: 'pending', orderId }, null), /id="refund-request-form"/);
  assert.doesNotMatch(refundBuyerPanel({ status: 'paid', orderId }, null, false), /id="refund-request-form"/);
});

test('Migration, routes và front-end có đầy đủ luồng và không thêm trạng thái thanh toán thủ công', async () => {
  const migration = await readFile(new URL('../../database/migrations/010_refund_review.sql', import.meta.url), 'utf8');
  const dbVerify = await readFile(new URL('../../database/scripts/mysql-verify.mjs', import.meta.url), 'utf8');
  const routes = await readFile(new URL('../../src/modules/payments/routes.mjs', import.meta.url), 'utf8');
  const app = await readFile(new URL('../../web/js/app/main.js', import.meta.url), 'utf8');
  assert.match(migration, /UNIQUE KEY refund_review_order_uk/);
  assert.match(migration, /refund_review_events/);
  assert.match(dbVerify, /'010_refund_review'/);
  assert.match(dbVerify, /'refund_review_requests', 'refund_review_events'/);
  assert.match(routes, /'POST', '\/payments\/orders\/:orderId\/refund-request'/);
  assert.match(routes, /'POST', '\/payments\/admin\/refund-requests\/:requestId\/transition'/);
  assert.match(app, /refundBuyerPanel\(payment, refundRequest, refundAvailable\)/);
  assert.match(app, /form.id === 'refund-request-form'/);
  assert.match(app, /"refund-request-form",/); // Submit must be intercepted to avoid query-string PII.
  const adminView = await readFile(new URL('../../web/js/pages/admin-payments.js', import.meta.url), 'utf8');
  assert.match(adminView, /refundAdminPanel\(refunds, refundPage\)/);
  assert.doesNotMatch(routes, /refund-execute|refund-provider|payout-execute/);
});

test('Biên nhận sai lệch không tạo hồ sơ hoặc nhật ký', async () => {
  const { service, client } = setup();
  client.receiptConsistent = false;
  await assert.rejects(service.buyerCreate(buyer, orderId, payload), { status: 404 });
  assert.equal(client.requests.length, 0);
  assert.equal(client.events.length, 0);
});
