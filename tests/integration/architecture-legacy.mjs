import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import sharp from 'sharp';

// Chạy service thật trên bản sao nguồn sạch, không đọc .env/data của workspace.
// Chỉ thay các hằng cổng 4100–4105 trong bản sao để không đụng service đang chạy.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tempRoot = fs.realpathSync(os.tmpdir());
const fixture = fs.mkdtempSync(path.join(tempRoot, 'momevia-architecture-'));
const reservations = [];
const children = [];
let logs = '';

async function reservePort() {
  const server = net.createServer();
  reservations.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}

function remapPorts(directory, ports) {
  for (const entry of fs.readdirSync(directory, {withFileTypes:true})) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) remapPorts(filename, ports);
    else if (entry.name.endsWith('.mjs')) {
      const source = fs.readFileSync(filename, 'utf8');
      fs.writeFileSync(filename, source.replace(/\b410[0-5]\b/g, port => ports[Number(port) - 4100]));
    }
  }
}

function launch(file, env) {
  const child = spawn(process.execPath, [file], {cwd:fixture,env,stdio:['ignore','pipe','pipe'],windowsHide:true});
  children.push(child);
  child.stdout.on('data', chunk => { logs = (logs + chunk).slice(-20_000); });
  child.stderr.on('data', chunk => { logs = (logs + chunk).slice(-20_000); });
  child.on('error', error => { logs += error.message; });
  return child;
}

function request(base, pathname, {method='GET',body,cookie,headers={},localAddress} = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(new URL(pathname, base), {
      method,localAddress,
      headers:{...(body ? {'content-type':'application/json'} : {}),...(cookie ? {cookie} : {}),...headers},
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const bytes = Buffer.concat(chunks);
        let data;
        try { data = JSON.parse(bytes.toString()); } catch { data = null; }
        resolve({status:res.statusCode,headers:res.headers,bytes,data});
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(10_000, () => req.destroy(new Error('API timeout')));
    req.end(body ? JSON.stringify(body) : undefined);
  });
}

try {
  const ports = await Promise.all(Array.from({length:6}, () => reservePort()));
  fs.cpSync(path.join(root, 'services'), path.join(fixture, 'services'), {
    recursive:true,filter:source => path.basename(source) !== 'data',
  });
  fs.cpSync(path.join(root, 'src'), path.join(fixture, 'src'), {recursive:true});
  fs.cpSync(path.join(root, 'web'), path.join(fixture, 'web'), {recursive:true});
  fs.copyFileSync(path.join(root, 'gateway.mjs'), path.join(fixture, 'gateway.mjs'));
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'junction');
  remapPorts(fixture, ports);
  const base = `http://127.0.0.1:${ports[0]}`;
  const env = {...process.env,NODE_ENV:'test',PUBLIC_BASE_URL:base,
    JWT_SECRET:randomBytes(32).toString('hex'),INTERNAL_SERVICE_KEY:randomBytes(32).toString('hex'),
    DEMO_AUTH_ENABLED:'true',DEMO_ADMIN_CODE:randomBytes(24).toString('hex'),GIFT_TTL_DAYS:'365'};
  Object.assign(env, { TEST_ACCOUNT_ENABLED: 'true', TEST_ACCOUNT_NAME: 'Legacy QA',
    TEST_ACCOUNT_EMAIL: 'legacy-env@example.test', TEST_ACCOUNT_PASSWORD: 'LegacyFixture123', TEST_ACCOUNT_ROLE: 'sender' });
  await Promise.all(reservations.map(server => new Promise(resolve => server.close(resolve))));
  for (const file of ['identity','catalog','checkout','gifts','support'].map(name => `services/${name}/server.mjs`).concat('gateway.mjs')) {
    launch(file, env);
  }
  const health = ['/api/auth/health','/api/catalog/health','/api/checkout/health','/api/gifts/health','/api/support/health'];
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (children.some(child => child.exitCode !== null || child.signalCode !== null)) throw new Error('Service fixture kết thúc sớm.');
    const results = await Promise.all(health.map(route => request(base,route).catch(() => null)));
    if (results.every(result => result?.status === 200 && result.data?.ok === true)) { ready = true; break; }
    await delay(100);
  }
  assert(ready, 'Fixture không khởi động đủ service.');
  const seededLogin = await request(base, '/api/auth/login', { method: 'POST', body: {
    email: 'legacy-env@example.test', password: 'LegacyFixture123',
  } });
  assert.equal(seededLogin.status, 200, 'Identity legacy phải tạo tài khoản từ env trước khi nhận request');
  assert.equal(seededLogin.data.user.role, 'sender');
  if (process.argv.includes('--browser')) {
    const { runBrowserSmoke } = await import('../browser/smoke.mjs');
    await runBrowserSmoke(base);
  }

  const email = `architecture-${randomUUID()}@example.test`;
  const account = {name:'Kiểm thử kiến trúc',email,password:'RegressionPass123',confirmPassword:'RegressionPass123'};
  const registrations = await Promise.all([
    request(base,'/api/auth/register',{method:'POST',body:account}),
    request(base,'/api/auth/register',{method:'POST',body:{...account,email:email.toUpperCase()}}),
  ]);
  assert.deepEqual(registrations.map(result => result.status).sort(), [201,409]);
  const users = JSON.parse(fs.readFileSync(path.join(fixture,'services/identity/data/users.json'),'utf8'));
  assert.equal(users.filter(user => user.email === email).length, 1);
  const cookie = registrations.find(result => result.status === 201).headers['set-cookie'][0].split(';')[0];
  console.log('PASS  Đăng ký đồng thời: một tài khoản, một phản hồi 409');

  assert.equal((await request(base,'/api/auth/creator',{method:'POST',body:{}})).status,401);
  assert.equal((await request(base,'/api/auth/creator',{method:'POST',cookie,body:{role:'admin'}})).status,403,
    'Sender must not promote its own role');
  assert.equal((await request(base,'/api/auth/me',{cookie})).data.user.role,'sender');

  const roleAccount={...account,email:`roles-${randomUUID()}@example.test`,role:'admin'};
  const roleSignup=await request(base,'/api/auth/register',{method:'POST',body:roleAccount});
  assert.equal(roleSignup.status,201);
  assert.equal(roleSignup.data.user.role,'sender','Register must ignore a client-supplied role');
  const roleId=roleSignup.data.user.id;
  const roleCookie=roleSignup.headers['set-cookie'][0].split(';')[0];
  const rolePath=`/api/auth/admin/users/${roleId}/role`;
  assert.equal((await request(base,rolePath,{method:'POST',cookie:roleCookie,body:{role:'admin'}})).status,403);
  assert.equal((await request(base,'/api/auth/admin/users',{cookie:roleCookie})).status,403);
  const adminLogin=await request(base,'/api/auth/demo-admin',{method:'POST',body:{code:env.DEMO_ADMIN_CODE}});
  assert.equal(adminLogin.status,200);
  const adminCookie=adminLogin.headers['set-cookie'][0].split(';')[0];
  const adminId=adminLogin.data.user.id;
  const adminUsers=await request(base,'/api/auth/admin/users',{cookie:adminCookie});
  assert.equal(adminUsers.status,200);
  assert(adminUsers.data.users.every(user=>!('passwordHash' in user)));
  const promoted=await request(base,rolePath,{method:'POST',cookie:adminCookie,body:{role:'creator'}});
  assert.equal(promoted.status,200);
  assert.equal(promoted.data.user.id,roleId);
  assert.equal(promoted.headers['set-cookie'],undefined,'Admin must not receive the target user session');
  assert.equal((await request(base,'/api/auth/me',{cookie:adminCookie})).data.user.id,adminId);
  const creatorLogin=await request(base,'/api/auth/login',{method:'POST',body:{email:roleAccount.email,password:roleAccount.password}});
  assert.equal(creatorLogin.status,200);
  const creatorCookie=creatorLogin.headers['set-cookie'][0].split(';')[0];
  assert.equal((await request(base,'/api/catalog/creator/templates',{cookie:creatorCookie})).status,200);
  assert.equal((await request(base,'/api/auth/creator',{method:'POST',cookie:creatorCookie,body:{userId:roleId}})).status,403);
  assert.equal((await request(base,rolePath,{method:'POST',cookie:creatorCookie,body:{role:'admin'}})).status,403);
  assert.equal((await request(base,rolePath,{method:'POST',cookie:adminCookie,body:{role:'owner'}})).status,400);
  assert.equal((await request(base,'/api/auth/admin/users/missing/role',{method:'POST',cookie:adminCookie,body:{role:'creator'}})).status,404);
  assert.equal((await request(base,rolePath,{method:'POST',cookie:adminCookie,body:{role:'sender'}})).status,200);
  assert.equal((await request(base,'/api/catalog/creator/templates',{cookie:creatorCookie})).status,403);
  assert.equal((await request(base,'/api/catalog/creator/templates',{method:'POST',cookie:creatorCookie,body:{title:'Blocked role',subtitle:'Denied after demotion',theme:'rose',price:0}})).status,403);
  const compatibility=await request(base,'/api/auth/creator',{method:'POST',cookie:adminCookie,body:{userId:roleId}});
  assert.equal(compatibility.status,200);
  assert.equal(compatibility.headers['set-cookie'],undefined);
  assert.equal((await request(base,rolePath,{method:'POST',cookie:adminCookie,body:{role:'sender'}})).status,200);
  console.log('PASS  Only Admin changes roles; Sender/Creator cannot self-promote; demotion overrides old JWT claims');

  const catalog = await request(base,'/api/catalog/templates');
  assert.equal(catalog.status, 200);
  const templateId = catalog.data.templates.find(template => template.price === 0).id;
  for (const route of [`/api/catalog/internal/templates/${templateId}`, '/api/catalog/internal', '/api/catalog/%69nternal/templates/a', '/api/checkout/internal/license/a/b']) {
    const result = await request(base,route,{headers:{'x-service-key':env.INTERNAL_SERVICE_KEY}});
    assert.equal(result.status, 403, route);
  }
  const internalUrl = `http://127.0.0.1:${ports[2]}`;
  assert.equal((await request(internalUrl,`/internal/templates/${templateId}`)).status, 403);
  assert.equal((await request(internalUrl,`/internal/templates/${templateId}`,{headers:{'x-service-key':env.INTERNAL_SERVICE_KEY}})).status, 200);
  console.log('PASS  Gateway chặn nội bộ ngay cả khi biết khóa; service vẫn kiểm tra khóa');

  const photo = await sharp({create:{width:2,height:2,channels:3,background:'red'}}).png().toBuffer();
  const created = await request(base,'/api/gifts/gifts',{method:'POST',cookie,body:{templateId,recipientName:'Mai',senderName:'An',message:'Quà kiểm thử cô lập',photoDataUrl:`data:image/png;base64,${photo.toString('base64')}`}});
  assert.equal(created.status, 201);
  const slug = created.data.gift.slug;
  const gift = await request(base,`/api/gifts/gifts/${slug}`);
  const mine = await request(base,'/api/gifts/gifts/mine',{cookie});
  for (const photoUrl of [gift.data.gift.photoUrl,mine.data.gifts.find(item => item.slug === slug).photoUrl]) {
    assert.equal(typeof photoUrl, 'string');
    const loaded = await request(base,photoUrl);
    assert.equal(loaded.status, 200);
    assert.equal(loaded.headers['content-type'], 'image/png');
    assert.deepEqual(await sharp(loaded.bytes).raw().toBuffer(), await sharp(photo).raw().toBuffer());
    assert.equal((await sharp(loaded.bytes).metadata()).exif, undefined);
  }
  console.log('PASS  URL ảnh public và danh sách của tôi trả đúng bytes ảnh');

  const repliesRoute = `/api/gifts/gifts/${slug}/replies`;
  for (let i = 0; i < 3; i++) {
    assert.equal((await request(base,repliesRoute,{method:'POST',body:{message:'Lời đáp kiểm thử'}})).status,201);
  }
  assert.equal((await request(base,repliesRoute,{method:'POST',body:{message:'Vượt hạn mức'},headers:{'x-forwarded-for':'192.0.2.99'}})).status,429);
  assert.equal((await request(base,repliesRoute,{method:'POST',body:{message:'Một người nhận khác'},localAddress:'127.0.0.2'})).status,201);
  console.log('PASS  Hạn mức reply tách IP thực và không bị vượt bằng header giả');

  for (let i = 0; i < 6; i++) {
    const result = await request(base,'/api/support/requests',{method:'POST',
      localAddress:'127.0.0.3',
      headers:{'x-forwarded-for':`192.0.2.${i + 1}`},
      body:{name:'Khách kiểm thử',email,topic:'Hỗ trợ',message:'Nội dung hỗ trợ trong môi trường kiểm thử cô lập.'}});
    assert.equal(result.status, i < 5 ? 201 : 429);
  }
  console.log('PASS  Đổi X-Forwarded-For không vượt được hạn mức Support');

  for (const script of ['smoke-auth.mjs','smoke-upgrade.mjs','smoke.mjs','smoke-ui.mjs']) {
    const child = launch(path.join(root,'tests','smoke',script), env);
    const [code] = await once(child, 'exit');
    assert.equal(code, 0, script);
    console.log(`PASS  ${script}`);
  }

  const extraGift = await request(base,'/api/gifts/gifts',{method:'POST',cookie,body:{templateId,recipientName:'QA',senderName:'QA',message:'Concurrent reply regression'}});
  assert.equal(extraGift.status,201);
  const extraRoute = `/api/gifts/gifts/${extraGift.data.gift.slug}`;
  const replyResults = await Promise.all(Array.from({length:3},(_,i)=>request(base,`${extraRoute}/replies`,{method:'POST',body:{message:`Concurrent reply ${i}`}})));
  assert(replyResults.every(result=>result.status===201));
  assert.equal((await request(base,`${extraRoute}/replies`)).data.replies.length,3);
  assert.equal((await request(base,extraRoute)).data.gift.replyCount,3);
  const paidId = catalog.data.templates.find(template=>template.price>0).id;
  const purchases = await Promise.all(Array.from({length:20},()=>request(base,'/api/checkout/orders/demo-purchase',{method:'POST',cookie,body:{templateId:paidId}})));
  assert(purchases.every(result=>result.status===201));
  assert.equal(new Set(purchases.map(result=>result.data.order.id)).size,1);
  const storedOrders = JSON.parse(fs.readFileSync(path.join(fixture,'services/checkout/data/orders.json'),'utf8'));
  assert.equal(storedOrders.filter(order=>order.userId===users.find(user=>user.email===email).id&&order.templateId===paidId).length,1);
  console.log('PASS  Concurrent replies persist and concurrent purchases reuse one order');

  const protectedIp = '127.0.0.4';
  for (let i=0;i<11;i++) {
    const attempt=await request(base,'/api/auth/login',{method:'POST',localAddress:protectedIp,
      headers:{'x-forwarded-for':`192.0.2.${i+1}`},body:{email,password:'WrongPass123'}});
    assert.equal(attempt.status,i<10?401:429);
    if(i===10) assert(attempt.headers['retry-after']);
  }
  for (let i=0;i<11;i++) {
    const attempt=await request(base,'/api/auth/register',{method:'POST',localAddress:'127.0.0.5',
      body:{...account,confirmPassword:'mismatch'}});
    assert.equal(attempt.status,i<10?400:429);
  }
  for (let i=0;i<4;i++) {
    const attempt=await request(base,'/api/auth/demo-admin',{method:'POST',localAddress:'127.0.0.6',body:{code:'wrong'}});
    assert.equal(attempt.status,i<3?403:429);
  }
  console.log('PASS  Login/register/admin are throttled; spoofed headers do not reset quota');

  assert.equal((await request(base,'/api/auth/logout',{method:'POST',cookie})).status,200);
  assert.equal((await request(base,'/api/auth/me',{cookie})).data.user,null);
  const protectedRoutes=['/api/gifts/gifts/mine','/api/catalog/favorites','/api/checkout/orders','/api/support/admin/requests'];
  for (const route of protectedRoutes) assert.equal((await request(base,route,{cookie})).status,401,route);
  const identity=children[0];
  const identityExited=once(identity,'exit');
  identity.kill();
  await identityExited;
  assert.equal((await request(base,'/api/gifts/gifts/mine',{cookie})).status,503);
  const restarted=launch('services/identity/server.mjs',{...env,NODE_ENV:'production',TEST_ACCOUNT_ENABLED:'false'});
  let identityReady=false;
  for(let i=0;i<100;i++) {
    if(restarted.exitCode!==null) throw new Error('Identity restart failed');
    if((await request(base,'/api/auth/health').catch(()=>null))?.status===200) {identityReady=true;break;}
    await delay(100);
  }
  assert(identityReady);
  for (const route of protectedRoutes) assert.equal((await request(base,route,{cookie})).status,401,route);
  console.log('PASS  Logout revokes replay on all services across Identity restart; outage fails closed');
  assert.equal((await request(base,'/api/auth/providers')).data.demo,false);
  assert.equal((await request(base,'/api/auth/demo-admin',{method:'POST',body:{code:env.DEMO_ADMIN_CODE}})).status,403);
  assert.equal((await request(base,'/api/auth/creator',{method:'POST',cookie:roleCookie,body:{userId:roleId}})).status,403);
  assert.equal((await request(base,rolePath,{method:'POST',cookie:creatorCookie,body:{role:'admin'}})).status,403);
  assert.equal((await request(base,rolePath,{method:'POST',cookie:adminCookie,body:{role:'creator'}})).status,200);
  assert.equal((await request(base,'/api/catalog/creator/templates',{cookie:roleCookie})).status,200);
  const identityEnd=process.hrtime.bigint();
  const introspection=await request(`http://127.0.0.1:${ports[1]}`,'/internal/session',{
    method:'POST',headers:{'x-service-key':env.INTERNAL_SERVICE_KEY},body:{token:roleCookie.slice('session='.length)},
  });
  const sampleMs=Number(process.hrtime.bigint()-identityEnd)/1e6;
  assert.equal(introspection.status,200);
  assert.equal(introspection.data.user.role,'creator');
  console.log(`OBSERVATION Internal session HTTP round trip: ${sampleMs.toFixed(2)} ms (one local sample, not a benchmark)`);
  assert.equal((await request(base,`/api/auth/admin/users/${adminId}/role`,{method:'POST',cookie:adminCookie,body:{role:'sender'}})).status,200);
  assert.equal((await request(base,rolePath,{method:'POST',cookie:adminCookie,body:{role:'admin'}})).status,403);
  assert.equal((await request(base,'/api/catalog/admin/pending',{cookie:adminCookie})).status,403);
  assert.equal((await request(base,'/api/support/admin/requests',{cookie:adminCookie})).status,403);
  console.log('PASS  Production role guards stay active; demoted Admin token loses Admin permissions across services');
  console.log('Hoàn tất kiểm thử HTTP cô lập; không dùng dữ liệu hay service đang chạy của workspace.');
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  await Promise.all(reservations.filter(server => server.listening).map(server => new Promise(resolve => server.close(resolve))));
  await Promise.all(children.filter(child => child.exitCode === null && child.signalCode === null).map(async child => {
    const exited = once(child,'exit');
    child.kill();
    await exited;
  }));
  if (path.dirname(path.resolve(fixture)) !== tempRoot) throw new Error('Từ chối dọn thư mục ngoài vùng fixture.');
  fs.rmSync(fixture, {recursive:true,force:true});
}
