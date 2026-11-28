import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const args = process.argv.slice(2);
if (args.length > 1 || (args.length && args[0] !== '--check')) throw new Error('Usage: npm run test:auth [-- --check]');
const root = fileURLToPath(new URL('../../', import.meta.url));
const dir = path.join(root, 'tests/unit');
// Critical suites are required explicitly, so an omitted untracked module cannot silently reduce the gate.
const required = [
  'auth-gateway-security', 'auth-integration-security', 'auth-password-policy', 'auth-provider-labels',
  'credentials', 'identity-recovery-unverified', 'registration-consent', 'oauth-consent', 'policy-archive',
  'consent-history', 'privacy-center', 'privacy-requests', 'recovery-center', 'recovery-guards',
  'recovery-security', 'password-change', 'sessions', 'session-security', 'session-inventory',
  'session-revocation', 'request-origin', 'proxy', 'test-account', 'legal', 'auth-production', 'phase01-security',
  'auth-schema-audit', 'mysql-identity-catalog', 'mysql-identity-catalog-services', 'mysql-migration-audit', 'mysql-support',
].map(name => `${name}.test.mjs`);
const files = readdirSync(dir);
const missing = required.filter(name => !files.includes(name));
if (missing.length) throw new Error(`Missing required Auth test suites: ${missing.join(', ')}`);
const selected = [...new Set([...required, ...files.filter(name => /^auth-.*\.test\.mjs$/.test(name))])].sort();
console.log(`Auth Quality Gate: ${selected.length} test files (local fixtures, no production credentials)`);
if (args.includes('--check')) {
  console.log('PASS required Auth suites present; npm test must still execute them.');
} else {
  const result = spawnSync(process.execPath, ['--test', ...selected.map(name => path.join(dir, name))], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
