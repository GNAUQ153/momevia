// Momevia 7190fd2 — draft-only migration rehearsal, NEVER target production.
// Place in database/scripts/. Requires the complete repository at this commit.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { MySqlClient } from '../../src/infrastructure/mysql/client.mjs';
import { mysqlDate } from '../../src/modules/identity/mysql.repositories.mjs';
import { designFromRow, assetFromRow, jsonValue } from '../../src/modules/designs/mysql.repository.mjs';
import { assetIds, canonicalStringify } from '../../web/js/shared/canvas/index.js';
import { exportCanvas, verifyCanvas } from '../../scripts/dev/canvas-backup.mjs';

const check = (ok, msg) => { if (!ok) throw new Error(msg); };
const same = (a, b) => canonicalStringify(a) === canonicalStringify(b);
const json = JSON.stringify;
const sha = value => `sha256:${createHash('sha256').update(canonicalStringify(value)).digest('hex')}`;
const date = value => value == null ? null : mysqlDate(value);
const plain = v => v && typeof v === 'object' && !Array.isArray(v);
const empty = v => plain(v) && Object.keys(v).length === 0;
const draftTables = ['designs','design_assets','design_asset_refs','design_create_requests','design_mutations'];
const otherTables = ['design_versions','checkout_design_contexts','gifts','gift_replies','gift_asset_refs','gift_publication_requests','orders','demo_purchases','template_entitlements','support_requests','music_library_overrides','music_library_history','json_storage_imports'];
const read = filename => {
  check(fs.lstatSync(filename).isFile() && !fs.lstatSync(filename).isSymbolicLink(), 'Expected regular file');
  return JSON.parse(fs.readFileSync(filename,'utf8'));
};
const count = async (tx, name) => Number((await tx.execute(`SELECT COUNT(*) n FROM ${name}`))[0][0].n);
async function insert(tx, table, columns, values) {
  check(values.every(v => v !== undefined), `Undefined value in ${table}`);
  await tx.execute(`INSERT INTO ${table} (${columns}) VALUES (${values.map(()=>'?').join(',')})`, values);
}
function inspectOther(root) {
  for (const rel of ['checkout/orders.json','gifts/gifts.json','gifts/replies.json','support/requests.json']) {
    const a = read(path.join(root,rel));
    check(Array.isArray(a) && a.length === 0, `${rel}: nonempty/unsupported; draft-only migration refused`);
  }
  const audio = read(path.join(root,'designs/music-library.json'));
  check(audio.formatVersion===1 && Array.isArray(audio.items) && Array.isArray(audio.history) && !audio.items.length && !audio.history.length, 'Music curation exists or unsupported; migration refused');
  const images = path.join(root,'gifts/images');
  if (fs.existsSync(images)) check(fs.readdirSync(images).length===0,'Legacy gift images present; migration refused');
}
async function run() {
  const {values: v} = parseArgs({options:{root:{type:'string'},offline:{type:'boolean'},apply:{type:'boolean'}}});
  check(v.root && v.offline, 'Usage: --root <extracted momevia directory> --offline [--apply]');
  const e = process.env;
  check(e.MIGRATION_TEST_HOST === '127.0.0.1', 'Explicit MIGRATION_TEST_HOST=127.0.0.1 required');
  check(e.MIGRATION_TEST_DATABASE === 'momevia_migration_test','Only momevia_migration_test is allowed');
  check(['3306','3308','3309','13306'].includes(e.MIGRATION_TEST_PORT), 'Use a dedicated local port, never Railway tunnel ports');
  check(e.MIGRATION_TEST_USER && e.MIGRATION_TEST_PASSWORD,'Explicit test credentials required');
  check(!e.RAILWAY_ENVIRONMENT_ID && !e.RAILWAY_SERVICE_ID,'Railway runtime is forbidden');
  const root = path.resolve(v.root);
  inspectOther(root);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(),'momevia-rehearsal-'));
  const client = new MySqlClient({env:{MYSQL_HOST:e.MIGRATION_TEST_HOST, MYSQL_PORT:e.MIGRATION_TEST_PORT, MYSQL_DATABASE:e.MIGRATION_TEST_DATABASE, MYSQL_USER:e.MIGRATION_TEST_USER, MYSQL_PASSWORD:e.MIGRATION_TEST_PASSWORD}});
  const rollback = new Error('REHEARSAL_ROLLBACK');
  try {
    const source = path.join(root,'designs');
    const verified = path.join(tmp,'canvas');
    exportCanvas({source,target:verified,offline:true});
    const manifest = verifyCanvas({source:verified}).manifest;
    const c = read(path.join(verified,'canvas.json'));
    for (const key of ['contexts','publications','versions','replies']) check(empty(c[key]), `${key} nonempty; draft-only migration refused`);
    const counts = Object.fromEntries(['designs','creates','mutations','assets'].map(k=>[k,Object.keys(c[k]).length]));
    counts.assetRefs = Object.values(c.designs).reduce((n,d)=>n+assetIds(d.document).length,0);
    console.log('Validated source counts:',counts);
    const [[db]] = await client.execute('SELECT DATABASE() db');
    check(db.db==='momevia_migration_test','Wrong database');
    const [versions] = await client.execute('SELECT version FROM schema_migrations');
    for (const prefix of ['006_','012_','013_','014_','015_','016_']) check(versions.some(r=>r.version.startsWith(prefix)),`Missing schema migration ${prefix}`);
    check(await count(client,'schema_migration_pending')===0,'Interrupted schema migration');
    const [engines] = await client.execute('SELECT TABLE_NAME name, ENGINE engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
    for (const table of [...draftTables,...otherTables,'users','templates']) check(engines.some(r=>r.name===table&&r.engine==='InnoDB'),`Missing or nontransactional table: ${table}`);
    try {
      await client.withTransaction(async tx=>{
        for (const table of [...draftTables,...otherTables]) check(await count(tx,table)===0,`${table} is not empty; refusing merge`);
        const [u] = await tx.execute('SELECT id FROM users');
        const [t] = await tx.execute('SELECT id FROM templates');
        const users = new Set(u.map(r=>r.id)), templates = new Set(t.map(r=>r.id));
        check(users.size>0&&templates.size>0,'Restore the existing SQL backup first');
        for (const d of Object.values(c.designs)) {
          check(users.has(d.ownerId),'Draft owner missing in target');
          check(d.source.kind==='blank'||templates.has(d.source.templateId),'Draft template missing in target');
          await insert(tx,'designs','id,owner_id,title,source_kind,template_id,template_version_id,provenance,policy,revision,schema_version,document,document_hash,created_at,updated_at,archived_at', [d.id,d.ownerId,d.title,d.source.kind,d.source.templateId||null,d.source.templateVersionId||null,json(d.provenance),json(d.policy),d.revision,d.schemaVersion,json(d.document),d.documentHash,date(d.createdAt),date(d.updatedAt),date(d.archivedAt)]);
        }
        for (const a of Object.values(c.assets)) {
          check(users.has(a.ownerId)&&c.designs[a.designId]?.ownerId===a.ownerId,'Asset owner/design mismatch');
          await insert(tx,'design_assets','id,owner_id,design_id,status,mime,bytes,width,height,content_hash,storage_key,created_at,media_kind,duration_ms,sample_count,sample_rate,channels',[a.id,a.ownerId,a.designId,a.status,a.mime,a.bytes,a.width,a.height,a.contentHash,a.storageKey,date(a.createdAt),a.mediaKind||'image',a.durationMs??null,a.sampleCount??null,a.sampleRate??null,a.channels??null]);
        }
        const refs = [];
        for (const d of Object.values(c.designs)) for (const id of assetIds(d.document)) {
          await insert(tx,'design_asset_refs','design_id,asset_id',[d.id,id]); refs.push(`${d.id}:${id}`);
        }
        for (const [key,value] of Object.entries(c.creates)) {
          const [ownerId,mutationId,...rest]=key.split(':'); const id=value.result.design.id;
          check(!rest.length&&mutationId&&c.designs[id]?.ownerId===ownerId,'Create owner/key mismatch');
          await insert(tx,'design_create_requests','owner_id,mutation_id,request_hash,design_id',[ownerId,mutationId,value.requestHash,id]);
        }
        for (const [key,value] of Object.entries(c.mutations)) {
          const [id,mutationId,...rest]=key.split(':');
          check(!rest.length&&mutationId&&c.designs[id]&&value.result.designId===id&&value.result.mutationId===mutationId,'Mutation identity mismatch');
          await insert(tx,'design_mutations','design_id,owner_id,mutation_id,request_hash,response',[id,c.designs[id].ownerId,mutationId,value.requestHash,json(value.result)]);
        }
        // Check round-trip on the same transaction, before any commit.
        const [dr]=await tx.execute('SELECT * FROM designs');
        check(dr.length===counts.designs&&dr.every(r=>same(designFromRow(r),c.designs[r.id])),'Draft round-trip mismatch');
        const [ar]=await tx.execute('SELECT * FROM design_assets');
        check(ar.length===counts.assets&&ar.every(r=>same(assetFromRow(r),c.assets[r.id])),'Asset round-trip mismatch');
        const [rr]=await tx.execute('SELECT design_id,asset_id FROM design_asset_refs');
        check(same(rr.map(r=>`${r.design_id}:${r.asset_id}`).sort(),refs.sort()),'Asset refs mismatch');
        const [cr]=await tx.execute('SELECT owner_id,mutation_id,request_hash,design_id FROM design_create_requests');
        check(cr.length===counts.creates&&cr.every(r=>{const x=c.creates[`${r.owner_id}:${r.mutation_id}`];return x?.requestHash===r.request_hash&&x.result.design.id===r.design_id;}),'Create replay mismatch');
        const [mr]=await tx.execute('SELECT design_id,owner_id,mutation_id,request_hash,response FROM design_mutations');
        check(mr.length===counts.mutations&&mr.every(r=>{const x=c.mutations[`${r.design_id}:${r.mutation_id}`];return x?.requestHash===r.request_hash&&c.designs[r.design_id].ownerId===r.owner_id&&same(jsonValue(r.response),x.result);}),'Mutation replay mismatch');
        // Archive the original aggregate, including historical create ACKs; no identity credentials.
        const snapshot={kind:'incremental-drafts-v1',canvas:c,files:manifest.files};
        const sourceHash=sha(snapshot);
        await insert(tx,'json_storage_imports','id,source_label,source_hash,source_snapshot,version_aliases,counts',[randomUUID(),'local-draft-rehearsal',sourceHash,json(snapshot),'{}',json(counts)]);
        const [[receipt]]=await tx.execute('SELECT source_snapshot FROM json_storage_imports WHERE source_hash=?',[sourceHash]);
        check(receipt&&same(jsonValue(receipt.source_snapshot),snapshot),'Source receipt mismatch');
        check(await count(tx,'users')===users.size&&await count(tx,'templates')===templates.size,'Identity/catalog count changed');
        inspectOther(root);
        check(same(read(path.join(source,'canvas.json')),c),'Source changed');
        for (const f of manifest.files) {
          const bytes=fs.readFileSync(path.join(source,f.file));
          check(`sha256:${createHash('sha256').update(bytes).digest('hex')}`===f.sha256,'Source file changed');
        }
        if (!v.apply) throw rollback;
      });
      console.log('LOCAL_COMMIT_PASS',counts);
    } catch(err) {
      if (err!==rollback) throw err;
      for (const table of [...draftTables,'json_storage_imports']) check(await count(client,table)===0,`Rollback verification failed: ${table}`);
      console.log('LOCAL_DRY_RUN_ROLLBACK_PASS',counts);
    }
  } finally {
    try { await client.close(); } finally { fs.rmSync(tmp,{recursive:true,force:true}); }
  }
}
run().catch(err=>{console.error('Migration rehearsal failed:',err.code||err.message);process.exitCode=1;});
