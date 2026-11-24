import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {runAnimatedBrowser} from './animated-elements-browser.mjs';
const root=process.cwd(),s=JSON.parse(fs.readFileSync('local/animated-elements-50/session.json')),out=path.resolve('docs/animated-elements-50'),report=JSON.parse(fs.readFileSync(path.join(out,'qa-report.json')));
if(new URL(s.base).hostname!=='127.0.0.1'||new URL(s.base).port!=='4191'||!s.fixture.startsWith(path.join(root,'local','sfx-qa','animated-50-')))throw new Error('Wrong isolated fixture');
fs.cpSync('web',path.join(s.fixture,'web'),{recursive:true});delete report.failure;delete report.passed;
const api=async(route,body,status=200)=>{const r=await fetch(s.base+'/api'+route,{method:body?'POST':'GET',headers:{cookie:s.cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const v=await r.json();assert.equal(r.status,status,route+JSON.stringify(v));return v;};
try{await runAnimatedBrowser({...s,out,report,api,oldDesignId:s.oldDesignId,oldGiftSlug:s.oldGiftSlug});report.passed=true;}catch(e){report.failure={message:e.message,stack:e.stack};console.error(e.stack);process.exitCode=1;}finally{fs.writeFileSync(path.join(out,'qa-report.json'),JSON.stringify(report,null,2)+'\n');}
