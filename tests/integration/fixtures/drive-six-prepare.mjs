import fs from'node:fs';import assert from'node:assert/strict';import{randomUUID}from'node:crypto';import sharp from'sharp';
import{editInvitation}from'../../../web/js/shared/canvas/invitation.js';
assert(process.env.DRIVE_QA_RUNTIME&&process.env.DRIVE_QA_RESULT_FILE,'Fixture input/output paths must be explicit');
const runtime=JSON.parse(fs.readFileSync(process.env.DRIVE_QA_RUNTIME)),{base,owner}=runtime;
assert.equal(runtime.testFixture,'drive-six-mysql','Only the isolated integration fixture may run this writer');assert(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname),'Loopback fixture only');
const ids=['garden-tea','secret-santa-invitation','midnight-soiree','graduation-countdown','graduation-mixtape','the-last-chapter-v2'],rows=[];
const image=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#D8A8BE"/><circle cx="300" cy="290" r="135" fill="#EAC572"/><path d="M0 800L600 430V800Z" fill="#29445D"/></svg>')).png().toBuffer();
async function api(route,body,actor=owner,expected=200,headers={}){const r=await fetch(base+'/api'+route,{method:body?'POST':'GET',headers:{...(actor?{cookie:actor.cookie}:{}),...(body?{'content-type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});const d=await r.json();assert.equal(r.status,expected,route+' '+JSON.stringify(d));return d;}
const catalog=(await api('/catalog/templates',undefined,null)).templates;for(const id of ids)assert(catalog.some(t=>t.id===id),id+' catalog');
for(const id of ids){
 let{design}=await api('/designs/designs',{source:{kind:'template',templateId:id},mutationId:randomUUID()},owner,201);
 const upload=await fetch(`${base}/api/designs/designs/${design.id}/assets`,{method:'POST',headers:{cookie:owner.cookie,'content-type':'image/png','x-mutation-id':randomUUID()},body:image});assert.equal(upload.status,201);const{asset}=await upload.json();
 design.document.assets.push({assetId:asset.id,kind:'image'});
 for(const e of design.document.elements){if(e.type==='image'&&e.props.optional){e.props.assetId=asset.id;e.accessibility.alt='Ảnh của chủ thiệp QA';}if(e.type==='interaction'&&e.props.photos)for(const slot of e.props.photos){slot.assetId=asset.id;slot.alt='Kỷ niệm tốt nghiệp';slot.caption='Một kỷ niệm có thể thay ảnh';}}
 Object.assign(design.document.bindings.recipientName,{value:'Khánh An'});Object.assign(design.document.bindings.senderName,{value:'Nguyễn Ánh'});Object.assign(design.document.bindings.message,{value:'Cảm ơn bạn đã cùng mình đi qua những năm tháng đáng nhớ. Hẹn gặp bạn trong ngày đặc biệt này. — Nguyễn Ánh'});
 design.document.personalization={version:1,mode:'list',names:[{row:2,name:'Khánh An'},{row:3,name:'Khánh An'}]};
 editInvitation(design.document,'zone','Asia/Ho_Chi_Minh');editInvitation(design.document,'date','2027-01-03T09:45');editInvitation(design.document,'venue','Hội trường Nguyễn Văn A, Hà Nội — địa điểm QA');
 const oldRevision=design.revision;
 await api(`/designs/designs/${design.id}/save`,{title:catalog.find(t=>t.id===id).title+' — QA',document:design.document,expectedRevision:oldRevision,mutationId:randomUUID()});
 await api(`/designs/designs/${design.id}/save`,{title:'stale write',document:design.document,expectedRevision:oldRevision,mutationId:randomUUID()},owner,409);
 design=(await api(`/designs/designs/${design.id}`)).design;
 const body={designId:design.id,expectedRevision:design.revision,expectedDocumentHash:design.documentHash,idempotencyKey:randomUUID(),access:{open:'link',send:'link',read:'sender'}};
 const{gift}=await api('/gifts/gifts/from-design',body,owner,201);const replay=await api('/gifts/gifts/from-design',body);assert.equal(replay.gift.id,gift.id);
 const{recipients}=await api(`/gifts/gifts/mine/${gift.slug}/recipients`);assert.equal(recipients.length,2);assert.notEqual(recipients[0].id,recipients[1].id);
 const q=new URL(recipients[0].url).search,q2=new URL(recipients[1].url).search;
 const endpoint='/gifts/gifts/'+gift.slug;
 const publicGift=(await api(endpoint+q,undefined,null)).gift;
 if(id==='graduation-mixtape'){
  const intent={intentId:randomUUID(),name:'Khánh An',message:'Lưu bút QA từ người nhận thứ nhất'};
  const a=await api(endpoint+'/replies'+q,intent,null,201),b=await api(endpoint+'/replies'+q,intent,null,201);assert.equal(a.reply.id,b.reply.id);
  await api(endpoint+'/replies'+q2,{...intent,intentId:randomUUID(),message:'Lưu bút QA từ người nhận thứ hai'},null,201);
  const replies=(await api(`/gifts/gifts/mine/${gift.slug}/replies`)).replies;assert.equal(replies.length,2);assert.notEqual(replies[0].id,replies[1].id);assert.deepEqual(new Set(replies.map(r=>r.recipientId)),new Set(recipients.map(r=>r.id)));
 }else{
  const input={status:'attending',partySize:2,note:'Mình sẽ đến — QA'};
  const a=await api(endpoint+'/rsvp'+q,input,null),b=await api(endpoint+'/rsvp'+q,input,null);assert.deepEqual(a.rsvp,b.rsvp);
  assert.equal((await api(endpoint+q2,undefined,null)).gift.rsvp.status,null);
  await api(endpoint+'/rsvp'+q2,{status:'declined',partySize:1,note:'Hẹn lần sau — QA'},null);
  const roster=(await api(`/gifts/gifts/mine/${gift.slug}/recipients`)).recipients;assert.equal(roster[0].rsvp.note,input.note);assert.equal(roster[1].rsvp.status,'declined');
 }
 const snapshot=JSON.stringify(publicGift.documentSnapshot);
 editInvitation(design.document,'date','2027-02-01T09:45');editInvitation(design.document,'venue','Đã đổi nháp sau khi gửi');
 await api(`/designs/designs/${design.id}/save`,{title:design.title,document:design.document,expectedRevision:design.revision,mutationId:randomUUID()});
 assert.equal(JSON.stringify((await api(endpoint+q,undefined,null)).gift.documentSnapshot),snapshot);
 rows.push({id,designId:design.id,editor:`${base}/design/${design.id}`,gift:gift.slug,url:recipients[0].url,secondUrl:recipients[1].url,sceneIds:design.document.scenes.map(s=>s.id),reloadedOwnerResult:true,snapshotPreserved:true,staleSaveRejected:true,publicationRetryIdempotent:true});console.log('API PASS',id);
}
fs.writeFileSync(process.env.DRIVE_QA_RESULT_FILE,JSON.stringify({base,rows},null,2));
