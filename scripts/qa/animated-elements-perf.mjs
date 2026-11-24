import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startSfxFixture} from '../../tests/integration/sfx-fixture.mjs';
const root=process.cwd(),out=path.resolve('docs/animated-elements-50'),session=JSON.parse(fs.readFileSync('local/animated-elements-50/session.json')),legacy=JSON.parse(fs.readFileSync('tests/fixtures/motion-legacy-elements.json'));
const baselineCommit=execFileSync('git',['rev-parse','527e646'],{encoding:'utf8'}).trim();
const fixture=await startSfxFixture({baseline:true,baselineCommit,label:'animated-50-before'}),browser=await chromium.launch({channel:'chrome',headless:true});
const report={baselineCommit,host:{platform:os.platform(),cpu:os.cpus()[0].model,logicalCpus:os.cpus().length},profile:{viewport:'390×844',cpuSlowdown:4,physicalDevice:false,runs:3,framesPerRun:120},cases:[]};
try{
 for(const [version,base]of [['before',fixture.base],['after',session.base]]){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'no-preference'}),page=await context.newPage();await page.goto(base);await page.locator('body').waitFor();const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  for(const scene of version==='before'?['empty','legacy-ten']:['empty','legacy-ten','new-ten'])for(let run=0;run<3;run++){
   const result=await page.evaluate(async({scene,legacy})=>{
    const {renderElement,applyLayout}=await import('/js/features/gift-runtime/renderer.js'),{createMotion,playElement}=await import('/js/features/gift-runtime/effects.js'),{eventMediaUrl}=await import('/js/shared/canvas/event-media.js');
    const abort=new AbortController(),motion=createMotion(()=>true),host=globalThis.document.createElement('div');Object.assign(host.style,{position:'fixed',inset:'0',zIndex:'10000',background:'#FFF5FA'});globalThis.document.body.append(host);
    let models=[];if(scene==='legacy-ten')models=Array.from({length:10},(_,i)=>structuredClone(legacy[i%6].definition.elements[0]));
    if(scene==='new-ten'){const {ANIMATED_ELEMENTS,animatedElementCards}=await import('/js/shared/canvas/animated-elements.js');models=[1,3,11,13,15,21,22,31,36,41].map(n=>{const spec=ANIMATED_ELEMENTS[n-1];return animatedElementCards(spec.group).find(c=>c.id===spec.id).create()[0];});}
    const begun=performance.now();for(const [i,m]of models.entries()){const n=renderElement(m,{document:{bindings:{}},assetUrl:id=>eventMediaUrl(id),signal:abort.signal});applyLayout(n,{...m,layout:{x:i%2*190,y:Math.floor(i/2)*160,width:160,height:160,rotation:0}},{width:390,height:844});host.append(n);void playElement(n,m,motion,abort.signal);}
    await Promise.all([...host.querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));await new Promise(r=>setTimeout(r,300));const readyMs=performance.now()-begun,frames=[];let previous=performance.now();await new Promise(resolve=>{const tick=now=>{frames.push(now-previous);previous=now;if(frames.length<120)globalThis.requestAnimationFrame(tick);else resolve();};globalThis.requestAnimationFrame(tick);});const peakAnimations=host.getAnimations({subtree:true}).length,domNodes=host.querySelectorAll('*').length;abort.abort();motion.cancel();await new Promise(globalThis.requestAnimationFrame);await Promise.resolve();const remaining=host.getAnimations({subtree:true}).length,stats=motion.stats?.();host.remove();frames.sort((a,b)=>a-b);return{p95Ms:frames[Math.ceil(frames.length*.95)-1],readyMs,peakAnimations,domNodes,remaining,stats};
   },{scene,legacy});assert.equal(result.remaining,0);if(result.stats){assert.equal(result.stats.animations,0);assert.equal(result.stats.pending,0);}report.cases.push({version,scene,run,...result});
  }
  report[version+'Resources']=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>({path:new URL(r.name).pathname,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize})));
  await context.close();
 }
 report.browser=browser.version();report.targetP95Ms=33;report.targetMet=report.cases.filter(c=>c.scene==='new-ten').every(c=>c.p95Ms<=33);report.passed=true;console.log(JSON.stringify({targetMet:report.targetMet,cases:report.cases},null,2));
}catch(e){report.failure=e.stack;console.error(e.stack);process.exitCode=1;}finally{fs.writeFileSync(path.join(out,'performance-before-after.json'),JSON.stringify(report,null,2)+'\n');await browser.close();await fixture.close();process.chdir(root);}
