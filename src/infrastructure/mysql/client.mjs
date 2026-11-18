import { loadEnvironment } from '../../shared/config.mjs';

export function resolveMysqlConfig(env = process.env) {
  loadEnvironment();
  const host = env.MYSQL_HOST || '127.0.0.1';
  const database = env.MYSQL_DATABASE || 'momevia_dev';
  const user = env.MYSQL_USER || 'momevia';
  const password = env.MYSQL_PASSWORD;
  const port = Number(env.MYSQL_PORT || 3306);
  if (!password) throw new Error('MYSQL_PASSWORD chưa được cấu hình trong .env.');
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('MYSQL_PORT không hợp lệ.');
  if (!/^[a-zA-Z0-9_]{1,64}$/.test(database)) throw new Error('MYSQL_DATABASE chỉ được dùng chữ, số, gạch dưới.');
  return {
    host, port, database, user, password,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 100,
    charset: 'utf8mb4',
    timezone: 'Z',
    dateStrings: true,
    decimalNumbers: false,
  };
}

export class MySqlClient {
  constructor({ env = process.env, createPool } = {}) {
    this.env = env;
    this.poolFactory = createPool;
    this.poolPromise = null;
  }

  async pool() {
    if (!this.poolPromise) {
      this.poolPromise = (async () => {
        const driver = this.poolFactory ? null : await import('mysql2/promise');
        const createPool = this.poolFactory || driver.createPool || driver.default?.createPool;
        if (typeof createPool !== 'function') throw new Error('Không tải được mysql2/promise.createPool.');
        return createPool(resolveMysqlConfig(this.env));
      })().catch(error => {
        this.poolPromise = null;
        throw error;
      });
    }
    return this.poolPromise;
  }

  async execute(sql, params = []) {
    const pool = await this.pool();
    return pool.execute(sql, params);
  }

  async withTransaction(work) {
    const pool = await this.pool();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const value = await work({ execute: (sql, params = []) => connection.execute(sql, params) });
      await connection.commit();
      return value;
    } catch (error) {
      try { await connection.rollback(); } catch { /* Ưu tiên giữ nguyên lỗi gốc. */ }
      throw error;
    } finally {
      connection.release();
    }
  }

  async close() {
    if (!this.poolPromise) return;
    const pool = await this.poolPromise;
    this.poolPromise = null;
    await pool.end();
  }
}
