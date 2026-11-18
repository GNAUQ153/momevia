import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { createConnection } from 'mysql2/promise';
import { resolveMysqlConfig } from '../../src/infrastructure/mysql/client.mjs';
import { loadEnvironment } from '../../src/shared/config.mjs';

const directory = new URL('../migrations/', import.meta.url);

async function migrate() {
  loadEnvironment();
  const { MYSQL_MIGRATION_USER: migrationUser, MYSQL_MIGRATION_PASSWORD: migrationPassword } = process.env;
  if (Boolean(migrationUser) !== Boolean(migrationPassword)) {
    throw new Error('Cấu hình đồng thời MYSQL_MIGRATION_USER và MYSQL_MIGRATION_PASSWORD.');
  }
  const env = migrationUser
    ? { ...process.env, MYSQL_USER: migrationUser, MYSQL_PASSWORD: migrationPassword }
    : process.env;
  const { host, port, database, user, password, charset, timezone } = resolveMysqlConfig(env);
  const files = (await readdir(directory)).filter(file => file.endsWith('.sql')).sort();
  const versions = files.map(file => file.slice(0, -4));
  if (!files.length || versions.some((version, index) =>
    !/^[0-9]{3}_[a-z0-9_]+$/.test(version) || Number(version.slice(0, 3)) !== index + 1 || version.length > 40)) {
    throw new Error('Các file migration cần có số thứ tự liên tục từ 001 và tên phiên bản dài tối đa 40 ký tự.');
  }

  console.log(`MySQL migration → ${host}:${port}/${database}`);
  const connection = await createConnection({ host, port, user, password, charset, timezone, multipleStatements: true });
  try {
    await connection.query('SET SESSION autocommit = 1');
    // Dùng cùng một kết nối để giữ khóa xuyên suốt, kể cả khi schema chưa tồn tại.
    const lock = createHash('sha256').update(`momevia:migrate:${database.toLowerCase()}`).digest('hex');
    const [[{ acquired }]] = await connection.execute('SELECT GET_LOCK(?, 30) AS acquired', [lock]);
    if (acquired !== 1) throw new Error('Không lấy được khóa migration. Kiểm tra tiến trình đang cập nhật schema.');

    const schema = connection.escapeId(database);
    try {
      await connection.query(`USE ${schema}`);
    } catch (error) {
      if (error.code !== 'ER_BAD_DB_ERROR') throw error;
      await connection.query(`CREATE DATABASE IF NOT EXISTS ${schema} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
      await connection.query(`USE ${schema}`);
      console.log(`Đã chuẩn bị schema ${database}.`);
    }

    const [tables] = await connection.execute(`
      SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()
    `);
    const tableNames = new Set(tables.map(row => row.name));
    const [rows] = tableNames.has('schema_migrations')
      ? await connection.execute('SELECT version FROM schema_migrations ORDER BY version')
      : [[]];
    const applied = rows.map(row => row.version);
    if (applied.some((version, index) => version !== versions[index])) {
      throw new Error('Lịch sử migration không khớp thứ tự của repo. Kiểm tra schema_migrations trước khi chạy tiếp.');
    }

    // DDL có implicit commit. Giữ dấu vết nếu kết nối mất giữa một file SQL.
    if (tableNames.has('schema_migration_pending')) {
      const [pending] = await connection.execute('SELECT version FROM schema_migration_pending');
      const interrupted = pending.find(({ version }) => !applied.includes(version));
      if (interrupted) {
        throw new Error(`Migration ${interrupted.version} chưa hoàn tất. Đối chiếu schema và bản sao lưu trước khi chạy lại.`);
      }
      if (pending.length) await connection.execute('DELETE FROM schema_migration_pending');
    }
    if (!applied.length && tables.some(({ name }) => name !== 'schema_migration_pending')) {
      throw new Error('Schema đã có bảng nhưng thiếu lịch sử migration. Kiểm tra schema trước khi khởi tạo.');
    }

    const remaining = files.slice(applied.length);
    if (!remaining.length) {
      console.log(`Schema đã ở phiên bản ${versions.at(-1)}.`);
      return;
    }
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migration_pending (
      version VARCHAR(40) NOT NULL PRIMARY KEY
    ) ENGINE=InnoDB`);
    for (const file of remaining) {
      const version = file.slice(0, -4);
      const sql = await readFile(new URL(file, directory), 'utf8');
      await connection.execute('INSERT INTO schema_migration_pending (version) VALUES (?)', [version]);
      try {
        await connection.query(sql);
        const [recorded] = await connection.execute('SELECT version FROM schema_migrations WHERE version = ?', [version]);
        if (recorded.length !== 1) throw new Error('File SQL chưa ghi phiên bản vào schema_migrations.');
        await connection.execute('DELETE FROM schema_migration_pending WHERE version = ?', [version]);
      } catch (error) {
        throw new Error(`Migration ${version}: ${error.message}`);
      }
      console.log(`Đã áp dụng ${version}.`);
    }
  } finally {
    await connection.end();
  }
}

try {
  await migrate();
} catch (error) {
  console.error(`MySQL migration thất bại: ${error.message}`);
  process.exitCode = 1;
}
