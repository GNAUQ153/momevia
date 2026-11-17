import test from 'node:test';
import assert from 'node:assert/strict';
import { MySqlSupportRepository } from '../../src/modules/support/mysql.repository.mjs';
import { SupportService } from '../../src/modules/support/support.service.mjs';

class MockClient {
  calls = [];
  async execute(sql, params = []) {
    this.calls.push([sql, params]);
    return [sql.trimStart().startsWith('SELECT') ? [
      { id: 'abc', code: 'HT-2026-X', userId: 'def', name: 'An', email: 'a@test.dev', topic: 'Test', message: 'Xin giúp đỡ', status: 'new', createdAt: '2026-11-17 10:00:00.000' },
    ] : { affectedRows: 1 }];
  }
  async close() {}
}

test('Support mysql insert có placeholder, tách legacy identity', async () => {
  const client = new MockClient();
  const repo = new MySqlSupportRepository(client);
  const ticket = {
    id: 'abcdef', code: 'HT-2026-AAA', userId: 'user-json', name: 'An',
    email: 'a@test.dev', topic: 'Hỗ trợ', message: "Nội dung có ' dấu nháy",
    status: 'new', createdAt: '2026-11-17T10:00:00.000Z',
  };
  await repo.insert(ticket);
  assert.match(client.calls[0][0], /VALUES \(\?, \?, NULL, \?, \?, \?, \?, \?, \?, \?\)/);
  assert.equal(client.calls[0][1][2], 'user-json');
  assert.doesNotMatch(client.calls[0][0], /Nội dung có/);
  const rows = await repo.all();
  assert.equal(rows[0].createdAt, '2026-11-17T10:00:00.000Z');
});

test('SupportService vẫn từ chối người không phải admin', async () => {
  const client = new MockClient();
  const service = new SupportService({ repository: new MySqlSupportRepository(client), attempts: { consume: () => true } });
  await assert.rejects(service.requests({ role: 'sender' }), /quản trị viên/);
  assert.equal(client.calls.length, 0);
  const requests = await service.requests({ role: 'admin' });
  assert.equal(requests[0].code, 'HT-2026-X');
});
