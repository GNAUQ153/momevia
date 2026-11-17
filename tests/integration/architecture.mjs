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

// Khởi chạy Modular Monolith trong thư mục dữ liệu tạm, không đụng workspace.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tempRoot = fs.realpathSync(os.tmpdir());
const fixture = fs.mkdtempSync(path.join(tempRoot, 'momevia-modular-'));
const children = [];
let logs = '';

async function reservePort() {
  const service = net.createServer();
  service.listen(0, '127.0.0.1');
  await once(service, 'listening');
  const port = service.address().port;
  await new Promise(resolve => service.close(resolve));
  return port;
}
function launch(file, env) {
  const child = spawn(process.execPath, [file], {cwd:fixture,env,stdio:['ignore','pipe','pipe'],windowsHide:true});
  children.push(child);
  child.stdout.on('data',chunk => { logs = (logs + chunk).slice(-20_000); });
  child.stderr.on('data',chunk => { logs = (logs + chunk).slice(-20_000); });
  child.on('error',error => { logs += error.message; });
  return child;
}
function request(base, pathname, {method='GET',body,cookie,headers={},localAddress} = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(new URL(pathname, base), {
      method,localAddress,
      headers:{...(body ? {'content-type':'application/json'} : {}),...(cookie ? {cookie} : {}),...headers},
    },res => {
      const chunks=[];
      res.on('data',chunk => chunks.push(chunk));
      res.on('end',() => {
        const bytes=Buffer.concat(chunks);
        let data;
        try {data=JSON.parse(bytes.toString());} catch {data=null;}
        resolve({status:res.statusCode,headers:res.headers,bytes,data});
      });
      res.on('error',reject);
    });
    req.on('error',reject);
    req.setTimeout(10_000, () => req.destroy(new Error('API timeout')));
    req.end(body ? JSON.stringify(body) : undefined);
  });
}

try {
  const port = await reservePort();
  for (const directory of ['src','services','web']) {
    fs.cpSync(path.join(root,directory),path.join(fixture,directory),{
      recursive:true,filter:source => path.basename(source) !== 'data',
    });
  }
  fs.copyFileSync(path.join(root,'dev.mjs'),path.join(fixture,'dev.mjs'));
  fs.symlinkSync(path.join(root,'node_modules'),path.join(fixture,'node_modules'),'junction');
  const base=`http://127.0.0.1:${port}`;
  fs.writeFileSync(path.join(fixture, '.env'), [
    'TEST_ACCOUNT_ENABLED=true', 'TEST_ACCOUNT_NAME="Tài khoản mẫu QA"',
    'TEST_ACCOUNT_EMAIL=env-qa@example.test', 'TEST_ACCOUNT_PASSWORD=EnvFixturePass123',
    'TEST_ACCOUNT_ROLE=creator',
  ].join('\n'));
  const env={...process.env, NODE_ENV:'test', PORT:String(port), PUBLIC_BASE_URL:base,
    IDENTITY_STORAGE:'json', CATALOG_STORAGE:'json', CHECKOUT_STORAGE:'json', GIFTS_STORAGE:'json', SUPPORT_STORAGE:'json', DESIGNS_STORAGE:'json',
    PAYMENT_ENABLED:'false', PAYMENT_LIVE_ENABLED:'false', CANVAS_READ_ENABLED:'true', CANVAS_EDIT_ENABLED:'true', CANVAS_PUBLISH_ENABLED:'true',
    JWT_SECRET:randomBytes(32).toString('hex'),INTERNAL_SERVICE_KEY:randomBytes(32).toString('hex'),
    DEMO_AUTH_ENABLED:'true',DEMO_ADMIN_CODE:randomBytes(24).toString('hex'),GIFT_TTL_DAYS:'365'};
  for (const key of Object.keys(env).filter(key => key.startsWith('TEST_ACCOUNT_'))) delete env[key];
  const app=launch('dev.mjs',env);
  const health=['/api/auth/health','/api/catalog/health','/api/checkout/health','/api/gifts/health','/api/support/health'];
  let ready=false;
  for(let i=0;i<100;i++) {
    if(app.exitCode!==null || app.signalCode!==null) throw new Error('Backend fixture kết thúc sớm.');
    const results=await Promise.all(health.map(route=>request(base,route).catch(()=>null)));
    if(results.every(result=>result?.status===200&&result.data?.ok===true)){ready=true;break;}
    await delay(100);
  }
  assert(ready,'Backend fixture không khởi động các module.');
  assert.equal(children.length,1,'Momevia phải chạy đúng một HTTP server process.');
  const seededLogin = await request(base, '/api/auth/login', { method: 'POST', body: {
    email: 'ENV-QA@example.test', password: 'EnvFixturePass123',
  } });
  assert.equal(seededLogin.status, 200, 'Tài khoản từ .env phải đăng nhập được ngay sau khởi động');
  assert.equal(seededLogin.data.user.role, 'creator');
  assert(!('passwordHash' in seededLogin.data.user));
  assert(!('testAccount' in seededLogin.data.user));
  if(process.argv.includes('--browser')) {
    const {runBrowserSmoke}=await import('../browser/smoke.mjs');
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
  console.log('PASS  Public API không lộ endpoint /internal khi chuyển sang một server');

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
  assert.equal((await request(base,`/api/auth/admin/users/${adminId}/role`,{method:'POST',cookie:adminCookie,body:{role:'sender'}})).status,200);
  assert.equal((await request(base,rolePath,{method:'POST',cookie:adminCookie,body:{role:'admin'}})).status,403);
  assert.equal((await request(base,'/api/catalog/admin/pending',{cookie:adminCookie})).status,403);
  assert.equal((await request(base,'/api/support/admin/requests',{cookie:adminCookie})).status,403);
  console.log('PASS  Mất quyền Admin làm vô hiệu hóa quyền truy cập trên mọi module');
  console.log('PASS  Tất cả module chia một HTTP process, bảo toàn public API và truy cập dữ liệu tách biệt');
} catch(error) {
  console.error(logs);
  throw error;
} finally {
  await Promise.all(children.filter(child=>child.exitCode===null&&child.signalCode===null).map(async child=>{
    const exited=once(child,'exit');
    child.kill();
    await exited;
  }));
  if(path.dirname(path.resolve(fixture))!==tempRoot) throw new Error('Từ chối xóa ngoài thư mục fixture.');
  fs.rmSync(fixture,{recursive:true,force:true});
}
