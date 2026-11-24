import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {loadEnvironment} from '../../src/shared/config.mjs';
import {MySqlClient,resolveMysqlConfig} from '../../src/infrastructure/mysql/client.mjs';
import {libraryFingerprint} from '../../src/modules/designs/library-live-review.mjs';
import {builtinMedia} from '../../src/modules/designs/builtin-media.mjs';
import {runAnimatedBrowser} from './animated-elements-browser.mjs';

loadEnvironment();const cfg=resolveMysqlConfig(),base='http://localhost:4100',out=path.resolve('docs/animated-elements-live-20261124'),privateDir=path.resolve('database/private/animated-elements-live-20261124');
if(cfg.host!=='127.0.0.1'||cfg.port!==3306||cfg.database!=='momevia_dev'||!fs.existsSync(path.join(privateDir,'state.json')))throw new Error('Reviewed local backup required');
fs.mkdirSync(out,{recursive:true});const db=new MySqlClient(),report={base,target:{host:cfg.host,port:cfg.port,database:cfg.database},syntheticAccount:true};
try{
 const email='motion-live-'+randomUUID()+'@example.test',password='MotionLocalReview2026',r=await fetch(base+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Người gửi kiểm tra 50 mẫu',email,password,confirmPassword:password})}),account=await r.json();assert.equal(r.status,201,JSON.stringify(account));const cookie=r.headers.get('set-cookie').split(';')[0];
 const api=async(route,body,status=200)=>{const res=await fetch(base+'/api'+route,{method:body?'POST':'GET',headers:{cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined}),value=await res.json();assert.equal(res.status,status,route+JSON.stringify(value));return value;};
 const library=(await api('/designs/library')).library.items;assert.equal(library.filter(r=>r.kind==='element').length,293);assert.equal(library.filter(r=>r.kind==='element'&&r.id.startsWith('motion-')).length,50);report.library={rows:library.length,elements:293,newIds:50,motion:library.filter(r=>r.kind==='element'&&r.definition.visualKind==='animation').length};
 let old=(await api('/designs/designs',{source:{kind:'blank'},mutationId:randomUUID()},201)).design;
 for(const [k,v]of Object.entries({recipientName:'Mai kiểm tra',senderName:'An kiểm tra',message:'Lời chúc kiểm tra tương thích trên MySQL cục bộ'}))old.document.bindings[k].value=v;
 const legacy=JSON.parse(fs.readFileSync('tests/fixtures/motion-legacy-elements.json')).find(r=>r.id==='natural-motion-heart').definition.elements[0],model=structuredClone(legacy),media=builtinMedia(model.props.assetId);
 const upload=await fetch(base+'/api/designs/designs/'+old.id+'/assets',{method:'POST',headers:{cookie,'content-type':'image/webp','x-mutation-id':randomUUID()},body:media.bytes}),uploaded=await upload.json();assert.equal(upload.status,201,JSON.stringify(uploaded));model.props.assetId=uploaded.asset.id;
 old.document.schemaVersion=old.document.registryVersion=2;old.document.elements=[model];old.document.scenes[0].elementIds=[model.id];old.document.assets=[{assetId:model.props.assetId,kind:'image'}];
 await api('/designs/designs/'+old.id+'/save',{title:old.title,document:old.document,expectedRevision:old.revision,mutationId:randomUUID()});old=(await api('/designs/designs/'+old.id)).design;
 const gift=(await api('/gifts/gifts/from-design',{designId:old.id,expectedRevision:old.revision,expectedDocumentHash:old.documentHash,idempotencyKey:randomUUID()},201)).gift;
 const session={base,cookie,email,password,userId:account.user.id,oldDesignId:old.id,oldGiftSlug:gift.slug};fs.writeFileSync(path.join(privateDir,'review-session.json'),JSON.stringify(session,null,2));
 await runAnimatedBrowser({...session,out,report,api});
 const before=JSON.parse(fs.readFileSync(path.join(privateDir,'business-before-browser.json'))),preserved=[];
 for(const [table,value]of Object.entries(before)){const [rows]=await db.execute(`SELECT * FROM \`${table}\``),hashes=new Set(rows.map(libraryFingerprint));assert(value.hashes.every(hash=>hashes.has(hash)),'Existing rows changed: '+table);preserved.push({table,existingRows:value.count,addedRows:rows.length-value.count});}
 report.existingRowsPreserved=preserved;report.passed=true;console.log('PASS actual momevia_dev: 50 Studio insertions, preview, saved/public snapshots, two-motion heart and all pre-existing non-library rows preserved.');
}catch(e){report.failure={message:e.message,stack:e.stack};console.error(e.stack);process.exitCode=1;}finally{await db.close();fs.writeFileSync(path.join(out,'local-live-browser.json'),JSON.stringify(report,null,2)+'\n');}
