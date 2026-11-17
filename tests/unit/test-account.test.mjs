import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { testAccountConfig } from '../../src/shared/config.mjs';
import { JsonRepository } from '../../src/shared/storage.mjs';
import { CredentialsService, publicUser } from '../../src/modules/identity/credentials.service.mjs';
import { provisionTestAccount } from '../../src/modules/identity/test-account.service.mjs';

const env = {
  NODE_ENV: 'test', TEST_ACCOUNT_ENABLED: 'true',
  TEST_ACCOUNT_EMAIL: ' QA@Example.test ', TEST_ACCOUNT_PASSWORD: 'FixturePassword123',
};

test('Tài khoản mẫu mặc định tắt, kiểm tra cấu hình trước khi ghi dữ liệu', () => {
  assert.equal(testAccountConfig({}), null);
  assert.equal(testAccountConfig({ ...env, TEST_ACCOUNT_ENABLED: 'false' }), null);
  const account = testAccountConfig(env);
  assert.equal(account.email, 'qa@example.test');
  assert.equal(account.role, 'sender');
  assert.equal(account.name, 'Tài khoản kiểm thử');
  for (const role of ['sender', 'creator', 'admin']) {
    assert.equal(testAccountConfig({ ...env, TEST_ACCOUNT_ROLE: role }).role, role);
  }
  for (const patch of [
    { NODE_ENV: 'production' }, { TEST_ACCOUNT_EMAIL: '' }, { TEST_ACCOUNT_EMAIL: 'invalid' },
    { TEST_ACCOUNT_PASSWORD: '' }, { TEST_ACCOUNT_PASSWORD: 'onlyletters' },
    { TEST_ACCOUNT_PASSWORD: 'a1'.repeat(65) }, { TEST_ACCOUNT_NAME: 'A' },
    { TEST_ACCOUNT_ROLE: 'owner' },
  ]) assert.throws(() => testAccountConfig({ ...env, ...patch }));
});

test('Lưu tài khoản mẫu có hash, đăng nhập và khởi tạo lại không sửa dữ liệu đã lưu', async () => {
  const tempRoot = fs.realpathSync(os.tmpdir());
  const fixture = fs.mkdtempSync(path.join(tempRoot, 'momevia-test-account-'));
  try {
    const filename = path.join(fixture, 'users.json');
    const repo = new JsonRepository(filename);
    const credentials = new CredentialsService(repo);
    const account = testAccountConfig({ ...env, TEST_ACCOUNT_ROLE: 'creator' });
    const unrelated = await credentials.register({ name: 'Existing user', email: 'existing@example.test', password: 'ExistingPass123' });
    const user = await provisionTestAccount(credentials, account);
    assert.equal(user.role, 'creator');
    assert.deepEqual(user.testAccount, { source: 'env' });
    assert.equal((await credentials.login(account)).id, user.id);
    const before = fs.readFileSync(filename, 'utf8');
    assert(!before.includes(account.password));
    assert.deepEqual(repo.get(unrelated.id), unrelated);
    assert(!('testAccount' in publicUser(user)));
    assert(!('passwordHash' in publicUser(user)));
    const restarted = new CredentialsService(new JsonRepository(filename));
    assert.equal((await provisionTestAccount(restarted, {
      ...account, password: 'ChangedPassword123', role: 'admin', name: 'Changed name',
    })).id, user.id);
    assert.equal(await provisionTestAccount(restarted, null), null);
    assert.equal(fs.readFileSync(filename, 'utf8'), before);
    assert.equal((await restarted.login(account)).id, user.id);
    await assert.rejects(() => restarted.login({ ...account, password: 'ChangedPassword123' }), { status: 401 });
    await assert.rejects(() => provisionTestAccount(restarted, { ...account, email: unrelated.email }), /không ghi đè/);
    assert.equal(fs.readFileSync(filename, 'utf8'), before);
  } finally {
    if (path.dirname(path.resolve(fixture)) !== tempRoot) throw new Error('Unsafe fixture path');
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
