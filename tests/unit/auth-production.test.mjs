import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { authProductionIssues } from '../../src/shared/auth-production.mjs';
import { productionIssues, checkProductionStartup } from '../../src/shared/production.mjs';
import { cookie } from '../../src/shared/security.mjs';

const base = { PUBLIC_BASE_URL: 'https://momevia.io.vn' };
const ready = { ...base, GOOGLE_CLIENT_ID: 'fixture-id', GOOGLE_CLIENT_SECRET: 'fixture-google-secret',
  GOOGLE_CALLBACK_URL: `${base.PUBLIC_BASE_URL}/api/auth/google/callback`, ZALO_APP_ID: 'fixture-zalo-id',
  ZALO_APP_SECRET: 'fixture-zalo-secret', ZALO_CALLBACK_URL: `${base.PUBLIC_BASE_URL}/api/auth/zalo/callback`,
  RECOVERY_MAIL_URL: 'https://mail.example.test/relay', RECOVERY_MAIL_TOKEN: 'fixture-mail-token' };

test('Optional disabled providers do not block startup; full Auth preflight requires all three', () => {
  assert.deepEqual(authProductionIssues({ ...base, GOOGLE_CALLBACK_URL: 'http://localhost:4100/api/auth/google/callback' }), []);
  assert.deepEqual(authProductionIssues(ready, { requireProviders: true }), []);
  assert(authProductionIssues({ ...base, GOOGLE_CLIENT_ID: ' ' }).some(issue => issue.includes('GOOGLE_CLIENT_ID')));
  assert(authProductionIssues({ ...base, RECOVERY_MAIL_TOKEN: ' ' }).some(issue => issue.includes('RECOVERY_MAIL_TOKEN')));
  const issues = authProductionIssues(base, { requireProviders: true });
  for (const key of ['GOOGLE_CLIENT_ID', 'GOOGLE_CALLBACK_URL', 'ZALO_APP_ID', 'ZALO_CALLBACK_URL', 'RECOVERY_MAIL_URL', 'RECOVERY_MAIL_TOKEN']) assert(issues.some(issue => issue.includes(key)));
});

test('Partial OAuth and incorrect callback origin/path/query are rejected without exposing credentials', () => {
  for (const callback of ['http://momevia.io.vn/api/auth/google/callback', 'https://other.example.test/api/auth/google/callback', 'https://momevia.io.vn/api/auth/google/callback?x=1', 'https://momevia.io.vn/api/auth/zalo/callback', 'https://momevia.io.vn/a/../api/auth/google/callback']) {
    const issues = authProductionIssues({ ...ready, GOOGLE_CALLBACK_URL: callback });
    assert(issues.some(issue => issue.includes('GOOGLE_CALLBACK_URL')));
    assert(!issues.join().includes(callback));
  }
  const issues = authProductionIssues({ ...ready, GOOGLE_CLIENT_SECRET: 'secret with whitespace', ZALO_APP_SECRET: '' });
  assert(issues.some(issue => issue.includes('GOOGLE_CLIENT_SECRET')));
  assert(issues.some(issue => issue.includes('ZALO_APP_SECRET')));
  assert(!issues.join().includes('secret with whitespace'));
});

test('Mail relay requires HTTPS and both values, does not expose URL credentials or token', () => {
  for (const url of ['http://mail.example.test/relay', 'https://user:private@mail.example.test/relay', 'https://mail.example.test/relay#private', 'https://mail.example.test/\\relay', '']) {
    const issues = authProductionIssues({ ...ready, RECOVERY_MAIL_URL: url });
    assert(issues.some(issue => issue.includes('RECOVERY_MAIL_URL')));
    assert(!issues.join().includes('private'));
    assert(!issues.join().includes(ready.RECOVERY_MAIL_TOKEN));
  }
  assert(authProductionIssues({ ...ready, RECOVERY_MAIL_TOKEN: '' }).some(issue => issue.includes('RECOVERY_MAIL_TOKEN')));
});

test('Reject raw non-origin paths and keep existing startup strict/warning behavior', () => {
  for (const url of ['https://momevia.io.vn/a/..', 'https://momevia.io.vn?x=1', 'https://momevia.io.vn\\', 'http://momevia.io.vn', '']) {
    assert(authProductionIssues({ ...ready, PUBLIC_BASE_URL: url }).some(issue => issue.includes('PUBLIC_BASE_URL')));
  }
  const env = { ...ready, NODE_ENV: 'production', JWT_SECRET: 'a'.repeat(64), INTERNAL_SERVICE_KEY: 'b'.repeat(64),
    IDENTITY_STORAGE: 'mysql', CATALOG_STORAGE: 'mysql', CHECKOUT_STORAGE: 'mysql', GIFTS_STORAGE: 'mysql', DESIGNS_STORAGE: 'mysql', SUPPORT_STORAGE: 'mysql',
    MYSQL_HOST: 'mysql.internal', MYSQL_DATABASE: 'momevia', MYSQL_USER: 'app', MYSQL_PASSWORD: 'fixture-only', MOMEVIA_DATA_DIR: process.cwd() };
  assert.deepEqual(productionIssues(env), []);
  const bad = { ...env, GOOGLE_CALLBACK_URL: 'https://wrong.example.test/callback' };
  let warning = '';
  checkProductionStartup(bad, value => { warning = value; });
  assert.match(warning, /GOOGLE_CALLBACK_URL/);
  assert.throws(() => checkProductionStartup({ ...bad, PRODUCTION_STRICT: 'true' }), /GOOGLE_CALLBACK_URL/);
});

test('Cookie Secure follows parsed HTTPS protocol; local HTTP and invalid URLs do not crash', t => {
  const original = process.env.PUBLIC_BASE_URL;
  t.after(() => { if (original === undefined) delete process.env.PUBLIC_BASE_URL; else process.env.PUBLIC_BASE_URL = original; });
  for (const value of ['https://momevia.io.vn', 'HTTPS://momevia.io.vn']) {
    process.env.PUBLIC_BASE_URL = value;
    for (const name of ['session', 'oauth_google', 'oauth_zalo']) {
      assert.match(cookie(name, 'fixture'), /; Secure$/);
      assert.match(cookie(name, '', 0), /; Max-Age=0; Secure$/);
    }
  }
  for (const value of ['http://localhost:4100', 'invalid', '']) {
    process.env.PUBLIC_BASE_URL = value;
    assert.doesNotMatch(cookie('session', 'fixture'), /; Secure/);
  }
});

test('Hostinger relay forwards Origin and Fetch Metadata without trusting arbitrary forwarded IP', () => {
  const source = readFileSync(new URL('../../deploy/hostinger/api-relay.php', import.meta.url), 'utf8');
  assert.match(source, /'HTTP_ORIGIN'\s*=>\s*'Origin'/);
  assert.match(source, /'HTTP_SEC_FETCH_SITE'\s*=>\s*'Sec-Fetch-Site'/);
  assert.doesNotMatch(source, /'HTTP_X_FORWARDED_FOR'\s*=>/);
  assert.match(source, /CURLOPT_FOLLOWLOCATION\s*=>\s*false/);
  assert.match(source, /CURLOPT_SSL_VERIFYPEER\s*=>\s*true/);
});
