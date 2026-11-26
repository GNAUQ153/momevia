import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';

const migrationDirectory = new URL('../migrations/', import.meta.url);
const baselineFile = new URL('../migration-baseline.json', import.meta.url);

// Chuẩn hóa xuống dòng để checksum giống nhau trên Windows và Linux.
export function migrationHash(sql) {
  return createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
}

// Kiểm tra quy ước SQL hiện tại, không thay thế SQL parser hoặc MySQL thật.
export function inspectMigrations(entries, baseline) {
  const migrations = [...entries].sort((a, b) => a.name.localeCompare(b.name));
  const issues = [];
  const tables = new Set();
  const records = migrations.map(({ name, sql }, index) => {
    const version = name.replace(/\.sql$/, '');
    if (!/^\d{3}_[a-z0-9_]+\.sql$/.test(name) || Number(version.slice(0, 3)) !== index + 1 || version.length > 40) {
      issues.push(`Tên hoặc thứ tự migration không hợp lệ: ${name}`);
    }
    const body = sql.replace(/^\s*--[^\r\n]*/gm, '');
    const markers = [...body.matchAll(/\bINSERT\s+IGNORE\s+INTO\s+schema_migrations\s*\(\s*version\s*\)\s*VALUES\s*\(\s*'([^']+)'\s*\)\s*;/gi)];
    if (markers.length !== 1 || markers[0][1] !== version || body.slice(markers[0].index + markers[0][0].length).trim()) {
      issues.push(`Migration phải ghi đúng phiên bản ở cuối file: ${name}`);
    }
    const createdTables = [...body.matchAll(/^\s*CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-z0-9_]+)\s*\(/gim)].map(match => match[1]);
    const createCount = [...body.matchAll(/^\s*CREATE\s+(?:TEMPORARY\s+)?TABLE\b/gim)].length;
    if (createCount !== createdTables.length || /^\s*(?:DROP|RENAME)\s+TABLE\b/im.test(body) || /^\s*ALTER\s+TABLE\b[^;]*\bRENAME\s+(?:TO|AS)\b/im.test(body)) {
      issues.push(`DDL tạo/xóa/đổi tên bảng ngoài quy ước audit: ${name}`);
    }
    for (const table of createdTables) {
      if (tables.has(table)) issues.push(`Bảng được khai báo tạo nhiều lần: ${table}`);
      tables.add(table);
    }
    return { version, sha256: migrationHash(sql), createdTables };
  });
  if (!records.length) issues.push('Không tìm thấy migration.');
  if (!Array.isArray(baseline) || !baseline.length) throw new Error('Thiếu baseline checksum migration.');
  for (const [index, pinned] of baseline.entries()) {
    const current = records[index];
    if (!current || current.version !== pinned.version || current.sha256 !== pinned.sha256) {
      issues.push(`Migration lịch sử bị sửa, xóa hoặc đổi tên: ${pinned.version}`);
    }
  }
  return { migrations: records, tableCount: tables.size, pinnedCount: baseline.length, issues };
}

export async function auditRepository() {
  const names = (await readdir(migrationDirectory)).filter(name => name.endsWith('.sql'));
  const entries = await Promise.all(names.map(async name => ({ name, sql: await readFile(new URL(name, migrationDirectory), 'utf8') })));
  const baseline = JSON.parse(await readFile(baselineFile, 'utf8'));
  return inspectMigrations(entries, baseline);
}

// Đối chiếu prefix đã ghi với bảng thực tế; không đọc dữ liệu nghiệp vụ.
export function assessSchema(migrations, { applied, pending, tables }, { requireLatest = false } = {}) {
  const issues = [];
  const versions = migrations.map(record => record.version);
  const prefixValid = applied.every((version, index) => version === versions[index]);
  if (!prefixValid) issues.push('Lịch sử schema_migrations không khớp prefix của repo.');
  if (pending.length) issues.push('Có marker migration pending; cần đối chiếu trước khi chạy migration.');
  const expected = new Set(prefixValid ? migrations.slice(0, applied.length).flatMap(record => record.createdTables) : []);
  const actual = new Map(tables.map(row => [row.name, row.engine]));
  const missingTables = [...expected].filter(name => !actual.has(name));
  const wrongEngine = [...expected].filter(name => actual.has(name) && actual.get(name) !== 'InnoDB');
  const unexpectedTables = [...actual.keys()].filter(name => name !== 'schema_migration_pending' && !expected.has(name)).sort();
  if (missingTables.length) issues.push('Thiếu bảng thuộc migration đã ghi.');
  if (wrongEngine.length) issues.push('Có bảng thuộc migration đã ghi không dùng InnoDB.');
  if (unexpectedTables.length) issues.push('Có bảng ngoài prefix migration đã ghi; cần rà soát, không tự xóa.');
  const remaining = prefixValid ? versions.slice(applied.length) : null;
  if (requireLatest && remaining?.length) issues.push('Schema chưa ở migration mới nhất.');
  return { applied, pending, remaining, missingTables, wrongEngine, unexpectedTables, issues,
    status: issues.length ? 'review_required' : remaining.length ? 'pending_migrations' : 'latest' };
}

export async function readSchemaMetadata(client) {
  const [tables] = await client.execute(`SELECT TABLE_NAME AS name, ENGINE AS engine
    FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`);
  const names = new Set(tables.map(row => row.name));
  const [applied] = names.has('schema_migrations')
    ? await client.execute('SELECT version FROM schema_migrations ORDER BY version') : [[]];
  const [pending] = names.has('schema_migration_pending')
    ? await client.execute('SELECT version FROM schema_migration_pending ORDER BY version') : [[]];
  return { tables, applied: applied.map(row => row.version), pending: pending.map(row => row.version) };
}
