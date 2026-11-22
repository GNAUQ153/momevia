import { builtinMedia } from '../../src/modules/designs/builtin-media.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {createElement} from '../../web/js/shared/canvas/registry.js';
import {publicDocument} from '../../web/js/shared/canvas/schema.js';
const root=path.resolve('local/interactive-cards-20261122'),{base,cookie}=JSON.parse(fs.readFileSync(path.join(root,'final/session.json')));
const results=[];
async function request(route,body,expected=200,actor=cookie){const response=await fetch(base+'/api'+route,{method:body?'POST':'GET',headers:{cookie:actor,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const value=await response.json();assert.equal(response.status,expected,JSON.stringify(value));return value;}
try{
 for(const sourceId of ['sunny-wishes','confetti']){
  const target=sourceId==='sunny-wishes'?'confetti':'sunny-wishes';
  const trial=await request('/designs/template-trial',{templateId:sourceId});
  let {design}=await request('/designs/designs',{source:trial.source,mutationId:randomUUID(),trialBindings:{recipientName:'Trần Phương Thảo',senderName:'Bạn đồng hành',message:'Một lời nhắn của riêng mình.'}},201);
  const original=structuredClone(design);
  const duplicated=(await request(`/designs/designs/${design.id}/duplicate`,{mutationId:randomUUID()},201)).design;
  const duplicatePreview=await request(`/designs/designs/${duplicated.id}/restyle/preview`,{targetTemplateId:target,expectedRevision:duplicated.revision,expectedDocumentHash:duplicated.documentHash});assert.deepEqual(duplicatePreview.missing,[]);assert.equal(duplicatePreview.document.bindings.message.value,design.document.bindings.message.value);
  const previewInput={targetTemplateId:target,expectedRevision:design.revision,expectedDocumentHash:design.documentHash};
  const preview=await request(`/designs/designs/${design.id}/restyle/preview`,previewInput);
  assert.equal(preview.document.bindings.message.value,design.document.bindings.message.value);assert.deepEqual(preview.missing,[]);
  const command={...previewInput,targetTemplateVersionId:preview.plan.targetVersion,planHash:preview.planHash,mutationId:randomUUID()};
  const first=await request(`/designs/designs/${design.id}/restyle`,command,201);const retry=await request(`/designs/designs/${design.id}/restyle`,command,201);
  assert.equal(first.design.id,retry.design.id);assert.notEqual(first.design.id,design.id);assert.equal(first.design.source.templateId,target);assert.equal(first.design.source.templateVersionId,preview.plan.targetVersion);assert.equal(first.design.policy.kind,'sender-basic');
  assert.deepEqual((await request('/designs/designs/'+design.id)).design,original);
  await request(`/designs/designs/${design.id}/save`,{expectedRevision:design.revision,mutationId:randomUUID(),title:design.title,document:{...design.document,bindings:{...design.document.bindings,message:{type:'text',value:'Sửa ở tab khác'}}}});
  await request(`/designs/designs/${design.id}/restyle`,{...command,mutationId:randomUUID()},409);
  assert.equal((await request(`/designs/designs/${design.id}/restyle`,command,201)).design.id,first.design.id);
  design=(await request('/designs/designs/'+design.id)).design;
  const bytes=await sharp({create:{width:64,height:48,channels:3,background:'#AA5744'}}).png().toBuffer();
  const uploaded=await fetch(`${base}/api/designs/designs/${design.id}/assets`,{method:'POST',headers:{cookie,'content-type':'image/png','x-mutation-id':randomUUID()},body:bytes});assert.equal(uploaded.status,201);const asset=(await uploaded.json()).asset;
  const image=createElement('image',{id:'private-photo',props:{assetId:asset.id},accessibility:{alt:'Ảnh fixture riêng'}});
  design.document.assets.push({assetId:asset.id,kind:'image'});design.document.elements.push(image);design.document.scenes[0].elementIds.push(image.id);
  await request(`/designs/designs/${design.id}/save`,{expectedRevision:design.revision,mutationId:randomUUID(),title:design.title,document:design.document});design=(await request('/designs/designs/'+design.id)).design;
  const pi={targetTemplateId:target,expectedRevision:design.revision,expectedDocumentHash:design.documentHash},p=await request(`/designs/designs/${design.id}/restyle/preview`,pi);assert(p.missing.includes('photo:private-photo'));
  const lossy={...pi,targetTemplateVersionId:p.plan.targetVersion,planHash:p.planHash,mutationId:randomUUID()};await request(`/designs/designs/${design.id}/restyle`,lossy,422);const accepted=await request(`/designs/designs/${design.id}/restyle`,{...lossy,acceptMissing:true},201);assert(!accepted.design.document.assets.some(a=>a.assetId===asset.id));
  assert.deepEqual((await request('/designs/designs/'+design.id)).design.document,design.document);
  await request(`/designs/designs/${design.id}/restyle/preview`,{...pi,targetTemplateId:'proud-of-you'},422);
  results.push({direction:`${sourceId} → ${target}`,sourceId:design.id,newId:first.design.id,carried:preview.carried,sourceVersion:design.source.templateVersionId,targetVersion:preview.plan.targetVersion,duplicatedDraftRolesPreserved:true,retryOneDraft:true,staleTab409:true,missingPrivatePhotoRequiresConfirmation:true,originalIntact:true});
 }
 // Published fixture from the exact old V2 and a V1, then source edits. Public
 // snapshots must remain byte-for-byte identical after new-template creation.
 const legacyRows=JSON.parse(fs.readFileSync('tests/fixtures/interactive-cards-v2-before.json'));
 for(const [label,document]of [['v1',JSON.parse(fs.readFileSync('tests/fixtures/canvas-v1.json'))],['old-v2',structuredClone(legacyRows.find(r=>r.id==='proud-of-you').definition.documents.vi)]]){
  let {design}=await request('/designs/designs',{source:{kind:'blank'},mutationId:randomUUID()},201);
  for(const b of Object.values(document.bindings))b.value='Nội dung fixture cũ';
  // Materialize old artwork through a temporary current draft; never put a
  // shared builtin ID into a Sender-owned document.
  if(document.assets.length){
   const oldId=document.assets[0].assetId,bytes=builtinMedia(oldId).bytes;
   const upload=await fetch(`${base}/api/designs/designs/${design.id}/assets`,{method:'POST',headers:{cookie,'content-type':'image/webp','x-mutation-id':randomUUID()},body:bytes});assert.equal(upload.status,201);const newId=(await upload.json()).asset.id;
   document.assets[0].assetId=newId;for(const e of document.elements)if(e.type==='image'&&e.props.assetId===oldId)e.props.assetId=newId;
  }
  await request(`/designs/designs/${design.id}/save`,{expectedRevision:design.revision,mutationId:randomUUID(),title:label,document});design=(await request('/designs/designs/'+design.id)).design;
  const {gift}=await request('/gifts/gifts/from-design',{designId:design.id,expectedRevision:design.revision,expectedDocumentHash:design.documentHash,idempotencyKey:randomUUID()},201);
  assert.deepEqual((await request('/gifts/gifts/'+gift.slug)).gift.documentSnapshot,publicDocument(document));
  const snapshot=structuredClone(publicDocument(document));document.bindings.message.value='Sửa nháp sau khi gửi';await request(`/designs/designs/${design.id}/save`,{expectedRevision:design.revision,mutationId:randomUUID(),title:label,document});
  assert.deepEqual((await request('/gifts/gifts/'+gift.slug)).gift.documentSnapshot,snapshot);results.push({legacy:label,slug:gift.slug,snapshotPreserved:true});
 }
 console.log('PASS both restyle directions, target provenance, source CAS, retry, private-photo loss confirmation, and immutable V1/old-V2 fixtures');
}catch(error){results.push({failure:error.message,stack:error.stack});process.exitCode=1;console.error(error.stack);}
finally{fs.writeFileSync(path.join(root,'final/api-report.json'),JSON.stringify(results,null,2));}
