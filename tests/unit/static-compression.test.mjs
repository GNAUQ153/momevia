import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import { gunzipSync,brotliCompressSync,brotliDecompressSync } from 'node:zlib';
import {randomUUID} from 'node:crypto';
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
test('precompressed public files honor br/gzip quality, HEAD and lossless bytes',async()=>{
 const url=new URL(`../../web/assets/lcp-${randomUUID()}.js`,import.meta.url),original=Buffer.from('export const note="Momevia tiếng Việt";\n'.repeat(32));
 fs.writeFileSync(url,original);fs.writeFileSync(new URL(url.href+'.br'),brotliCompressSync(original));
 const server=http.createServer((req,res)=>staticFile(req,res,new URL(req.url,'http://127.0.0.1')));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const get=(encoding,method='GET')=>new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port:server.address().port,path:'/assets/'+url.pathname.split('/').at(-1),method,headers:{'accept-encoding':encoding}},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({headers:res.headers,body:Buffer.concat(chunks)}));});req.on('error',reject);req.end();});
 try{
  const br=await get('br, gzip');assert.equal(br.headers['content-encoding'],'br');assert.deepEqual(brotliDecompressSync(br.body),original);assert.match(br.headers['content-type'],/javascript/);
  const gzip=await get('br;q=0.3, gzip;q=1');assert.equal(gzip.headers['content-encoding'],'gzip');assert.deepEqual(gunzipSync(gzip.body),original);
  const plain=await get('br;q=0, gzip;q=0');assert.equal(plain.headers['content-encoding'],undefined);assert.deepEqual(plain.body,original);
  const head=await get('br','HEAD');assert.equal(head.body.length,0);assert.equal(head.headers['content-encoding'],'br');assert.equal(head.headers.vary,'Accept-Encoding');
 }finally{await new Promise(resolve=>server.close(resolve));fs.rmSync(url);fs.rmSync(new URL(url.href+'.br'));}
});
test('public Catalog data is no-store, inert JSON and escapes closing-script text',async()=>{
 const title='</script><script>alert("unsafe")</script>',publicCatalog={endpoint:'/catalog/templates',data:{templates:[{id:'safe',title}]}};
 const server=http.createServer((req,res)=>staticFile(req,res,new URL(req.url,'http://127.0.0.1'),{publicCatalog}));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const response=await fetch(`http://127.0.0.1:${server.address().port}/explore`),html=await response.text();assert.equal(response.headers.get('cache-control'),'no-store');assert(!html.includes(title));const raw=html.match(/id="public-catalog-bootstrap">([\s\S]*?)<\/script>/)[1];assert.equal(JSON.parse(raw).data.templates[0].title,title);}finally{await new Promise(resolve=>server.close(resolve));}
});
