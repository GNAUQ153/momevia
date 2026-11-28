import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { auditAuthSchema, assessAuthSchema, sessionMigration } from '../../database/scripts/auth-schema-audit.mjs';
import { auditRepository } from '../../database/scripts/migration-audit.mjs';

const columns = () => ['credential_version', 'issued_at'].map((name, i) => ({ name, type: i ? 'datetime(3)' : 'bigint unsigned', nullable: 'YES', defaultValue: null, extra: '' }));
const indexes = () => ['user_id', 'credential_version', 'expires_at'].map((columnName, i) => ({ indexName: 'sessions_owner_version_expiry_idx', columnName, position: i + 1, prefixLength: null, indexType: 'BTREE', visible: 'YES', nonUnique: 1, direction: 'A' }));
const latest = { status: 'latest', applied: [sessionMigration], issues: [], pending: [], remaining: [] };

test('020 pinning covers unchanged SQL and correct metadata passes', async () => {
  const repo = await auditRepository();
  assert.deepEqual(repo.issues, []);
  assert.ok(repo.pinnedCount >= 20);
  assert.equal(assessAuthSchema(columns(), indexes().reverse()).status, 'ok');
});

test('missing, duplicate, incorrectly typed or non-nullable columns fail', () => {
  assert.equal(assessAuthSchema([], indexes()).status, 'review_required');
  assert.equal(assessAuthSchema([...columns(), columns()[0]], indexes()).status, 'review_required');
  for (const [i, change] of [[0, { type: 'bigint' }], [0, { nullable: 'NO' }], [0, { defaultValue: '0' }], [1, { type: 'datetime' }], [1, { extra: 'DEFAULT_GENERATED' }]]) {
    const rows = columns(); Object.assign(rows[i], change);
    assert.equal(assessAuthSchema(rows, indexes()).status, 'review_required');
  }
});

test('incorrect index name, visibility, uniqueness, prefix, order or direction fails', () => {
  assert.equal(assessAuthSchema(columns(), []).status, 'review_required');
  assert.equal(assessAuthSchema(columns(), [...indexes(), indexes()[0]]).status, 'review_required');
  for (const change of [{ indexName: 'other' }, { visible: 'NO' }, { nonUnique: 0 }, { prefixLength: 4 }, { position: 2 }, { direction: 'D' }, { indexType: 'HASH' }]) {
    const rows = indexes(); Object.assign(rows[0], change);
    assert.equal(assessAuthSchema(columns(), rows).status, 'review_required');
  }
});

test('never reads metadata for pending, missing or invalid schema', async () => {
  for (const schema of [null, { ...latest, applied: [] }, { ...latest, pending: [sessionMigration] }, { ...latest, status: 'pending_migrations' }, { ...latest, issues: ['bad'] }]) {
    const result = await auditAuthSchema({ execute() { assert.fail('Must not query'); } }, schema);
    assert.equal(result.status, 'skipped_schema');
  }
});

test('live metadata reader uses parameterized SELECT only and propagates driver failure', async () => {
  const calls = [];
  const result = await auditAuthSchema({ async execute(sql, args) { calls.push({ sql, args }); return [calls.length === 1 ? columns() : indexes()]; } }, latest);
  assert.equal(result.status, 'ok'); assert.equal(calls.length, 2);
  assert(calls.every(call => /^SELECT\b/.test(call.sql) && /TABLE_SCHEMA = DATABASE\(\)/.test(call.sql)));
  assert.deepEqual(calls[0].args, ['sessions', 'credential_version', 'issued_at']);
  assert.deepEqual(calls[1].args, ['sessions', 'sessions_owner_version_expiry_idx']);
  await assert.rejects(auditAuthSchema({ async execute() { throw Error('fixture failure'); } }, latest), /fixture failure/);
});

test('CLI requires explicit live opt-in for auth schema audit', () => {
  const cli = fileURLToPath(new URL('../../database/scripts/mysql-audit.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, '--auth-schema'], { encoding: 'utf8' });
  assert.equal(result.status, 1); assert.equal(result.stdout, '');
});
