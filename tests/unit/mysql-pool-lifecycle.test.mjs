import test from 'node:test';
import assert from 'node:assert/strict';
import { MySqlClient } from '../../src/infrastructure/mysql/client.mjs';
import { createRepositories as identity } from '../../src/modules/identity/repositories.mjs';
import { createRepositories as catalog } from '../../src/modules/catalog/repositories.mjs';
import { createRepositories as checkout } from '../../src/modules/checkout/repositories.mjs';
import { createRepositories as gifts } from '../../src/modules/gifts/repositories.mjs';
import { createRepositories as support } from '../../src/modules/support/repositories.mjs';

const env = { MYSQL_PASSWORD: 'fixture-only', MYSQL_DATABASE: 'momevia_test' };
const deferred = () => Promise.withResolvers();

function fixture(overrides = {}) {
  const calls = [];
  const connection = {
    async beginTransaction() { calls.push('begin'); },
    async execute() { calls.push('execute'); return [[{ ok: 1 }]]; },
    async commit() { calls.push('commit'); },
    async rollback() { calls.push('rollback'); },
    release() { calls.push('release'); },
    destroy() { calls.push('destroy'); },
    ...overrides,
  };
  const pool = { execute: connection.execute, async getConnection() { return connection; },
    async end() { calls.push('end'); } };
  const client = new MySqlClient({ env, createPool: () => { calls.push('pool'); return pool; } });
  return { client, pool, connection, calls };
}

test('Các Repository nhận cùng client nhưng chế độ độc lập vẫn có client riêng', () => {
  const settings = ['IDENTITY_STORAGE', 'CATALOG_STORAGE', 'CHECKOUT_STORAGE', 'GIFTS_STORAGE', 'SUPPORT_STORAGE'];
  const previous = settings.map(key => process.env[key]);
  try {
    settings.forEach(key => { process.env[key] = 'mysql'; });
    const { client } = fixture();
    const repos = [identity(client).users, catalog(client).templates, catalog(client).favoritesService,
      checkout(client).orders, gifts(client).gifts, gifts(client).replies, support(client).requests];
    for (const repo of repos) assert.equal(repo.client, client);
    assert.notEqual(identity().client, catalog().client);
    assert.notEqual(support().requests.client, client);
    settings.forEach(key => { process.env[key] = 'json'; });
    assert.equal(identity(client).client, undefined);
    assert.equal(checkout(client).client, undefined);
  } finally {
    settings.forEach((key, i) => { if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i]; });
  }
});

test('Nhiều truy vấn đồng thời chỉ khởi tạo một pool', async () => {
  const { client, calls } = fixture();
  await Promise.all(Array.from({ length: 20 }, () => client.execute('SELECT 1')));
  assert.equal(calls.filter(x => x === 'pool').length, 1);
  await client.close();
  assert.equal(calls.filter(x => x === 'end').length, 1);
});

test('Client chưa dùng không mở pool khi close, không tái mở sau close', async () => {
  const { client, calls } = fixture();
  await Promise.all([client.close(), client.close()]);
  await assert.rejects(client.execute('SELECT 1'), /đóng/);
  await assert.rejects(client.withTransaction(() => {}), /đóng/);
  assert.deepEqual(calls, []);
});

test('Close chờ cả transaction và truy vấn đang đợi pool, không nhận công việc mới', async () => {
  const factory = deferred(), entered = deferred(), resume = deferred();
  const { pool, calls } = fixture();
  const client = new MySqlClient({ env, createPool: () => factory.promise });
  const query = client.execute('SELECT 1');
  const transaction = client.withTransaction(async tx => { entered.resolve(); await resume.promise; await tx.execute('SELECT 2'); });
  const closing = client.close();
  assert.equal(client.close(), closing);
  await assert.rejects(client.execute('SELECT 3'), /đóng/);
  factory.resolve(pool);
  await query;
  await entered.promise;
  assert.ok(!calls.includes('end'));
  resume.resolve();
  await Promise.all([transaction, closing]);
  assert.deepEqual(calls.slice(-3), ['commit', 'release', 'end']);
});

test('Pool khởi tạo lỗi có thể thử lại trước khi đóng', async () => {
  const { pool } = fixture();
  let attempts = 0;
  const client = new MySqlClient({ env, createPool: () => { if (++attempts === 1) throw new Error('offline'); return pool; } });
  await assert.rejects(client.execute('SELECT 1'), /offline/);
  await client.execute('SELECT 1');
  assert.equal(attempts, 2);
  await client.close();
});

test('Rollback lỗi loại connection khỏi pool và giữ lỗi nghiệp vụ gốc', async () => {
  const { client, calls } = fixture({ async rollback() { throw new Error('connection lost'); } });
  const original = new Error('business error');
  await assert.rejects(client.withTransaction(async () => { throw original; }), error => error === original);
  assert.ok(calls.includes('destroy'));
  assert.ok(!calls.includes('release'));
  await client.close();
});

test('Commit lỗi vẫn rollback, release và không ghi nhận thành công', async () => {
  const { client, calls } = fixture({ async commit() { throw new Error('commit failed'); } });
  await assert.rejects(client.withTransaction(async () => 1), /commit failed/);
  assert.deepEqual(calls.slice(-2), ['rollback', 'release']);
  await client.close();
});

test('Facade transaction không được thực thi sau commit hoặc rollback', async () => {
  const { client, calls } = fixture();
  let tx;
  await client.withTransaction(async current => { tx = current; });
  await assert.rejects(tx.execute('SELECT 1'), /kết thúc/);
  await assert.rejects(client.withTransaction(async current => { tx = current; throw new Error('abort'); }), /abort/);
  await assert.rejects(tx.execute('SELECT 1'), /kết thúc/);
  assert.ok(!calls.includes('execute'));
  await client.close();
});

test('Lỗi lấy connection không để close chờ vô hạn', async () => {
  const { pool, calls } = fixture();
  pool.getConnection = async () => { throw new Error('queue limit'); };
  const client = new MySqlClient({ env, createPool: () => pool });
  await assert.rejects(client.withTransaction(async () => {}), /queue limit/);
  await client.close();
  assert.deepEqual(calls, ['end']);
});

test('Close chờ transaction đã vào hàng đợi getConnection', async () => {
  const queued = deferred(), ready = deferred();
  const { pool, connection, calls } = fixture();
  pool.getConnection = () => { queued.resolve(); return ready.promise; };
  const client = new MySqlClient({ env, createPool: () => pool });
  const work = client.withTransaction(async tx => tx.execute('SELECT 1'));
  await queued.promise;
  const closing = client.close();
  await Promise.resolve();
  assert.ok(!calls.includes('end'));
  ready.resolve(connection);
  await Promise.all([work, closing]);
  assert.deepEqual(calls, ['begin', 'execute', 'commit', 'release', 'end']);
  assert.equal(client.poolPromise, null);
});
