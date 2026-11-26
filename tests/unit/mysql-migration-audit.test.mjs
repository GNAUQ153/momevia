import test from 'node:test';
import assert from 'node:assert/strict';
import { auditRepository, migrationHash, inspectMigrations, assessSchema, readSchemaMetadata } from '../../database/scripts/migration-audit.mjs';

const repository = await auditRepository();
const { migrations } = repository;
const state = (count = migrations.length) => ({
  applied: migrations.slice(0, count).map(record => record.version),
  pending: [],
  tables: migrations.slice(0, count).flatMap(record => record.createdTables).map(name => ({ name, engine: 'InnoDB' })),
});

test('Migration trong repo khớp checksum và đúng thứ tự', () => {
  assert.deepEqual(repository.issues, []);
  assert.ok(migrations.length >= 19);
  assert.equal(repository.pinnedCount >= 19, true);
  assert.ok(migrations.flatMap(record => record.createdTables).includes('publication_repurchases'));
});

test('Checksum giống nhau giữa LF và CRLF, phát hiện sửa nội dung', () => {
  assert.equal(migrationHash('a\nb\n'), migrationHash('a\r\nb\r\n'));
  assert.notEqual(migrationHash('a\nb\n'), migrationHash('a\nc\n'));
});

test('Phát hiện sửa lịch sử, thiếu thứ tự và marker sai', () => {
  const sql = "CREATE TABLE IF NOT EXISTS test_table (id INT);\nINSERT IGNORE INTO schema_migrations(version) VALUES ('001_initial');\n";
  const baseline = [{ version: '001_initial', sha256: migrationHash(sql) }];
  assert.deepEqual(inspectMigrations([{ name: '001_initial.sql', sql }], baseline).issues, []);
  assert.ok(inspectMigrations([{ name: '001_initial.sql', sql: sql.replace('INT', 'BIGINT') }], baseline).issues.some(issue => issue.includes('lịch sử')));
  assert.ok(inspectMigrations([{ name: '003_wrong.sql', sql }], baseline).issues.some(issue => issue.includes('thứ tự')));
  assert.ok(inspectMigrations([{ name: '001_initial.sql', sql: sql + 'ALTER TABLE test_table ADD COLUMN x INT;' }], baseline).issues.some(issue => issue.includes('cuối file')));
  assert.ok(inspectMigrations([], baseline).issues.some(issue => issue.includes('lịch sử')));
  const next = { name: '002_rename.sql', sql: "RENAME TABLE test_table TO renamed;\nINSERT IGNORE INTO schema_migrations(version) VALUES ('002_rename');" };
  assert.ok(inspectMigrations([{ name: '001_initial.sql', sql }, next], baseline).issues.some(issue => issue.includes('DDL')));
});

test('Schema 016 hợp lệ nhưng còn migration 017–019', () => {
  const result = assessSchema(migrations, state(16));
  assert.equal(result.status, 'pending_migrations');
  assert.deepEqual(result.remaining.slice(0, 3), ['017_payment_scope_keys', '018_publication_credits', '019_publication_repurchases']);
  assert.equal(assessSchema(migrations, state(16), { requireLatest: true }).status, 'review_required');
});

test('Schema mới nhất và schema rỗng được phân biệt', () => {
  assert.equal(assessSchema(migrations, state()).status, 'latest');
  assert.equal(assessSchema(migrations, state(0)).status, 'pending_migrations');
});

test('Phát hiện sai prefix, bảng thiếu, sai engine và bảng ngoài lịch sử', () => {
  const invalid = state(16);
  invalid.tables = invalid.tables.filter(row => row.name !== 'designs');
  invalid.tables.find(row => row.name === 'users').engine = 'MyISAM';
  invalid.tables.push({ name: 'publication_credits', engine: 'InnoDB' });
  const result = assessSchema(migrations, invalid);
  assert.deepEqual(result.missingTables, ['designs']);
  assert.deepEqual(result.wrongEngine, ['users']);
  assert.deepEqual(result.unexpectedTables, ['publication_credits']);
  assert.equal(result.status, 'review_required');
  invalid.applied.splice(1, 1);
  assert.equal(assessSchema(migrations, invalid).remaining, null);
});

test('Marker pending không được bỏ qua dù phiên bản đã ghi', () => {
  const current = state();
  current.pending = [current.applied.at(-1)];
  current.tables.push({ name: 'schema_migration_pending', engine: 'InnoDB' });
  assert.equal(assessSchema(migrations, current).status, 'review_required');
});

test('Metadata chỉ dùng SELECT và bỏ qua bảng lịch sử chưa tồn tại', async () => {
  const calls = [];
  const client = { async execute(sql) { calls.push(sql); return [[{ name: 'users', engine: 'InnoDB' }]]; } };
  assert.deepEqual(await readSchemaMetadata(client), { tables: [{ name: 'users', engine: 'InnoDB' }], applied: [], pending: [] });
  assert.equal(calls.length, 1);
  const current = state(1);
  current.tables.push({ name: 'schema_migration_pending', engine: 'InnoDB' });
  const answers = [current.tables, current.applied.map(version => ({ version })), [{ version: '002_support_user_bridge' }]];
  const metadata = await readSchemaMetadata({ async execute(sql) { calls.push(sql); return [answers.shift()]; } });
  assert.deepEqual(metadata.applied, current.applied);
  assert.deepEqual(metadata.pending, ['002_support_user_bridge']);
  assert.equal(calls.length, 4);
  assert.ok(calls.every(sql => /^SELECT\b/i.test(sql)));
});
