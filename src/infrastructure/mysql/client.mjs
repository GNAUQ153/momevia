import { loadEnvironment } from '../../shared/config.mjs';

export function resolveMysqlConfig(env = process.env) {
  loadEnvironment();
  const host = env.MYSQL_HOST || '127.0.0.1';
  const database = env.MYSQL_DATABASE || 'momevia_dev';
  const user = env.MYSQL_USER || 'momevia';
  const password = env.MYSQL_PASSWORD;
  const port = Number(env.MYSQL_PORT || 3306);
  const connectionLimit = Number(env.MYSQL_CONNECTION_LIMIT || 5);
  if (!Number.isSafeInteger(connectionLimit) || connectionLimit < 1 || connectionLimit > 20)
    throw new Error('MYSQL_CONNECTION_LIMIT phải là số nguyên từ 1 đến 20.');
  if (!password) throw new Error('MYSQL_PASSWORD chưa được cấu hình trong .env.');
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('MYSQL_PORT không hợp lệ.');
  if (!/^[a-zA-Z0-9_]{1,64}$/.test(database)) throw new Error('MYSQL_DATABASE chỉ được dùng chữ, số, gạch dưới.');
  return {
    host, port, database, user, password,
    waitForConnections: true,
    connectionLimit,
    queueLimit: 100,
    charset: 'utf8mb4',
    timezone: 'Z',
    dateStrings: true,
    decimalNumbers: false,
  };
}

export class MySqlClient {
  constructor({ env = process.env, createPool, monitor } = {}) {
    this.env = env;
    this.poolFactory = createPool;
    this.monitor = monitor;
    this.poolPromise = null;
    this.active = new Set();
    this.closing = null;
  }

  async pool() {
    if (this.closing) throw new Error('MySQL client đã đóng hoặc đang đóng.');
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

  // Theo dõi cả công việc đang đợi kết nối, không chỉ transaction đã bắt đầu.
  async run(work, kind) {
    if (this.closing) throw new Error('MySQL client đã đóng hoặc đang đóng.');
    const operation = (async () => work(await this.pool()))();
    this.active.add(operation);
    const finish = this.monitor?.observeDb(kind, this.active.size);
    let failed = true;
    try { const result = await operation; failed = false; return result; }
    finally { this.active.delete(operation); finish?.(failed); }
  }

  execute(sql, params = []) {
    return this.run(pool => pool.execute(sql, params), 'query');
  }

  withTransaction(work) {
    return this.run(async pool => {
      const connection = await pool.getConnection();
      let reusable = true;
      let active = true;
      try {
        await connection.beginTransaction();
        const value = await work({ execute: (sql, params = []) => {
          if (!active) return Promise.reject(new Error('Transaction đã kết thúc.'));
          return connection.execute(sql, params);
        } });
        active = false;
        await connection.commit();
        return value;
      } catch (error) {
        active = false;
        try { await connection.rollback(); }
        catch { reusable = false; }
        throw error;
      } finally {
        // Không đưa kết nối có rollback lỗi trở lại pool.
        if (reusable) connection.release();
        else { try { connection.destroy(); } catch { /* Giữ lỗi gốc. */ } }
      }
    }, 'transaction');
  }

  close() {
    if (!this.closing) {
      this.closing = (async () => {
        await Promise.allSettled(this.active);
        if (!this.poolPromise) return;
        const pool = await this.poolPromise;
        try { await pool.end(); }
        finally { this.poolPromise = null; }
      })();
    }
    return this.closing;
  }
}
