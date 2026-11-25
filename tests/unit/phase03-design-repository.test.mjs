import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as legacy from '../../src/modules/designs/mysql.repository.mjs';
import * as mapping from '../../src/modules/designs/mysql-row-mapping.mjs';
import * as transaction from '../../src/modules/designs/mysql-transaction.mjs';
import { JsonDesignRepository } from '../../src/modules/designs/json.repository.mjs';

const { MySqlDesignsRepository } = legacy;
const time = '2026-11-25T00:00:00.000Z';
const row = { id: 'design', owner_id: 'owner', title: 'Thiệp thử', source_kind: 'template', template_id: 'template', template_version_id: 'version', provenance: '{}', policy: '{}', revision: 1, schema_version: 1, document: '{"schemaVersion":1,"assets":[]}', document_hash: 'old', created_at: time, updated_at: time, archived_at: null };
const input = { expectedRevision: 1, mutationId: 'save-key', requestHash: 'save-hash', title: 'Thiệp mới', document: { schemaVersion: 1, assets: [] }, documentHash: 'new', assetIds: [] };
const asset = { id: 'asset', ownerId: 'owner', designId: 'design', status: 'ready', mime: 'image/png', bytes: 10, width: 1, height: 2, contentHash: 'asset-hash', storageKey: 'asset.png', createdAt: time };
const context = { contextId: 'context', designId: 'design', designRevision: 1, documentHash: 'old', source: { kind: 'template', templateId: 'template', templateVersionId: 'version' } };

// Fixture SQL chỉ mô phỏng giao thức execute, không mô phỏng InnoDB.
function fixture(steps) {
  const calls = [];
  let transactions = 0;
  const execute = async (sql, params = []) => {
    const next = steps.shift();
    assert(next, `SQL ngoài kỳ vọng: ${sql}`);
    assert.match(sql, next[0]);
    assert.deepEqual(params, next[1]);
    calls.push(sql);
    return [next[2]];
  };
  const client = { execute, async withTransaction(work) { transactions++; return work({ execute }); } };
  return { repo: new MySqlDesignsRepository(client), calls, verify(count) { assert.equal(steps.length, 0); assert.equal(transactions, count); } };
}
const lockOwner = [/SELECT id FROM users WHERE id=\? FOR UPDATE/, ['owner'], [{ id: 'owner' }]];
const lockDesign = [/SELECT \* FROM designs WHERE id=\? AND owner_id=\? AND archived_at IS NULL FOR UPDATE/, ['design', 'owner'], [row]];
const lockMutation = [/SELECT request_hash,response FROM design_mutations.*FOR UPDATE/, ['design', 'owner', 'save-key'], []];

test('giữ tương thích export mapping và transaction của repository cũ', () => {
  for (const key of ['jsonValue', 'iso', 'designFromRow', 'assetFromRow']) assert.equal(legacy[key], mapping[key]);
  for (const key of ['canvasError', 'canvasTransaction', 'lockedDesign', 'sameRequest', 'sameRevision', 'lockOwner', 'ensureAssets']) assert.equal(legacy[key], transaction[key]);
  assert.deepEqual(mapping.designFromRow(row).source, context.source);
  assert.equal(mapping.designFromRow(row).createdAt, time);
});

test('truy vấn tài sản và checkout context luôn ràng buộc chủ tài khoản', async () => {
  const f = fixture([
    [/WHERE id=\? AND owner_id=\? LIMIT 1/, ['asset', 'other'], []],
    [/JOIN orders o ON o.id=c.order_id AND o.user_id=c.owner_id\s+WHERE c.owner_id=\? AND c.order_id=\? ORDER BY/, ['other', 'order'], []],
    [/JOIN orders o ON o.id=c.order_id AND o.user_id=c.owner_id\s+WHERE c.owner_id=\? AND c.order_id=\? AND c.context_id=\?/, ['other', 'order', 'context'], []],
  ]);
  assert.equal(await f.repo.getAsset('other', 'asset'), null);
  assert.deepEqual(await f.repo.listContexts('other', 'order'), []);
  assert.equal(await f.repo.getContext('other', 'order', 'context'), null);
  f.verify(0);
});

test('ghi checkout context giữ thứ tự khóa và dùng cùng transaction', async () => {
  const f = fixture([lockOwner, lockDesign,
    [/SELECT \* FROM checkout_design_contexts.*FOR UPDATE/, ['owner', 'order', 'mutation'], []],
    [/SELECT id,user_id,template_id FROM orders WHERE id=\? AND user_id=\? FOR UPDATE/, ['order', 'owner'], [{ template_id: 'template' }]],
    [/INSERT INTO checkout_design_contexts/, ['context','owner','order','design',1,'old','template','version','mutation','request'], { affectedRows: 1 }],
  ]);
  assert.deepEqual(await f.repo.attachContext('owner', 'order', 'mutation', 'request', context), { ...context, replayed: false });
  f.verify(1);
});

test('checkout context từ chối đơn không thuộc chủ thiết kế trước khi ghi', async () => {
  const f = fixture([lockOwner, lockDesign,
    [/SELECT \* FROM checkout_design_contexts.*FOR UPDATE/, ['owner', 'order', 'mutation'], []],
    [/SELECT id,user_id,template_id FROM orders WHERE id=\? AND user_id=\? FOR UPDATE/, ['order', 'owner'], []],
  ]);
  await assert.rejects(f.repo.attachContext('owner', 'order', 'mutation', 'request', context), { code: 'ORDER_NOT_FOUND', status: 404 });
  f.verify(1);
});

test('tài sản vượt quota bị chặn trước callback prepare và INSERT', async () => {
  const f = fixture([lockOwner, lockDesign,
    [/SELECT \* FROM design_assets WHERE id=\? FOR UPDATE/, ['asset'], []],
    [/SELECT COALESCE\(SUM\(bytes\),0\).*owner_id=\?/, ['owner'], [{ bytes: 50 * 1024 * 1024 }]],
  ]);
  await assert.rejects(f.repo.insertAsset('owner', 'design', asset, { prepare: () => assert.fail('Không được promote asset') }), { code: 'ASSET_QUOTA', status: 413 });
  f.verify(1);
});

test('MySQL chờ callback policy từ chối trước mọi lệnh ghi', async () => {
  const f = fixture([lockDesign, lockMutation]);
  let checked = false;
  await assert.rejects(f.repo.save('owner', 'design', input, async current => {
    await Promise.resolve();
    assert.equal(current.revision, 1);
    checked = true;
    throw new Error('QA policy rejected');
  }), /QA policy rejected/);
  assert.equal(checked, true);
  f.verify(1);
});

test('JSON chờ policy bất đồng bộ, từ chối không ghi revision hoặc mutation', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'momevia-repository-contract-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'canvas.json');
  const repo = new JsonDesignRepository(file);
  await repo.create('owner', 'create', 'hash', mapping.designFromRow(row));
  const before = fs.readFileSync(file, 'utf8');
  let checked = false;
  await assert.rejects(repo.save('owner', 'design', input, async current => {
    await Promise.resolve();
    assert.equal(current.revision, 1);
    checked = true;
    throw new Error('QA policy rejected');
  }), /QA policy rejected/);
  assert.equal(checked, true);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  const ack = await repo.save('owner', 'design', input, async () => { await Promise.resolve(); });
  assert.equal(ack.savedRevision, 2);
  assert.equal((await repo.save('owner', 'design', input, () => assert.fail('Replay không chạy policy'))).replayed, true);
  assert.equal((await repo.get('owner', 'design')).revision, 2);
});
