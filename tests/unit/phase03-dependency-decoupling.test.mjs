import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { normalizeEmail, validatePassword } from '../../src/shared/credential-policy.mjs';
import { giftRenewalDays, quotaQaEnabled } from '../../src/shared/feature-config.mjs';
import { giftRenewalDays as legacyRenewalDays } from '../../src/modules/gifts/renewal.mjs';
import { quotaQaEnabled as legacyQuotaQaEnabled } from '../../src/modules/checkout/quota-config.mjs';
import { CredentialsService } from '../../src/modules/identity/credentials.service.mjs';
import { testAccountConfig } from '../../src/shared/config.mjs';
import { HttpError } from '../../src/shared/http.mjs';
import { runAudit } from '../../scripts/quality/audit-architecture.mjs';

const configUrl = new URL('../../src/shared/config.mjs', import.meta.url).href;
const qa = { NODE_ENV: 'test', PAYMENT_ENV: 'sandbox', PUBLICATION_QUOTA_QA_ENABLED: 'true',
  MYSQL_HOST: '127.0.0.1', MYSQL_DATABASE: 'momevia_canvas_qa_config', CANVAS_QA_MYSQL_ISOLATED: 'true',
  IDENTITY_STORAGE: 'mysql', CATALOG_STORAGE: 'mysql', CHECKOUT_STORAGE: 'mysql', GIFTS_STORAGE: 'mysql', DESIGNS_STORAGE: 'mysql' };
const account = { TEST_ACCOUNT_ENABLED: 'true', TEST_ACCOUNT_EMAIL: ' QA@Example.test ', TEST_ACCOUNT_PASSWORD: 'abc12345' };

// Giữ hợp đồng lỗi HTTP của service khi chuyển validation về shared.
function assertCredentialError(fn, input, key) {
  assert.throws(() => fn(input), error => error instanceof HttpError && error.status === 400 && error.messageKey === key);
}

test('Import tương thích trỏ tới cùng hàm cấu hình, không nhân đôi policy', () => {
  assert.equal(legacyRenewalDays, giftRenewalDays);
  assert.equal(legacyQuotaQaEnabled, quotaQaEnabled);
  assert.equal(giftRenewalDays(undefined), 0);
  assert.equal(giftRenewalDays('30'), 30);
  assert.throws(() => giftRenewalDays('31'), /GIFT_RENEWAL_DAYS/);
  assert.equal(quotaQaEnabled({}), false);
  assert.equal(quotaQaEnabled(qa), true);
  for (const patch of [{ NODE_ENV: 'production' }, { RAILWAY_SERVICE_ID: 'qa' }, { PAYMENT_LIVE_ENABLED: 'true' }, { DESIGNS_STORAGE: 'json' }]) {
    assert.throws(() => quotaQaEnabled({ ...qa, ...patch }), /PUBLICATION_QUOTA_QA_ENABLED/);
  }
});

test('Email giữ nguyên chuẩn hóa, mã lỗi và kiểu HttpError ở cả policy và service', () => {
  const service = new CredentialsService();
  for (const fn of [normalizeEmail, value => service.normalizeEmail(value)]) {
    assert.equal(fn(' QA@Example.test '), 'qa@example.test');
    assertCredentialError(fn, null, 'errors.auth.invalidEmail');
    assertCredentialError(fn, 'wrong', 'errors.auth.emailRequired');
    assertCredentialError(fn, 'a'.repeat(250) + '@x.test', 'errors.auth.emailRequired');
  }
});

test('Mật khẩu giữ nguyên giới hạn 8–128 và yêu cầu chữ cái, chữ số', () => {
  const service = new CredentialsService();
  for (const fn of [validatePassword, value => service.validatePassword(value)]) {
    for (const valid of ['abc12345', 'a1'.repeat(64)]) assert.equal(fn(valid), undefined);
    for (const invalid of [null, 'a123456', 'a1'.repeat(65)]) assertCredentialError(fn, invalid, 'errors.auth.passwordLength');
    for (const invalid of ['abcdefgh', '12345678']) assertCredentialError(fn, invalid, 'errors.auth.passwordComposition');
  }
});

test('Tài khoản test vẫn dùng chung policy; thông báo độ dài khớp quy tắc 8 ký tự', () => {
  assert.equal(testAccountConfig({}), null);
  assert.equal(testAccountConfig(account).email, 'qa@example.test');
  assert.equal(testAccountConfig(account).password, 'abc12345');
  assert.throws(() => testAccountConfig({ ...account, TEST_ACCOUNT_PASSWORD: 'a123456' }), /8 đến 128/);
  assert.throws(() => testAccountConfig({ ...account, NODE_ENV: 'production' }), /production/);
});

test('Khởi tạo cấu hình trong tiến trình cô lập: mặc định tắt và production từ chối QA', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'momevia-decoupling-'));
  const env = { NODE_ENV: 'production', JWT_SECRET: 'a'.repeat(64), INTERNAL_SERVICE_KEY: 'b'.repeat(64) };
  const code = `import { environment } from ${JSON.stringify(configUrl)}; const c = environment(); console.log(JSON.stringify({demoEnabled:c.demoEnabled, demoTemplateCheckout:c.demoTemplateCheckout, giftRenewalDays:c.giftRenewalDays, testAccount:c.testAccount}));`;
  const run = override => spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd, env: { ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}), ...env, ...override }, encoding: 'utf8', timeout: 10000,
  });
  try {
    const result = run({ DEMO_AUTH_ENABLED: 'true', DEMO_TEMPLATE_CHECKOUT_ENABLED: 'true' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { demoEnabled: false, demoTemplateCheckout: false, giftRenewalDays: 0, testAccount: null });
    const isolated = run({ ...qa, GIFT_RENEWAL_DAYS: '7' });
    assert.equal(isolated.status, 0, isolated.stderr);
    assert.equal(JSON.parse(isolated.stdout).giftRenewalDays, 7);
    for (const [override, message] of [[{ ...qa, NODE_ENV: 'production' }, /PUBLICATION_QUOTA_QA_ENABLED/],
      [{ ...qa, RAILWAY_SERVICE_ID: 'qa' }, /PUBLICATION_QUOTA_QA_ENABLED/], [{ GIFT_RENEWAL_DAYS: '31' }, /GIFT_RENEWAL_DAYS/],
      [account, /TEST_ACCOUNT_ENABLED/], [{ JWT_SECRET: '' }, /JWT_SECRET/]]) {
      const rejected = run(override);
      assert.notEqual(rejected.status, 0);
      assert.match(rejected.stderr, message);
    }
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});

test('Không còn vòng import tĩnh và phụ thuộc ngược; allowlist phải rỗng', () => {
  const report = runAudit();
  assert.deepEqual(report.cycles, []);
  assert.deepEqual(report.cycleEdges, []);
  assert.deepEqual(report.boundaries, []);
  const baseline = JSON.parse(fs.readFileSync(new URL('../../docs/architecture-baseline.json', import.meta.url), 'utf8'));
  assert.deepEqual(baseline, { cycleEdges: [], boundaries: [] });
});
