import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
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
