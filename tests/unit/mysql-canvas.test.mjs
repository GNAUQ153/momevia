import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { designFromRow, assetFromRow, sameRevision, canvasTransaction, MySqlDesignsRepository } from '../../src/modules/designs/mysql.repository.mjs';
import { giftFromRow } from '../../src/modules/designs/mysql-publication.mjs';

const timestamp = '2026-11-17 00:00:00.000';
test('canvas SQL converters use authoritative relation columns and explicit date/number/null semantics', () => {
  const design = designFromRow({ id:'real', owner_id:'owner', title:'Tiếng Việt', source_kind:'blank', template_id:null,
    template_version_id:null, provenance:'{"adapter":"blank"}',policy:'{"kind":"sender-basic"}',revision:'8',schema_version:1,
    document:'{"schemaVersion":1}',document_hash:'sha256:test',created_at:timestamp,updated_at:timestamp,archived_at:null });
  assert.deepEqual(design.source,{kind:'blank'}); assert.equal(design.revision,8); assert.equal(design.ownerId,'owner');
  assert.equal(design.archivedAt,null); assert.equal(design.createdAt,'2026-11-17T00:00:00.000Z');
  const asset=assetFromRow({id:'asset',owner_id:'owner',design_id:'real',status:'ready',mime:'image/webp',bytes:'123',width:'2',height:3,
    content_hash:'hash',storage_key:'private.webp',created_at:timestamp});
  assert.equal(asset.bytes,123);assert.equal(asset.width,2);assert.equal(asset.mime,'image/webp');
  const gift=giftFromRow({id:'real-gift',slug:'real-slug',user_id:'real-owner',template_id:null,source_kind:'blank',design_version_id:'real-version',
    recipient_name:'Mai',sender_name:'An',message:'Lời chúc',image_file:null,reply_count:'2',created_at:timestamp,expires_at:'2027-11-17 00:00:00.000',
    payload:JSON.stringify({id:'spoof',userId:'spoof',sourceKind:'legacy',templateId:'fake-template',designVersionId:'fake-version',documentSnapshot:{schemaVersion:1}})});
  assert.equal(gift.id,'real-gift');assert.equal(gift.userId,'real-owner');assert.equal(gift.sourceKind,'blank');assert.equal(gift.templateId,null);
  assert.equal(gift.designVersionId,'real-version');assert.equal(gift.replyCount,2);
});
test('revision and hash conflicts preserve owner-scoped reconciliation metadata',()=>{
  const design={revision:3,documentHash:'server'};
  assert.throws(()=>sameRevision(design,2),{status:409,code:'REVISION_CONFLICT',details:{revision:3,documentHash:'server'}});
  assert.throws(()=>sameRevision(design,3,'client'),{status:409});
  assert.doesNotThrow(()=>sameRevision(design,3,'server'));
});
test('transaction retry is bounded and restricted to rolled-back InnoDB lock failures',async()=>{
  let attempts=0;
  const client={async withTransaction(work){if(++attempts<3)throw Object.assign(new Error('deadlock'),{code:'ER_LOCK_DEADLOCK'});return work({});}};
  assert.equal(await canvasTransaction(client,async()=>42),42);assert.equal(attempts,3);
  attempts=0;
  await assert.rejects(canvasTransaction({async withTransaction(){attempts++;throw Object.assign(new Error('FK'),{code:'ER_NO_REFERENCED_ROW_2'});}},()=>{}),{code:'ER_NO_REFERENCED_ROW_2'});
  assert.equal(attempts,1);
  attempts=0;
  await assert.rejects(canvasTransaction({async withTransaction(){attempts++;throw Object.assign(new Error('lock'),{code:'ER_LOCK_WAIT_TIMEOUT'});}},()=>{}),{code:'ER_LOCK_WAIT_TIMEOUT'});
  assert.equal(attempts,3);
});
test('missing canvas migration fails readiness clearly without mutating schema',async()=>{
  const calls=[];
  const repo=new MySqlDesignsRepository({async execute(sql){calls.push(sql);return [[]];}});
  await assert.rejects(repo.ready(),{status:503,code:'CANVAS_MIGRATION_REQUIRED'});
  assert(calls.every(sql=>sql.startsWith('SELECT')));
});
test('canvas refuses native JSON storage before the lossless document migration', async () => {
  const calls = [];
  const repo = new MySqlDesignsRepository({ async execute(sql) {
    calls.push(sql); return [sql.includes("version='006_canvas'") ? [{ version: '006_canvas' }] : []];
  } });
  await assert.rejects(repo.ready(), error => error.code === 'CANVAS_MIGRATION_REQUIRED' && error.message.includes('012'));
  assert(calls.every(sql => sql.startsWith('SELECT')));
});

test('migration006 keeps legacy FK and requires real immutable version for blank publication',()=>{
  const sql=fs.readFileSync(new URL('../../database/migrations/006_canvas.sql',import.meta.url),'utf8');
  assert.match(sql,/MODIFY COLUMN template_id VARCHAR\(128\) CHARACTER SET ascii COLLATE ascii_bin NULL/);
  assert.match(sql,/source_kind='blank' AND template_id IS NULL AND design_version_id IS NOT NULL/);
  assert.match(sql,/source_kind='legacy' AND template_id IS NOT NULL AND design_version_id IS NULL/);
  for(const table of ['designs','design_create_requests','design_mutations','design_versions','design_assets','design_asset_refs','gift_asset_refs','gift_publication_requests','checkout_design_contexts'])
    assert.match(sql,new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(`));
  assert.doesNotMatch(sql,/DROP\s+(TABLE|FOREIGN KEY)|DELETE FROM|BINARY\(16\)|JSONB/i);
  assert.match(sql,/UNIQUE KEY checkout_context_mutation_uk \(owner_id, order_id, mutation_id\)/);
  assert.doesNotMatch(sql,/UNIQUE[^\n]*\(order_id\)/);
});
