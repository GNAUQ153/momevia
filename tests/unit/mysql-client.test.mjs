import test from 'node:test';
import assert from 'node:assert/strict';
import { MySqlClient } from '../../src/infrastructure/mysql/client.mjs';

function fixture() {
  const calls = [];
  const connection = {
    beginTransaction: async () => { calls.push('begin'); },
    execute: async (sql, params) => { calls.push(['execute', sql, params]); return [[{ ok: 1 }]]; },
    commit: async () => { calls.push('commit'); },
    rollback: async () => { calls.push('rollback'); },
    release: () => { calls.push('release'); },
  };
  const pool = {
    getConnection: async () => connection,
    execute: connection.execute,
    end: async () => { calls.push('end'); },
  };
  const client = new MySqlClient({
    env: { MYSQL_PASSWORD: 'not-a-production-password', MYSQL_DATABASE: 'momevia_test' },
    createPool: () => pool,
  });
  return { calls, client };
}

test('MySQL transaction commit với cùng một connection', async () => {
  const { client, calls } = fixture();
  const result = await client.withTransaction(async trx => {
    const [rows] = await trx.execute('SELECT ?', [1]);
    return rows[0].ok;
  });
  assert.equal(result, 1);
  assert.deepEqual(calls.slice(0, 4).map(x => Array.isArray(x) ? x[0] : x), ['begin', 'execute', 'commit', 'release']);
  await client.close();
  assert.equal(calls.at(-1), 'end');
});

test('MySQL transaction rollback khi công việc lỗi', async () => {
  const { client, calls } = fixture();
  await assert.rejects(client.withTransaction(async trx => {
    await trx.execute('UPDATE x SET a=?', [1]);
    throw new Error('test rollback');
  }), /rollback/);
  assert.deepEqual(calls.slice(-2), ['rollback', 'release']);
});

test('không kết nối khi thiếu thông tin mật khẩu', async () => {
  const client = new MySqlClient({ env: { MYSQL_DATABASE: 'momevia_test' }, createPool() { throw new Error('should not call'); } });
  await assert.rejects(client.execute('SELECT 1'), /MYSQL_PASSWORD/);
});
