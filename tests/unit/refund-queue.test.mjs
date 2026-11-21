import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  RefundReviewRepository, RefundReviewService, readRefundQueueCursor,
  writeRefundQueueCursor, refundQueueFilters,
} from '../../src/modules/payments/refund-review.mjs';
import { refundAdminPanel } from '../../web/js/pages/refund-review.js';

const admin = { sub: '897d0107-e85b-45af-90ee-7124a5a4b489', role: 'admin' };
const buyer = { sub: '0a4698da-2046-4cb3-9c24-7e1d7b942b21', role: 'sender' };
const creator = { sub: 'c920e2cc-005e-4cd3-888f-254bd621ab91', role: 'creator' };

class QueueStub {
  constructor() {
    this.calls = [];
    this.rows = Array.from({ length: 34 }, (_, index) => {
      const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
      const timestamp = `2026-11-21 12:${String(index).padStart(2, '0')}:00.000000`;
      return {
        id, order_id: id, requester_id: buyer.sub,
        reason_code: 'technical_problem', reason_detail: `Lỗi giao diện số ${index}`,
        status: index % 5 === 0 ? 'closed_declined' : index % 3 === 0 ? 'in_review' : 'submitted',
        page_created: timestamp, created_at: timestamp, updated_at: timestamp,
        payment_provider: 'payos', is_test: 1, gross_vnd: 59000,
      };
    });
  }
  async execute(sql, params = []) {
    this.calls.push({ sql, params });
    assert.match(sql, /^SELECT r\.\*,o\.payment_provider/);
    assert.match(sql, /ORDER BY r\.created_at DESC,r\.id DESC LIMIT \?/);
    assert(!sql.includes('UPDATE ') && !sql.includes('DELETE '));
    const size = params.at(-1);
    const explicitFilter = /r\.status=\?/.test(sql) ? params[0] : null;
    const cursor = /r\.created_at < \?/.test(sql)
      ? { time: params.at(-4), id: params.at(-2) } : null;
    const items = [...this.rows].filter(r => (!sql.includes("r.status IN ('submitted'") || r.status !== 'closed_declined')
      && (!explicitFilter || r.status === explicitFilter)
      && (!cursor || r.page_created < cursor.time || (r.page_created === cursor.time && r.id < cursor.id)))
      .sort((a, b) => b.page_created.localeCompare(a.page_created) || b.id.localeCompare(a.id));
    return [items.slice(0, size)];
  }
}

function setup(env = 'mysql') {
  const db = new QueueStub();
  const repository = new RefundReviewRepository(db);
  return { db, service: new RefundReviewService({ repository, env: { CHECKOUT_STORAGE: env } }) };
}

test('Hàng đợi chỉ cho Admin và storage MySQL, không tin vai trò do client khai', async () => {
  const { service } = setup();
  await assert.rejects(service.adminQueue(buyer), { status: 403 });
  await assert.rejects(service.adminQueue(creator), { status: 403 });
  await assert.rejects(setup('json').service.adminQueue(admin), { status: 503 });
});

test('Bộ lọc và limit phải whitelist, dữ liệu được tham số hoá SQL', async () => {
  const { db, service } = setup();
  for (const filter of ['x', "all' OR 1=1 --", 'refunded', ''])
    await assert.rejects(service.adminQueue(admin, { filter }), { status: 400 });
  for (const limit of ['101', '-1', '1 OR 1=1', '0'])
    await assert.rejects(service.adminQueue(admin, { limit }), { status: 400 });
  const { requests } = await service.adminQueue(admin, { filter: 'submitted', limit: '4' });
  assert.equal(requests.length, 4);
  assert.match(db.calls.at(-1).sql, /r\.status=\?/);
  assert.equal(db.calls.at(-1).params[0], 'submitted');
  assert.equal(db.calls.at(-1).params.at(-1), 5);
  assert(!db.calls.at(-1).sql.includes('submitted'));
  assert.deepEqual(refundQueueFilters, ['active', 'submitted', 'in_review', 'awaiting_provider', 'closed_declined', 'all']);
});

test('Phân trang cursor theo thời gian và UUID, không trùng hoặc bỏ qua hồ sơ', async () => {
  const { db, service } = setup();
  let cursor = null;
  const ids = [];
  for (let pages = 0; pages < 10; pages++) {
    const page = await service.adminQueue(admin, { filter: 'active', limit: '7', cursor });
    ids.push(...page.requests.map(r => r.id));
    cursor = page.nextCursor;
    if (!cursor) break;
  }
  assert.equal(ids.length, db.rows.filter(row => row.status !== 'closed_declined').length);
  assert.equal(new Set(ids).size, ids.length);
  assert(ids.every(id => db.rows.find(row => row.id === id)?.status !== 'closed_declined'));
});

test('Cursor giả, thay bộ lọc, vượt kích thước và nội dung giả mạo đều bị từ chối', async () => {
  const { db, service } = setup();
  const row = db.rows[0];
  const cursor = writeRefundQueueCursor(row, 'all');
  assert.deepEqual(readRefundQueueCursor(cursor, 'all'), { time: row.page_created, id: row.id });
  for (const invalid of ['not-base64!', 'a'.repeat(300), Buffer.from('{}').toString('base64url'), `${cursor}a`])
    assert.throws(() => readRefundQueueCursor(invalid, 'all'), { status: 400 });
  await assert.rejects(service.adminQueue(admin, { filter: 'submitted', cursor }), { status: 400 });
});

test('Phân trang all/closed cho ra dữ liệu đúng và không lộ thông tin ngân hàng', async () => {
  const { service, db } = setup();
  const page = await service.adminQueue(admin, { filter: 'closed_declined', limit: 100 });
  assert.equal(page.nextCursor, null);
  assert.equal(page.requests.length, db.rows.filter(r => r.status === 'closed_declined').length);
  for (const row of page.requests) {
    assert.equal(row.canRefund, false);
    assert(!Object.keys(row).some(key => /webhook|bank|token|secret|raw/i.test(key)));
  }
});

test('UI bộ lọc VI/EN, phân trang và nội dung nguy hiểm được escape', () => {
  const html = refundAdminPanel([{ id: 'a', orderId: 'b', status: 'submitted', reasonCode: 'other',
    detail: '<img src=x onerror=alert(1)>', amountVnd: 59000 }],
  { filter: 'active', nextCursor: 'safeCursor', hasPrev: true });
  assert.match(html, /admin-refund-filter/);
  assert.match(html, /data-action="admin-refund-next"/);
  assert.match(html, /data-action="admin-refund-prev"/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img/);
});

test('Route mới chỉ gọi service đã xác thực; không mở endpoint thay đổi dòng tiền', async () => {
  const source = await readFile(new URL('../../src/modules/payments/routes.mjs', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../../web/js/app/main.js', import.meta.url), 'utf8');
  assert.match(source, /'GET', '\/payments\/admin\/refund-queue'/);
  assert.match(source, /service\.refundReview\.adminQueue\(admin/);
  assert.match(ui, /admin\/refund-queue\?filter=active&limit=20/);
  assert.match(ui, /admin-refund-next/);
  assert.doesNotMatch(source, /refund-execute|payout-execute/);
});
