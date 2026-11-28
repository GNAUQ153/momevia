// Explicit destructive fixture: requires an EMPTY, isolated QA schema and
// never takes connection details from .env/MYSQL_* or alters the app's data.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { MySqlClient } from '../../src/infrastructure/mysql/client.mjs';
import { MySqlDesignsRepository } from '../../src/modules/designs/mysql.repository.mjs';
import { MySqlPublicationUnitOfWork } from '../../src/modules/designs/mysql-publication.mjs';
import { MySqlGiftsRepository } from '../../src/modules/gifts/mysql.repositories.mjs';
import { MySqlCheckoutRepository } from '../../src/modules/checkout/mysql.repository.mjs';
import { CheckoutService } from '../../src/modules/checkout/checkout.service.mjs';
import { MySqlPaymentRepository } from '../../src/modules/payments/mysql.repository.mjs';
import { RefundSettlementQa } from '../../src/modules/payments/refund-settlement-qa.mjs';
import { readIntegrityCounts } from '../../database/scripts/integrity-audit.mjs';
import { auditRepository, assessSchema, readSchemaMetadata } from '../../database/scripts/migration-audit.mjs';
import { auditAuthSchema } from '../../database/scripts/auth-schema-audit.mjs';
import { MySqlUsersRepository, MySqlSessionStore } from '../../src/modules/identity/mysql.repositories.mjs';
import { CredentialsService } from '../../src/modules/identity/credentials.service.mjs';
import { sessionActionRef } from '../../src/modules/identity/session-inventory.mjs';
import { signSession, verifySession } from '../../src/shared/security.mjs';
import { registrationConsent } from '../../web/js/shared/registration-consent.js';

const require = createRequire(import.meta.url);
const driver = require('mysql2/promise');
const database = process.env.CANVAS_QA_MYSQL_DATABASE;
const port = Number(process.env.CANVAS_QA_MYSQL_PORT);
assert.equal(process.env.CANVAS_QA_MYSQL_ISOLATED, 'true', 'Set CANVAS_QA_MYSQL_ISOLATED=true only for an isolated empty QA schema.');
assert.match(database || '', /^momevia_canvas_qa_[a-z0-9_]+$/);
assert(Number.isSafeInteger(port) && port >= 1024 && port <= 65535, 'Explicit QA loopback port required.');
const options = { host: '127.0.0.1', port, database, user: process.env.CANVAS_QA_MYSQL_USER || 'root',
  password: process.env.CANVAS_QA_MYSQL_PASSWORD, timezone: 'Z', dateStrings: true, charset: 'utf8mb4',
  waitForConnections: true, connectionLimit: 8, decimalNumbers: false };
assert(options.password, 'Explicit QA password required.');
const admin = await driver.createConnection({ ...options, multipleStatements: true });
const [target] = await admin.query('SELECT DATABASE() AS db, VERSION() AS version');
assert.equal(target[0].db, database);
assert.match(target[0].version, /^8\.4\./);
const [tables] = await admin.query('SHOW TABLES');
assert.equal(tables.length, 0, 'Fixture refuses a nonempty database; use a new isolated schema.');
console.log(`TARGET isolated loopback schema=${database} mysql=${target[0].version}`);
const clients = [];
function client() {
  const pool = driver.createPool(options);
  const c = new MySqlClient({ env: { MYSQL_HOST: options.host, MYSQL_PORT: String(port), MYSQL_DATABASE: database,
    MYSQL_USER: options.user, MYSQL_PASSWORD: options.password }, createPool: () => pool });
  clients.push(c);
  return c;
}
let count = 0;
async function check(label, work) { await work(); count++; console.log(`PASS ${label}`); }
const uuid = randomUUID;
const hash = value => `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
const now = new Date().toISOString();
const later = new Date(Date.now() + 86400_000).toISOString();
const date = value => value.slice(0, 23).replace('T', ' ');
const owner = uuid(), other = uuid(), templateId = 'canvas-paid-template';
const record = (source = { kind: 'blank' }) => {
  const document = { schemaVersion: 1, bindings: { recipientName: { type: 'text', value: 'Mai' }, senderName: { type: 'text', value: 'An' }, message: { type: 'text', value: 'Chúc mừng sinh nhật Việt Nam!' } }, assets: [], scenes: [], elements: [] };
  return { id: uuid(), ownerId: owner, title: 'Quà tiếng Việt', source, provenance: { adapter: source.kind === 'blank' ? 'blank' : 'legacy-v1' },
    policy: { kind: 'sender-basic', lockedElements: {} }, revision: 1, schemaVersion: 1, document,
    documentHash: hash(document), createdAt: now, updatedAt: now, archivedAt: null };
};
const db = client(), db2 = client();
const repo = new MySqlDesignsRepository(db), repo2 = new MySqlDesignsRepository(db2);
const uow = new MySqlPublicationUnitOfWork(db), uow2 = new MySqlPublicationUnitOfWork(db2);
let legacySlug, design, asset;
function publishRequest(d, key = uuid()) { return { designId: d.id, expectedRevision: d.revision, expectedDocumentHash: d.documentHash, idempotencyKey: key }; }
function builder({ paid = false, afterCheck, fail = false } = {}) {
  return async ctx => {
    const d = ctx.design;
    if (paid) {
      assert.equal((await ctx.getTemplate(templateId)).price, 10000);
      if (!await ctx.hasLicense(owner, templateId)) throw Object.assign(new Error('License required'), { status: 402 });
    }
    if (afterCheck) await afterCheck(ctx);
    if (fail) throw new Error('injected before commit');
    const versionId = uuid();
    return { gift: { id: uuid(), slug: uuid().replaceAll('-', ''), userId: owner,
      templateId: d.source.templateId || null, sourceKind: d.source.kind, designVersionId: versionId,
      title: d.title, templateTitle: d.title, theme: 'lavender', recipientName: 'Mai', senderName: 'An',
      message: 'Chúc mừng sinh nhật Việt Nam!', imageFile: null, replyCount: 0,
      documentSnapshot: d.document, runtimeVersion: 1, assetIds: d.document.assets.map(a => a.assetId), createdAt: now, expiresAt: later },
    version: { id: versionId, designId: d.id, revision: d.revision, schemaVersion: 1, runtimeVersion: 1,
      documentHash: d.documentHash, document: d.document, createdAt: now }, assetIds: d.document.assets.map(a => a.assetId) };
  };
}
try {
  for (const name of ['001_initial.sql','002_support_user_bridge.sql','003_identity_catalog.sql','004_gifts_checkout.sql','005_payment_receipts.sql']) {
    await admin.query(await fs.readFile(new URL(`../../database/migrations/${name}`, import.meta.url), 'utf8'));
  }
  for (const id of [owner, other]) await admin.execute(`INSERT INTO users(id,provider,provider_id,name,role,created_at,legacy_payload)
    VALUES (?,'demo',?,?,'sender',?,'{}')`, [id, id, 'Tài khoản tổng hợp', date(now)]);
  await admin.execute(`INSERT INTO templates(id,title,style,theme,price_vnd,status,created_at,payload)
    VALUES (?,'Mẫu thử','classic','lavender',10000,'published',?,'{}')`, [templateId, date(now)]);
  const legacy = { id: uuid(), slug: uuid().replaceAll('-', ''), userId: owner, templateId, recipientName: 'Mai', senderName: 'An', message: 'Legacy', imageFile: null, replyCount: 0, createdAt: now, expiresAt: later };
  legacySlug = legacy.slug;
  await new MySqlGiftsRepository(db).insert(legacy);
  await admin.query(await fs.readFile(new URL('../../database/migrations/006_canvas.sql', import.meta.url), 'utf8'));
  await admin.query(await fs.readFile(new URL('../../database/migrations/007_support_reports.sql', import.meta.url), 'utf8'));
  const oldReply = uuid();
  await admin.execute("INSERT INTO gift_replies(id,gift_id,name,message,created_at) VALUES (?,?,'QA','Lời cũ',?)", [oldReply, legacy.id, date(now)]);
  await admin.query(await fs.readFile(new URL('../../database/migrations/008_gift_reply_read_state.sql', import.meta.url), 'utf8'));
  const [[preservedReply]] = await admin.execute('SELECT message,read_status FROM gift_replies WHERE id=?', [oldReply]);
  assert.deepEqual({ ...preservedReply }, { message: 'Lời cũ', read_status: null });
  for (const name of ['009_payment_reconciliation_audit.sql', '010_refund_review.sql', '011_json_storage_imports.sql', '012_canvas_lossless_json.sql'])
    await admin.query(await fs.readFile(new URL(`../../database/migrations/${name}`, import.meta.url), 'utf8'));
  await check('C25 upgrade 001–012 preserves legacy gift/reply, excludes old replies from unread, and preserves FK rules', async () => {
    await repo.ready();
    const preservedGift = await new MySqlGiftsRepository(db).getBySlug(legacySlug);
    assert.equal(preservedGift.id, legacy.id);
    assert.equal(preservedGift.unreadCount, 0);
    const [rows] = await admin.query("SELECT COLLATION_NAME,IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gifts' AND COLUMN_NAME='template_id'");
    assert.equal(rows[0].COLLATION_NAME, 'ascii_bin'); assert.equal(rows[0].IS_NULLABLE, 'YES');
    await assert.rejects(admin.execute(`INSERT INTO designs(id,owner_id,title,source_kind,provenance,policy,revision,schema_version,document,document_hash,created_at,updated_at)
      VALUES (?,?,'invalid','blank','{}','{}',1,1,'{}','hash',?,?)`, [uuid(), uuid(), date(now), date(now)]), { code: 'ER_NO_REFERENCED_ROW_2' });
  });
  const createKey = uuid(); const candidate = record();
  await check('C01/C06 create is owner scoped and idempotent across two adapter pools', async () => {
    const [a,b] = await Promise.all([repo.create(owner,createKey,'create-hash',candidate),repo2.create(owner,createKey,'create-hash',record())]);
    assert.equal(a.design.id,b.design.id); assert.equal(Number(a.replayed)+Number(b.replayed),1); design=a.design;
    assert.equal(await repo.get(other,design.id),null);
    await assert.rejects(repo.create(owner,createKey,'changed',record()),{status:409});
    assert.equal((await repo.get(owner,design.id)).document.bindings.message.value,'Chúc mừng sinh nhật Việt Nam!');
  });
  let winningSave;
  await check('C05/C06 two real connections CAS once; lost-ACK replay retains exact revision', async () => {
    const input = { expectedRevision:1, mutationId:uuid(), requestHash:'save-a', title:'Đã sửa', document:design.document, documentHash:design.documentHash, assetIds:[] };
    const input2 = { ...input,mutationId:uuid(),requestHash:'save-b',title:'Tab khác' };
    const results=await Promise.allSettled([repo.save(owner,design.id,input),repo2.save(owner,design.id,input2)]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
    winningSave=results[0].status==='fulfilled'?input:input2;
    const ack=await repo2.save(owner,design.id,winningSave);
    assert.equal(ack.replayed,true); assert.equal(ack.savedRevision,2);
    await assert.rejects(repo.save(owner,design.id,{...winningSave,requestHash:'bad'}),{status:409});
    design=await repo.get(owner,design.id);
  });
  await check('Phase 3.3: asynchronous save policy rejection preserves revision and mutation ledger', async () => {
    const before = await repo.get(owner, design.id);
    const input = { expectedRevision: before.revision, mutationId: uuid(), requestHash: 'policy-qa', title: before.title, document: before.document, documentHash: before.documentHash, assetIds: [] };
    await assert.rejects(repo.save(owner, design.id, input, async current => {
      await Promise.resolve();
      assert.equal(current.revision, before.revision);
      throw new Error('QA policy rejected');
    }), /QA policy rejected/);
    assert.deepEqual(await repo2.get(owner, design.id), before);
    const [rows] = await admin.execute('SELECT mutation_id FROM design_mutations WHERE owner_id=? AND design_id=? AND mutation_id=?', [owner, design.id, input.mutationId]);
    assert.equal(rows.length, 0);
  });
  await check('C08/C09 owner asset ACL, ready validation and draft refs', async () => {
    asset={id:uuid(),ownerId:owner,designId:design.id,status:'ready',mime:'image/png',bytes:68,width:1,height:1,contentHash:hash('synthetic-png'),storageKey:`${uuid()}.png`,createdAt:now};
    await repo.insertAsset(owner,design.id,asset);
    assert.equal(await repo.getAsset(other,asset.id),null);
    await assert.rejects(repo.insertAsset(other,design.id,{...asset,id:uuid()}),{status:404});
    const doc={...design.document,assets:[{assetId:asset.id,kind:'image'}]};
    await repo.save(owner,design.id,{expectedRevision:design.revision,mutationId:uuid(),requestHash:'add-asset',title:design.title,document:doc,documentHash:hash(doc),assetIds:[asset.id]});
    design=await repo.get(owner,design.id);
  });
  let publication, request;
  await check('C17 blank publication concurrent same key produces one gift and pins snapshot', async () => {
    request=publishRequest(design);
    const [a,b]=await Promise.all([uow.publish(owner,request,'pub-hash',builder()),uow2.publish(owner,request,'pub-hash',builder())]);
    assert.equal(a.gift.id,b.gift.id); assert.equal(Number(a.replayed)+Number(b.replayed),1); publication=a;
    assert.equal(a.gift.templateId,null); assert.equal((await uow.pinnedAsset(a.gift.slug,asset.id)).id,asset.id);
    await assert.rejects(uow.publish(owner,request,'changed',builder()),{status:409});
    const [[row]]=await admin.execute('SELECT COUNT(*) AS count FROM gifts WHERE design_version_id=?',[a.gift.designVersionId]); assert.equal(row.count,1);
  });
  await check('C18 DB fault after gift insert rolls back version/gift/pins/result; same key retries', async () => {
    const failRequest=publishRequest(design);
    const failing={withTransaction:work=>db2.withTransaction(tx=>work({execute:async(sql,args)=>{
      if(sql.includes('INSERT INTO gift_publication_requests')) throw new Error('injected before commit');
      return tx.execute(sql,args);
    }}))};
    const [[before]]=await admin.query('SELECT COUNT(*) AS count FROM gifts');
    await assert.rejects(new MySqlPublicationUnitOfWork(failing).publish(owner,failRequest,'fail-hash',builder()),/injected/);
    const [[after]]=await admin.query('SELECT COUNT(*) AS count FROM gifts'); assert.equal(before.count,after.count);
    const result=await uow.publish(owner,failRequest,'fail-hash',builder()); assert.equal(result.replayed,false);
    assert.equal((await uow2.publish(owner,failRequest,'fail-hash',builder())).gift.id,result.gift.id);
  });
  await check('Phase 3.5B: multi-asset create/save/publication preserve refs and rollback', async () => {
    const otherAsset = { ...asset, id: uuid(), storageKey: `${uuid()}.png` };
    await repo.insertAsset(owner, design.id, otherAsset);
    const assetIds = [asset.id, otherAsset.id].sort();
    const d = record();
    d.document.assets = assetIds.map(assetId => ({ assetId, kind: 'image' }));
    d.documentHash = hash(d.document);
    await repo.create(owner, uuid(), 'batch-create', d);
    const readRefs = async () => (await admin.execute('SELECT asset_id FROM design_asset_refs WHERE design_id=? ORDER BY asset_id', [d.id]))[0].map(row => row.asset_id);
    assert.deepEqual(await readRefs(), assetIds);
    const input = { expectedRevision: d.revision, mutationId: uuid(), requestHash: 'batch-save', title: d.title, document: d.document, documentHash: d.documentHash, assetIds };
    const failing = { withTransaction: work => db2.withTransaction(tx => work({ async execute(sql, args) {
      const result = await tx.execute(sql, args);
      if (sql.startsWith('INSERT INTO design_asset_refs')) throw new Error('batch rollback injection');
      return result;
    } })) };
    await assert.rejects(new MySqlDesignsRepository(failing).save(owner, d.id, input), /batch rollback injection/);
    assert.equal((await repo.get(owner, d.id)).revision, d.revision);
    assert.deepEqual(await readRefs(), assetIds);
    const [mutations] = await admin.execute('SELECT mutation_id FROM design_mutations WHERE design_id=? AND mutation_id=?', [d.id, input.mutationId]);
    assert.equal(mutations.length, 0);
    await repo.save(owner, d.id, input);
    assert.deepEqual(await readRefs(), assetIds);
    const current = await repo.get(owner, d.id);
    const result = await uow.publish(owner, publishRequest(current), 'batch-publish', builder());
    const [pins] = await admin.execute('SELECT asset_id FROM gift_asset_refs WHERE gift_id=? ORDER BY asset_id', [result.gift.id]);
    assert.deepEqual(pins.map(row => row.asset_id), assetIds);
  });
  await check('C19 archive draft keeps public snapshot/pins and replay after process adapter recreation', async () => {
    await repo.archive(owner,design.id); assert.equal(await repo.get(owner,design.id),null);
    const recreated=new MySqlPublicationUnitOfWork(client());
    const replay=await recreated.publish(owner,request,'pub-hash',builder({fail:true}));
    assert.equal(replay.gift.id,publication.gift.id); assert.equal(replay.replayed,true);
    assert.equal((await recreated.pinnedAsset(publication.gift.slug,asset.id)).id,asset.id);
  });
  const paid=record({kind:'template',templateId,templateVersionId:uuid()});
  await repo.create(owner,uuid(),'paid-create',paid);
  const orderId=uuid(),entitlementId=uuid();
  await admin.execute(`INSERT INTO orders(id,user_id,template_id,gross_vnd,platform_fee_vnd,creator_amount_vnd,currency,status,payment_provider,is_test,created_at,payload)
    VALUES (?,?,?,10000,2000,8000,'VND','paid','synthetic',1,?,'{}')`,[orderId,owner,templateId,date(now)]);
  await check('C13 paid order without active entitlement cannot publish; revoked entitlement denied',async()=>{
    await assert.rejects(uow.publish(owner,publishRequest(paid),'no-right',builder({paid:true})),{status:402});
    await admin.execute('INSERT INTO template_entitlements(id,user_id,template_id,order_id,revoked_at) VALUES (?,?,?,?,UTC_TIMESTAMP(3))',[entitlementId,owner,templateId,orderId]);
    await assert.rejects(uow.publish(owner,publishRequest(paid),'revoked',builder({paid:true})),{status:402});
    await admin.execute('UPDATE template_entitlements SET revoked_at=NULL WHERE id=?',[entitlementId]);
  });
  await check('C13 revoke wins lock: in-flight publication observes committed revoke and fails',async()=>{
    const revoke=await driver.createConnection(options); await revoke.beginTransaction();
    await revoke.execute('UPDATE template_entitlements SET revoked_at=UTC_TIMESTAMP(3) WHERE id=?',[entitlementId]);
    let settled=false;
    const pending=uow.publish(owner,publishRequest(paid),'revoke-first',builder({paid:true})).finally(()=>{settled=true;});
    // Attach rejection immediately so Node never treats the expected failure as unhandled.
    const expected=assert.rejects(pending,{status:402});
    await new Promise(resolve=>setTimeout(resolve,80)); assert.equal(settled,false);
    await revoke.commit(); await expected; await revoke.end();
    await admin.execute('UPDATE template_entitlements SET revoked_at=NULL WHERE id=?',[entitlementId]);
  });
  await check('C13 publish wins lock: revoke waits, committed snapshot remains valid',async()=>{
    let release,entered; const gate=new Promise(resolve=>{release=resolve;}); const enteredGate=new Promise(resolve=>{entered=resolve;});
    const pending=uow.publish(owner,publishRequest(paid),'publish-first',builder({paid:true,afterCheck:async()=>{entered();await gate;}}));
    await enteredGate;
    const revoke=await driver.createConnection(options); let revoked=false;
    const revoking=revoke.execute('UPDATE template_entitlements SET revoked_at=UTC_TIMESTAMP(3) WHERE id=?',[entitlementId]).then(()=>{revoked=true;});
    await new Promise(resolve=>setTimeout(resolve,80)); assert.equal(revoked,false);release();
    const result=await pending;await revoking;await revoke.end();assert.equal(result.replayed,false);
  });
  await check('C14 one order retains independent contexts for two designs; idempotency conflict explicit',async()=>{
    const second=record(paid.source);await repo.create(owner,uuid(),'second-paid',second);
    const contexts=[];
    for(const d of [paid,second]) {
      const key=uuid();const context={contextId:uuid(),orderId,designId:d.id,designRevision:d.revision,documentHash:d.documentHash,source:d.source,resumePath:`/design/${d.id}`};
      const result=await repo.attachContext(owner,orderId,key,`context-${d.id}`,context);contexts.push(result);
      assert.equal((await repo2.attachContext(owner,orderId,key,`context-${d.id}`,context)).replayed,true);
      await assert.rejects(repo.attachContext(owner,orderId,key,'changed',context),{status:409});
    }
    const rows=await repo.listContexts(owner,orderId);assert.equal(rows.length,2);assert.notEqual(rows[0].designId,rows[1].designId);
    assert.equal(await repo.getContext(other,orderId,contexts[0].contextId),null);
    assert.deepEqual(await repo.listContexts(other,orderId),[]);
  });
  await check('C20 two connections: publication lock blocks GC protocol; committed refs prevent tombstone',async()=>{
    const sharing=record();sharing.document.assets=[{assetId:asset.id,kind:'image'}];sharing.documentHash=hash(sharing.document);
    await repo.create(owner,uuid(),'gc-sharing',sharing);
    let release,entered;const gate=new Promise(resolve=>{release=resolve;});const enteredGate=new Promise(resolve=>{entered=resolve;});
    const pending=uow.publish(owner,publishRequest(sharing),'gc-publish',builder({afterCheck:async()=>{entered();await gate;}}));
    await enteredGate;
    const tx=await driver.createConnection(options);await tx.beginTransaction();let locked=false;
    const gcLock=tx.execute('SELECT id FROM design_assets WHERE id=? FOR UPDATE',[asset.id]).then(()=>{locked=true;});
    await new Promise(resolve=>setTimeout(resolve,80));assert.equal(locked,false);
    release();await pending;await gcLock;
    const [[refs]]=await tx.execute('SELECT COUNT(*) AS count FROM gift_asset_refs WHERE asset_id=?',[asset.id]);assert(refs.count>=1);
    const [updated]=await tx.execute(`UPDATE design_assets SET status='delete_pending' WHERE id=?
      AND NOT EXISTS(SELECT 1 FROM gift_asset_refs WHERE asset_id=?)
      AND NOT EXISTS(SELECT 1 FROM design_asset_refs WHERE asset_id=?)`,[asset.id,asset.id,asset.id]);
    assert.equal(updated.affectedRows,0);await tx.commit();await tx.end();
    assert.equal((await repo.getAsset(owner,asset.id)).status,'ready');
  });
  await check('C25 blank FK/discriminator rejects missing snapshot version',async()=>{
    await assert.rejects(admin.execute(`INSERT INTO gifts(id,slug,user_id,template_id,recipient_name,sender_name,message,reply_count,created_at,expires_at,payload,source_kind)
      VALUES (?,?,?,NULL,'Mai','An','invalid',0,?,?,'{}','blank')`,[uuid(),uuid(),owner,date(now),date(later)]),{code:'ER_CHECK_CONSTRAINT_VIOLATED'});
  });
  await check('Phase 2.3B: entitlement provenance, owner scope, revoked demo retry and publication parity', async () => {
    // Chỉ dùng schema QA đã được xác minh trống ở đầu fixture.
    const checkoutRepo = new MySqlCheckoutRepository(db);
    const checkout = new CheckoutService({ repository: checkoutRepo,
      catalog: { async getTemplate(id) { return { id, price: 10000 }; } } });
    const purchase = { userId: other, templateId, templateTitle: 'Mẫu thử', grossAmount: 10000 };
    const demoOrder = await checkoutRepo.purchaseDemo(purchase);
    assert.equal((await checkoutRepo.purchaseDemo(purchase)).id, demoOrder.id);
    const buyer = { sub: owner };
    const guest = { sub: other };
    let summary = await checkout.entitlementDetails(buyer, templateId);
    // Fixture cũ dùng provider synthetic; chưa được suy diễn thành thanh toán thật.
    assert.equal(summary.sources.unknown.revoked, 1);
    assert.equal(summary.licensed, false);
    assert.equal((await checkout.entitlementDetails(guest, templateId)).sources.demo.active, 1);
    for (const [provider, isTest, status] of [['payos', 0, 'paid'], ['momo', 1, 'paid'], ['momo', 1, 'refunded']]) {
      const id = uuid();
      await admin.execute(`INSERT INTO orders(id,user_id,template_id,gross_vnd,platform_fee_vnd,creator_amount_vnd,currency,status,payment_provider,is_test,created_at,payload)
        VALUES (?,?,?,10000,2000,8000,'VND',?,?,?,?, '{}')`, [id,owner,templateId,status,provider,isTest,date(now)]);
      await admin.execute('INSERT INTO template_entitlements(id,user_id,template_id,order_id) VALUES (?,?,?,?)', [uuid(),owner,templateId,id]);
    }
    summary = await checkout.entitlementDetails(buyer, templateId);
    assert.deepEqual(summary.totals, { active: 2, revoked: 1, inactive: 1 });
    assert.equal(summary.sources.live.active, 1);
    assert.equal(summary.sources.sandbox.active, 1);
    assert.equal(summary.sources.sandbox.inactive, 1);
    assert.equal(summary.licensed, await checkoutRepo.hasLicense(owner, templateId));
    const result = await uow.publish(owner,publishRequest(paid),'entitlement-lifecycle',builder({paid:true}));
    assert.equal(result.replayed, false);
    await admin.execute('UPDATE template_entitlements SET revoked_at=UTC_TIMESTAMP(3) WHERE order_id=?',[demoOrder.id]);
    assert.equal(await checkoutRepo.hasLicense(other,templateId), false);
    assert.equal((await checkout.entitlementDetails(guest, templateId)).sources.demo.revoked, 1);
    await assert.rejects(checkoutRepo.purchaseDemo(purchase), { status: 409 });
    await assert.rejects(checkout.adminEntitlementSummary(buyer), { status: 403 });
    const all = await checkout.adminEntitlementSummary({ sub: owner, role: 'admin' });
    assert.deepEqual(all.totals, { active: 2, revoked: 2, inactive: 1 });
  });
  await check('Phase 2.4A: publication usage counts committed gifts, not retries or other owners', async () => {
    const checkout = new CheckoutService({ repository: new MySqlCheckoutRepository(db) });
    const buyer = { sub: owner };
    const before = await checkout.publicationUsage(buyer, templateId);
    const otherBefore = await checkout.publicationUsage({ sub: other }, templateId);
    const request = publishRequest(paid);
    const first = await uow.publish(owner, request, 'publication-usage', builder({ paid: true }));
    const replay = await uow2.publish(owner, request, 'publication-usage', builder({ paid: true }));
    assert.equal(first.gift.id, replay.gift.id);
    const after = await checkout.publicationUsage(buyer, templateId);
    assert.equal(after.total, before.total + 1);
    assert.equal(after.sources.template, before.sources.template + 1);
    assert.equal(after.sources.legacy, before.sources.legacy);
    assert.equal(after.quotaEnforced, false);
    await admin.execute("UPDATE gifts SET payload=JSON_SET(payload,'$.revokedAt',?) WHERE id=?", [now, first.gift.id]);
    assert.deepEqual(await checkout.publicationUsage(buyer, templateId), after);
    assert.deepEqual(await checkout.publicationUsage({ sub: other }, templateId), otherBefore);
  });
  await check('Phase 2.4A: checkout replay never crosses sandbox/live mode', async () => {
    const payments = new MySqlPaymentRepository(db);
    const request = { userId: other, templateId, title: 'Mẫu thử', amount: 10000, provider: 'momo', isTest: true };
    const first = await payments.createPending(request);
    const replay = await payments.createPending(request);
    assert.equal(replay.id, first.id);
    assert.equal(replay.isTest, true);
    await assert.rejects(payments.createPending({ ...request, isTest: false }), { status: 409 });
    const [rows] = await admin.execute(`SELECT COUNT(*) AS total FROM payment_checkout_keys WHERE user_id=? AND template_id=?`, [other,templateId]);
    assert.equal(Number(rows[0].total), 1);
    assert.equal((await payments.forUser(first.orderId, other)).isTest, true);
  });
  await check('Phase 2.4B1: verified payment cannot settle or replay across environments', async () => {
    const payments = new MySqlPaymentRepository(db);
    const intent = await payments.createPending({ userId: other, templateId, title: 'Mẫu thử', amount: 10000, provider: 'momo', isTest: true });
    const event = { provider: intent.provider, code: intent.code, amount: intent.amount, reference: uuid(), currency: 'VND', success: true };
    const readCounts = async () => {
      const [[counts]] = await admin.execute(`SELECT
        (SELECT COUNT(*) FROM template_entitlements WHERE order_id=?) AS rights_count,
        (SELECT COUNT(*) FROM payment_receipts WHERE order_id=?) AS receipt_count`, [intent.orderId, intent.orderId]);
      return [Number(counts.rights_count), Number(counts.receipt_count)];
    };
    await assert.rejects(payments.settleVerified(event, false), { status: 409 });
    assert.equal((await payments.forUser(intent.orderId, other)).status, 'pending');
    assert.deepEqual(await readCounts(), [0, 0]);
    assert.equal((await payments.settleVerified(event, true)).replay, false);
    assert.equal((await payments.settleVerified(event, true)).replay, true);
    // Phase 2.6B: giao dịch khác không được báo là replay thành công.
    await assert.rejects(payments.settleVerified({ ...event, reference: uuid() }, true), { status: 409 });
    await assert.rejects(payments.settleVerified(event, false), { status: 409 });
    assert.deepEqual(await readCounts(), [1, 1]);
    // Phase 2.6A: đối chiếu biên nhận với intent thật trên MySQL QA.
    const receipt = await payments.receipt(intent.orderId, other);
    assert.equal(receipt.transactionReference, event.reference);
    assert.equal(receipt.testPayment, true);
    assert.match(receipt.paidAt, /Z$/);
    assert.equal(await payments.receipt(intent.orderId, owner), null);
    const refundPayload = { orderId: intent.orderId, requesterId: other, reasonCode: 'technical_problem', detail: 'Yêu cầu QA rà soát giao dịch.' };
    await admin.execute('UPDATE payment_receipts SET provider_reference=? WHERE order_id=?', ['mismatch-fixture', intent.orderId]);
    try {
      assert.equal(await payments.receipt(intent.orderId, other), null);
      await assert.rejects(payments.refunds.createBuyerRequest(refundPayload), { status: 404 });
      const audit = await payments.adminFinanceExceptions(100);
      assert(audit.records.find(row => row.orderId === intent.orderId)?.issues.includes('receipt'));
    } finally {
      await admin.execute('UPDATE payment_receipts SET provider_reference=? WHERE order_id=?', [event.reference, intent.orderId]);
    }
    assert.equal((await payments.receipt(intent.orderId, other)).transactionReference, event.reference);
    const review = await payments.refunds.createBuyerRequest(refundPayload);
    const assessment = (await payments.refunds.listAdmin(100)).find(row => row.id === review.id).assessment;
    assert.equal(assessment.receipt, 'consistent');
    assert.equal(assessment.entitlement, 'active');
    assert.equal(assessment.credit, 'unavailable');
    assert.equal((await payments.refunds.byBuyer(intent.orderId, other)).assessment, undefined);
  });
  await check('Phase 2.4B2: scoped checkout preserves historical anchor and isolates concurrent retries', async () => {
    // Hoàn tất prefix 013–016 trước 017; Auth acceptance sẽ kiểm tra đủ lịch sử 001–020.
    for (const name of ['013_canvas_library.sql', '014_canvas_audio.sql', '015_music_library.sql', '016_recipient_naming.sql'])
      await admin.query(await fs.readFile(new URL(`../../database/migrations/${name}`, import.meta.url), 'utf8'));
    // Chạy migration thật sau khi fixture đã có khóa Sandbox từ phiên bản trước.
    await admin.query(await fs.readFile(new URL('../../database/migrations/017_payment_scope_keys.sql', import.meta.url), 'utf8'));
    const legacy = new MySqlPaymentRepository(db);
    const first = new MySqlPaymentRepository(db, { scopedCheckout: true });
    const second = new MySqlPaymentRepository(db2, { scopedCheckout: true });
    const sandbox = { userId: other, templateId, title: 'Mẫu thử', amount: 10000, provider: 'momo', isTest: true };
    const old = await legacy.createPending(sandbox);
    assert.equal((await first.createPending(sandbox)).id, old.id);
    const live = { ...sandbox, isTest: false, provider: 'payos' };
    const [a, b] = await Promise.all([first.createPending(live), second.createPending(live)]);
    assert.equal(a.id, b.id);
    assert.notEqual(a.id, old.id);
    assert.equal(a.isTest, false);
    assert.equal((await second.createPending(sandbox)).id, old.id);
    // Runtime cũ tiếp tục chặn scope khác, không tự tạo đơn thay thế.
    await assert.rejects(legacy.createPending(live), { status: 409 });
    const [[counts]] = await admin.execute(`SELECT
      (SELECT COUNT(*) FROM payment_checkout_scope_keys WHERE user_id=? AND template_id=?) AS scoped_count,
      (SELECT COUNT(*) FROM payment_checkout_keys WHERE user_id=? AND template_id=?) AS legacy_count,
      (SELECT COUNT(*) FROM payment_intents p JOIN orders o ON o.id=p.order_id WHERE o.user_id=? AND o.template_id=?) AS intent_count`,
    [other, templateId, other, templateId, other, templateId]);
    assert.deepEqual([Number(counts.scoped_count), Number(counts.legacy_count), Number(counts.intent_count)], [1, 1, 2]);
    assert.equal((await first.forUser(a.orderId, other)).status, 'pending');
    assert.equal(await first.forUser(a.orderId, owner), null);
    const [[rights]] = await admin.execute('SELECT COUNT(*) AS total FROM template_entitlements WHERE order_id=?', [a.orderId]);
    assert.equal(Number(rights.total), 0);
  });
  await check('Phase 2.4B3/B4: credit grant, rollback, shared-pool cross-flow competition, repurchase and replay', async () => {
    await admin.query(await fs.readFile(new URL('../../database/migrations/018_publication_credits.sql', import.meta.url), 'utf8'));
    const quotaTemplate = 'canvas-quota-qa-template';
    await admin.execute(`INSERT INTO templates(id,title,style,theme,price_vnd,status,created_at,payload)
      VALUES (?,'Mẫu quota','classic','lavender',10000,'published',?,'{}')`, [quotaTemplate, date(now)]);
    const payments = new MySqlPaymentRepository(db, { quotaEnabled: true });
    const intent = await payments.createPending({ userId: owner, templateId: quotaTemplate, title: 'Mẫu quota', amount: 10000, provider: 'momo', isTest: true });
    const event = { provider: 'momo', code: intent.code, reference: uuid(), amount: intent.amount, currency: 'VND', success: true };
    assert.equal((await payments.settleVerified(event, true)).replay, false);
    assert.equal((await payments.settleVerified(event, true)).replay, true);
    const checkout = new MySqlCheckoutRepository(db, { quotaEnabled: true });
    assert.deepEqual(await checkout.publicationQuota(owner, quotaTemplate), { remaining: 1, consumed: 0, legacyUnlimited: false });
    const refundReview = await payments.refunds.createBuyerRequest({ orderId: intent.orderId, requesterId: owner, reasonCode: 'technical_problem', detail: 'Yêu cầu QA đối soát credit.' });
    const refundAssessment = async () => (await payments.refunds.listAdmin(100)).find(row => row.id === refundReview.id).assessment;
    assert.equal((await refundAssessment()).credit, 'unused');
    assert.equal(await checkout.hasLicense(owner, quotaTemplate), true);
    assert.equal(await checkout.hasLicense(other, quotaTemplate), false);
    const d = record({ kind: 'template', templateId: quotaTemplate, templateVersionId: uuid() });
    await repo.create(owner, uuid(), 'quota-design', d);
    const qaUow = new MySqlPublicationUnitOfWork(db, { quotaEnabled: true });
    const failAfterConsumption = { withTransaction: work => db.withTransaction(tx => work({ execute: (sql, params) => {
      if (sql.includes('INSERT INTO gift_publication_requests')) throw Error('quota rollback injection');
      return tx.execute(sql, params);
    } })) };
    await assert.rejects(new MySqlPublicationUnitOfWork(failAfterConsumption, { quotaEnabled: true })
      .publish(owner, publishRequest(d), 'quota-rollback', builder()), /quota rollback injection/);
    assert.equal((await checkout.publicationQuota(owner, quotaTemplate)).remaining, 1);
    const legacyGift = { id: uuid(), slug: uuid().replaceAll('-', ''), userId: owner, templateId: quotaTemplate,
      recipientName: 'Mai', senderName: 'An', message: 'QA', imageFile: null, createdAt: now, expiresAt: later };
    const request = publishRequest(d);
    const [canvasResult, legacyResult] = await Promise.allSettled([
      qaUow.publish(owner, request, 'quota-race', builder()),
      new MySqlGiftsRepository(db, { quotaEnabled: true }).insert(legacyGift),
    ]);
    assert.equal([canvasResult, legacyResult].filter(result => result.status === 'fulfilled').length, 1);
    const rejected = [canvasResult, legacyResult].find(result => result.status === 'rejected');
    assert.equal(rejected.reason.status, 402);
    if (canvasResult.status === 'fulfilled') {
      const replay = await qaUow.publish(owner, request, 'quota-race', builder({ fail: true }));
      assert.equal(replay.gift.id, canvasResult.value.gift.id);
    } else await assert.rejects(qaUow.publish(owner, request, 'quota-race', builder()), { status: 402 });
    assert.deepEqual(await checkout.publicationQuota(owner, quotaTemplate), { remaining: 0, consumed: 1, legacyUnlimited: false });
    assert.equal((await refundAssessment()).credit, 'consumed');
    assert.equal(await checkout.hasLicense(owner, quotaTemplate), false);
    const [[counts]] = await admin.execute(`SELECT
      (SELECT COUNT(*) FROM gifts WHERE user_id=? AND template_id=?) AS gifts_count,
      (SELECT COUNT(*) FROM publication_credits c JOIN template_entitlements e ON e.id=c.entitlement_id WHERE e.order_id=?) AS credit_count`,
    [owner, quotaTemplate, intent.orderId]);
    assert.deepEqual([Number(counts.gifts_count), Number(counts.credit_count)], [1, 1]);
    assert.equal((await checkout.publicationQuota(owner, templateId)).legacyUnlimited, true);
    await admin.query(await fs.readFile(new URL('../../database/migrations/019_publication_repurchases.sql', import.meta.url), 'utf8'));
    const repurchases = new MySqlPaymentRepository(db, { quotaEnabled: true, scopedCheckout: true });
    const repurchases2 = new MySqlPaymentRepository(db2, { quotaEnabled: true, scopedCheckout: true });
    assert.equal(await repurchases.repurchaseCandidate(owner, quotaTemplate), intent.orderId);
    assert.equal(await repurchases.repurchaseCandidate(other, quotaTemplate), null);
    const nextRequest = { userId: owner, templateId: quotaTemplate, title: 'Mẫu quota', amount: 10000,
      provider: 'momo', isTest: true, previousOrderId: intent.orderId };
    await assert.rejects(repurchases.createPending({ ...nextRequest, userId: other }), { status: 409 });
    const [next, repeated] = await Promise.all([repurchases.createPending(nextRequest), repurchases2.createPending(nextRequest)]);
    assert.equal(next.id, repeated.id);
    assert.notEqual(next.orderId, intent.orderId);
    assert.equal((await checkout.publicationQuota(owner, quotaTemplate)).remaining, 0);
    const nextEvent = { ...event, code: next.code, reference: uuid() };
    assert.equal((await repurchases.settleVerified(nextEvent, true)).replay, false);
    assert.equal((await repurchases2.settleVerified(nextEvent, true)).replay, true);
    assert.deepEqual(await checkout.publicationQuota(owner, quotaTemplate), { remaining: 1, consumed: 1, legacyUnlimited: false });
    assert.equal(await repurchases.repurchaseCandidate(owner, quotaTemplate), null);
    const secondGift = { ...legacyGift, id: uuid(), slug: uuid().replaceAll('-', '') };
    await new MySqlGiftsRepository(db2, { quotaEnabled: true }).insert(secondGift);
    assert.deepEqual(await checkout.publicationQuota(owner, quotaTemplate), { remaining: 0, consumed: 2, legacyUnlimited: false });
    assert.equal((await repurchases.createPending(nextRequest)).id, next.id); // Retry cũ không tạo đơn thứ ba.
    assert.equal(await repurchases.repurchaseCandidate(owner, quotaTemplate), next.orderId);
    const third = await repurchases.createPending({ ...nextRequest, previousOrderId: next.orderId });
    assert.notEqual(third.id, next.id);
    const [[repurchaseCounts]] = await admin.execute(`SELECT
      (SELECT COUNT(*) FROM orders WHERE user_id=? AND template_id=?) AS order_count,
      (SELECT COUNT(*) FROM publication_credits c JOIN template_entitlements e ON e.id=c.entitlement_id WHERE e.user_id=? AND e.template_id=?) AS credit_count,
      (SELECT COUNT(*) FROM publication_repurchases r JOIN orders o ON o.id=r.previous_order_id WHERE o.user_id=? AND o.template_id=?) AS repurchase_count`,
    [owner, quotaTemplate, owner, quotaTemplate, owner, quotaTemplate]);
    assert.deepEqual([Number(repurchaseCounts.order_count), Number(repurchaseCounts.credit_count), Number(repurchaseCounts.repurchase_count)], [3, 2, 2]);
  });
  await check('Phase 2.7B: isolated refund simulation rolls back, reverses pinned creator sale once, and blocks consumed credit', async () => {
    const operator = uuid(), creator = uuid();
    for (const [id, role] of [[operator, 'admin'], [creator, 'creator']]) {
      await admin.execute(`INSERT INTO users(id,provider,provider_id,name,role,created_at,legacy_payload)
        VALUES (?,'demo',?,'QA',?,?,'{}')`, [id, id, role, date(now)]);
    }
    const qaEnv = { ...process.env, NODE_ENV: 'test', PAYMENT_ENV: 'sandbox', REFUND_SETTLEMENT_QA_ENABLED: 'true' };
    const simulation = new RefundSettlementQa(db, qaEnv), simulation2 = new RefundSettlementQa(db2, qaEnv);
    const payments = new MySqlPaymentRepository(db, { quotaEnabled: true });
    const checkout = new MySqlCheckoutRepository(db, { quotaEnabled: true });
    async function paidReview(template, consumed = false) {
      await admin.execute(`INSERT INTO templates(id,creator_id,title,style,theme,price_vnd,status,created_at,payload)
        VALUES (?,?,'QA refund','classic','lavender',10000,'published',?,'{}')`, [template, creator, date(now)]);
      const intent = await payments.createPending({ userId: owner, templateId: template, title: 'QA refund', amount: 10000, provider: 'momo', isTest: true });
      const event = { provider: 'momo', code: intent.code, reference: uuid(), amount: 10000, currency: 'VND', success: true };
      await payments.settleVerified(event, true);
      if (consumed) await new MySqlGiftsRepository(db, { quotaEnabled: true }).insert({
        id: uuid(), slug: uuid().replaceAll('-', ''), userId: owner, templateId: template, recipientName: 'QA', senderName: 'QA',
        message: 'QA', imageFile: null, replyCount: 0, createdAt: now, expiresAt: later });
      const review = await payments.refunds.createBuyerRequest({ orderId: intent.orderId, requesterId: owner,
        reasonCode: 'technical_problem', detail: 'QA kiểm thử hoàn tiền nội bộ.' });
      for (const [expectedStatus, status] of [['submitted', 'in_review'], ['in_review', 'awaiting_provider']]) {
        await payments.refunds.moveAdmin({ requestId: review.id, actorId: operator, expectedStatus, status, note: 'QA rà soát nội bộ' });
      }
      return { intent, event, args: { requestId: review.id, actorId: operator, simulationId: uuid() } };
    }
    const template = 'canvas-refund-qa-template';
    const { intent, event, args } = await paidReview(template);
    const failClient = { env: db.env, withTransaction: work => db.withTransaction(tx => work({ execute: (sql, params) => {
      if (sql.includes('INSERT INTO creator_ledger')) throw Error('refund rollback injection');
      return tx.execute(sql, params);
    } })) };
    await assert.rejects(new RefundSettlementQa(failClient, qaEnv).simulate(args), /refund rollback injection/);
    assert.equal(await checkout.hasLicense(owner, template), true);
    const [[before]] = await admin.execute('SELECT status FROM orders WHERE id=?', [intent.orderId]);
    assert.equal(before.status, 'paid');
    // Không đảo bút toán theo chủ mẫu hiện tại.
    await admin.execute('UPDATE templates SET creator_id=? WHERE id=?', [other, template]);
    const results = await Promise.all([simulation.simulate(args), simulation2.simulate(args)]);
    assert.equal(results.filter(r => r.replayed).length, 1);
    assert.equal(await checkout.hasLicense(owner, template), false);
    await assert.rejects(simulation.simulate({ ...args, simulationId: uuid() }), { status: 409 });
    await assert.rejects(payments.settleVerified(event, true), { status: 409 });
    const [[order]] = await admin.execute(`SELECT o.status,e.revoked_at,c.gift_id,p.status AS intent_status,
      (SELECT COUNT(*) FROM payment_receipts r WHERE r.order_id=o.id) AS receipts,
      (SELECT COUNT(*) FROM payment_transactions t WHERE t.order_id=o.id AND t.status='refunded') AS refunds
      FROM orders o JOIN template_entitlements e ON e.order_id=o.id JOIN publication_credits c ON c.entitlement_id=e.id
      JOIN payment_intents p ON p.order_id=o.id WHERE o.id=?`, [intent.orderId]);
    assert.equal(order.status, 'refunded'); assert(order.revoked_at); assert.equal(order.gift_id, null);
    assert.equal(order.intent_status, 'paid'); assert.equal(Number(order.receipts), 1); assert.equal(Number(order.refunds), 1);
    const [ledger] = await admin.execute('SELECT creator_id,amount_vnd,category FROM creator_ledger WHERE order_id=? ORDER BY category', [intent.orderId]);
    assert.deepEqual(ledger.map(l => [l.creator_id, l.amount_vnd, l.category]), [[creator, -8000, 'refund'], [creator, 8000, 'sale']]);
    const used = await paidReview('canvas-refund-consumed-qa', true);
    await assert.rejects(simulation.simulate(used.args), { status: 409 });
    const [[unchanged]] = await admin.execute('SELECT status FROM orders WHERE id=?', [used.intent.orderId]);
    assert.equal(unchanged.status, 'paid');
  });
  await check('Phase 3.5D: detect cross-owner entitlement and receipt evidence corruption; rollback restores audit counts', async () => {
    const baseline = await readIntegrityCounts(db);
    const counts = report => new Map(report.checks.map(row => [row.id, BigInt(row.violations)]));
    const before = counts(baseline);
    const rollback = new Error('QA integrity rollback');
    await assert.rejects(db.withTransaction(async tx => {
      const [[row]] = await tx.execute(`SELECT e.id,e.user_id,r.order_id FROM template_entitlements e
        JOIN orders o ON o.id=e.order_id JOIN payment_receipts r ON r.order_id=o.id
        JOIN payment_intents p ON p.order_id=o.id
        WHERE e.user_id=o.user_id AND e.template_id=o.template_id AND r.amount_vnd=o.gross_vnd
        AND r.amount_vnd=p.amount_vnd AND p.status='paid' AND BINARY r.provider_reference=BINARY p.provider_reference
        AND BINARY r.provider=BINARY p.provider AND BINARY p.provider=BINARY o.payment_provider
        AND o.currency='VND' AND o.is_test IN (0,1) AND o.payment_provider IN ('momo','payos')
        AND CHAR_LENGTH(TRIM(r.provider_reference))>0 AND r.amount_vnd>0 LIMIT 1 FOR UPDATE`);
      assert(row, 'Fixture must have an internally consistent paid receipt');
      const wrongOwner = row.user_id === owner ? other : owner;
      await tx.execute('UPDATE template_entitlements SET user_id=? WHERE id=?', [wrongOwner, row.id]);
      await tx.execute('UPDATE payment_receipts SET amount_vnd=amount_vnd+1 WHERE order_id=?', [row.order_id]);
      const after = counts(await readIntegrityCounts(tx));
      assert.equal(after.get('entitlement_order'), before.get('entitlement_order') + 1n);
      assert.equal(after.get('receipt_evidence'), before.get('receipt_evidence') + 1n);
      throw rollback;
    }), error => error === rollback);
    assert.deepEqual(await readIntegrityCounts(db), baseline);
  });
  await check('Auth V5.2B: migration 020, legacy session preservation and exact schema metadata', async () => {
    const secret = 'isolated-auth-session-fixture-secret';
    const users = new MySqlUsersRepository(db);
    const user = await users.get(owner);
    const legacyToken = signSession(user, secret), claims = verifySession(legacyToken, secret);
    await admin.execute('INSERT INTO sessions(id,user_id,expires_at) VALUES (?,?,?)', [claims.jti, owner, date(new Date(claims.exp * 1000).toISOString())]);
    await admin.query(await fs.readFile(new URL('../../database/migrations/020_session_inventory.sql', import.meta.url), 'utf8'));
    const repository = await auditRepository();
    assert.deepEqual(repository.issues, []);
    const schema = assessSchema(repository.migrations, await readSchemaMetadata(db), { requireLatest: true });
    assert.equal(schema.status, 'latest');
    assert.equal((await auditAuthSchema(db, schema)).status, 'ok');
    const [[row]] = await admin.execute('SELECT credential_version, issued_at FROM sessions WHERE id=?', [claims.jti]);
    assert.deepEqual({ ...row }, { credential_version: null, issued_at: null });
    const sessions = new MySqlSessionStore(db, users, secret);
    assert.ok(await sessions.find(legacyToken));
    const fresh = await sessions.create(user);
    const inventory = await sessions.listActive(fresh);
    assert.equal(inventory.sessions.length, 1);
    assert.equal(inventory.unclassifiedCount, 1);
    assert.equal((await sessions.listActive(legacyToken)).sessions.find(row => row.current).issuedAt, null);
    await sessions.revokeOthers(fresh);
    assert.equal(await sessions.find(legacyToken), null);
    assert.ok(await sessions.find(fresh));
  });
  await check('Auth V5.2B: two MySQL connections, scoped revocation and concurrent credential change', async () => {
    const secret = 'isolated-auth-concurrent-fixture-secret';
    const users = new MySqlUsersRepository(db), users2 = new MySqlUsersRepository(db2);
    const credentials = new CredentialsService(users), credentials2 = new CredentialsService(users2);
    const sessions = new MySqlSessionStore(db, users, secret), sessions2 = new MySqlSessionStore(db2, users2, secret);
    const old = 'FixtureOld123', first = 'FixtureFirst123', second = 'FixtureSecond123';
    const account = await credentials.registerPublic({ name: 'Auth QA', email: `auth-${uuid()}@example.test`, password: old, consent: registrationConsent(true, true) }, 'vi');
    const unrelated = await users.get(other);
    const a = await sessions.create(account), b = await sessions2.create(account), c = await sessions.create(account);
    const d = await sessions2.create(unrelated);
    const ca = verifySession(a, secret), cb = verifySession(b, secret);
    const ref = sessionActionRef(ca, cb.jti, secret);
    assert.equal(await sessions2.revokeOne(d, ref), false);
    assert.equal(await sessions2.revokeOne(c, ref), false);
    assert.equal(await sessions.revokeOne(a, ref), true);
    assert.equal(await sessions2.find(b), null);
    assert.ok(await sessions.find(a)); assert.ok(await sessions2.find(c)); assert.ok(await sessions2.find(d));
    // Hai connection cạnh tranh ghi credential; không giữ khóa lúc chạy scrypt.
    const claimsA = await sessions.find(a), claimsC = await sessions2.find(c);
    const change = (service, store, token, claims, password) => service.changePassword(claims,
      { currentPassword: old, password, confirmPassword: password }, update => store.mutateAuthenticated(token, update));
    const results = await Promise.allSettled([change(credentials, sessions, a, claimsA, first), change(credentials2, sessions2, c, claimsC, second)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.ok([401, 409].includes(results.find(result => result.status === 'rejected').reason.status));
    const persisted = await users2.get(account.id);
    assert.equal(persisted.credentialVersion, 1);
    assert.deepEqual(persisted.registrationConsent, account.registrationConsent);
    assert.equal(await sessions.find(a), null); assert.equal(await sessions2.find(c), null); assert.ok(await sessions2.find(d));
    await assert.rejects(credentials.login({ email: account.email, password: old }), { status: 401 });
    const winner = results[0].status === 'fulfilled' ? first : second;
    const loser = winner === first ? second : first;
    await assert.rejects(credentials2.login({ email: account.email, password: loser }), { status: 401 });
    const fresh = await sessions2.create(await credentials2.login({ email: account.email, password: winner }));
    assert.equal((await sessions.listActive(fresh)).sessions.length, 1);
  });
  console.log(`RESULT PASS ${count} isolated MySQL integration cases; mocks are not included.`);
} finally {
  await Promise.allSettled(clients.map(c=>c.close()));
  await admin.end();
}
