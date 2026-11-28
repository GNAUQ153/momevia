import { registrationConsent } from '../../web/js/shared/registration-consent.js';
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
import { runHttpSmoke } from '../smoke/http.mjs';
import { runAuthBoundary } from './auth-boundary.mjs';

// Cả hai topology chạy từ bản sao nguồn với dữ liệu và cổng loopback riêng.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tempRoot = fs.realpathSync(os.tmpdir());
const fixture = fs.mkdtempSync(path.join(tempRoot, 'momevia-architecture-'));
const legacy = process.argv.includes('--legacy');
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

function remapLegacyPorts(directory, ports) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) remapLegacyPorts(filename, ports);
    else if (entry.isFile() && entry.name.endsWith('.mjs')) {
      const source = fs.readFileSync(filename, 'utf8');
      fs.writeFileSync(filename, source.replace(/\b410[0-5]\b/g, port => ports[Number(port) - 4100]));
    }
  }
}

async function releasePorts() {
  await Promise.all(reservations.filter(server => server.listening).map(server => new Promise(resolve => server.close(resolve))));
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

async function startFixture() {
  const ports = await Promise.all(Array.from({ length: legacy ? 6 : 1 }, reservePort));
  const [port] = ports;
  for (const directory of ['src','services','web']) {
    fs.cpSync(path.join(root,directory),path.join(fixture,directory),{
      recursive:true,filter:source => path.basename(source) !== 'data',
    });
  }
  const entry = legacy ? 'gateway.mjs' : 'dev.mjs';
  fs.copyFileSync(path.join(root, entry), path.join(fixture, entry));
  if (legacy) remapLegacyPorts(fixture, ports);
  fs.symlinkSync(path.join(root,'node_modules'),path.join(fixture,'node_modules'),'junction');
  const base=`http://127.0.0.1:${port}`;
  fs.writeFileSync(path.join(fixture, '.env'), [
    'TEST_ACCOUNT_ENABLED=true', 'TEST_ACCOUNT_NAME="Tài khoản mẫu QA"',
    'TEST_ACCOUNT_EMAIL=env-qa@example.test', 'TEST_ACCOUNT_PASSWORD=EnvFixturePass123',
    'TEST_ACCOUNT_ROLE=creator',
  ].join('\n'));
  const env={...process.env, NODE_ENV:'test', PORT:String(port), PUBLIC_BASE_URL:base,
    ALLOWED_ORIGINS:'https://qa-4110.asse.devtunnels.ms',
    IDENTITY_STORAGE:'json', CATALOG_STORAGE:'json', CHECKOUT_STORAGE:'json', GIFTS_STORAGE:'json', SUPPORT_STORAGE:'json', DESIGNS_STORAGE:'json',
    PAYMENT_ENABLED:'false', PAYMENT_LIVE_ENABLED:'false', CANVAS_READ_ENABLED:'true', CANVAS_EDIT_ENABLED:'true', CANVAS_PUBLISH_ENABLED:'true',
    JWT_SECRET:randomBytes(32).toString('hex'),INTERNAL_SERVICE_KEY:randomBytes(32).toString('hex'),
    DEMO_AUTH_ENABLED:'true',DEMO_TEMPLATE_CHECKOUT_ENABLED:'true',DEMO_ADMIN_CODE:randomBytes(24).toString('hex'),GIFT_TTL_DAYS:'365'};
  for (const key of Object.keys(env).filter(key => key.startsWith('TEST_ACCOUNT_'))) delete env[key];
  if (legacy) {
    Object.assign(env, { TEST_ACCOUNT_ENABLED: 'true', TEST_ACCOUNT_NAME: 'Legacy QA',
      TEST_ACCOUNT_EMAIL: 'legacy-env@example.test', TEST_ACCOUNT_PASSWORD: 'LegacyFixture123', TEST_ACCOUNT_ROLE: 'sender' });
  }
  await releasePorts();
  if (legacy) {
    for (const service of ['identity', 'catalog', 'checkout', 'gifts', 'support'])
      launch(`services/${service}/server.mjs`, env);
  }
  launch(entry, env);
  const health=['/api/auth/health','/api/catalog/health','/api/checkout/health','/api/gifts/health','/api/support/health'];
  await waitForHealth(base, health, children);
  assert.equal(children.length, legacy ? 6 : 1, 'Fixture phải khởi động đúng số process của topology.');
  const fabricModule = await request(base, '/js/vendor/fabric.mjs', { method: 'HEAD' });
  assert.equal(fabricModule.status, 200);
  assert.match(fabricModule.headers['content-type'], /^text\/javascript\b/, 'Fabric ESM must be served as JavaScript.');
  for (const locale of ['vi', 'en']) {
    const translations = await request(base, `/assets/locales/${locale}.json`);
    assert.equal(translations.status, 200);
    assert.match(translations.headers['content-type'], /^application\/json\b/);
    assert(translations.data['shell.meta.homeTitle']);
  }
  const seededLogin = await request(base, '/api/auth/login', { method: 'POST', body: {
    email: legacy ? env.TEST_ACCOUNT_EMAIL : 'ENV-QA@example.test',
    password: legacy ? env.TEST_ACCOUNT_PASSWORD : 'EnvFixturePass123',
  } });
  assert.equal(seededLogin.status, 200, 'Tài khoản từ .env phải đăng nhập được ngay sau khởi động');
  assert.equal(seededLogin.data.user.role, legacy ? 'sender' : 'creator');
  assert(!('passwordHash' in seededLogin.data.user));
  assert(!('testAccount' in seededLogin.data.user));
  const loginBody = { email: legacy ? env.TEST_ACCOUNT_EMAIL : 'env-qa@example.test',
    password: legacy ? env.TEST_ACCOUNT_PASSWORD : 'EnvFixturePass123' };
  for (const origin of [base, `http://localhost:${port}`, 'https://qa-4110.asse.devtunnels.ms']) {
    const login = await request(base, '/api/auth/login', { method: 'POST', body: loginBody, headers: { origin } });
    assert.equal(login.status, 200, `Login through ${origin}`);
    assert.equal((await request(base, '/api/auth/me', { cookie: sessionCookie(login) })).data.user.id, seededLogin.data.user.id);
    assert.equal((await request(base, '/api/auth/logout', { method: 'POST', cookie: sessionCookie(login), headers: { origin } })).status, 200);
  }
  for (const origin of ['https://evil.example', `http://localhost:${port + 1}`, 'https://other-4110.asse.devtunnels.ms', 'null']) {
    const denied = await request(base, '/api/auth/login', { method: 'POST', body: loginBody,
      headers: { origin, 'x-forwarded-host': new URL(base).host, 'x-forwarded-proto': 'http' } });
    assert.equal(denied.status, 403, `Reject ${origin}`);
    assert.match(denied.headers['content-type'], /application\/json/);
    assert.match(denied.data.error, /ALLOWED_ORIGINS/);
    assert.equal(denied.headers['set-cookie'], undefined);
  }
  console.log('PASS  Login/logout through loopback aliases and configured tunnel; foreign origins rejected');
  await runAuthBoundary(base, request, sessionCookie(seededLogin));
  console.log('PASS  Auth boundary: blocked writes do not change session, private responses are no-store');
  if(process.argv.includes('--browser')) {
    const { runAuthEntryBrowser } = await import('../browser/auth-entry.mjs');
    await runAuthEntryBrowser(base);
    const {runLocaleBrowser}=await import('../browser/locale.mjs');
    await runLocaleBrowser(base);
    const { runFestivalBrowser } = await import('../browser/festival.mjs');
    await runFestivalBrowser(base);
    const {runHomeBrowser}=await import('../browser/home.mjs');
    await runHomeBrowser(base);
    const {runBrowserSmoke}=await import('../browser/smoke.mjs');
    await runBrowserSmoke(base);
  }
  return { base, env, ports, seededLogin };
}

async function waitForHealth(base, routes, processes) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (processes.some(child => child.exitCode !== null || child.signalCode !== null)) throw new Error('Backend fixture kết thúc sớm.');
    const results = await Promise.all(routes.map(route => request(base, route).catch(() => null)));
    if (results.every(result => result?.status === 200 && result.data?.ok === true)) return;
    await delay(100);
  }
  assert.fail('Backend fixture không khởi động các module.');
}

const sessionCookie = result => result.headers['set-cookie'][0].split(';')[0];
const protectedRoutes = ['/api/gifts/gifts/mine', '/api/catalog/favorites', '/api/checkout/orders', '/api/support/admin/requests'];

async function checkGiftTransport(base, env, cookie, email) {
  const catalog = await request(base,'/api/catalog/templates');
  assert.equal(catalog.status, 200);
  const templateId = catalog.data.templates.find(template => template.price === 0).id;
  for (const route of [`/api/catalog/internal/templates/${templateId}`, '/api/catalog/internal', '/api/catalog/%69nternal/templates/a', '/api/checkout/internal/license/a/b']) {
    const result = await request(base,route,{headers:{'x-service-key':env.INTERNAL_SERVICE_KEY}});
    assert.equal(result.status, 403, route);
  }
  console.log('PASS  Public API không lộ endpoint /internal');

  const photo = await sharp({create:{width:2,height:2,channels:3,background:'red'}}).png().toBuffer();
  const created = await request(base,'/api/gifts/gifts',{method:'POST',cookie,body:{access:{open:'link',send:'link',read:'link'},templateId,recipientName:'Mai',senderName:'An',message:'Quà kiểm thử cô lập',photoDataUrl:`data:image/png;base64,${photo.toString('base64')}`}});
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
  return { catalog, templateId };
}

async function runLegacy({ base, env, ports, seededLogin }) {
  const senderCookie = sessionCookie(seededLogin);
  const { templateId } = await checkGiftTransport(base, env, senderCookie, env.TEST_ACCOUNT_EMAIL);
  const catalogService = `http://127.0.0.1:${ports[2]}`;
  const privateTemplate = `/internal/templates/${templateId}`;
  assert.equal((await request(catalogService, privateTemplate)).status, 403);
  const internalHeaders = { 'x-service-key': env.INTERNAL_SERVICE_KEY };
  assert.equal((await request(catalogService, privateTemplate, { headers: internalHeaders })).status, 200);
  console.log('PASS  Gateway chặn truy cập qua mạng công khai, service yêu cầu khóa nội bộ');

  const actor = await request(base, '/api/auth/register', {
    method: 'POST',
    body: { consent: registrationConsent(true, true), name: 'Legacy Creator QA', email: `legacy-creator-${randomUUID()}@example.test`,
      password: 'RegressionPass123', confirmPassword: 'RegressionPass123' },
  });
  assert.equal(actor.status, 201);
  const creatorCookie = sessionCookie(actor);
  const roleId = actor.data.user.id;
  const rolePath = `/api/auth/admin/users/${roleId}/role`;
  const admin = await request(base, '/api/auth/demo-admin', { method: 'POST', body: { code: env.DEMO_ADMIN_CODE } });
  assert.equal(admin.status, 200);
  const adminCookie = sessionCookie(admin);

  assert.equal((await request(base, '/api/checkout/orders', { cookie: senderCookie })).status, 200);
  assert.equal((await request(base, '/api/auth/logout', { method: 'POST', cookie: senderCookie })).status, 200);
  assert.equal((await request(base, '/api/auth/me', { cookie: senderCookie })).data.user, null);
  for (const route of protectedRoutes)
    assert.equal((await request(base, route, { cookie: senderCookie })).status, 401, route);
  const identity = children[0];
  const identityExited = once(identity, 'exit');
  identity.kill();
  await identityExited;
  assert.equal((await request(base, '/api/gifts/gifts/mine', { cookie: senderCookie })).status, 503);
  const restarted = launch('services/identity/server.mjs', { ...env, NODE_ENV: 'production', TEST_ACCOUNT_ENABLED: 'false' });
  await waitForHealth(base, ['/api/auth/health'], [restarted]);
  for (const route of protectedRoutes)
    assert.equal((await request(base, route, { cookie: senderCookie })).status, 401, route);
  console.log('PASS  Logout vẫn thu hồi phiên sau khi Identity khởi động lại, lỗi kết nối trả 503');

  assert.equal((await request(base, '/api/auth/providers')).data.demo, false);
  assert.equal((await request(base, '/api/auth/demo-admin', { method: 'POST', body: { code: env.DEMO_ADMIN_CODE } })).status, 403);
  assert.equal((await request(base, '/api/auth/creator', { method: 'POST', cookie: creatorCookie, body: { userId: roleId } })).status, 403);
  assert.equal((await request(base, rolePath, { method: 'POST', cookie: adminCookie, body: { role: 'creator' } })).status, 200);
  assert.equal((await request(base, '/api/catalog/creator/templates', { cookie: creatorCookie })).status, 200);
  assert.equal((await request(base, rolePath, { method: 'POST', cookie: creatorCookie, body: { role: 'admin' } })).status, 403);
  const introspection = await request(`http://127.0.0.1:${ports[1]}`, '/internal/session', {
    method: 'POST', headers: internalHeaders, body: { token: creatorCookie.slice('session='.length) },
  });
  assert.equal(introspection.status, 200);
  assert.equal(introspection.data.user.role, 'creator');
  assert.equal((await request(base, `/api/auth/admin/users/${admin.data.user.id}/role`, { method: 'POST', cookie: adminCookie, body: { role: 'sender' } })).status, 200);
  assert.equal((await request(base, rolePath, { method: 'POST', cookie: adminCookie, body: { role: 'admin' } })).status, 403);
  assert.equal((await request(base, '/api/catalog/admin/pending', { cookie: adminCookie })).status, 403);
  assert.equal((await request(base, '/api/support/admin/requests', { cookie: adminCookie })).status, 403);
  console.log('PASS  Role được cập nhật qua Identity sau khi khởi động lại ở chế độ production');
}

async function runMonolith({ base, env }) {
  const email = `architecture-${randomUUID()}@example.test`;
  const account = {consent: registrationConsent(true, true),name:'Kiểm thử kiến trúc',email,password:'RegressionPass123',confirmPassword:'RegressionPass123'};
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
  // BR06: kiểm tra cùng một session qua Identity, Catalog, Checkout và Support.
  // JSON fixture không có tài chính MySQL: 503 với đúng quyền, 403 với sai quyền.
  const actors = [undefined, cookie, creatorCookie, adminCookie];
  const roleMatrix = [
    ['/api/catalog/creator/templates', [401, 403, 200, 200]],
    ['/api/catalog/admin/pending', [401, 403, 403, 200]],
    ['/api/support/admin/requests', [401, 403, 403, 200]],
    ['/api/checkout/admin/entitlements/summary', [401, 403, 403, 200]],
    ['/api/checkout/payments/creator/statement', [401, 403, 503, 503]],
    ['/api/checkout/payments/admin/finance', [401, 403, 403, 503]],
    ['/api/checkout/payments/admin/refund-queue', [401, 403, 403, 503]],
  ];
  for (const [route, expected] of roleMatrix) {
    for (const [index, session] of actors.entries()) {
      const result = await request(base, route, { cookie: session });
      assert.equal(result.status, expected[index], `BR06 ${route}: actor ${index}`);
    }
  }
  console.log('PASS  BR06 cross-module role matrix: Guest / Sender / Creator / Admin');
  assert.equal((await request(base,'/api/auth/creator',{method:'POST',cookie:creatorCookie,body:{userId:roleId}})).status,403);
  assert.equal((await request(base,rolePath,{method:'POST',cookie:creatorCookie,body:{role:'admin'}})).status,403);
  assert.equal((await request(base,rolePath,{method:'POST',cookie:adminCookie,body:{role:'owner'}})).status,400);
  assert.equal((await request(base,'/api/auth/admin/users/missing/role',{method:'POST',cookie:adminCookie,body:{role:'creator'}})).status,404);
  assert.equal((await request(base,rolePath,{method:'POST',cookie:adminCookie,body:{role:'sender'}})).status,200);
  assert.equal((await request(base,'/api/catalog/creator/templates',{cookie:creatorCookie})).status,403);
  assert.equal((await request(base,'/api/checkout/payments/creator/statement',{cookie:creatorCookie})).status,403);
  assert.equal((await request(base,'/api/catalog/creator/templates',{method:'POST',cookie:creatorCookie,body:{title:'Blocked role',subtitle:'Denied after demotion',theme:'rose',price:0}})).status,403);
  const compatibility=await request(base,'/api/auth/creator',{method:'POST',cookie:adminCookie,body:{userId:roleId}});
  assert.equal(compatibility.status,200);
  assert.equal(compatibility.headers['set-cookie'],undefined);
  assert.equal((await request(base,rolePath,{method:'POST',cookie:adminCookie,body:{role:'sender'}})).status,200);
  console.log('PASS  Only Admin changes roles; Sender/Creator cannot self-promote; demotion overrides old JWT claims');

  const { catalog, templateId } = await checkGiftTransport(base, env, cookie, email);

  await runHttpSmoke(base, { adminCode: env.DEMO_ADMIN_CODE });

  const extraGift = await request(base,'/api/gifts/gifts',{method:'POST',cookie,body:{access:{open:'link',send:'link',read:'link'},templateId,recipientName:'QA',senderName:'QA',message:'Concurrent reply regression'}});
  assert.equal(extraGift.status,201);
  const extraRoute = `/api/gifts/gifts/${extraGift.data.gift.slug}`;
  const replyResults = await Promise.all(Array.from({length:3},(_,i)=>request(base,`${extraRoute}/replies`,{method:'POST',body:{message:`Concurrent reply ${i}`}})));
  assert(replyResults.every(result=>result.status===201));
  assert.equal((await request(base,`${extraRoute}/replies`)).data.replies.length,3);
  assert.equal((await request(base,extraRoute)).data.gift.replyCount,3);
  // Thư viện hiện chỉ có Originals miễn phí; dùng mẫu trả phí cũ còn mua được qua link trực tiếp.
  const paidId = catalog.data.templates.find(template=>template.price>0)?.id || 'midnight-bloom';
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
  for (const route of protectedRoutes) assert.equal((await request(base,route,{cookie})).status,401,route);
  assert.equal((await request(base,`/api/auth/admin/users/${adminId}/role`,{method:'POST',cookie:adminCookie,body:{role:'sender'}})).status,200);
  assert.equal((await request(base,rolePath,{method:'POST',cookie:adminCookie,body:{role:'admin'}})).status,403);
  assert.equal((await request(base,'/api/catalog/admin/pending',{cookie:adminCookie})).status,403);
  assert.equal((await request(base,'/api/support/admin/requests',{cookie:adminCookie})).status,403);
  console.log('PASS  Mất quyền Admin làm vô hiệu hóa quyền truy cập trên mọi module');
  console.log('PASS  Tất cả module chia một HTTP process, bảo toàn public API và truy cập dữ liệu tách biệt');
}

try {
  const topology = await startFixture();
  if (legacy) await runLegacy(topology);
  else await runMonolith(topology);
} catch(error) {
  console.error(logs);
  throw error;
} finally {
  await releasePorts();
  await Promise.all(children.filter(child=>child.exitCode===null&&child.signalCode===null).map(async child=>{
    const exited=once(child,'exit');
    child.kill();
    await exited;
  }));
  if(path.dirname(path.resolve(fixture))!==tempRoot) throw new Error('Từ chối xóa ngoài thư mục fixture.');
  fs.rmSync(fixture,{recursive:true,force:true});
}
