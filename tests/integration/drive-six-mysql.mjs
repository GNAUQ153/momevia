import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{fileURLToPath}from'node:url';import{execFile}from'node:child_process';import{promisify}from'node:util';
import{startSfxFixture}from'./sfx-fixture.mjs';import{CanvasLibraryService}from'../../src/modules/designs/library.service.mjs';import{builtinLibraryItems}from'../../src/modules/designs/library.seed.mjs';
import{buildDriveLibraryRollout,planDriveLibraryRollout,applyDriveLibraryRollout,driveFingerprint,DRIVE_LIBRARY_KEYS,PAPER_LIBRARY_KEYS}from'../../src/modules/designs/drive-library-rollout.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const reviewedPath=process.argv.find(a=>a.startsWith('--reviewed='))?.slice(11);if(!reviewedPath)throw new Error('Pass --reviewed=<immutable reviewed library export>');
const reviewed=JSON.parse(fs.readFileSync(path.resolve(reviewedPath),'utf8'));
const paperScope=process.argv.includes('--paper'),scopeKeys=paperScope?PAPER_LIBRARY_KEYS:DRIVE_LIBRARY_KEYS;const bundle=buildDriveLibraryRollout(reviewed,builtinLibraryItems(),{scope:paperScope?'paper':'drive'}),completed=[];
const fixture=await startSfxFixture({sql:true,label:'drive-six-mysql'}),conn=fixture.connection;
const client={execute:(...args)=>conn.execute(...args),withTransaction:async fn=>{await conn.beginTransaction();try{const r=await fn(client);await conn.commit();return r;}catch(e){await conn.rollback();throw e;}}};
const library=new CanvasLibraryService(client),admin={role:'admin'},owner=await fixture.register('Drive MySQL QA');
const runtime=path.join(root,'local/drive-six-20261127/mysql-runtime.json'),resultFile=path.join(root,'local/drive-six-20261127/mysql-six-links.json');
try{
 fs.mkdirSync(path.dirname(runtime),{recursive:true});fs.writeFileSync(runtime,JSON.stringify({base:fixture.base,owner,directory:fixture.directory,testFixture:'drive-six-mysql'}));
 // Fresh database follows the normal API and publication paths for all six templates.
 await promisify(execFile)(process.execPath,[path.join(root,'tests/integration/fixtures/drive-six-prepare.mjs')],{cwd:root,env:{...process.env,DRIVE_QA_RUNTIME:runtime,DRIVE_QA_RESULT_FILE:resultFile},windowsHide:true,timeout:120000});completed.push('fresh MySQL: six sender/recipient/owner journeys, same-name identity, save CAS, reply/RSVP, publication replay and snapshots');
 const links=JSON.parse(fs.readFileSync(resultFile));const snapshots=await Promise.all(links.rows.map(async row=>{const q=new URL(row.url).search;const r=await fixture.request('/gifts/gifts/'+row.gift+q);assert.equal(r.status,200);return JSON.stringify(r.data.gift.documentSnapshot);}));
 const actualNow=Date.now;
 try{Date.now=()=>Date.parse('2027-01-03T02:45:00.000Z')+1;
  for(const row of links.rows.filter(r=>r.id!=='graduation-mixtape')){const endpoint='/gifts/gifts/'+row.gift,q=new URL(row.url).search;const view=await fixture.request(endpoint+q);assert.equal(view.status,200);assert.equal(view.data.gift.rsvp.canRespond,false);const closed=await fixture.request(endpoint+'/rsvp'+q,{body:{status:'attending',partySize:1,note:'Too late'}});assert.equal(closed.status,409);}
 }finally{Date.now=actualNow;}
 completed.push('all five attendance cards remain readable after event time and reject late RSVP without erasing saved responses');
 // A populated QA library from the reviewed pre-change export, with an Admin-owned edit outside this rollout.
 await conn.execute('DELETE FROM canvas_library_history');await conn.execute('DELETE FROM canvas_library_items');
 for(const r of reviewed)await conn.execute('INSERT INTO canvas_library_items(kind,id,revision,status,sort_order,definition) VALUES (?,?,?,?,?,?)',[r.kind,r.id,r.revision,r.status,r.sortOrder,JSON.stringify(r.definition)]);
 let old=(await library.rows()).find(r=>r.kind==='template'&&r.id==='proud-of-you');
 await library.put(admin,old.kind,old.id,{expectedRevision:old.revision,definition:{...old.definition,title:{vi:'Bản Admin QA giữ nguyên',en:'Preserved Admin QA edition'}}});
 const outside=(await library.rows()).filter(r=>!scopeKeys.includes(r.kind+':'+r.id)).map(driveFingerprint);
 await library.ready();assert.deepEqual((await library.rows()).filter(r=>!scopeKeys.includes(r.kind+':'+r.id)).map(driveFingerprint),outside);completed.push('existing library bootstrap preserves Admin edits and does not silently replace reviewed rows');
 // Exercise a row whose definition actually changes in this reviewed rollout.
 // Bumping an already identical Garden row can legitimately match a retry.
 const changed=bundle.changes.find(c=>c.before&&driveFingerprint(c.before.definition)!==driveFingerprint(c.next.definition));assert(changed,'The test rollout must contain a changed definition');
 await conn.execute('UPDATE canvas_library_items SET revision=revision+1 WHERE kind=? AND id=?',[changed.before.kind,changed.before.id]);
 const conflict=planDriveLibraryRollout(await library.rows(),bundle);assert.equal(conflict.canApply,false);assert.equal(conflict.actions.find(a=>a.key===changed.before.kind+':'+changed.before.id).status,'conflict');
 const refused=await applyDriveLibraryRollout(library,admin,bundle);assert.deepEqual(refused.applied,[]);
 // Reset only this intentionally simulated QA revision before exercising the approved baseline.
 await conn.execute('UPDATE canvas_library_items SET revision=revision-1 WHERE kind=? AND id=?',[changed.before.kind,changed.before.id]);completed.push('concurrent revision mismatch blocks the entire scoped update before any write');
 const applied=await applyDriveLibraryRollout(library,admin,bundle);assert(applied.canApply);assert.equal(applied.applied.length,scopeKeys.length);
 assert.deepEqual((await library.rows()).filter(r=>!scopeKeys.includes(r.kind+':'+r.id)).map(driveFingerprint),outside);
 const again=await applyDriveLibraryRollout(library,admin,bundle);assert(again.canApply);assert.deepEqual(again.applied,[]);
 const row=(await library.rows()).find(r=>r.kind==='template'&&r.id==='garden-tea');await assert.rejects(library.put(admin,row.kind,row.id,{expectedRevision:row.revision-1,definition:row.definition}),{code:'LIBRARY_REVISION_CONFLICT'});
 completed.push('Scoped reviewed items apply through CAS/history; retry is unchanged; stale API update is rejected; outside rows byte-identical');
 // Rollback first removes the five new choices from this isolated Catalog.
 // Saved drafts and gifts keep their independent documents and media.
 const newIds=links.rows.filter(r=>r.id!=='garden-tea').map(r=>r.id);
 for(const id of newIds)await conn.execute("UPDATE templates SET status='rejected',payload=JSON_SET(payload,'$.status','rejected') WHERE id=?",[id]);
 const visible=(await fixture.request('/catalog/templates')).data.templates;assert(newIds.every(id=>!visible.some(t=>t.id===id)));
 const rollback=await applyDriveLibraryRollout(library,admin,bundle,{rollback:true});assert(rollback.canApply);assert.equal(rollback.applied.length,scopeKeys.length);
 const rollbackAgain=await applyDriveLibraryRollout(library,admin,bundle,{rollback:true});assert(rollbackAgain.canApply);assert.deepEqual(rollbackAgain.applied,[]);
 for(const change of bundle.changes){const row=(await library.rows()).find(r=>r.kind===change.next.kind&&r.id===change.next.id);if(change.before){assert.deepEqual(row.definition,change.before.definition);assert.equal(row.status,change.before.status);}else assert.equal(row.status,'disabled');}
 for(const[index,row]of links.rows.entries()){const r=await fixture.request('/gifts/gifts/'+row.gift+new URL(row.url).search);assert.equal(r.status,200);assert.equal(JSON.stringify(r.data.gift.documentSnapshot),snapshots[index]);const d=await fixture.request('/designs/designs/'+row.designId,{cookie:owner.cookie});assert.equal(d.status,200);}
 const[history]=await conn.execute('SELECT kind,id,revision FROM canvas_library_history');assert(history.some(r=>r.id==='garden-tea'));
 completed.push('rollback restores the reviewed definitions/statuses (disables only rows absent from baseline), is repeatable and preserves every saved draft/published snapshot');
 fs.writeFileSync(path.join(root,'local/drive-six-20261127/mysql-results.json'),JSON.stringify({completed,storage:'Docker MySQL 8.4, random schema, loopback binding, destroyed after test',scopedItems:scopeKeys.length},null,2));console.log(JSON.stringify({passed:completed},null,2));
}finally{await fixture.close();}
