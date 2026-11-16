import test from 'node:test';
import assert from 'node:assert/strict';
import { IdentityService } from '../../src/modules/identity/identity.service.mjs';

test('OAuth state/PKCE vẫn khớp cookie sau tách Identity service', () => {
  const service = new IdentityService({ users: {}, sessions: {}, config: {} });
  const cookie = service.oauthCookie('zalo', 'state-value', 'pkce-value').split(';')[0];
  assert.equal(service.consumeState({headers:{cookie}}, 'zalo', 'state-value'), 'pkce-value');
  assert.throws(() => service.consumeState({headers:{cookie}}, 'zalo', 'wrong-state'), {status:403});
  assert.throws(() => service.consumeState({headers:{}}, 'zalo', 'state-value'), {status:403});
});
