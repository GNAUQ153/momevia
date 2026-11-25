// Real MySQL + HTTP + injected provider fixture. No merchant requests, no .env,
// and all application files/media are copied into a new OS temporary directory.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { once } from 'node:events';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { confirmGiftAccess } from '../browser/gift-access.mjs';
import { runRecovery, simulatedGoogle } from './recovery-journey.mjs';
import { runReplyIntents } from './reply-intents.mjs';
import { runRsvpApi } from './rsvp.mjs';
import { runExpandedApi } from './canvas-expanded.mjs';

const require = createRequire(import.meta.url), driver = require('mysql2/promise'), sharp = require('sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const artifacts = process.env.BROWSER_ARTIFACT_DIR && path.resolve(process.env.BROWSER_ARTIFACT_DIR);
if (artifacts) fs.mkdirSync(artifacts, { recursive: true });
const database = process.env.CANVAS_QA_MYSQL_DATABASE, port = Number(process.env.CANVAS_QA_MYSQL_PORT);
assert.equal(process.env.CANVAS_QA_MYSQL_ISOLATED, 'true');
assert.match(database || '', /^momevia_canvas_qa_[a-z0-9_]+$/);
assert(Number.isSafeInteger(port) && port >= 1024 && port <= 65535);
assert(process.env.CANVAS_QA_MYSQL_PASSWORD, 'Explicit synthetic QA password required.');
const dbOptions = { host:'127.0.0.1',port,user:process.env.CANVAS_QA_MYSQL_USER || 'root',password:process.env.CANVAS_QA_MYSQL_PASSWORD,
  charset:'utf8mb4',timezone:'Z',dateStrings:true,multipleStatements:true };
const admin = await driver.createConnection(dbOptions);
const [[server]] = await admin.query('SELECT VERSION() AS version');assert.match(server.version,/^8\.4\./);
const [[exists]] = await admin.execute('SELECT COUNT(*) AS count FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?',[database]);
assert.equal(exists.count,0,'Refuses existing schema; select a NEW isolated QA database.');
await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
await admin.changeUser({ database });
for(const name of fs.readdirSync(path.join(root,'database/migrations')).filter(n=>/^\d+.*\.sql$/.test(n)).sort()) {
  if (name === '007_support_reports.sql') await admin.execute(`INSERT INTO support_requests
    (id,code,name,email,topic,message,status,created_at)
    VALUES (UUID(),'QA-OLD-SUPPORT','QA cũ','old@example.test','Hỗ trợ','Bản ghi trước migration 007','new',UTC_TIMESTAMP(3))`);
  await admin.query(fs.readFileSync(path.join(root,'database/migrations',name),'utf8'));
}
const [[oldTicket]] = await admin.execute("SELECT message, report_kind, assigned_to FROM support_requests WHERE code='QA-OLD-SUPPORT'");
assert.deepEqual({ ...oldTicket }, { message: 'Bản ghi trước migration 007', report_kind: null, assigned_to: null });
const fixture = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'momevia-canvas-mysql-api-'));
for(const name of ['src','web']) fs.cpSync(path.join(root,name),path.join(fixture,name),{recursive:true});
fs.cpSync(path.join(root,'tests/browser'),path.join(fixture,'tests/browser'),{recursive:true});
fs.copyFileSync(path.join(root,'package.json'),path.join(fixture,'package.json'));
const qaModules = process.env.CANVAS_QA_NODE_MODULES || path.join(root,'node_modules');
assert(fs.existsSync(path.join(qaModules,'mysql2')) && fs.existsSync(path.join(qaModules,'sharp')),'Locked QA dependency installation required.');
fs.symlinkSync(qaModules,path.join(fixture,'node_modules'),'junction');
const previousCwd=process.cwd(), previousEnv={...process.env};
let app,base='',count=0,providerCreates=0,externalRequests=0,FixtureHttpError;
const originalFetch=globalThis.fetch;
const providerKey='synthetic-provider-HMAC-only';
const sign = body => createHmac('sha256',providerKey).update(JSON.stringify({code:body.code,amount:body.amount,reference:body.reference,success:body.success})).digest('hex');
const fakeProvider={
  async create(input){providerCreates++;assert.match(input.returnUrl,/^https:\/\/qa\.example\.test\/payment-result\/[\da-f-]{36}$/);assert.equal(input.returnUrl,input.cancelUrl);assert(!input.description.includes('Mai'));
    return {checkoutUrl:'https://payments.example.test/fixture',qrPayload:'synthetic-payment-only',providerPaymentId:`fake-${input.code}`};},
  async verifyWebhook(body){if(body.signature!==sign(body))throw new FixtureHttpError(400,'Synthetic signature rejected');
    return {provider:'momo',code:body.code,amount:body.amount,reference:body.reference,success:body.success,currency:'VND'};},
};
globalThis.fetch=(input,options)=>{const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);const mock=simulatedGoogle(url,options);if(mock)return mock;if(!base||url.origin!==base){externalRequests++;throw new Error(`External network blocked in QA: ${url.origin}`);}return originalFetch(input,options);};
const uuid=randomUUID;
async function request(route,{method='GET',cookie,body,bytes,headers={}}={}) {
  const res=await fetch(`${base}${route}`,{method,headers:{...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{}),...headers},body:bytes|| (body?JSON.stringify(body):undefined)});
  const dataBytes=Buffer.from(await res.arrayBuffer());let data=null;try{data=JSON.parse(dataBytes);}catch{/* binary or HTML */}
  return {status:res.status,headers:res.headers,data,bytes:dataBytes};
}
async function json(route,options={},expected=200){const r=await request(route,options);assert.equal(r.status,expected,`${route}: ${JSON.stringify(r.data)}`);return r.data;}
async function post(route,cookie,body,expected=200){return json(route,{method:'POST',cookie,body},expected);}
async function check(label,fn){await fn();count++;console.log(`PASS ${label}`);}
let cookie,otherCookie,owner,blank,blankGift,paidA,paidB,payment,contexts=[],contextRequests=[];
async function getDesign(id,c=cookie){return (await json(`/api/designs/designs/${id}`,{cookie:c})).design;}
async function create(source={kind:'blank'},presetId='envelope-basic'){return (await post('/api/designs/designs',cookie,{source,presetId,mutationId:uuid()},201)).design;}
async function save(d,document=d.document){const ack=await post(`/api/designs/designs/${d.id}/save`,cookie,{expectedRevision:d.revision,mutationId:uuid(),title:d.title,document});assert.equal(ack.savedRevision,d.revision+1);return getDesign(d.id);}
async function preflight(d){return post(`/api/designs/designs/${d.id}/preflight`,cookie,{expectedRevision:d.revision});}
function publishBody(d,key=uuid()){return {designId:d.id,expectedRevision:d.revision,expectedDocumentHash:d.documentHash,idempotencyKey:key,access:{open:'link',send:'link',read:'link'}};}
function fill(d){d.document.bindings.recipientName.value='Mai';d.document.bindings.senderName.value='An';d.document.bindings.message.value='Chúc mừng sinh nhật! Tiếng Việt: ă â ê ô ơ ư đ.';return d.document;}
try{
  Object.assign(process.env,{NODE_ENV:'test',MYSQL_HOST:'127.0.0.1',MYSQL_PORT:String(port),MYSQL_DATABASE:database,MYSQL_USER:dbOptions.user,MYSQL_PASSWORD:dbOptions.password,
    IDENTITY_STORAGE:'mysql',CATALOG_STORAGE:'mysql',CHECKOUT_STORAGE:'mysql',GIFTS_STORAGE:'mysql',DESIGNS_STORAGE:'mysql',SUPPORT_STORAGE:'mysql',
    PAYMENT_ENABLED:'false',PAYMENT_LIVE_ENABLED:'false',CANVAS_READ_ENABLED:'true',CANVAS_EDIT_ENABLED:'true',CANVAS_PUBLISH_ENABLED:'true',
    PUBLIC_BASE_URL:'http://127.0.0.1',TEST_ACCOUNT_ENABLED:'false'});
  process.chdir(fixture);
  const {templates,addedSystemTemplates}=await import(pathToFileURL(path.join(fixture,'src/modules/catalog/seed.mjs')).href);
  for(const t of templates.filter(template => !addedSystemTemplates.some(added => added.id === template.id)))await admin.execute(`INSERT INTO templates(id,title,style,theme,price_vnd,status,created_at,payload) VALUES (?,?,?,?,?,'published',UTC_TIMESTAMP(3),?)`,[t.id,t.title,t.style,t.theme,t.price,JSON.stringify({...t,status:'published',creatorId:'system'})]);
  const {createHttpApp}=await import(pathToFileURL(path.join(fixture,'src/server/app.mjs')).href);
  ({HttpError:FixtureHttpError}=await import(pathToFileURL(path.join(fixture,'src/shared/http.mjs')).href));
  const {createElement}=await import(pathToFileURL(path.join(fixture,'web/js/shared/canvas/index.js')).href);
  const config={baseUrl:'http://127.0.0.1',jwtSecret:randomBytes(32).toString('hex'),internalKey:randomBytes(32).toString('hex'),demoEnabled:true,adminCode:'synthetic-admin',giftTtlDays:365,giftRenewalDays:7,googleId:'synthetic',googleSecret:'synthetic',zaloId:'',zaloSecret:'',testAccount:null};
  const paymentEnv={NODE_ENV:'test',IDENTITY_STORAGE:'mysql',CATALOG_STORAGE:'mysql',CHECKOUT_STORAGE:'mysql',PAYMENT_ENABLED:'true',PAYMENT_ENV:'sandbox',PAYMENT_LIVE_ENABLED:'false',PUBLIC_BASE_URL:'https://qa.example.test',MOMO_PARTNER_CODE:'synthetic',MOMO_ACCESS_KEY:'synthetic',MOMO_SECRET_KEY:'synthetic'};
  let recoveryNow = Date.now();
  const mailbox = [];
  app=await createHttpApp(config,{paymentProviders:{momo:fakeProvider},paymentEnv, sendRecoveryMail: async mail => mailbox.push(mail), recoveryNow: () => recoveryNow});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');base=`http://127.0.0.1:${app.server.address().port}`;config.baseUrl=base;
  console.log(`TARGET MySQL ${server.version}; NEW synthetic schema=${database}; temp copy, provider injected, all external fetch denied.`);
  await check('MySQL composition readiness and sender sessions via actual Identity API',async()=>{
    const health=await json('/api/designs/health');assert.equal(health.profile.mode,'mysql');assert.equal(health.profile.supported,true);
    const first=await request('/api/auth/demo',{method:'POST',body:{name:'Người gửi QA',deviceId:uuid()}});assert.equal(first.status,200);owner=first.data.user.id;cookie=first.headers.get('set-cookie').split(';')[0];assert.equal(first.data.user.role,'sender');
    const second=await request('/api/auth/demo',{method:'POST',body:{name:'Người khác QA',deviceId:uuid()}});assert.equal(second.status,200);otherCookie=second.headers.get('set-cookie').split(';')[0];
    assert.equal((await request('/api/designs/designs')).status,401);
  });
  await check('MySQL saves empty drafts and rejects publication with the preflight blocker', async () => {
    const empty = await create({ kind: 'blank' }, 'blank');
    const saved = await save(empty, fill(empty));
    assert.equal(saved.document.elements.length, 0);
    const checked = await preflight(saved);
    assert.equal(checked.canPublish, false);
    assert.deepEqual(checked.blockers.map(({ code }) => code), ['EMPTY_DESIGN']);
    const rejected = await post('/api/gifts/gifts/from-design', cookie, publishBody(saved), 422);
    assert.deepEqual(rejected.details, checked.blockers);
    assert.deepEqual((await json('/api/gifts/gifts/mine', { cookie })).gifts, []);
  });
  await check('RSVP MySQL HTTP: private receipt, concurrent writes, owner ACL and revoke', () =>
    runRsvpApi((route, options) => request('/api' + route, { ...options, method: options.body ? 'POST' : 'GET' }), cookie, otherCookie, async slug => {
      // Chỉ thay hạn trong schema QA mới để kiểm thử gia hạn thực.
      await admin.execute('UPDATE gifts SET expires_at=DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 1 DAY) WHERE slug=?', [slug]);
    }));
  await check('C01/C05/C06 blank create/save/reload/CAS/lost ACK through HTTP MySQL',async()=>{
    const mutationId=uuid(),body={source:{kind:'blank'},presetId:'envelope-basic',mutationId};
    blank=(await post('/api/designs/designs',cookie,body,201)).design;const replay=await post('/api/designs/designs',cookie,body,201);assert.equal(replay.design.id,blank.id);assert.equal(replay.replayed,true);
    blank=await save(blank,fill(blank));assert.equal(blank.document.bindings.recipientName.value,'Mai');
    const a={expectedRevision:blank.revision,mutationId:uuid(),title:'Tab A',document:blank.document};
    const b={...a,mutationId:uuid(),title:'Tab B'};
    const pair=await Promise.all([request(`/api/designs/designs/${blank.id}/save`,{method:'POST',cookie,body:a}),request(`/api/designs/designs/${blank.id}/save`,{method:'POST',cookie,body:b})]);
    assert.deepEqual(pair.map(r=>r.status).sort(),[200,409]);const winner=pair[0].status===200?a:b;
    const ack=await post(`/api/designs/designs/${blank.id}/save`,cookie,winner);assert.equal(ack.replayed,true);blank=await getDesign(blank.id);
    assert.equal((await request(`/api/designs/designs/${blank.id}`,{cookie:otherCookie})).status,404);
    assert.equal((await request(`/api/designs/designs/${blank.id}/save`,{method:'POST',cookie,body:{...winner,source:{kind:'blank'}}})).status,422);
  });
  await check('MySQL restyle: both directions, owner ACL, target provenance/price, CAS and concurrent idempotency',async()=>{
    for(const [sourceId,targetTemplateId]of [['sunny-wishes','confetti'],['confetti','sunny-wishes']]){
      let original=await create({kind:'template',templateId:sourceId});original=await save(original,fill(original));
      const input={targetTemplateId,expectedRevision:original.revision,expectedDocumentHash:original.documentHash};
      const preview=await post(`/api/designs/designs/${original.id}/restyle/preview`,cookie,input);
      const duplicate=(await post(`/api/designs/designs/${original.id}/duplicate`,cookie,{mutationId:uuid()},201)).design;
      const duplicatePreview=await post(`/api/designs/designs/${duplicate.id}/restyle/preview`,cookie,{targetTemplateId,expectedRevision:duplicate.revision,expectedDocumentHash:duplicate.documentHash});assert.deepEqual(duplicatePreview.missing,[]);
      assert.equal((await request(`/api/designs/designs/${original.id}/restyle/preview`,{method:'POST',cookie:otherCookie,body:input})).status,404);
      const command={...input,targetTemplateVersionId:preview.plan.targetVersion,planHash:preview.planHash,mutationId:uuid()};
      const pair=await Promise.all([post(`/api/designs/designs/${original.id}/restyle`,cookie,command,201),post(`/api/designs/designs/${original.id}/restyle`,cookie,command,201)]);
      assert.equal(pair[0].design.id,pair[1].design.id);assert.equal(pair[0].design.source.templateId,targetTemplateId);assert.equal(pair[0].design.source.templateVersionId,preview.plan.targetVersion);assert.equal(pair[0].design.policy.kind,'sender-basic');assert.deepEqual((await getDesign(original.id)).document,original.document);
      await admin.execute('UPDATE templates SET price_vnd=12345 WHERE id=?',[targetTemplateId]);
      await post(`/api/designs/designs/${original.id}/restyle/preview`,cookie,input,403);
      await admin.execute('UPDATE templates SET price_vnd=0 WHERE id=?',[targetTemplateId]);
      const edited=structuredClone(original.document);edited.bindings.message.value='Changed in another tab';await save(original,edited);
      await post(`/api/designs/designs/${original.id}/restyle`,cookie,{...command,mutationId:uuid()},409);
      assert.equal((await post(`/api/designs/designs/${original.id}/restyle`,cookie,command,201)).design.id,pair[0].design.id);
    }
  });
  let imageAsset;
  await check('C09 real re-encode asset upload, owner ACL, crop persisted, publish ready',async()=>{
    const bytes=await sharp({create:{width:32,height:24,channels:3,background:'#abcdef'}}).png().toBuffer();const mutation=uuid();
    const response=await json(`/api/designs/designs/${blank.id}/assets`,{method:'POST',cookie,bytes,headers:{'content-type':'image/png','x-mutation-id':mutation}},201);imageAsset=response.asset;
    assert.equal(imageAsset.status,'ready');assert.equal(imageAsset.width,32);
    const repeated=await json(`/api/designs/designs/${blank.id}/assets`,{method:'POST',cookie,bytes,headers:{'content-type':'image/png','x-mutation-id':mutation}},201);assert.equal(repeated.asset.id,imageAsset.id);
    assert.equal((await request(`/api/designs/designs/${blank.id}/assets/${imageAsset.id}`,{cookie:otherCookie})).status,404);
    const invalid=await request(`/api/designs/designs/${blank.id}/assets`,{method:'POST',cookie,bytes:Buffer.from('not a real png image bytes here'),headers:{'content-type':'image/png','x-mutation-id':uuid()}});assert.equal(invalid.status,400);
    const image=createElement('image',{id:'fixture-photo',props:{assetId:imageAsset.id,focalPoint:{x:0.2,y:0.7}}});blank.document.elements.push(image);blank.document.scenes[0].elementIds.push(image.id);blank.document.assets.push({assetId:imageAsset.id,kind:'image'});
    blank=await save(blank);assert.deepEqual(blank.document.elements.find(e=>e.id===image.id).props.focalPoint,{x:0.2,y:0.7});
    const p=await preflight(blank);assert.equal(p.authorization.status,'allowed');assert.equal(p.canPublish,true);
  });
  await check('C17/C19/C21 public immutable snapshot/media/reply free without login and no private DTO',async()=>{
    const body=publishBody(blank),[a,b]=await Promise.all([request('/api/gifts/gifts/from-design',{method:'POST',cookie,body}),request('/api/gifts/gifts/from-design',{method:'POST',cookie,body})]);
    assert.deepEqual([a.status,b.status].sort(),[200,201]);assert.equal(a.data.gift.id,b.data.gift.id);blankGift=a.data.gift;
    const publicGift=(await json(`/api/gifts/gifts/${blankGift.slug}`)).gift;assert(publicGift.documentSnapshot);assert(!('ownerId'in publicGift));assert(!('policy'in publicGift));assert(!('designId'in publicGift));assert(!('source'in publicGift));
    const { gifts } = await json('/api/gifts/gifts/mine', { cookie });
    assert.equal(publicGift.url, `${base}/g/${blankGift.slug}`);
    assert.equal(publicGift.url, blankGift.url);
    assert.equal(gifts.find(gift => gift.slug === blankGift.slug).url, blankGift.url);
    const media=await request(`/api/gifts/gifts/${blankGift.slug}/assets/${imageAsset.id}`);assert.equal(media.status,200);assert.equal(media.headers.get('content-type'),'image/png');assert(media.bytes.length>0);
    await post(`/api/gifts/gifts/${blankGift.slug}/replies`,null,{name:'Người nhận',message:'Cảm ơn bạn!'},201);
    assert.equal((await json(`/api/gifts/gifts/${blankGift.slug}/replies`)).replies.length,1);
    blank.document.bindings.message.value='Bản nháp sau khi gửi';blank=await save(blank);
    assert.notEqual((await json(`/api/gifts/gifts/${blankGift.slug}`)).gift.documentSnapshot.bindings.message.value,blank.document.bindings.message.value);
    await post(`/api/designs/designs/${blank.id}/archive`,cookie,{});
    assert.equal((await request(`/api/gifts/gifts/${blankGift.slug}/assets/${imageAsset.id}`)).status,200);
    assert.equal(providerCreates,0,'Blank must create no checkout');
  });
  await check('C02 catalog matches all seeded presets, free template publishes and data stays intact',async()=>{
    const catalog=(await json('/api/catalog/templates')).templates;
    const originals=JSON.stringify(catalog);
    assert.deepEqual(catalog.map(template=>template.id).sort(),templates.map(template=>template.id).sort());
    for(const template of templates){const d=await create({kind:'template',templateId:template.id});assert.equal(d.source.templateId,template.id);assert.equal(d.document.scenes.length,template.scenes,template.id);}
    const free=await create({kind:'template',templateId:'confetti'});const saved=await save(free,fill(free));assert.equal((await preflight(saved)).canPublish,true);
    await post('/api/gifts/gifts/from-design',cookie,publishBody(saved),201);
    assert.equal(JSON.stringify((await json('/api/catalog/templates')).templates),originals);
  });
  let extendedCards;
  await check('Public preview returns only one published DB template, both locales and pinned definitions',async()=>{
    const {templatePreviewDocument}=await import(pathToFileURL(path.join(fixture,'web/js/shared/canvas/presets.js'))),{serverText}=await import(pathToFileURL(path.join(fixture,'src/shared/locale.mjs')));
    for(const id of ['hai-phong-bi','birthday-radiance','proud-of-you','loi-moi-ben-hien','cuon-phim-ngay-ay','ban-do-ngay-ra-truong']){
      const payload=await json(`/api/designs/library/templates/${id}/preview`);assert.deepEqual(Object.keys(payload),['documents']);
      const {template}=await json(`/api/catalog/templates/${id}`);
      for(const locale of ['vi','en'])assert.deepEqual(payload.documents[locale],templatePreviewDocument(template,(key,values)=>serverText(locale,key,values)));
    }
    await admin.execute("UPDATE templates SET status='pending' WHERE id='birthday-radiance'");
    try{assert.equal((await request('/api/designs/library/templates/birthday-radiance/preview')).status,404);}finally{await admin.execute("UPDATE templates SET status='published' WHERE id='birthday-radiance'");}
  });
  await check('V2 on MySQL: three published QA cards, nested album media, ACL and revoke', async () => {
    ({cards:extendedCards} = await runExpandedApi(base, cookie, otherCookie, { artifacts: artifacts && path.join(artifacts,'qa-gifts') }));
  });
  await check('C14/C15 pending intent + two resume contexts do not grant rights or auto publish',async()=>{
    paidA=await create({kind:'template',templateId:'midnight-bloom'});paidA=await save(paidA,fill(paidA));
    paidB=await create({kind:'template',templateId:'midnight-bloom'});paidB=await save(paidB,fill(paidB));
    const p=await preflight(paidA);assert.equal(p.authorization.status,'needs_template_license');assert.equal(p.canPublish,false);
    assert.equal((await request('/api/gifts/gifts/from-design',{method:'POST',cookie,body:publishBody(paidA)})).status,402);
    assert.deepEqual((await json('/api/checkout/payments/methods')).methods.map(m=>m.id),['momo']);
    payment=(await post('/api/checkout/payments/create',cookie,{templateId:'midnight-bloom',method:'momo'},201)).payment;
    const again=(await post('/api/checkout/payments/create',cookie,{templateId:'midnight-bloom',method:'momo'},201)).payment;assert.equal(again.orderId,payment.orderId);assert.equal(providerCreates,1);
    for(const d of [paidA,paidB]){const input={designId:d.id,expectedRevision:d.revision,expectedDocumentHash:d.documentHash,mutationId:uuid()};contextRequests.push(input);contexts.push((await post(`/api/checkout/payments/orders/${payment.orderId}/design-contexts`,cookie,input,201)).context);}
    assert.equal((await json(`/api/checkout/payments/orders/${payment.orderId}/design-contexts`,{cookie})).contexts.length,2);
    assert.notEqual(contexts[0].designId,contexts[1].designId);
    assert.equal((await json(`/api/checkout/payments/orders/${payment.orderId}`,{cookie})).payment.status,'pending');
    assert.equal((await request(`/api/checkout/payments/orders/${payment.orderId}/receipt`,{cookie})).status,404);
    assert.equal((await request(`/payment-result/${payment.orderId}?status=PAID&paid=true`)).status,200);
    assert.equal((await preflight(paidA)).authorization.status,'needs_template_license');
    assert.equal((await request(`/api/checkout/payments/orders/${payment.orderId}/design-contexts/${contexts[0].contextId}`,{cookie:otherCookie})).status,404);
  });
  await check('C15 injected signed webhook settles actual SQL order/right/receipt once; invalid signature denied',async()=>{
    const body={code:payment.code,amount:payment.amount,reference:`synthetic-${uuid()}`,success:true};
    // Signature failure is from the injected provider contract, not merchant verification.
    const invalid=await request('/api/checkout/payments/webhooks/momo',{method:'POST',body:{...body,signature:'bad'}});assert.equal(invalid.status,400);
    body.signature=sign(body);await post('/api/checkout/payments/webhooks/momo',null,body);await post('/api/checkout/payments/webhooks/momo',null,body);
    assert.equal((await json(`/api/checkout/payments/orders/${payment.orderId}`,{cookie})).payment.status,'paid');
    const receipt=(await json(`/api/checkout/payments/orders/${payment.orderId}/receipt`,{cookie})).receipt;assert.equal(receipt.amountVnd,59000);assert.equal(receipt.testPayment,true);
    assert.equal((await preflight(paidA)).authorization.status,'allowed');
    const [[counts]]=await admin.execute('SELECT (SELECT COUNT(*) FROM template_entitlements WHERE order_id=?) AS rights_count,(SELECT COUNT(*) FROM payment_receipts WHERE order_id=?) AS receipt_count',[payment.orderId,payment.orderId]);assert.equal(counts.rights_count,1);assert.equal(counts.receipt_count,1);
  });
  await check('C13/C16 revoked rights denied; paid publish fault retry does not create new payment',async()=>{
    await admin.execute('UPDATE template_entitlements SET revoked_at=UTC_TIMESTAMP(3) WHERE order_id=?',[payment.orderId]);
    assert.equal((await preflight(paidA)).authorization.status,'needs_template_license');
    assert.equal((await request('/api/gifts/gifts/from-design',{method:'POST',cookie,body:publishBody(paidA)})).status,402);
    await admin.execute('UPDATE template_entitlements SET revoked_at=NULL WHERE order_id=?',[payment.orderId]);
    const body=publishBody(paidA);const actual=app.modules.designs.service.publication;
    let fail=true;app.modules.designs.service.publication={publish(...args){if(fail){fail=false;throw new FixtureHttpError(503,'Synthetic storage unavailable');}return actual.publish(...args);}};
    assert.equal((await request('/api/gifts/gifts/from-design',{method:'POST',cookie,body})).status,503);
    const result=await post('/api/gifts/gifts/from-design',cookie,body,201);const replay=await post('/api/gifts/gifts/from-design',cookie,body,200);assert.equal(result.gift.id,replay.gift.id);
    assert.equal(providerCreates,1);const [[n]]=await admin.execute('SELECT COUNT(*) AS count FROM orders WHERE user_id=? AND template_id=?',[owner,'midnight-bloom']);assert.equal(n.count,1);
    app.modules.designs.service.publication=actual;
    paidA.document.bindings.message.value='Đã thay đổi ở tab khác';paidA=await save(paidA);
    const resumed=(await json(`/api/checkout/payments/orders/${payment.orderId}/design-contexts/${contexts[0].contextId}`,{cookie})).context;assert.equal(resumed.changed,true);assert.equal(resumed.currentRevision,paidA.revision);
    const contextReplay=(await post(`/api/checkout/payments/orders/${payment.orderId}/design-contexts`,cookie,contextRequests[0],201)).context;
    assert.equal(contextReplay.replayed,true);assert.equal(contextReplay.contextId,contexts[0].contextId,'Lost context ACK must replay after draft revision advances');
  });
  if(process.argv.includes('--browser')){
    await check('Browser MySQL sender: register/login/favorite/Creator guard/save/publish/QR',async()=>{
      const {runBrowserSmoke}=await import(pathToFileURL(path.join(fixture,'tests/browser/smoke.mjs')).href);
      await runBrowserSmoke(base);
    });
    await check('Browser MySQL blank starter: stable text/numeric editing, save/F5, simulated preview, publish',async()=>{
      const {chromium}=require('playwright');const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
      try{
        const context=await browser.newContext({viewport:{width:1440,height:1000}});const separator=cookie.indexOf('=');await context.addCookies([{name:cookie.slice(0,separator),value:cookie.slice(separator+1),url:base}]);
        await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
        const page=await context.newPage();let previewWrites=0;page.on('request',r=>{if(r.method()==='POST'&&/\/replies$/.test(r.url()))previewWrites++;});
        await page.goto(`${base}/design/new`);await page.locator('[data-editor-action="create-starter"]').click();await page.locator('.editor-workspace').waitFor();
        await page.locator('[data-editor-field="binding.recipientName"]').fill('Mai');await page.locator('[data-editor-field="binding.senderName"]').fill('An');await page.locator('[data-editor-field="binding.message"]').fill('Lời chúc MySQL từ trang trống');
        await page.locator('[data-editor-action="library-tab"][data-tab="add"]').click();
        await page.locator('[data-block="paragraph"]').click();await page.locator('[data-editor-field="props.text"]').fill('Tiếng Việt được lưu: ă â ê ô ơ ư đ');
        await page.locator('.editor-geometry summary').click();
        await page.locator('[data-editor-field="layout.x"]').fill('72');await page.locator('[data-editor-action="save"]').click();await page.locator('.editor-save-status').filter({hasText:'Đã lưu'}).waitFor();
        const id=page.url().split('/').at(-1);let persisted=await getDesign(id);assert.equal(persisted.source.kind,'blank');assert(persisted.document.elements.some(e=>e.type==='text'&&e.props.text==='Tiếng Việt được lưu: ă â ê ô ơ ư đ'&&e.layout.x===72));
        await page.reload();await page.locator('.editor-workspace').waitFor();assert.equal(await page.locator('[data-editor-field="binding.message"]').inputValue(),'Lời chúc MySQL từ trang trống');
        await page.locator('[data-editor-action="preview"]').click();const dialog=page.locator('dialog.editor-preview-dialog');await dialog.locator('.gift-runtime-envelope').click();await dialog.getByRole('button',{name:'Đọc lời nhắn',exact:true}).click();await dialog.getByLabel('Lời đáp',{exact:true}).fill('Mô phỏng không ghi');await dialog.getByRole('button',{name:'Gửi lời đáp',exact:true}).click();await dialog.locator('.gift-runtime-replies').getByText('Mô phỏng không ghi').waitFor();assert.equal(previewWrites,0);
        await dialog.locator('[data-editor-action="preview-close"]').click();await page.locator('[data-editor-action="publish"]').click();await confirmGiftAccess(page);await page.waitForURL('**/success/*');await page.locator('#share-link').waitFor();
        persisted=await getDesign(id);assert.equal(persisted.document.bindings.message.value,'Lời chúc MySQL từ trang trống');
        if (artifacts) await page.screenshot({path:path.join(artifacts,'mysql-blank-success-1440.png'),fullPage:true});
      }finally{await browser.close();}
    });
    await check('Browser MySQL recipient: anonymous, keyboard/reduced motion, six viewports, reply and no editor bundle',async()=>{
      const {chromium}=require('playwright');const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
      try{
        const guest=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
        await guest.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
        const page=await guest.newPage(),scripts=[],errors=[];page.on('request',r=>{if(r.resourceType()==='script')scripts.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
        await page.addInitScript(()=>{globalThis.__canvasCsp=[];globalThis.document.addEventListener('securitypolicyviolation',e=>globalThis.__canvasCsp.push(e.violatedDirective));});
        await page.goto(`${base}/g/${blankGift.slug}`);await page.locator('.gift-runtime-envelope').waitFor();
        await page.locator('.gift-runtime-envelope').focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'Đọc lời nhắn',exact:true}).click();
        await page.getByLabel('Lời đáp',{exact:true}).fill('Lời đáp MySQL bằng trình duyệt');await page.getByRole('button',{name:'Gửi lời đáp',exact:true}).click();
        await page.locator('.gift-runtime-replies').getByText('Lời đáp MySQL bằng trình duyệt').waitFor();
        assert.equal((await json(`/api/gifts/gifts/${blankGift.slug}/replies`)).replies.length,2);
        for(const width of [320,375,390,768,1024,1440]){
          await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.innerWidth+1),`Public overflow at ${width}`);
        }
        assert(!scripts.some(url=>/pages\/designer\.js|features\/canvas-editor/.test(url)),'Public player must not load editor');
        assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>globalThis.__canvasCsp),[]);
        if (artifacts) await page.screenshot({path:path.join(artifacts,'mysql-recipient-1440.png'),fullPage:true});
        await guest.close();
      }finally{await browser.close();}
    });
    await check('C28 Browser MySQL paid receipt without design context retains print and Studio fallback',async()=>{
      const old=(await post('/api/checkout/payments/create',cookie,{templateId:'love-letter',method:'momo'},201)).payment;
      const body={code:old.code,amount:old.amount,reference:`synthetic-old-${uuid()}`,success:true};body.signature=sign(body);await post('/api/checkout/payments/webhooks/momo',null,body);
      assert.deepEqual((await json(`/api/checkout/payments/orders/${old.orderId}/design-contexts`,{cookie})).contexts,[]);
      const {chromium}=require('playwright');const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
      try{
        const context=await browser.newContext();const separator=cookie.indexOf('=');await context.addCookies([{name:cookie.slice(0,separator),value:cookie.slice(separator+1),url:base}]);
        await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
        const page=await context.newPage();await page.goto(`${base}/payment-result/${old.orderId}`);await page.locator('#payment-receipt').waitFor();
        assert(await page.getByRole('button',{name:'In / Lưu PDF',exact:true}).isVisible());assert(await page.getByRole('link',{name:'Về không gian của tôi',exact:true}).isVisible());
        assert.match(await page.locator('#payment-receipt').innerText(), /Thanh toán được xác nhận lúc:.*UTC/);
        assert.match(await page.locator('#payment-receipt').innerText(), /không thu tiền thật/);
      }finally{await browser.close();}
    });
  }
  let restoreGift;
  if (process.argv.includes('--browser')) await check('Creator template identity is isolated from preview data on MySQL', async () => {
    const { runSenderIdentity } = await import('../browser/sender-identity.mjs');
    await runSenderIdentity(base);
  });
  await check('Account recovery on MySQL with mock inbox and Google, same account/draft/gift', () => runRecovery(base, {
    mailFor: email => mailbox.findLast(item => item.to === email),
    messageFor: email => mailbox.findLast(item => item.to === email)?.text,
    advance: ms => { recoveryNow += ms; },
  }));
  await check('Real MySQL reply replay keeps one row, distinct intents and exact owner read state', async () => {
    const { gift } = await post('/api/gifts/gifts', cookie, {
      templateId: 'sunny-wishes', recipientName: 'Mai', senderName: 'An', message: 'Hộp thư SQL QA.', access: { open: 'link', send: 'link', read: 'link' },
    }, 201);
    await runReplyIntents(base, gift.slug, cookie, otherCookie);
    const [rows] = await admin.execute('SELECT read_status FROM gift_replies WHERE gift_id=? ORDER BY created_at,id', [gift.id]);
    assert.deepEqual(rows.map(row => row.read_status).sort(), ['read', 'unread']);
  });
  if (process.argv.includes('--browser')) await check('Creator birthday template V1/V2, real UI and MySQL', async () => {
    const { runCreatorJourney } = await import('../browser/creator-journey.mjs');
    restoreGift = await runCreatorJourney(base);
  });
  await check('C27 writer disabled keeps reader/media; C22 TTL guards public/reply/assets',async()=>{
    app.modules.designs.flags.edit=false;app.modules.designs.flags.publish=false;
    assert.equal((await request('/api/designs/designs',{method:'POST',cookie,body:{source:{kind:'blank'},mutationId:uuid()}})).status,503);
    assert.equal((await request(`/api/gifts/gifts/${blankGift.slug}`)).status,200);assert.equal((await request(`/api/gifts/gifts/${blankGift.slug}/assets/${imageAsset.id}`)).status,200);
    await admin.execute('UPDATE gifts SET created_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 3 DAY),expires_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 DAY) WHERE slug=?',[blankGift.slug]);
    for(const route of [`/api/gifts/gifts/${blankGift.slug}`,`/api/gifts/gifts/${blankGift.slug}/replies`,`/api/gifts/gifts/${blankGift.slug}/assets/${imageAsset.id}`])assert.equal((await request(route)).status,410);
    assert.equal(externalRequests,0);
  });
  if (process.env.MOMEVIA_QA_RESTORE_CONTAINER && restoreGift) await check('DB and media restore to a clean MySQL schema and fresh app', async () => {
    const { runMysqlRestore } = await import('./mysql-restore.mjs');
    await runMysqlRestore({ root, sourceFixture: fixture, database, container: process.env.MOMEVIA_QA_RESTORE_CONTAINER, config, gift: restoreGift,
      extended:extendedCards.find(card=>card.key==='anniversary'), artifacts, stopSource: async () => {
      await new Promise(resolve => app.server.close(resolve));
      await app.close();
      app = null;
    } });
  });
  console.log(`RESULT PASS ${count} real MySQL HTTP/provider-injected cases. External requests=${externalRequests}; merchant E2E NOT RUN.`);
}finally{
  globalThis.fetch=originalFetch;
  if(app){await new Promise(resolve=>app.server.close(resolve));await app.close();}
  await admin.end();process.chdir(previousCwd);
  for(const key of Object.keys(process.env))if(!(key in previousEnv))delete process.env[key];Object.assign(process.env,previousEnv);
  // Synthetic temp fixture is retained on purpose for debugging and media proof.
  console.log(`Fixture retained: ${fixture}`);
}
