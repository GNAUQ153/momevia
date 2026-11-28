import assert from 'node:assert/strict';

// Shared scenario: call through the real public HTTP boundary, not IdentityRouter directly.
// The caller owns an isolated fixture account and provides its cookie.
export async function runAuthBoundary(base, request, cookie) {
  const call = (path, options = {}) => request(base, `/api/auth${path}`, { cookie, ...options });
  const get = async path => {
    const result = await call(path);
    assert.equal(result.status, 200, path);
    assert.equal(result.headers['cache-control'], 'no-store', path);
    return result.data;
  };
  const before = await get('/me');
  assert.ok(before.user?.id);
  const sessions = await get('/sessions');
  assert.equal(sessions.sessions.filter(row => row.current).length, 1);
  await get('/consent');
  await get('/consent/history');
  const writes = [
    ['/logout', {}],
    ['/sessions/revoke-others', { confirm: true }],
    ['/sessions/revoke', { confirm: true, ref: 'a'.repeat(64) }],
    ['/password/change', { currentPassword: 'FixtureOnly123', password: 'NewFixture123', confirmPassword: 'NewFixture123', confirmLogout: true }],
    ['/consent/confirm', {}],
    ['/google/start', {}],
    ['/zalo/start', {}],
  ];
  const denied = [
    { origin: 'https://untrusted.example', 'x-forwarded-host': new URL(base).host, 'x-forwarded-proto': 'http' },
    { origin: 'null' },
    { 'sec-fetch-site': 'cross-site' },
  ];
  for (const [path, body] of writes) {
    for (const headers of denied) {
      const response = await call(path, { method: 'POST', body, headers });
      assert.equal(response.status, 403, `${path}: must reject before handler`);
      assert.equal(response.headers['cache-control'], 'no-store', path);
      assert.equal(response.headers['set-cookie'], undefined, path);
    }
  }
  // GET must not execute a write handler, even with a valid session cookie.
  for (const [path] of writes) assert.equal((await call(path)).status, 404, path);
  for (const path of ['/internal/session', '/%69nternal/session', '/internal%2Fsession']) {
    const response = await call(path, { method: 'POST', body: { token: 'fixture-only' }, headers: { origin: base } });
    assert.equal(response.status, 403, path);
    assert.equal(response.headers['cache-control'], 'no-store', path);
  }
  const media = await call('/sessions/revoke-others', { method: 'POST', body: { confirm: true }, headers: { origin: base, 'content-type': 'text/plain' } });
  assert.equal(media.status, 415);
  assert.deepEqual(await get('/me'), before);
  assert.deepEqual(await get('/sessions'), sessions);
}
