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
  console.log(`RESULT PASS ${count} isolated MySQL integration cases; mocks are not included.`);
} finally {
  await Promise.allSettled(clients.map(c=>c.close()));
  await admin.end();
}
