import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { registerRoutes } from '../../src/modules/identity/routes.mjs';

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
