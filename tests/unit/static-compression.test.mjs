import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { staticFile } from '../../src/gateway/static.mjs';
test('public static compression negotiates gzip, preserves bytes, q=0 and HEAD',async()=>{
 const server=http.createServer((req,res)=>staticFile(req,res,new URL(req.url,'http://127.0.0.1')));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const request=(encoding,method='GET')=>new Promise((resolve,reject)=>{
  const req=http.request({host:'127.0.0.1',port:server.address().port,path:'/assets/locales/vi.json',headers:{'accept-encoding':encoding},method},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({headers:res.headers,bytes:Buffer.concat(chunks)}));});req.on('error',reject);req.end();
 });
 try{
  const original=fs.readFileSync(new URL('../../web/assets/locales/vi.json',import.meta.url));
  const gzip=await request('br, gzip;q=1');assert.equal(gzip.headers['content-encoding'],'gzip');assert.equal(gzip.headers.vary,'Accept-Encoding');assert.deepEqual(gunzipSync(gzip.bytes),original);assert(gzip.bytes.length<original.length*.5);
  for(const encoding of ['gzip;q=0','gzip;q=0.00 ','identity']){const plain=await request(encoding);assert.equal(plain.headers['content-encoding'],undefined);assert.deepEqual(plain.bytes,original);}
  const head=await request('gzip','HEAD');assert.equal(head.bytes.length,0);assert.equal(head.headers['content-encoding'],'gzip');
 }finally{await new Promise(resolve=>server.close(resolve));}
});
