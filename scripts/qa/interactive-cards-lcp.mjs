import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const root=path.resolve('local/interactive-cards-20261122'),out=path.resolve('local/lcp-20261122');fs.mkdirSync(out,{recursive:true});
const {base}=JSON.parse(fs.readFileSync(path.join(root,'final/session.json'))),runs=Number(process.env.LCP_RUNS||5),label=process.env.LCP_LABEL||'after';
const targetMs=Number(process.env.LCP_TARGET_MS||2600);assert(Number.isFinite(targetMs)&&targetMs>0);
assert(/^[a-z0-9-]+$/.test(label));assert(Number.isInteger(runs)&&runs>=1&&runs<=5);
const ids=['hai-phong-bi','birthday-radiance','proud-of-you','loi-moi-ben-hien','cuon-phim-ngay-ay','ban-do-ngay-ra-truong'];
const routes=process.env.LCP_ROUTES?.split(',')||['/explore',...ids.map(id=>'/template/'+id)];
const context=await chromium.launchPersistentContext(path.join(root,'chrome-lab-profile'),{channel:'chrome',headless:true,viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:'vi-VN'});
const report={browser:context.browser().version(),configuration:{profile:'chrome-lab-profile',viewport:'390×844',uiLocale:'vi',dpr:1,cpuSlowdown:4,network:{latencyMs:100,downloadBytesPerSecond:200000,uploadBytesPerSecond:93750},cache:'disabled',runs,targetLcpMs:targetMs,observationMsAfterLoad:4500,byteMethod:'CDP encoded bytes, includes main document, cross-origin HTTP and partial responses; excludes data URIs'},cases:[],errors:[]};
try{
 const page=await context.newPage(),cdp=await context.newCDPSession(page),network=new Map();
 page.on('pageerror',error=>report.errors.push(error.message));
 cdp.on('Network.requestWillBeSent',({requestId,request,type})=>{const u=new URL(request.url);if(['http:','https:'].includes(u.protocol))network.set(requestId,{name:u.pathname,type,bytes:0,partialBytes:0});});
 cdp.on('Network.responseReceived',({requestId,response})=>{const r=network.get(requestId);if(r){r.status=response.status;r.mime=response.mimeType;}});
 cdp.on('Network.dataReceived',({requestId,encodedDataLength})=>{const r=network.get(requestId);if(r)r.partialBytes+=encodedDataLength;});
 cdp.on('Network.loadingFinished',({requestId,encodedDataLength})=>{const r=network.get(requestId);if(r)r.bytes=encodedDataLength;});
 cdp.on('Network.loadingFailed',({requestId})=>{const r=network.get(requestId);if(r)r.failed=true;});
 await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:100,downloadThroughput:200000,uploadThroughput:93750});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await page.addInitScript(()=>{
  globalThis.localStorage.setItem('momevia-locale','vi');globalThis.__lab={lcp:0,cls:0,lcpEntries:[],shifts:[]};
  new globalThis.PerformanceObserver(list=>{for(const e of list.getEntries()){globalThis.__lab.lcp=e.startTime;globalThis.__lab.lcpEntries.push({at:e.startTime,tag:e.element?.tagName,class:e.element?.className,text:e.element?.textContent?.slice(0,100),url:e.url?new URL(e.url).pathname:undefined,size:e.size});}}).observe({type:'largest-contentful-paint',buffered:true});
  new globalThis.PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput){globalThis.__lab.cls+=e.value;globalThis.__lab.shifts.push({at:e.startTime,value:e.value,sources:e.sources.map(s=>({tag:s.node?.tagName,class:s.node?.className,previousY:s.previousRect.y,currentY:s.currentRect.y}))});}}).observe({type:'layout-shift',buffered:true});
 });
 for(const route of routes)for(let run=1;run<=runs;run++){
  network.clear();await page.goto(base+route);await page.locator('#main h1').first().waitFor();await page.waitForTimeout(4500);
  const metrics=await page.evaluate(()=>({...globalThis.__lab,navigation:globalThis.performance.getEntriesByType('navigation')[0].toJSON(),resources:globalThis.performance.getEntriesByType('resource').map(e=>({name:new URL(e.name).pathname,startTime:e.startTime,bytes:e.transferSize,decodedBytes:e.decodedBodySize,duration:e.duration,initiatorType:e.initiatorType})),coverImages:[...globalThis.document.querySelectorAll('#main img')].filter(img=>{const r=img.getBoundingClientRect();return r.top<globalThis.innerHeight&&r.bottom>0;}).map(img=>({src:new URL(img.src).pathname,decoded:img.complete&&img.naturalWidth>0}))}));
  metrics.networkResources=[...network.values()].map(r=>({...r,bytes:r.bytes||r.partialBytes}));metrics.networkTotalBytes=metrics.networkResources.reduce((n,r)=>n+r.bytes,0);
  assert(metrics.lcp>0);assert(metrics.coverImages.length&&metrics.coverImages.every(i=>i.decoded));report.cases.push({route,run,...metrics});
  console.log(`${label} ${route} ${run}: LCP ${metrics.lcp.toFixed(0)} ms, CLS ${metrics.cls.toFixed(4)}, ${Math.round(metrics.networkTotalBytes/1024)} KiB`);
 }
 assert.deepEqual(report.errors,[]);report.measured=true;report.passed=report.cases.every(r=>r.lcp<targetMs&&r.cls<=.1);
 if(process.env.LCP_REQUIRE_TARGET==='true')assert(report.passed,`Every cold sample must have LCP <${targetMs}ms and CLS <=0.1`);
}catch(error){report.errors.push(error.stack);console.error(error.stack);process.exitCode=1;}
finally{await context.close();fs.writeFileSync(path.join(out,`${label}.json`),JSON.stringify(report,null,2)+'\n');}
