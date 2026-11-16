import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { once } from 'node:events';
import { Router, parseJson } from '../services/shared/http.mjs';

test('JSON parser giới hạn bytes và chỉ chấp nhận object', async () => {
  const body=(text,headers={})=>Object.assign(Readable.from([Buffer.from(text)]),{headers:{'content-type':'application/json',...headers}});
  await assert.rejects(()=>parseJson(body('1234'),3),{status:413});
  await assert.rejects(()=>parseJson(body('{}',{'content-length':'100'}),3),{status:413});
  for(const value of ['null','[]','1','"text"','{broken']) await assert.rejects(()=>parseJson(body(value)),{status:400});
  assert.deepEqual(await parseJson(body('{"ok":true}')),{ok:true});
});

test('Router đặt timeout rõ ràng trên HTTP server', async () => {
  const server=new Router().listen(0);
  await once(server,'listening');
  try {
    assert.equal(server.headersTimeout,10_000);
    assert.equal(server.requestTimeout,30_000);
    assert.equal(server.keepAliveTimeout,5_000);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
