import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { integrityCheckIds, readIntegrityCounts, auditIntegrity } from '../../database/scripts/integrity-audit.mjs';

const answers = () => integrityCheckIds.map(checkId => ({ checkId, violations: '0' }));
const client = rows => ({ async execute() { return [rows]; } });
const latest = { status: 'latest', issues: [], remaining: [] };

test('Integrity audit dùng một SELECT, không trả bản ghi cá nhân', async () => {
  let calls = 0;
  const rows = answers().map(row => ({ ...row, privateValue: 'không được xuất' }));
  const result = await auditIntegrity({ async execute(sql, params) {
    calls++;
    assert.match(sql, /^SELECT /);
    assert.equal(sql.split('UNION ALL').length, 11);
    assert.equal(params, undefined);
    assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|ALTER|DROP|FOR UPDATE)\b/i);
    return [rows.reverse()];
  } }, latest);
  assert.equal(calls, 1);
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.checks, answers().map(({ checkId, violations }) => ({ id: checkId, violations })));
  assert.doesNotMatch(JSON.stringify(result), /privateValue|không được xuất/);
});

test('Báo bất thường theo invariant và giữ COUNT chính xác', async () => {
  const rows = answers();
  rows[0].violations = '9007199254740993';
  rows[5].violations = '2';
  const result = await readIntegrityCounts(client(rows));
  assert.equal(result.status, 'review_required');
  assert.equal(result.checks[0].violations, '9007199254740993');
  assert.deepEqual(result.failedChecks, ['entitlement_order', 'payment_scope_key']);
});

test('Không truy vấn dữ liệu nghiệp vụ nếu schema chưa hợp lệ', async () => {
  for (const schema of [null, { status: 'pending_migrations' }, { ...latest, issues: ['missing'] }, { ...latest, remaining: ['020'] }]) {
    const report = await auditIntegrity({ execute() { assert.fail('Không được gọi SQL'); } }, schema);
    assert.equal(report.status, 'skipped_schema');
    assert.deepEqual(report.checks, []);
  }
});

test('Fail closed nếu thiếu, trùng hoặc lạ check ID', async () => {
  for (const rows of [answers().slice(1), [...answers(), answers()[0]], [...answers().slice(1), { checkId: 'unknown', violations: '0' }]]) {
    await assert.rejects(readIntegrityCounts(client(rows)), /integrity audit/);
  }
});

test('Không chấp nhận COUNT âm, null, số thực hoặc kiểu không đúng', async () => {
  for (const value of ['-1', '1.5', '01', null, 0, 'NaN']) {
    const rows = answers(); rows[0].violations = value;
    await assert.rejects(readIntegrityCounts(client(rows)), /integrity audit/);
  }
});

test('Lỗi MySQL không được chuyển thành báo cáo sạch', async () => {
  const error = new Error('synthetic database failure');
  await assert.rejects(readIntegrityCounts({ async execute() { throw error; } }), error);
});

test('CLI offline vẫn chạy và từ chối integrity nếu không có live opt-in', () => {
  const script = new URL('../../database/scripts/mysql-audit.mjs', import.meta.url);
  const path = fileURLToPath(script);
  const report = JSON.parse(execFileSync(process.execPath, [path], { encoding: 'utf8' }));
  assert.equal(report.mode, 'offline');
  assert.equal(report.integrity, undefined);
  const result = spawnSync(process.execPath, [path, '--integrity'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
});
