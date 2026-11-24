import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MySqlPaymentRepository } from '../../src/modules/payments/mysql.repository.mjs';

const request = { userId: 'buyer', templateId: 'premium', title: 'Mẫu', amount: 10000, provider: 'momo', isTest: false };
const row = (isTest, id = 'legacy') => ({ id, order_id: `order-${id}`, order_user: 'buyer', order_template: 'premium', is_test: isTest, amount_vnd: 10000, provider: 'momo', status: 'pending', checkout_url: `https://example.test/${id}` });
function fixture({ migrated = true, owner = true, legacy, scoped, failInsert = false } = {}) {
  const calls = [];
  let commits = 0;
  const repo = new MySqlPaymentRepository({
    async withTransaction(work) {
      const result = await work({ async execute(sql, args = []) {
        calls.push([sql, args]);
        if (sql.includes('FROM schema_migrations')) return [migrated ? [{ version: '017_payment_scope_keys' }] : []];
        if (sql.includes('FROM users')) return [owner ? [{ id: 'buyer' }] : []];
        if (sql.includes('FROM payment_checkout_scope_keys')) return [scoped ? [scoped] : []];
        if (sql.includes('FROM payment_checkout_keys')) return [legacy ? [legacy] : []];
        if (failInsert && sql.includes('INSERT INTO payment_checkout_scope_keys')) throw Error('injected key error');
        return [{ affectedRows: 1 }];
      } });
      commits++;
      return result;
    },
  }, { scopedCheckout: true });
  return { repo, calls, commits: () => commits };
}
const inserts = calls => calls.filter(([sql]) => sql.includes('INSERT INTO'));

test('Chưa migration hoặc chủ tài khoản không hợp lệ thì không ghi giao dịch', async () => {
  for (const [options, status] of [[{ migrated: false }, 503], [{ owner: false }, 403]]) {
    const f = fixture(options);
    await assert.rejects(f.repo.createPending(request), { status });
    assert.equal(inserts(f.calls).length, 0);
    assert.equal(f.commits(), 0);
  }
});

test('Khóa cũ đúng scope vẫn replay, kể cả tạo sau migration', async () => {
  const f = fixture({ legacy: row(0) });
  const result = await f.repo.createPending(request);
  assert.equal(result.id, 'legacy');
  assert.equal(result.isTest, false);
  assert.equal(inserts(f.calls).length, 0);
  assert.deepEqual(f.calls[2][1], ['buyer', 'premium', 0]);
  assert.match(f.calls[1][0], /FOR UPDATE/);
});

test('Khóa Sandbox cũ không chặn tạo khóa Live; không sửa khóa cũ', async () => {
  const f = fixture({ legacy: row(1) });
  const result = await f.repo.createPending(request);
  assert.equal(result.isTest, false);
  assert.equal(result.checkoutUrl, null);
  assert.equal(inserts(f.calls).length, 3);
  assert.deepEqual(inserts(f.calls)[2][1], ['buyer', 'premium', 0, result.id]);
  assert.equal(f.commits(), 1);
});

test('Khóa đầu tiên tạo cả anchor cũ và khóa scope; retry không tạo lại đơn', async () => {
  const f = fixture();
  const result = await f.repo.createPending({ ...request, isTest: true });
  assert.equal(inserts(f.calls).length, 4);
  assert.deepEqual(inserts(f.calls)[2][1], ['buyer', 'premium', 1, result.id]);
  assert.deepEqual(inserts(f.calls)[3][1], ['buyer', 'premium', result.id]);
  const replay = fixture({ scoped: row(1, 'scoped'), legacy: row(1, 'scoped') });
  assert.equal((await replay.repo.createPending({ ...request, isTest: true })).id, 'scoped');
  assert.equal(inserts(replay.calls).length, 0);
});

test('Scope hoặc chủ/mẫu không khớp, hay khóa trùng khác intent, đều fail closed', async () => {
  for (const options of [{ scoped: row(1) }, { legacy: { ...row(0), order_user: 'other' } },
    { legacy: { ...row(1), order_template: 'other' } }, { legacy: row(2) },
    { scoped: row(0, 'new'), legacy: row(0, 'old') }]) {
    const f = fixture(options);
    await assert.rejects(f.repo.createPending(request), { status: 409 });
    assert.equal(inserts(f.calls).length, 0);
  }
});

test('Lỗi ghi khóa scope không trả thành công hoặc commit đơn chưa có khóa', async () => {
  const f = fixture({ failInsert: true });
  await assert.rejects(f.repo.createPending(request), /injected key error/);
  assert.equal(f.commits(), 0);
});

test('Migration bổ sung giữ khóa cũ, unique theo scope và intent, không sửa dữ liệu cũ', () => {
  const sql = readFileSync(new URL('../../database/migrations/017_payment_scope_keys.sql', import.meta.url), 'utf8');
  assert.match(sql, /PRIMARY KEY \(user_id, template_id, is_test\)/);
  assert.match(sql, /UNIQUE KEY payment_scope_intent_uk \(intent_id\)/);
  assert.match(sql, /FOREIGN KEY \(intent_id\) REFERENCES payment_intents\(id\)/);
  assert.doesNotMatch(sql, /\b(?:ALTER|DROP|DELETE|UPDATE)\b/i);
  assert.match(sql, /INSERT IGNORE INTO schema_migrations.*017_payment_scope_keys/);
});
