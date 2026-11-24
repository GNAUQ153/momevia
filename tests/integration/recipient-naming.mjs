import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { loadEnvironment } from '../../src/shared/config.mjs';
import { startSfxFixture } from './sfx-fixture.mjs';
import { runRecipientBrowser } from '../browser/recipient-naming.mjs';
import { recipientRowsPreview, parseRecipientCsv } from '../../web/js/features/gifts/recipient-import.js';
import { createElement } from '../../web/js/shared/canvas/registry.js';
import { encodeWav } from '../../web/js/shared/canvas/audio-pcm.js';
import readExcel from 'read-excel-file/node';

const root = process.cwd();
const sql = process.argv.includes('--mysql-local'), baseline = process.argv.includes('--baseline');
if (sql) loadEnvironment();
const fixture = await startSfxFixture({ sql, externalSql: sql, baseline, baselineCommit: execFileSync('git', ['rev-parse', '85ef36a'], { encoding: 'utf8' }).trim(), label: baseline ? 'recipient-before' : sql ? 'recipient-mysql' : 'recipient-json' });
const { request, app, register, base, directory } = fixture;
const done = [], artifacts = path.join(root, 'local/recipient-naming', baseline ? 'before' : sql ? 'mysql' : 'json');
fs.mkdirSync(artifacts, { recursive: true });
async function check(label, fn) { await fn(); done.push(label); console.log('PASS '+label); }
const token = () => randomBytes(32).toString('base64url');
const owner = await register('Người gửi QA'), other = await register('Người khác QA');
if (sql) {
  const { templates } = await import('../../src/modules/catalog/seed.mjs');
  for (const t of templates) await fixture.connection.execute(`INSERT IGNORE INTO templates(id,title,style,theme,price_vnd,status,created_at,payload) VALUES (?,?,?,?,?,'published',UTC_TIMESTAMP(3),?)`,[t.id,t.title,t.style,t.theme,t.price,JSON.stringify({...t,status:'published',systemOwned:true,creatorId:'system'})]);
}
async function api(url, body, actor = owner, status = 200) {
  const result = await request(url, { cookie: actor?.cookie, body });
  assert.equal(result.status, status, url+' '+JSON.stringify(result.data)); return result.data;
}
async function draft(mode = 'manual', names) {
  const { design } = await api('/designs/designs', { source: { kind: 'blank' }, presetId: 'envelope-basic', mutationId: randomUUID() }, owner, 201);
  Object.assign(design.document.bindings, { recipientName: { type: 'text', value: mode === 'manual' ? 'Mai Anh' : '' }, senderName: { type: 'text', value: 'Người gửi' }, message: { type: 'text', value: 'Gửi {người nhận}, chúc bạn một ngày vui!' } });
  if (!baseline) design.document.personalization = { version: 1, mode, ...(names ? { names } : {}) };
  return save(design);
}
async function save(design) {
  await api(`/designs/designs/${design.id}/save`, { title: design.title, document: design.document, expectedRevision: design.revision, mutationId: randomUUID() });
  return (await api(`/designs/designs/${design.id}`)).design;
}
const publishBody = (d, access = { open: 'link', send: 'link', read: 'link' }) => ({ designId: d.id, expectedRevision: d.revision, expectedDocumentHash: d.documentHash, idempotencyKey: randomUUID(), access });
async function publish(d, access) { return (await api('/gifts/gifts/from-design', publishBody(d, access), owner, 201)).gift; }
const publicGift = async (gift, params = '') => (await api(`/gifts/gifts/${gift.slug}${params}`, undefined, null)).gift;
let manual, list, self, old, names, roster, coverless, protectedGift, legacyDirect;
try {
  await check('manual publication and legacy literal-brace compatibility', async () => {
    const d = await draft(); manual = await publish(d);
    const legacy = await draft(); delete legacy.document.personalization;
    old = await publish(await save(legacy));
    assert.equal((await publicGift(old)).documentSnapshot.bindings.message.value, 'Gửi {người nhận}, chúc bạn một ngày vui!');
    assert.equal((await publicGift(manual)).recipientName, 'Mai Anh');
  });
  if (!baseline) {
    names = Array.from({ length: 100 }, (_, i) => ({ row: i + 2, name: i === 1 ? 'Nguyễn Mai Anh' : i === 0 ? 'Nguyễn Mai Anh' : i === 2 ? '=SUM(1,2)' : `Người nhận ${i + 1} · Đặng Ánh` }));
    await check('legacy renderer creation remains direct and list creation replays one atomic roster', async () => {
      const body={templateId:'sunny-wishes',recipientName:'Tên thủ công',senderName:'QA',message:'Gửi {người nhận}'};
      const {gift:legacy}=await api('/gifts/gifts',body,owner,201); legacyDirect=legacy;
      assert.equal((await publicGift(legacy)).recipientName,'Tên thủ công');assert.equal((await publicGift(legacy)).message,'Gửi {người nhận}');
      const multi={...body,personalization:{version:1,mode:'list',names:names.slice(0,2)},idempotencyKey:randomUUID()};
      const results=await Promise.all([api('/gifts/gifts',multi,owner,201),api('/gifts/gifts',multi,owner,201)]);
      assert.equal(results[0].gift.id,results[1].gift.id);
      const rows=(await api(`/gifts/gifts/mine/${results[0].gift.slug}/recipients`)).recipients;
      assert.equal(rows.length,2);assert.notEqual(rows[0].url,rows[1].url);
      assert.equal((await publicGift(results[0].gift,new URL(rows[0].url).search)).message,'Gửi Nguyễn Mai Anh');
      await api('/gifts/gifts',{...multi,personalization:{version:1,mode:'self'}},owner,409);
    });
    await check('100 ordered receipts, duplicate names, atomic publish replay and all 100 mappings', async () => {
      const preview = recipientRowsPreview(parseRecipientCsv('\ufeffTên người nhận\r\n'+names.map(n => '"'+n.name+'"').join('\r\n')));
      assert.equal(preview.names.length, 100); assert.equal(preview.errors.length, 0);
      const d = await draft('list', names), body = publishBody(d);
      const results = await Promise.all(Array.from({ length: 3 }, async () => request('/gifts/gifts/from-design', { cookie: owner.cookie, body })));
      assert(results.every(r => [200,201].includes(r.status)), JSON.stringify(results));
      assert.equal(new Set(results.map(r => r.data.gift.id)).size, 1); list = results[0].data.gift;
      roster = (await api(`/gifts/gifts/mine/${list.slug}/recipients`)).recipients;
      assert.equal(roster.length, 100); assert.equal(new Set(roster.map(r => r.url)).size, 100);
      for (let start = 0; start < 100; start += 10) await Promise.all(roster.slice(start, start + 10).map(async (r, i) => {
        const url = new URL(r.url), gift = await publicGift(list, url.search);
        assert.equal(gift.recipientName, names[start+i].name);
        assert.equal(gift.documentSnapshot.bindings.recipientName.value, names[start+i].name);
        assert(!JSON.stringify(gift).includes('recipients')); assert(!url.href.includes(encodeURIComponent(r.name)));
      }));
      assert.equal((await request(`/gifts/gifts/${list.slug}`)).status, 403);
      await api('/gifts/gifts/from-design', { ...body, access: { open: 'link', send: 'disabled', read: 'sender' } }, owner, 409);
    });
    await check('invalid final row creates no publication and export stays owner-only with Excel-safe names', async () => {
      const before = (await api('/gifts/gifts/mine')).gifts.length;
      const preview = recipientRowsPreview(parseRecipientCsv('Tên người nhận\r\n'+names.slice(0,99).map(n => '"'+n.name+'"').join('\r\n')+'\r\n""'));
      assert.deepEqual(preview.errors.map(e => e.row), [101]);
      const d = await draft('list', []);
      await api('/gifts/gifts/from-design', publishBody(d), owner, 422);
      assert.equal((await api('/gifts/gifts/mine')).gifts.length, before);
      d.document.personalization.names = [...names.slice(0,99), { row: 101, name: '' }];
      await api(`/designs/designs/${d.id}/save`, { title: d.title, document: d.document, expectedRevision: d.revision, mutationId: randomUUID() }, owner, 422);
      const csv = await request(`/gifts/gifts/mine/${list.slug}/recipients.csv`, { cookie: owner.cookie }); assert.equal(csv.status,200);
      const parsed = parseRecipientCsv(csv.bytes.toString('utf8'));
      assert.equal(parsed.length,101); assert.equal(parsed[3].cells[0], "'=SUM(1,2)"); assert.equal(parsed[1].cells[1], roster[0].url);
      const workbook=await request(`/gifts/gifts/mine/${list.slug}/recipients.xlsx`,{cookie:owner.cookie});assert.equal(workbook.status,200);
      fs.writeFileSync(path.join(artifacts,'export-100.xlsx'),workbook.bytes);
      const excel=await readExcel(workbook.bytes);assert.equal(excel.length,101);assert.equal(excel[3][0],'=SUM(1,2)');
      for(const [i,row] of excel.slice(1).entries()){assert.equal(row[0],names[i].name);assert.equal(row[1],roster[i].url);}
      for (const actor of [other, null]) for (const suffix of ['recipients','recipients.csv','recipients.xlsx']) assert([401,404].includes((await request(`/gifts/gifts/mine/${list.slug}/${suffix}`, { cookie: actor?.cookie })).status));
    });
    await check('self gate never records GETs; concurrent/retried confirmations keep separate receipts and replies', async () => {
      self = await publish(await draft('self'));
      for (let i = 0; i < 3; i++) assert.equal((await publicGift(self)).nameRequired, true);
      assert.equal((await api(`/gifts/gifts/mine/${self.slug}/recipients`)).recipients.length,0);
      const tokens = [token(),token(),token(),token()], labels=['Lan','Minh','Lan','Lan'];
      await Promise.all(tokens.map((t,i) => api(`/gifts/gifts/${self.slug}/recipient`, { token:t, name: labels[i] }, null)));
      await Promise.all(Array.from({length:5},()=>api(`/gifts/gifts/${self.slug}/recipient`, {token:tokens[0],name:'Lan'}, null)));
      let rows = (await api(`/gifts/gifts/mine/${self.slug}/recipients`)).recipients; assert.equal(rows.length,4); assert(rows.every(r=>r.status==='confirmed'));
      for (const [i,t] of tokens.entries()) assert.equal((await publicGift(self, '?r='+t)).recipientName, labels[i]);
      await api(`/gifts/gifts/${self.slug}/recipient`, {token:tokens[0],name:'Tên khác'}, null, 409);
      const body={intentId:randomUUID(),name:'Chữ ký riêng',message:'Cảm ơn bạn!'};
      await api(`/gifts/gifts/${self.slug}/replies?r=${tokens[1]}`, body, null, 201);
      await api(`/gifts/gifts/${self.slug}/replies?r=${tokens[1]}`, body, null, 201);
      const replies=(await api(`/gifts/gifts/mine/${self.slug}/replies`)).replies;
      assert.equal(replies.length,1); assert.equal(replies[0].cardName,'Minh'); assert.equal(replies[0].name,'Chữ ký riêng');
      const minh=rows.find(r=>r.name==='Minh'); assert.equal(replies[0].recipientId,minh.id);
      assert.equal((await api(`/gifts/gifts/${self.slug}/replies?r=${tokens[0]}`,undefined,null)).replies.length,0);
      assert.equal((await api(`/gifts/gifts/${self.slug}/replies?r=${tokens[1]}`,undefined,null)).replies.length,1);
      rows=(await api(`/gifts/gifts/mine/${self.slug}/recipients`)).recipients; assert.equal(rows.filter(r=>r.status==='replied').length,1);
      assert.equal((await api('/gifts/gifts/mine')).gifts.find(g=>g.id===self.id).unreadCount,1);
      await api(`/gifts/gifts/mine/${self.slug}/replies/read`,{ids:[replies[0].id]});
      assert.equal((await api('/gifts/gifts/mine')).gifts.find(g=>g.id===self.id).unreadCount,0);
      assert.equal((await request(`/gifts/gifts/${self.slug}/replies`)).status,403);
    });
    await check('invites, independent send/read rights and media gates checked at server', async () => {
      const d = await draft('list', names.slice(0,2));
      const image=await request(`/designs/designs/${d.id}/assets`,{cookie:owner.cookie,bytes:await sharp({create:{width:10,height:10,channels:3,background:'#e8cfee'}}).png().toBuffer(),headers:{'content-type':'image/png','x-mutation-id':randomUUID()}});
      assert.equal(image.status,201,JSON.stringify(image.data));
      d.document.assets.push({assetId:image.data.asset.id,kind:'image'});
      const photo=createElement('image',{id:'photo-proof',props:{assetId:image.data.asset.id},accessibility:{alt:'Ảnh kiểm thử'}});
      d.document.elements.push(photo); d.document.scenes[0].elementIds.push(photo.id);
      const audio=await request(`/designs/designs/${d.id}/audio`,{cookie:owner.cookie,bytes:Buffer.from(encodeWav(new Float32Array(4410))),headers:{'content-type':'audio/wav','x-mutation-id':randomUUID()}});
      assert.equal(audio.status,201,JSON.stringify(audio.data));
      d.document.schemaVersion=d.document.registryVersion=3;
      d.document.assets.push({assetId:audio.data.asset.id,kind:'audio'});
      const sound=createElement('sound-button',{id:'sound-proof',sound:{kind:'audio',assetId:audio.data.asset.id,volume:0.5}});
      d.document.elements.push(sound);d.document.scenes[0].elementIds.push(sound.id);
      const saved=await save(d); protectedGift=await publish(saved,{open:'invite',send:'disabled',read:'sender'});
      const [r]=(await api(`/gifts/gifts/mine/${protectedGift.slug}/recipients`)).recipients;
      const query=new URL(r.url).search; assert(query.includes('invite='));
      assert.equal((await publicGift(protectedGift,query)).replyPermissions.canSend,false);
      assert.equal((await request(`/gifts/gifts/${protectedGift.slug}/assets/${image.data.asset.id}${query}`)).status,200);
      assert.equal((await request(`/gifts/gifts/${protectedGift.slug}/assets/${audio.data.asset.id}${query}`)).status,200);
      for(const suffix of ['',`/assets/${image.data.asset.id}`,'/replies']) assert.equal((await request(`/gifts/gifts/${protectedGift.slug}${suffix}?r=${new URL(r.url).searchParams.get('r')}`)).status,403);
      assert.equal((await request(`/gifts/gifts/${protectedGift.slug}/assets/${image.data.asset.id}?invite=${new URL(r.url).searchParams.get('invite')}`)).status,403);
      assert.equal((await request(`/gifts/gifts/${protectedGift.slug}/assets/${audio.data.asset.id}?invite=${new URL(r.url).searchParams.get('invite')}`)).status,403);
      await api(`/gifts/gifts/${protectedGift.slug}/replies${query}`,{name:'A',message:'No'},null,403);
      await api(`/gifts/gifts/mine/${protectedGift.slug}/revoke`,{});
      for(const suffix of ['',`/assets/${image.data.asset.id}`,`/assets/${audio.data.asset.id}`,'/replies']) assert.equal((await request(`/gifts/gifts/${protectedGift.slug}${suffix}${query}`)).status,410);
    });
    await check('paid-template context preserves recipient mode, list version and document through simulated checkout', async () => {
      const {design}=await api('/designs/designs',{source:{kind:'template',templateId:'midnight-bloom'},mutationId:randomUUID()},owner,201);
      design.document.personalization={version:1,mode:'list',names:names.slice(0,2)};
      design.document.bindings.senderName.value='QA'; design.document.bindings.message.value='Gửi {người nhận}';
      const saved=await save(design), preflight=await api(`/designs/designs/${saved.id}/preflight`,{expectedRevision:saved.revision});
      assert.equal(preflight.authorization.status,'needs_template_license');assert(!preflight.blockers.some(b=>b.path==='bindings.recipientName'));
      app.modules.checkout.service.config.demoEnabled=true;
      const {order}=await api('/checkout/orders/demo-purchase',{templateId:'midnight-bloom'},owner,201);
      const {context}=await api(`/checkout/payments/orders/${order.id}/design-contexts`,{designId:saved.id,expectedRevision:saved.revision,expectedDocumentHash:saved.documentHash,mutationId:randomUUID()},owner,201);
      const resumed=await api(`/checkout/payments/orders/${order.id}/design-contexts/${context.contextId}`);
      assert.equal(resumed.context.changed,false);
      const reloaded=(await api(`/designs/designs/${saved.id}`)).design;assert.deepEqual(reloaded.document.personalization,saved.document.personalization);
      assert.equal((await api(`/designs/designs/${saved.id}/preflight`,{expectedRevision:saved.revision})).canPublish,true);
      const gift=await publish(reloaded);assert.equal((await api(`/gifts/gifts/mine/${gift.slug}/recipients`)).recipients.length,2);
    });
    await check('Creator policies and fallback dedication use explicit personalization permission', async () => {
      const d=await draft('self'); d.document.elements=d.document.elements.filter(e=>e.props.textBinding!=='recipientName');
      for(const scene of d.document.scenes) scene.elementIds=scene.elementIds.filter(id=>d.document.elements.some(e=>e.id===id));
      coverless=await publish(await save(d));
      const locked={document:structuredClone(d.document),policy:{kind:'creator-template',editableBindings:['message'],lockedElements:{}}};
      assert.throws(()=>app.modules.designs.service.enforcePolicy(locked,d.document),e=>e.code==='RECIPIENT_LOCKED');
    });
  }
  await runRecipientBrowser(base,{owner,manual,old,list,self,roster,coverless,legacyDirect,artifacts,baseline,sql});
  if(!baseline) await check('disable new links preserves shared-link confirmation and existing readers; expiry rejects access',async()=>{
    const canary=await draft('self');
    process.env.RECIPIENT_NAMING_OWNER_IDS=other.user.id;
    assert.equal((await api(`/designs/designs/${canary.id}/preflight`,{expectedRevision:canary.revision})).canPublish,false);
    process.env.RECIPIENT_NAMING_OWNER_IDS=owner.user.id;
    assert.equal((await api(`/designs/designs/${canary.id}/preflight`,{expectedRevision:canary.revision})).canPublish,true);
    delete process.env.RECIPIENT_NAMING_OWNER_IDS;
    process.env.RECIPIENT_NAMING_ENABLED='false';
    const survivingToken=token();
    await api(`/gifts/gifts/${self.slug}/recipient`,{token:survivingToken,name:'Mới'},null,200);
    process.env.RECIPIENT_CONFIRMATIONS_ENABLED='false';
    await api(`/gifts/gifts/${self.slug}/recipient`,{token:token(),name:'Mới khác'},null,503);
    await api(`/gifts/gifts/${self.slug}/recipient`,{token:survivingToken,name:'Mới'},null,200);
    delete process.env.RECIPIENT_CONFIRMATIONS_ENABLED;
    assert.equal((await publicGift(list,new URL(roster[0].url).search)).recipientName,names[0].name);
    await api('/gifts/gifts/from-design',publishBody(await draft('self')),owner,422);
    delete process.env.RECIPIENT_NAMING_ENABLED;
    const gift=await app.modules.gifts.service.validateSlug(self.slug);
    await app.modules.gifts.service.mutateGift(gift,current=>{current.expiresAt=new Date(0).toISOString();return {};});
    if(sql) await fixture.connection.execute('UPDATE gifts SET created_at=DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 3 DAY), expires_at=DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 DAY) WHERE id=?',[gift.id]);
    assert.equal((await request(`/gifts/gifts/${self.slug}`)).status,410);
    await api(`/gifts/gifts/${self.slug}/recipient`,{token:token(),name:'Mới'},null,410);
  });
  fs.writeFileSync(path.join(artifacts,'api-results.json'),JSON.stringify({storage:sql?'mysql':'json',baseline,checks:done,fixture:directory},null,2));
  console.log(`RESULT PASS ${done.length} recipient naming groups; ${sql?'real MySQL':'JSON'}; browser evidence ${artifacts}`);
} finally { await fixture.close(); }
