import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {loadEnvironment} from '../../src/shared/config.mjs';
import {startSfxFixture} from '../../tests/integration/sfx-fixture.mjs';
import {createElement} from '../../web/js/shared/canvas/registry.js';
const root=process.cwd(),out=path.resolve('docs/animated-elements-50'),session=JSON.parse(fs.readFileSync('local/animated-elements-50/session.json'));loadEnvironment();
const fixture=await startSfxFixture({sql:true,externalSql:true,baseline:true,baselineCommit:execFileSync('git',['rev-parse','527e646'],{encoding:'utf8'}).trim(),label:'animated-50-network-before'}),browser=await chromium.launch({channel:'chrome',headless:true}),report={profile:{viewport:'390x844',cpuSlowdown:4,coldContexts:true,cacheDisabled:true,network:'local loopback, no bandwidth emulation',samples:3},samples:[]};
try{
 const owner=await fixture.register('Network baseline QA');
 for(const [version,base,cookie]of [['before',fixture.base,owner.cookie],['after',session.base,session.cookie]]){
  const api=async(route,body,status=200)=>{const r=await fetch(base+'/api'+route,{method:body?'POST':'GET',headers:{cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined}),v=await r.json();assert.equal(r.status,status,JSON.stringify(v));return v;};
  const {design}=await api('/designs/designs',{source:{kind:'blank'},mutationId:randomUUID()},201);
  const sample=(await api('/designs/designs',{source:{kind:'blank'},mutationId:randomUUID()},201)).design;sample.document.schemaVersion=sample.document.registryVersion=2;
  for(const key of ['recipientName','senderName','message'])sample.document.bindings[key].value='Synthetic network QA';sample.document.elements=Array.from({length:10},(_,i)=>createElement('shape',{id:'network-'+i,layout:{x:20+(i%2)*180,y:20+Math.floor(i/2)*150,width:100,height:100},effects:{emphasis:{id:'A01'}},props:{color:i%2?'#C7A8D9':'#E8B7CD'}}));sample.document.scenes[0].elementIds=sample.document.elements.map(e=>e.id);
  await api(`/designs/designs/${sample.id}/save`,{title:sample.title,document:sample.document,expectedRevision:sample.revision,mutationId:randomUUID()});const saved=(await api('/designs/designs/'+sample.id)).design,gift=(await api('/gifts/gifts/from-design',{designId:saved.id,expectedRevision:saved.revision,expectedDocumentHash:saved.documentHash,idempotencyKey:randomUUID()},201)).gift;
  report[version+'Library']=(await api('/designs/library')).library.items.reduce((v,r)=>(v.rows++,v.elements+=r.kind==='element'?1:0,v),{rows:0,elements:0});
  for(const type of ['library','legacy-gift'])for(let run=0;run<3;run++){
   const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'no-preference'}),split=cookie.indexOf('=');if(type==='library')await context.addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:base}]);const page=await context.newPage(),cdp=await context.newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
   const started=Date.now();await page.goto(base+(type==='library'?'/design/'+design.id:'/g/'+gift.slug));
   if(type==='library'){await page.locator('.editor-artboard').waitFor();await page.locator('[data-editor-action="sheet-library"]').click();await page.locator('[data-block="natural-motion-heart"]').waitFor();}
   else await page.locator('.gift-runtime-stage [data-runtime-element]').first().waitFor();
   await page.waitForTimeout(500);const resources=await page.evaluate(()=>[...performance.getEntriesByType('navigation'),...performance.getEntriesByType('resource')].map(r=>({path:new URL(r.name).pathname,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize,decodedBodySize:r.decodedBodySize})));report.samples.push({version,type,run,readyMs:Date.now()-started,requests:resources.length,transferBytes:resources.reduce((n,r)=>n+r.transferSize,0),encodedBodyBytes:resources.reduce((n,r)=>n+r.encodedBodySize,0),resources});await context.close();
  }
 }
 report.passed=true;console.log(JSON.stringify(report.samples.map(({resources,...s})=>s),null,2));
}catch(e){report.failure=e.stack;console.error(e.stack);process.exitCode=1;}finally{await browser.close();await fixture.close();fs.writeFileSync(path.join(out,'network-before-after.json'),JSON.stringify(report,null,2)+'\n');process.chdir(root);}
