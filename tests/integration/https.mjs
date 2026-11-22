import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { once } from 'node:events';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { localCertificate } from '../../scripts/dev/certificate-local.mjs';
import { loadTlsOptions } from '../../src/shared/tls.mjs';
import { createElement } from '../../web/js/shared/canvas/registry.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const temporaryRoot=fs.realpathSync(os.tmpdir());
const fixture=fs.mkdtempSync(path.join(temporaryRoot,'momevia-https-'));
const beforeEnv={...process.env}, beforeCwd=process.cwd();
let app;
try {
  const certificate=localCertificate(path.join(fixture,'certificates'));
  assert.equal(loadTlsOptions({}),null);
  assert.throws(()=>loadTlsOptions({baseUrl:'https://localhost',httpsCertFile:certificate.certFile}));
  assert.throws(()=>loadTlsOptions({baseUrl:'http://localhost',httpsCertFile:certificate.certFile,httpsKeyFile:certificate.keyFile}));
  const other=localCertificate(path.join(fixture,'other-certificates'));
  assert.throws(()=>loadTlsOptions({baseUrl:'https://localhost',httpsCertFile:certificate.certFile,httpsKeyFile:other.keyFile}));
  assert.throws(()=>loadTlsOptions({baseUrl:'https://localhost',httpsCertFile:certificate.keyFile,httpsKeyFile:certificate.keyFile}));
  for(const entry of ['src','web','package.json'])fs.cpSync(path.join(root,entry),path.join(fixture,entry),{recursive:true});
  fs.symlinkSync(path.join(root,'node_modules'),path.join(fixture,'node_modules'),'junction');
  Object.assign(process.env,{NODE_ENV:'test',TEST_ACCOUNT_ENABLED:'false',DEMO_AUTH_ENABLED:'false',PUBLIC_BASE_URL:'https://127.0.0.1',PAYMENT_ENABLED:'false',PAYMENT_LIVE_ENABLED:'false',CANVAS_READ_ENABLED:'true',CANVAS_EDIT_ENABLED:'true',CANVAS_PUBLISH_ENABLED:'true'});
  for(const module of ['IDENTITY','CATALOG','CHECKOUT','GIFTS','DESIGNS','SUPPORT'])process.env[module+'_STORAGE']='json';
  process.chdir(fixture);
  const {createHttpApp}=await import(pathToFileURL(path.join(fixture,'src/server/app.mjs')));
  const config={baseUrl:'https://127.0.0.1',httpsCertFile:certificate.certFile,httpsKeyFile:certificate.keyFile,
    jwtSecret:randomBytes(32).toString('hex'),internalKey:randomBytes(32).toString('hex'),demoEnabled:false,testAccount:null,giftTtlDays:365,googleId:'',googleSecret:'',zaloId:'',zaloSecret:''};
  app=await createHttpApp(config);app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  const base=`https://127.0.0.1:${app.server.address().port}`;config.baseUrl=base;process.env.PUBLIC_BASE_URL=base;
  const ca=fs.readFileSync(certificate.certFile);
  let cookie='';
  const request=(route,body,origin=base,authenticated=true)=>new Promise((resolve,reject)=>{
    const req=https.request(base+route,{ca,method:body?'POST':'GET',headers:{origin,...(authenticated&&cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{})}},res=>{
      let text='';res.on('data',bytes=>{text+=bytes;});res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:JSON.parse(text)}));
    });req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
  });
  const health=await request('/api/designs/health');assert.equal(health.status,200);
  const username=`https-${randomUUID()}@example.test`;
  const login=await request('/api/auth/register',{name:'TLS sender',email:username,password:'HttpsQA12345',confirmPassword:'HttpsQA12345'});
  assert.equal(login.status,201);const setCookie=login.headers['set-cookie'].find(value=>value.startsWith('session='));
  assert.match(setCookie,/; Secure/);assert.match(setCookie,/; HttpOnly/);cookie=setCookie.split(';')[0];
  assert.equal((await request('/api/auth/logout',{},'https://untrusted.invalid')).status,403);
  const created=await request('/api/designs/designs',{source:{kind:'blank'},presetId:'blank',mutationId:randomUUID()});assert.equal(created.status,201);
  const draft=created.body.design;
  for(const [key,value]of Object.entries({senderName:'Minh',recipientName:'An',message:'Quà qua chứng chỉ HTTPS.'}))draft.document.bindings[key].value=value;
  const text=createElement('text',{id:'tls-greeting',props:{textBinding:'message'}});draft.document.elements.push(text);draft.document.scenes[0].elementIds.push(text.id);
  const saved=await request(`/api/designs/designs/${draft.id}/save`,{expectedRevision:draft.revision,mutationId:randomUUID(),title:'HTTPS QA',document:draft.document});assert.equal(saved.status,200);
  const preflight=await request(`/api/designs/designs/${draft.id}/preflight`,{expectedRevision:saved.body.savedRevision});assert.equal(preflight.body.canPublish,true);
  const published=await request('/api/gifts/gifts/from-design',{designId:draft.id,expectedRevision:saved.body.savedRevision,expectedDocumentHash:preflight.body.documentHash,idempotencyKey:randomUUID(),access:{open:'link',send:'disabled',read:'sender'}});
  assert.equal(published.status,201);assert.equal(published.body.gift.url,base+'/g/'+published.body.gift.slug);
  const gift=await request('/api/gifts/gifts/'+published.body.gift.slug,undefined,base,false);assert.equal(gift.status,200);assert.equal(gift.body.gift.documentSnapshot.bindings.message.value,'Quà qua chứng chỉ HTTPS.');
  await assert.rejects(new Promise((resolve,reject)=>{https.get(base+'/api/designs/health',resolve).on('error',reject);}));
  const insecure=await new Promise(resolve=>{const req=http.get(base.replace('https:','http:')+'/api/designs/health',res=>{res.resume();resolve(res.statusCode);});req.on('error',()=>resolve(null));});assert.notEqual(insecure,200);
  console.log('PASS Direct HTTPS: trusted explicit test CA, invalid/mismatched keys rejected, Secure session, origin rejection, draft/public gift HTTPS URLs, anonymous snapshot and no HTTP fallback. No external tunnel or certificate trust bypass.');
} finally {
  if(app){await new Promise(resolve=>app.server.close(resolve));await app.close();}
  process.chdir(beforeCwd);for(const key of Object.keys(process.env))if(!(key in beforeEnv))delete process.env[key];Object.assign(process.env,beforeEnv);
  assert(path.dirname(fixture)===temporaryRoot&&path.basename(fixture).startsWith('momevia-https-'));
  const modules=path.join(fixture,'node_modules');if(fs.lstatSync(modules,{throwIfNoEntry:false})?.isSymbolicLink())fs.unlinkSync(modules);
  fs.rmSync(fixture,{recursive:true,force:true});
}
