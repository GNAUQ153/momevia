import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { startSfxFixture } from './sfx-fixture.mjs';
import { createElement } from '../../web/js/shared/canvas/index.js';
import { encodeWav,trimPcm } from '../../web/js/shared/canvas/audio-pcm.js';
import { validatePcmWav } from '../../src/modules/designs/audio.service.mjs';
import { exportCanvas,restoreCanvas,verifyCanvas } from '../../scripts/dev/canvas-backup.mjs';
import { AUDIO_LIMITS } from '../../web/js/shared/canvas/audio-pcm.js';
import { SOUNDTRACKS } from '../../web/js/shared/canvas/soundtracks.js';
import { loadEnvironment } from '../../src/shared/config.mjs';

const externalSql=process.argv.includes('--mysql-local');if(externalSql)loadEnvironment();
const sql=externalSql||process.argv.includes('--mysql');
const fixture=await startSfxFixture({sql,externalSql,label:sql?'mysql':'json'}),{base,request,directory}=fixture,checks=[];
const check=async(name,work)=>{await work();checks.push({name,result:'PASS'});console.log('PASS '+name);};
async function post(owner,route,body,status=200){const r=await request(route,{cookie:owner.cookie,body});assert.equal(r.status,status,JSON.stringify(r.data));return r.data;}
const src=Float32Array.from({length:132300},(_,i)=>Math.sin(2*Math.PI*(i<44100?220:i<88200?880:1760)*i/44100)*.4),buffer={sampleRate:44100,length:src.length,numberOfChannels:1,getChannelData:()=>src},middle=Buffer.from(trimPcm(buffer,1000,2000).bytes);
fs.writeFileSync(path.join(directory,'three-signals.wav'),Buffer.from(encodeWav(src)));
try{
 const owner=await fixture.register('Người gửi SFX'),other=await fixture.register('Tài khoản thứ hai');
 let design=(await post(owner,'/designs/designs',{source:{kind:'blank'},presetId:'envelope-basic',mutationId:randomUUID()},201)).design;
 const save=async()=>{const r=await post(owner,`/designs/designs/${design.id}/save`,{title:design.title,document:design.document,mutationId:randomUUID(),expectedRevision:design.revision});design=(await request(`/designs/designs/${design.id}`,{cookie:owner.cookie})).data.design;assert.equal(design.revision,r.savedRevision);};
 const upload=(bytes=middle,mutation=randomUUID(),actor=owner)=>request(`/designs/designs/${design.id}/audio`,{cookie:actor.cookie,bytes,headers:{'content-type':'audio/wav','x-mutation-id':mutation}});
 let asset,unused,gift;
 await check('canonical PCM upload: same mutation concurrent replay, altered bytes rejected, foreign owner blocked',async()=>{
  const mutation=randomUUID(),responses=await Promise.all([upload(middle,mutation),upload(middle,mutation)]);assert(responses.every(r=>r.status===201),JSON.stringify(responses));assert.equal(responses[0].data.asset.id,responses[1].data.asset.id);asset=responses[0].data.asset;
  const changed=Buffer.from(middle);changed[50]^=1;assert.equal((await upload(changed,mutation)).status,409);assert.equal((await upload(middle,randomUUID(),other)).status,404);
  assert.equal((await request(`/designs/designs/${design.id}/assets/${asset.id}`,{cookie:other.cookie})).status,404);
  assert.equal((await upload(Buffer.from('not-a-wave'))).status,422);unused=(await upload(middle)).data.asset;
 });
 await check('concurrent uploads enforce cumulative quota before promoting ready bytes; no quota-rejected orphans',async()=>{
  const repo=fixture.app.modules.designs.repository;
  const usage=fixture.connection?Number((await fixture.connection.execute('SELECT COALESCE(SUM(bytes),0) bytes FROM design_assets WHERE owner_id=?',[owner.user.id]))[0][0].bytes):Object.values(repo.read().assets).filter(a=>a.ownerId===owner.user.id).reduce((n,a)=>n+a.bytes,0);
  const fakeId=randomUUID(),now=new Date().toISOString(),fake={id:fakeId,ownerId:owner.user.id,designId:design.id,status:'ready',mime:'image/png',bytes:AUDIO_LIMITS.ownerBytes-usage-middle.length-100,width:1,height:1,storageKey:fakeId+'.png',contentHash:'sha256:'+'0'.repeat(64),createdAt:now};
  await repo.insertAsset(owner.user.id,design.id,fake);
  const filesBefore=fs.readdirSync(path.join(directory,'services/designs/data/assets'));
  try{
   const replies=await Promise.all([upload(),upload()]);assert.deepEqual(replies.map(r=>r.status).sort(),[201,413]);
   const filesAfter=fs.readdirSync(path.join(directory,'services/designs/data/assets'));assert.equal(filesAfter.length,filesBefore.length+1);assert(filesAfter.every(n=>!n.endsWith('.staging')));
  }finally{if(fixture.connection)await fixture.connection.execute('DELETE FROM design_assets WHERE id=?',[fakeId]);else await repo.change(state=>{delete state.assets[fakeId];return true;});}
 });
 await check('background music, envelope/gift-box sounds and library/personal buttons survive save, reload and publish replay',async()=>{
  for(const binding of Object.values(design.document.bindings))binding.value='Quà SFX có lời chúc dạng chữ';
  const doc=design.document;doc.schemaVersion=doc.registryVersion=3;
  const envelope=doc.elements.find(e=>e.type==='envelope');envelope.sound={kind:'library',id:'seal-peel',version:1,startMs:0,endMs:850,volume:.7};
  const box=createElement('gift-box',{sound:{kind:'library',id:'box-pop',version:1,startMs:0,endMs:650,volume:.6},actions:[{on:'activate',type:'goToScene',targetSceneId:doc.scenes[2].id}],layout:{x:60,y:430,width:240,height:160}});
  const library=createElement('sound-button',{sound:{kind:'library',id:'warm-ending',version:1,startMs:100,endMs:2000,volume:.5},props:{label:'Nghe giai điệu kết'},layout:{x:50,y:500,width:280,height:60}}),personal=createElement('sound-button',{sound:{kind:'audio',assetId:asset.id,volume:.4},props:{label:'Nghe lời chúc cá nhân'},layout:{x:50,y:580,width:280,height:60}});
  doc.soundtrack={id:'calm-dawn',volume:.35};
  doc.elements.push(box,library,personal);doc.scenes[0].elementIds.push(box.id);doc.scenes[1].elementIds.push(library.id,personal.id);doc.assets.push({kind:'audio',assetId:asset.id});await save();
  assert.equal(design.document.schemaVersion,3);assert.deepEqual(design.document.soundtrack,doc.soundtrack);
  const preflight=await post(owner,`/designs/designs/${design.id}/preflight`,{expectedRevision:design.revision});assert.equal(preflight.canPublish,true,JSON.stringify(preflight));
  const body={designId:design.id,expectedRevision:design.revision,expectedDocumentHash:design.documentHash,idempotencyKey:randomUUID()};gift=(await post(owner,'/gifts/gifts/from-design',body,201)).gift;assert.equal((await post(owner,'/gifts/gifts/from-design',body)).gift.slug,gift.slug);
  const publicGift=(await request(`/gifts/gifts/${gift.slug}`)).data.gift;
  assert.deepEqual(publicGift.documentSnapshot.soundtrack,doc.soundtrack);
  assert.equal(publicGift.documentSnapshot.elements.find(e=>e.id===personal.id).sound.assetId,asset.id);
  const r=await request(`/gifts/gifts/${gift.slug}/assets/${asset.id}`);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'audio/wav');assert.deepEqual(r.bytes,middle);assert.equal(validatePcmWav(r.bytes).sampleCount,44100);
  // Correlate receiver samples against each of the three deliberately distinct source tones.
  const correlations=[220,880,1760].map(freq=>{let value=0;for(let i=0;i<44100;i++)value+=r.bytes.readInt16LE(44+i*2)/32768*Math.sin(2*Math.PI*freq*i/44100);return Math.abs(value/44100);});assert(correlations[1]>.19&&correlations[0]<.0001&&correlations[2]<.0001);fs.writeFileSync(path.join(directory,'trim-proof.json'),JSON.stringify({sampleCount:44100,durationMs:1000,frequencies:[220,880,1760],correlations,receiverBytesEqualMiddle:true},null,2));
  assert.equal((await request(`/gifts/gifts/${gift.slug}/assets/${unused.id}`)).status,404);
  fs.writeFileSync(path.join(directory,'receiver-middle.wav'),r.bytes);
 });
 await check('retiming personal sound creates a new file; old published pins remain immutable, including envelope audio',async()=>{
  const cut=Buffer.from(trimPcm(buffer,1100,1600).bytes),next=(await upload(cut)).data.asset;assert.notEqual(next.id,asset.id);
  const e=design.document.elements.find(e=>e.type==='envelope');e.sound={kind:'audio',assetId:next.id,volume:.8};design.document.assets.push({kind:'audio',assetId:next.id});await save();
  const before=(await request(`/gifts/gifts/${gift.slug}`)).data.gift;assert.equal(before.documentSnapshot.elements.find(e=>e.type==='envelope').sound.kind,'library');assert.deepEqual((await request(`/gifts/gifts/${gift.slug}/assets/${asset.id}`)).bytes,middle);
  const body={designId:design.id,expectedRevision:design.revision,expectedDocumentHash:design.documentHash,idempotencyKey:randomUUID()},newGift=(await post(owner,'/gifts/gifts/from-design',body,201)).gift;
  const regift=await post(owner,`/gifts/gifts/mine/${newGift.slug}/regift`,{mutationId:randomUUID()},201);
  assert(regift.design.document.elements.every(e=>e.sound?.kind!=='audio'));assert(regift.design.document.elements.some(e=>e.sound?.kind==='library'));assert.equal(regift.design.document.assets.filter(a=>a.kind==='audio').length,0);
 });
 await check('draft rejects foreign audio and image/audio masquerading; revision CAS protects concurrent editors',async()=>{
  const second=(await post(other,'/designs/designs',{source:{kind:'blank'},mutationId:randomUUID()},201)).design;second.document=structuredClone(design.document);
  const body={title:second.title,document:second.document,mutationId:randomUUID(),expectedRevision:second.revision};assert.equal((await request(`/designs/designs/${second.id}/save`,{cookie:other.cookie,body})).status,422);
  const bad=structuredClone(design.document);bad.assets.find(a=>a.kind==='audio').kind='image';assert.equal((await request(`/designs/designs/${design.id}/save`,{cookie:owner.cookie,body:{...body,document:bad,expectedRevision:design.revision}})).status,422);
  const stale={title:design.title,document:design.document,mutationId:randomUUID(),expectedRevision:design.revision-1};assert.equal((await request(`/designs/designs/${design.id}/save`,{cookie:owner.cookie,body:stale})).status,409);
 });
 await check('invite, expiry, revoke and unpinned-media ACL apply to sound exactly as images',async()=>{
  const input={designId:design.id,expectedRevision:design.revision,expectedDocumentHash:design.documentHash,idempotencyKey:randomUUID(),access:{open:'invite',send:'invite',read:'sender'}};
  const result=await request('/gifts/gifts/from-design',{cookie:owner.cookie,body:input});assert.equal(result.status,201,JSON.stringify(result.data));const inviteGift=result.data.gift,inviteUrl=new URL(inviteGift.inviteUrl),invite=inviteUrl.searchParams.get('invite');assert(invite);
  const route=`/gifts/gifts/${inviteGift.slug}/assets/${asset.id}`;assert.equal((await request(route)).status,403);assert.equal((await request(route+'?invite='+encodeURIComponent(invite))).status,200);
  await post(owner,`/gifts/gifts/mine/${inviteGift.slug}/revoke`,{});assert.equal((await request(route+'?invite='+encodeURIComponent(invite))).status,410);
  const expiring=(await post(owner,'/gifts/gifts/from-design',{...input,idempotencyKey:randomUUID(),access:{open:'link',send:'link',read:'link'}},201)).gift;
  if(fixture.connection)await fixture.connection.execute("UPDATE gifts SET created_at='1999-01-01 00:00:00',expires_at='2000-01-01 00:00:00' WHERE slug=?",[expiring.slug]);else await fixture.app.modules.designs.repository.change(state=>{const gift=Object.values(state.publications).find(p=>p.result.gift.slug===expiring.slug).result.gift;gift.createdAt='1999-01-01T00:00:00.000Z';gift.expiresAt='2000-01-01T00:00:00.000Z';return true;});
  assert.equal((await request(`/gifts/gifts/${expiring.slug}/assets/${asset.id}`)).status,410);
 });
 await check('pausing new SFX preserves recipient playback and text-only edits to existing sound drafts',async()=>{
  const service=fixture.app.modules.designs.service;service.flags.sfxCreate=false;assert.equal((await upload()).status,503);assert.equal((await request(`/gifts/gifts/${gift.slug}/assets/${asset.id}`)).status,200);
  design.title='Vẫn sửa lời chúc khi tạm tắt SFX';await save();design.document.elements.find(e=>e.type==='envelope').sound.volume=.2;
  assert.equal((await request(`/designs/designs/${design.id}/save`,{cookie:owner.cookie,body:{title:design.title,document:design.document,expectedRevision:design.revision,mutationId:randomUUID()}})).status,503);service.flags.sfxCreate=true;design=(await request(`/designs/designs/${design.id}`,{cookie:owner.cookie})).data.design;
 });
 await check('Creator v3 preview/cover, approved audio ownership remap and locked Sender sound policy',async()=>{
  const creator=await fixture.register('Creator SFX QA'),admin=await fixture.register('Admin SFX QA');
  await fixture.app.modules.identity.service.users.update(creator.user.id,{role:'creator'});await fixture.app.modules.identity.service.users.update(admin.user.id,{role:'admin'});
  const workspace=await post(creator,'/catalog/creator/workspaces',{title:'Mẫu có âm thanh',subtitle:'SFX QA gốc',mutationId:randomUUID()},201),id=workspace.id;
  let draft=(await request(`/designs/designs/${id}`,{cookie:creator.cookie})).data.design;
  const r=await request(`/designs/designs/${id}/audio`,{cookie:creator.cookie,bytes:middle,headers:{'content-type':'audio/wav','x-mutation-id':randomUUID()}});assert.equal(r.status,201,JSON.stringify(r.data));const creatorAsset=r.data.asset.id;
  draft.document.schemaVersion=draft.document.registryVersion=3;draft.document.assets.push({kind:'audio',assetId:creatorAsset});draft.document.elements.find(e=>e.type==='envelope').sound={kind:'audio',assetId:creatorAsset,volume:.7};
  const ack=await post(creator,`/designs/designs/${id}/save`,{title:draft.title,document:draft.document,expectedRevision:draft.revision,mutationId:randomUUID()});
  const {version}=await post(creator,`/catalog/creator/workspaces/${id}/submit`,{expectedRevision:ack.savedRevision,bindings:['message','recipientName','senderName'],rights:'Original synthetic test sound, redistribution approved.'});
  await post(admin,`/catalog/admin/templates/${id}/versions/${version.id}`,{action:'approve',rightsConfirmed:true});
  const cover=await request(`/catalog/templates/${id}/versions/${version.id}/cover`);assert.equal(cover.status,200);assert(cover.headers.get('content-type').includes('svg'));assert.equal((await request(`/catalog/templates/${id}/versions/${version.id}/assets/${creatorAsset}`)).status,200);
  draft=(await post(owner,'/designs/designs',{source:{kind:'template',templateId:id,templateVersionId:version.id},mutationId:randomUUID()},201)).design;
  const remapped=draft.document.elements.find(e=>e.type==='envelope').sound.assetId;assert.notEqual(remapped,creatorAsset);assert(draft.document.assets.some(a=>a.assetId===remapped&&a.kind==='audio'));
  const changed=structuredClone(draft.document);changed.elements.find(e=>e.type==='envelope').sound.volume=.1;
  assert.equal((await request(`/designs/designs/${draft.id}/save`,{cookie:owner.cookie,body:{title:draft.title,document:changed,expectedRevision:draft.revision,mutationId:randomUUID()}})).status,403);
 });
 await check('all fifty externally sourced music IDs save/reload; published music remains fixed after later draft changes',async()=>{
  for(const track of SOUNDTRACKS){design.document.soundtrack={id:track.id,volume:.3};await save();assert.equal(design.document.soundtrack.id,track.id);}
  const body={designId:design.id,expectedRevision:design.revision,expectedDocumentHash:design.documentHash,idempotencyKey:randomUUID()},publishedMusic=(await post(owner,'/gifts/gifts/from-design',body,201)).gift;
  const original=(await request(`/gifts/gifts/${publishedMusic.slug}`)).data.gift.documentSnapshot.soundtrack;assert.equal(original.id,SOUNDTRACKS.at(-1).id);design.document.soundtrack={id:SOUNDTRACKS[0].id,volume:.6};await save();assert.deepEqual((await request(`/gifts/gifts/${publishedMusic.slug}`)).data.gift.documentSnapshot.soundtrack,original);
 });
 if(!fixture.connection)await check('offline JSON backup, checksum verification and restore retain WAV and immutable gift snapshots',async()=>{
  const source=path.join(directory,'services/designs/data'),target=path.join(directory,'backup'),restore=path.join(directory,'restored');exportCanvas({source,target,offline:true});assert(verifyCanvas({source:target}).manifest);restoreCanvas({source:target,target:restore});assert.deepEqual(fs.readFileSync(path.join(restore,'assets',asset.id+'.wav')),middle);
 });
 if(fixture.connection)await check('existing MySQL Admin library edits survive additive SFX seeding and re-runs',async()=>{
  const library=fixture.app.modules.designs.library,rows=await library.rows(),original=rows.find(r=>r.kind==='element'&&r.id==='sound-button');assert(original);
  const custom={...original.definition,title:{vi:'Âm của Admin',en:'Admin sound'}};await library.put({role:'admin'},original.kind,original.id,{expectedRevision:original.revision,definition:custom,status:'disabled',sortOrder:77});await library.seedSound();const next=(await library.rows()).find(r=>r.kind===original.kind&&r.id===original.id);assert.equal(next.status,'disabled');assert.deepEqual(next.definition,custom);assert.equal(next.revision,original.revision+1);
 });
 fs.writeFileSync(path.join(directory,'session-private.json'),JSON.stringify({base,owner,other,designId:design.id,gift,source:path.join(directory,'three-signals.wav')},null,2));
 if(process.argv.includes('--browser')){const {runSfxBrowser}=await import('../browser/sfx.mjs');await runSfxBrowser({fixture,owner,design,gift,check});}
 console.log(`SFX_REPORT=${directory}`);
}catch(error){checks.push({name:'failure',result:'FAIL',error:error.stack});console.error(error.stack);process.exitCode=1;}
finally{fs.writeFileSync(path.join(directory,'results.json'),JSON.stringify({storage:fixture.connection?'mysql':'json',checks,physicalDevices:false,humanListening:false},null,2));await fixture.close();}
