import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {loadEnvironment} from '../../src/shared/config.mjs';
import {startSfxFixture} from '../../tests/integration/sfx-fixture.mjs';
import {MySqlClient} from '../../src/infrastructure/mysql/client.mjs';
import {CanvasLibraryService} from '../../src/modules/designs/library.service.mjs';
import {createMotionRollout,MOTION_ROLLOUT_IDS} from '../../src/modules/designs/motion-rollout.mjs';
import {previewRollout,applyRollout} from '../../src/modules/designs/library-rollout.mjs';
import {canonicalStringify} from '../../web/js/shared/canvas/schema.js';
import {runAnimatedBrowser} from './animated-elements-browser.mjs';
const root=process.cwd(),out=path.join(root,'docs/animated-elements-50');fs.mkdirSync(out,{recursive:true});
const report={date:'2026-11-24',environment:'isolated local MySQL; synthetic accounts only',cases:[]};
loadEnvironment();process.env.TEST_ACCOUNT_ENABLED='false';
let fixture,client;
try{
 fixture=await startSfxFixture({sql:true,externalSql:true,port:4191,label:'animated-50'});
 const {request,base,connection}=fixture;
 const actor=await fixture.register('Người gửi chuyển động QA');
 async function api(route,body,status=200){const r=await request(route,{cookie:actor.cookie,body});assert.equal(r.status,status,route+JSON.stringify(r.data));return r.data;}
 const initial=(await api('/designs/library')).library.items;assert.equal(initial.filter(r=>r.kind==='element').length,293);report.freshDatabase={rows:initial.length,elements:293,newIds:initial.filter(r=>r.kind==='element'&&r.id.startsWith('motion-')).map(r=>r.id)};
 const legacy=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/motion-legacy-elements.json'))),heart=legacy.find(r=>r.id==='natural-motion-heart');
 await connection.execute("DELETE FROM canvas_library_items WHERE kind='element' AND id LIKE 'motion-%'");
 await connection.execute("UPDATE canvas_library_items SET revision=?,status=?,sort_order=?,definition=? WHERE kind='element' AND id=?",[heart.revision,heart.status,heart.sortOrder,JSON.stringify(heart.definition),heart.id]);
 const oldApi=(await api('/designs/library')).library.items;report.beforeApi={rows:oldApi.length,elements:oldApi.filter(r=>r.kind==='element').length,animation:oldApi.filter(r=>r.kind==='element'&&r.definition.visualKind==='animation').length};assert.equal(report.beforeApi.elements,243);assert.equal(report.beforeApi.animation,6);
 client=new MySqlClient();const service=new CanvasLibraryService(client),before=await service.rows(),bundle=createMotionRollout(before),admin={role:'admin'};
 fs.writeFileSync(path.join(out,'qa-update-bundle.json'),JSON.stringify(bundle,null,2)+'\n');assert(previewRollout(before,bundle).canApply);
 const controls=before.filter(r=>!MOTION_ROLLOUT_IDS.includes(r.id));
 const conflict=structuredClone(bundle);conflict.changes.find(c=>c.before).expectedFingerprint='bad';assert.throws(()=>previewRollout(before,conflict));
 const changed=structuredClone(before);changed.find(r=>r.id===heart.id).definition.title.vi='Admin riêng';assert(!previewRollout(changed,bundle).canApply);
 // A saved legacy draft and gift exist before the library is upgraded.
 let old=(await api('/designs/designs',{source:{kind:'blank'},mutationId:randomUUID()},201)).design;
 for(const [k,v]of Object.entries({recipientName:'Mai QA',senderName:'An QA',message:'Lời chúc từ phiên bản cũ'}))old.document.bindings[k].value=v;
 const oldModel=structuredClone(heart.definition.elements[0]),media=oldModel.props.assetId;
 const {builtinMedia}=await import('../../src/modules/designs/builtin-media.mjs');
 const upload=await request(`/designs/designs/${old.id}/assets`,{cookie:actor.cookie,bytes:builtinMedia(media).bytes,headers:{'content-type':'image/webp','x-mutation-id':randomUUID()}});assert.equal(upload.status,201);
 oldModel.props.assetId=upload.data.asset.id;old.document.schemaVersion=old.document.registryVersion=2;old.document.elements=[oldModel];old.document.scenes[0].elementIds=[oldModel.id];old.document.assets=[{assetId:oldModel.props.assetId,kind:'image'}];
 await api(`/designs/designs/${old.id}/save`,{title:old.title,document:old.document,expectedRevision:old.revision,mutationId:randomUUID()});old=(await api(`/designs/designs/${old.id}`)).design;
 const oldGift=(await api('/gifts/gifts/from-design',{designId:old.id,expectedRevision:old.revision,expectedDocumentHash:old.documentHash,idempotencyKey:randomUUID()},201)).gift;
 const oldPublic=await api('/gifts/gifts/'+oldGift.slug),oldDraft=canonicalStringify(old.document);
 const partial=await applyRollout(service,admin,bundle,{stopAfter:10});assert(partial.interrupted);assert.equal(partial.applied.length,10);
 const resumed=await applyRollout(service,admin,bundle);assert(resumed.canApply&&!resumed.conflict);assert.equal(resumed.applied.length,41);assert.equal((await applyRollout(service,admin,bundle)).applied.length,0);
 const after=await service.rows();for(const c of controls)assert.deepEqual(after.find(r=>r.kind===c.kind&&r.id===c.id),c);
 const rollback=await applyRollout(service,admin,bundle,{rollback:true});assert(rollback.canApply&&!rollback.conflict);assert.equal(rollback.applied.length,51);assert.equal((await applyRollout(service,admin,bundle,{rollback:true})).applied.length,0);
 const restored=await service.rows();for(const r of before)assert.deepEqual(restored.find(x=>x.kind===r.kind&&x.id===r.id).definition,r.definition);
 // A new review uses current rollback revisions rather than rewriting history.
 const reapply=createMotionRollout(restored);const reapplied=await applyRollout(service,admin,reapply);assert(reapplied.canApply&&!reapplied.conflict);assert.equal(reapplied.applied.length,51);
 assert.equal(canonicalStringify((await api(`/designs/designs/${old.id}`)).design.document),oldDraft);const publicAfter=await api('/gifts/gifts/'+oldGift.slug);assert(oldPublic.gift.documentSnapshot);assert.deepEqual(publicAfter.gift.documentSnapshot,oldPublic.gift.documentSnapshot);
 const finalApi=(await api('/designs/library')).library.items;
 const adminActor=await fixture.register('Admin duyệt chuyển động QA');await connection.execute("UPDATE users SET role='admin' WHERE id=?",[adminActor.user.id]);
 const previews=[];for(const row of finalApi.filter(r=>r.kind==='element'&&r.id.startsWith('motion-'))){const response=await request('/designs/admin/library/preview/element/'+row.id,{cookie:adminActor.cookie,body:{definition:row.definition}});assert.equal(response.status,200,JSON.stringify(response.data));assert.equal(response.data.document.schemaVersion,4);assert.equal(response.data.document.elements[0].motions.rows.length,2);previews.push({id:row.id,document:response.data.document});}
 report.adminPreview={count:previews.length,readOnly:true,schemaVersion:4};fs.writeFileSync(path.join(root,'local/animated-elements-50/admin-previews.json'),JSON.stringify(previews));
report.afterApi={rows:finalApi.length,elements:finalApi.filter(r=>r.kind==='element').length,animation:finalApi.filter(r=>r.kind==='element'&&r.definition.visualKind==='animation').length,newIds:finalApi.filter(r=>r.kind==='element'&&r.id.startsWith('motion-')).map(r=>r.id)};
 assert.equal(report.afterApi.newIds.length,50);assert.equal(new Set(report.afterApi.newIds).size,50);
 report.rollout={scope:51,interrupted:10,resumed:41,rerun:0,rollback:51,rollbackRerun:0,reapply:51,unrelatedRowsPreserved:controls.length,conflictRejected:true,legacyDraftPreserved:true,legacyGiftPreserved:true};
 report.base=base;report.fixture=fixture.directory;report.database=process.env.MYSQL_DATABASE;
 fs.writeFileSync(path.join(root,'local/animated-elements-50/session.json'),JSON.stringify({base,cookie:actor.cookie,oldDesignId:old.id,oldGiftSlug:oldGift.slug,fixture:fixture.directory,database:report.database},null,2));
 console.log('PASS MySQL fresh seed, API 243→293 elements / 6→56 motion cards, scoped rollout 10+41, rerun, conflicts, rollback and legacy snapshots.');
 await runAnimatedBrowser({base,cookie:actor.cookie,out,report,api,oldDesignId:old.id,oldGiftSlug:oldGift.slug});
 report.passed=true;console.log('PASS animated elements browser.');
}catch(error){report.failure={message:error.message,stack:error.stack};console.error(error.stack);process.exitCode=1;}
finally{
 fs.writeFileSync(path.join(out,'qa-report.json'),JSON.stringify(report,null,2)+'\n');await client?.close();
 if(process.argv.includes('--serve')&&fixture){console.log('QA_REVIEW_URL='+fixture.base);process.stdin.resume();}else await fixture?.close();
}
