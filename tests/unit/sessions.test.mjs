import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import { IdentityService } from '../../src/modules/identity/identity.service.mjs';
import { registerRoutes } from '../../src/modules/identity/routes.mjs';
import { SessionStore } from '../../src/modules/identity/sessions.service.mjs';
import { signSession, verifySession } from '../../src/shared/security.mjs';

const secret = 'test-only-secret-for-session-regression';
test('Thu hồi bền vững một phiên; phiên khác còn hiệu lực và role được đọc lại', () => {
  let rows = [];
  const repo = { all:()=>rows, write:value=>{ rows=value; } };
  const user = {id:'user-a',name:'QA',role:'sender'};
  const users = {get:id=>id===user.id ? user : null};
  const store = new SessionStore(repo, users, secret);
  const first = store.create(user);
  const second = store.create(user);
  assert(store.find(first));
  store.revoke(first);
  const restarted = new SessionStore(repo, users, secret);
  assert.equal(restarted.find(first),null);
  assert(restarted.find(second));
  user.role='creator';
  assert.equal(restarted.find(second).role,'creator');
  assert.equal(restarted.find(signSession(user,secret)),null, 'Token chưa được cấp bởi Identity');
});

test('JWT từ chối exp thiếu, sai kiểu, hết hạn hoặc jti thiếu dù chữ ký đúng', () => {
  for (const payload of [{sub:'a',jti:'b'}, {sub:'a',jti:'b',exp:'tomorrow'},
    {sub:'a',jti:'b',exp:0}, {sub:'a',exp:Date.now()/1000+3600}]) {
    const header=Buffer.from(JSON.stringify({alg:'HS256'})).toString('base64url');
    const body=Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature=createHmac('sha256',secret).update(`${header}.${body}`).digest('base64url');
    assert.equal(verifySession(`${header}.${body}.${signature}`,secret),null);
  }
});

test('OAuth state/PKCE vẫn khớp cookie sau tách Identity service', () => {
  const service = new IdentityService({ users: {}, sessions: {}, config: { jwtSecret: secret } });
  const cookie = service.oauthCookie('zalo', 'state-value', 'pkce-value').split(';')[0];
  assert.equal(service.consumeState({headers:{cookie}}, 'zalo', 'state-value').verifier, 'pkce-value');
  assert.throws(() => service.consumeState({headers:{cookie}}, 'zalo', 'wrong-state'), {status:403});
  assert.throws(() => service.consumeState({headers:{}}, 'zalo', 'state-value'), {status:403});
});

test('demo-admin awaits asynchronous session persistence before sending cookie and JSON', async () => {
  let handler;
  const router = { on(method, route, fn) {
    if (method === 'POST' && route === '/demo-admin') handler = fn;
  } };
  const user = { id: 'admin-fixture', provider: 'local-admin', name: 'Admin', role: 'admin', email: null, createdAt: new Date().toISOString() };
  registerRoutes(router, {
    config: { demoEnabled: true, adminCode: 'fixture-code' },
    credentials: {}, sessions: {}, roles: {},
    authLimits: { consume() {} },
    service: {
      async demoAdmin() { return user; },
      async issueSession(res) {
        await Promise.resolve(); // Simulate async session persistence (JSON or MySQL).
        res.setHeader('set-cookie', ['session=fixture; HttpOnly']);
      },
    },
  });
  assert.equal(typeof handler, 'function');
  const req = Readable.from([Buffer.from(JSON.stringify({ code: 'fixture-code' }))]);
  req.headers = { 'content-type': 'application/json' };
  const headers = new Map();
  let sentHeaders;
  let status;
  const res = {
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    writeHead(code, moreHeaders) {
      status = code;
      sentHeaders = Object.fromEntries(headers);
      for (const [key, value] of Object.entries(moreHeaders)) sentHeaders[key.toLowerCase()] = value;
    },
    end() {},
  };
  await handler({ req, res });
  assert.equal(status, 200);
  assert.deepEqual(sentHeaders['set-cookie'], ['session=fixture; HttpOnly']);
});
