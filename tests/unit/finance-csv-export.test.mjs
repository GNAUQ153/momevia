import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  adminExceptionsCsv,
  creatorSalesCsv,
  csvCell,
  exportFileName,
} from '../../web/js/features/finance/export-csv.js';
import { adminReconciliationPanel } from '../../web/js/pages/admin-payments.js';
import { creatorFinancePanel } from '../../web/js/pages/creator.js';

const audit = (records = []) => ({ scope: 'internal_paid_order_exceptions', records, scanLimit: 100 });
const statement = (recent = []) => ({ scope: 'verified_paid_sales', currency: 'VND', recent });
const anomaly = {
  orderId: '8ec9e214-4994-4808-b028-8d8033250000',
  provider: 'payos', sandbox: true, amountVnd: 59000,
  createdAt: '2026-11-21T07:11:00Z', issues: ['receipt', 'split'],
};
const sale = {
  orderId: '8ec9e214-4994-4808-b028-8d8033250000', templateId: 'template-01',
  sandbox: false, grossVnd: 59000, platformFeeVnd: 11800, creatorVnd: 47200,
  bookedAt: '2026-11-21T07:11:00Z',
};

test('Admin CSV chỉ gồm trường tài chính whitelist, tách sandbox và mã lỗi', () => {
  const csv = adminExceptionsCsv(audit([{ ...anomaly, email: 'private@example.org', token: 'secret-token' }]));
  assert.match(csv, /^\uFEFForder_id,provider,environment,amount_vnd,created_at_utc,issue_codes\r\n/);
  assert.match(csv, /"payos","sandbox","59000","2026-11-21T07:11:00.000Z","receipt\|split"/);
  assert(!csv.includes('private@example.org'));
  assert(!csv.includes('secret-token'));
  assert.equal(csv.trim().split('\r\n').length, 2);
});

test('Creator CSV ghi số tiền nguyên VND không format theo locale; không chứa dữ liệu buyer', () => {
  const csv = creatorSalesCsv(statement([{ ...sale, buyerId: 'private-id', refundToken: 'private-token' }]));
  assert.match(csv, /order_id,template_id,environment,gross_vnd,platform_fee_vnd,creator_vnd,booked_at_utc/);
  assert.match(csv, /"59000","11800","47200"/);
  assert.match(csv, /"live"/);
  assert(!csv.includes('private-id'));
  assert(!csv.includes('private-token'));
});

test('CSV quote mọi ô và vô hiệu hóa công thức Excel ở trường ID không tin cậy', () => {
  for (const payload of [
    '=HYPERLINK("https://evil.invalid")',
    '   =1+1',
    '+1+1',
    '-2+3',
    '@SUM(1,2)',
    '\t=1+1',
  ]) {
    const value = csvCell(payload);
    assert(value.startsWith('"\''), payload);
    assert(value.endsWith('"'), payload);
  }
  assert.equal(csvCell('value,"test"'), '"value,""test"""');
  assert.equal(csvCell("\n=1+2"), "\"\' =1+2\"");
  const exported = adminExceptionsCsv(audit([{ ...anomaly, orderId: '=HYPERLINK("https://evil.invalid")', issues: ['receipt', '=BAD()'] }]));
  assert.match(exported, /"'=HYPERLINK\(""https:\/\/evil.invalid""\)"/);
  assert(!exported.includes('BAD()'));
});

test('Không xuất dữ liệu sai scope, số tiền âm, float hoặc record vượt giới hạn', () => {
  assert.throws(() => adminExceptionsCsv({ ...audit([anomaly]), scope: 'something_else' }), TypeError);
  assert.throws(() => creatorSalesCsv({ ...statement([sale]), currency: 'USD' }), TypeError);
  assert.throws(() => adminExceptionsCsv(audit([{ ...anomaly, amountVnd: -1 }])), TypeError);
  assert.throws(() => creatorSalesCsv(statement([{ ...sale, creatorVnd: 3.14 }])), TypeError);
  assert.throws(() => creatorSalesCsv(statement([{ ...sale, grossVnd: Number.MAX_SAFE_INTEGER + 1 }])), TypeError);
  assert.throws(() => adminExceptionsCsv(audit(Array(101).fill(anomaly))), TypeError);
  assert.throws(() => creatorSalesCsv(statement(Array(101).fill(sale))), TypeError);
});

test('UI chỉ hiển thị nút xuất khi có dữ liệu, không hiện khi lỗi hoặc rỗng', () => {
  assert.doesNotMatch(adminReconciliationPanel(null), /admin-finance-export/);
  assert.doesNotMatch(adminReconciliationPanel(audit()), /admin-finance-export/);
  assert.match(adminReconciliationPanel(audit([anomaly])), /data-action="admin-finance-export"/);
  assert.doesNotMatch(creatorFinancePanel(null), /creator-finance-export/);
  const summary = { live: { orders: 0, grossVnd: 0, platformFeeVnd: 0, creatorVnd: 0 }, sandbox: { orders: 0, grossVnd: 0, platformFeeVnd: 0, creatorVnd: 0 } };
  assert.doesNotMatch(creatorFinancePanel({ summary, recent: [] }), /creator-finance-export/);
  assert.match(creatorFinancePanel({ summary, recent: [sale] }), /data-action="creator-finance-export"/);
});

test('Tên CSV cố định, không nhận path injection; luồng frontend sử dụng endpoint role-scoped', async () => {
  assert.equal(exportFileName('creator-sales', new Date('2026-11-21T00:00:00Z')), 'momevia-creator-sales-2026-11-21.csv');
  assert.throws(() => exportFileName('../../private', new Date()), TypeError);
  const app = await readFile(new URL('../../web/js/app/finance-actions.js', import.meta.url), 'utf8');
  assert.match(app, /state\.user\?\.role !== 'admin'/);
  assert.match(app, /'\/checkout\/payments\/creator\/statement\?limit=100'/);
  assert.match(app, /'\/checkout\/payments\/admin\/finance\/exceptions\?limit=100'/);
  assert(!/exportFileName\('admin-exceptions',\s*element\.dataset/.test(app));
});
