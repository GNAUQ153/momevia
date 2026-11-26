import test from 'node:test';
import assert from 'node:assert/strict';
import { insertDesignAssetRefs, insertGiftAssetRefs } from '../../src/modules/designs/mysql-transaction.mjs';
import { MySqlDesignsRepository } from '../../src/modules/designs/mysql.repository.mjs';
import { MySqlClient } from '../../src/infrastructure/mysql/client.mjs';
import { assessIndexPrefixes, readIndexMetadata } from '../../database/scripts/index-audit.mjs';

const ids = n => Array.from({ length: n }, (_, i) => `asset-${i}`);
const mock = () => {
  const calls = [];
  return { calls, tx: { async execute(sql, params) { calls.push({ sql, params }); return [{ affectedRows: params.length / 2 }]; } } };
};

test('Không có tài sản thì không phát sinh INSERT', async () => {
  const f = mock();
  await insertDesignAssetRefs(f.tx, 'design', []);
  await insertGiftAssetRefs(f.tx, 'gift', []);
  assert.deepEqual(f.calls, []);
});

test('Gom tối đa 100 liên kết mỗi batch, giữ đủ tham số và thứ tự', async () => {
  const f = mock();
  const assets = ids(205);
  await insertDesignAssetRefs(f.tx, 'design', assets);
  assert.deepEqual(f.calls.map(call => call.params.length), [200, 200, 10]);
  assert.deepEqual(f.calls.flatMap(call => call.params), assets.flatMap(id => ['design', id]));
  for (const call of f.calls) {
    assert.match(call.sql, /^INSERT INTO design_asset_refs\(design_id,asset_id\) VALUES /);
    assert.equal((call.sql.match(/\?/g) || []).length, call.params.length);
  }
});

test('Liên kết thiệp dùng bảng cố định và không nội suy dữ liệu vào SQL', async () => {
  const f = mock();
  const value = "a' OR 1=1 --";
  await insertGiftAssetRefs(f.tx, 'gift', [value, 'b']);
  assert.deepEqual(f.calls, [{ sql: 'INSERT INTO gift_asset_refs(gift_id,asset_id) VALUES (?,?),(?,?)', params: ['gift', value, 'gift', 'b'] }]);
});

test('Không nuốt lỗi batch hoặc tiếp tục ghi sau lỗi', async () => {
  const error = Object.assign(new Error('FK'), { code: 'ER_NO_REFERENCED_ROW_2' });
  let calls = 0;
  await assert.rejects(insertDesignAssetRefs({ async execute() { if (++calls === 2) throw error; } }, 'design', ids(205)), error);
  assert.equal(calls, 2);
});

test('Client rollback toàn bộ transaction nếu batch thứ hai lỗi', async () => {
  const events = [];
  let calls = 0;
  const client = new MySqlClient();
  client.pool = async () => ({ async getConnection() { return {
    async beginTransaction() { events.push('begin'); },
    async execute() { events.push('insert'); if (++calls === 2) throw new Error('FK'); },
    async commit() { events.push('commit'); },
    async rollback() { events.push('rollback'); },
    release() { events.push('release'); },
  }; } });
  await assert.rejects(client.withTransaction(tx => insertGiftAssetRefs(tx, 'gift', ids(101))), /FK/);
  assert.deepEqual(events, ['begin', 'insert', 'insert', 'rollback', 'release']);
});

const now = '2026-11-26T00:00:00.000Z';
const designRow = { id: 'design', owner_id: 'owner', title: 'Test', source_kind: 'blank', provenance: '{}', policy: '{}', revision: 1, schema_version: 1, document: '{"schemaVersion":1}', document_hash: 'old', created_at: now, updated_at: now };
const assetRow = id => ({ id, owner_id: 'owner', design_id: 'design', status: 'ready', mime: 'image/png', bytes: 1, width: 1, height: 1, content_hash: 'hash', storage_key: 'x', created_at: now });
function saveFixture({ invalid = false } = {}) {
  const calls = [];
  const client = { async withTransaction(work) { return work({ async execute(sql, params) {
    calls.push({ sql, params });
    if (sql.startsWith('SELECT * FROM designs')) return [[designRow]];
    if (sql.startsWith('SELECT request_hash,response')) return [[]];
    if (sql.startsWith('SELECT * FROM design_assets')) return [invalid && params[0] === 'b' ? [] : [assetRow(params[0])]];
    return [{ affectedRows: 1 }];
  } }); } };
  return { calls, repo: new MySqlDesignsRepository(client) };
}
const input = { expectedRevision: 1, mutationId: 'mutation', requestHash: 'request', title: 'Test', document: { schemaVersion: 1 }, documentHash: 'new', assetIds: ['b', 'a', 'b'] };

test('Save khóa tài sản theo thứ tự cũ, gom ref đã dedup và ghi ACK sau batch', async () => {
  const f = saveFixture();
  const ack = await f.repo.save('owner', 'design', input);
  assert.equal(ack.savedRevision, 2);
  const locks = f.calls.filter(call => call.sql.startsWith('SELECT * FROM design_assets'));
  assert.deepEqual(locks.map(call => call.params), [['a', 'owner'], ['b', 'owner']]);
  assert(locks.every(call => call.sql.endsWith('FOR UPDATE')));
  assert.deepEqual(f.calls.slice(-3).map(call => call.sql.split(' ').slice(0, 3).join(' ')), ['DELETE FROM design_asset_refs', 'INSERT INTO design_asset_refs(design_id,asset_id)', 'INSERT INTO design_mutations(design_id,owner_id,mutation_id,request_hash,response)']);
  assert.deepEqual(f.calls.at(-2).params, ['design', 'b', 'design', 'a']);
});

test('Tài sản không hợp lệ vẫn chặn mọi lệnh ghi trước batch', async () => {
  const f = saveFixture({ invalid: true });
  await assert.rejects(f.repo.save('owner', 'design', input), { code: 'ASSET_NOT_READY' });
  assert(f.calls.every(call => call.sql.startsWith('SELECT')));
});

const part = (columnName, position, extra = {}) => ({ tableName: 'gift_replies', indexName: 'idx', columnName, position, prefixLength: null, indexType: 'BTREE', visible: 'YES', ...extra });
const unread = rows => assessIndexPrefixes(rows).find(check => check.query === 'gift-unread');
test('Audit prefix nhận index đầy đủ và không phụ thuộc thứ tự metadata', () => {
  assert.deepEqual(unread([part('read_status', 2), part('gift_id', 1), part('created_at', 3)]).candidates, ['idx']);
});
test('Audit không tính index thiếu cột, đảo cột, prefix rút gọn hoặc invisible', () => {
  for (const rows of [[part('gift_id', 1)], [part('read_status', 1), part('gift_id', 2)], [part('gift_id', 1, { prefixLength: 8 }), part('read_status', 2)], [part('gift_id', 1, { visible: 'NO' }), part('read_status', 2)], [part('gift_id', 2), part('read_status', 3)]]) {
    assert.equal(unread(rows).status, 'review_required');
  }
});
test('Index inventory chỉ đọc information_schema của database hiện hành', async () => {
  const calls = [];
  const rows = [part('gift_id', 1), part('read_status', 2)];
  const report = await readIndexMetadata({ async execute(sql) { calls.push(sql); return [rows]; } });
  assert.equal(calls.length, 1);
  assert.match(calls[0], /^SELECT[\s\S]+FROM information_schema\.STATISTICS WHERE TABLE_SCHEMA = DATABASE\(\)/);
  assert.deepEqual(report.indexes, rows);
  assert.equal(report.checks.find(check => check.query === 'gift-unread').status, 'prefix_found');
});
