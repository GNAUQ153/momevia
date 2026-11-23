import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import {execFileSync} from 'node:child_process';
import { startSfxFixture } from '../../tests/integration/sfx-fixture.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=path.join(root,'local/sfx-qa/performance-'+Date.now());fs.mkdirSync(out,{recursive:true});
const fixtures=[],report={baselineCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),configuration:{viewport:'390×844',dpr:1,cpuSlowdown:4,network:{latencyMs:100,downloadBytesPerSecond:200000,uploadBytesPerSecond:93750},cache:'disabled',runs:5,targetLcpMs:2600,observationMsAfterLoad:4500},samples:[]};let context;
try{
 const baselineIndex=process.argv.indexOf('--baseline');let before=null,previous;
 if(baselineIndex>=0){report.baselineMeasurementsFrom=path.resolve(process.argv[baselineIndex+1]);previous=JSON.parse(fs.readFileSync(report.baselineMeasurementsFrom,'utf8'));assert.equal(previous.baselineCommit,report.baselineCommit);assert.deepEqual(previous.configuration,report.configuration);const samples=previous.samples.filter(s=>s.label==='before');assert.equal(samples.length,35);report.samples.push(...samples);}
 else{before=await startSfxFixture({baseline:true,label:'perf-baseline',baselineCommit:report.baselineCommit});fixtures.push(before);}
 const after=await startSfxFixture({label:'perf-sfx'});fixtures.push(after);
 context=await chromium.launchPersistentContext(path.join(out,'chrome-lab-profile'),{channel:'chrome',headless:true,viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:'vi-VN'});report.browser=context.browser().version();
 if(previous)assert.equal(previous.browser,report.browser);
 const page=await context.newPage(),cdp=await context.newCDPSession(page),requests=[];await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:100,downloadThroughput:200000,uploadThroughput:93750});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 cdp.on('Network.requestWillBeSent',e=>requests.push({id:e.requestId,url:e.request.url,bytes:0}));cdp.on('Network.loadingFinished',e=>{const r=requests.find(r=>r.id===e.requestId);if(r)r.bytes=e.encodedDataLength;});
 await page.addInitScript(()=>{globalThis.localStorage.setItem('momevia-locale','vi');globalThis.__perf={lcp:0,cls:0};new globalThis.PerformanceObserver(list=>{for(const e of list.getEntries())globalThis.__perf.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});new globalThis.PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)globalThis.__perf.cls+=e.value;}).observe({type:'layout-shift',buffered:true});});
 const routes=['/explore',...['hai-phong-bi','birthday-radiance','proud-of-you','loi-moi-ben-hien','cuon-phim-ngay-ay','ban-do-ngay-ra-truong'].map(id=>'/template/'+id)];
 for(const route of routes)for(let run=1;run<=5;run++)for(const [label,fixture]of (before?[['before',before],['after',after]]:[['after',after]])){
  requests.length=0;await page.goto(fixture.base+route);await page.locator('#main h1').first().waitFor();await page.waitForTimeout(4500);const value=await page.evaluate(()=>globalThis.__perf),audioRequests=requests.filter(r=>/\/sfx(?:\/|$)|\.(?:wav|mp3)(?:\?|$)/.test(r.url)).length;assert.equal(audioRequests,0);report.samples.push({label,route,run,...value,audioRequests,bytes:requests.reduce((n,r)=>n+r.bytes,0)});console.log(`${label} ${route} ${run}: LCP ${Math.round(value.lcp)} ms CLS ${value.cls.toFixed(4)} audio=0`);
 }
 const median=values=>values.slice().sort((a,b)=>a-b)[Math.floor(values.length/2)];report.routes=routes.map(route=>{const before=report.samples.filter(r=>r.route===route&&r.label==='before'),after=report.samples.filter(r=>r.route===route&&r.label==='after');return {route,beforeLcpMedian:median(before.map(r=>r.lcp)),afterLcpMedian:median(after.map(r=>r.lcp)),beforeBytesMedian:median(before.map(r=>r.bytes)),afterBytesMedian:median(after.map(r=>r.bytes)),afterLcpMax:Math.max(...after.map(r=>r.lcp)),afterClsMax:Math.max(...after.map(r=>r.cls))};});report.passed=report.samples.filter(r=>r.label==='after').every(r=>r.lcp>0&&r.lcp<2600&&r.cls<=.1&&r.audioRequests===0);if(!report.passed)process.exitCode=1;
}catch(error){report.error=error.stack;console.error(error.stack);process.exitCode=1;}
finally{await context?.close();for(const fixture of fixtures.reverse())await fixture.close();fs.writeFileSync(path.join(out,'performance.json'),JSON.stringify(report,null,2));console.log('SFX_PERFORMANCE_REPORT='+out);}
