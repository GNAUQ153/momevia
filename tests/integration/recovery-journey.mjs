import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export function simulatedGoogle(input, options) {
  const url = new URL(input);
  if (url.origin === 'https://oauth2.googleapis.com') {
    const code = options.body.get('code');
    assert.match(code, /^synthetic-(known|unlinked)$/);
    return Response.json({ access_token: code });
  }
  if (url.origin === 'https://openidconnect.googleapis.com') {
    const code = options.headers.authorization.replace('Bearer ', '');
    return Response.json({ sub: code, email: 'linked@example.test', name: 'Google tổng hợp' });
  }
  return null;
}

export async function runRecovery(base, { messageFor, advance }) {
  const call = async (route, expected, { body, cookie } = {}) => {
    const res = await fetch(base + '/api' + route, { redirect: 'manual', method: body ? 'POST' : 'GET',
      headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => null);
    assert.equal(res.status, expected, `${route}: ${JSON.stringify(data)}`);
    return { data, location: res.headers.get('location'), cookie: res.headers.getSetCookie()[0]?.split(';')[0] };
  };
  const email = `recovery-${randomUUID()}@example.test`, oldPassword = 'OldSynthetic123', password = 'NewSynthetic123';
  const matches = message => /\b\d{8}\b/.exec(message)?.[0];
  const owner = await call('/auth/register', 201, { body: { email, name: 'Tài khoản khôi phục QA', password: oldPassword, confirmPassword: oldPassword } });
  const gift = (await call('/gifts/gifts', 201, { cookie: owner.cookie, body: {
    templateId: 'sunny-wishes', recipientName: 'Mai', senderName: 'An', message: 'Quà có trước khôi phục.',
  } })).data.gift;
  const draft = (await call('/designs/designs', 201, { cookie: owner.cookie,
    body: { source: { kind: 'blank' }, mutationId: randomUUID() } })).data.design;
  await call('/auth/recover/request', 202, { body: { email } });
  assert.equal(await messageFor(email), undefined);
  await call('/auth/verify-email/request', 202, { cookie: owner.cookie, body: {} });
  const verify = await call('/auth/verify-email/confirm', 200, { cookie: owner.cookie, body: { code: matches(await messageFor(email)) } });
  assert.equal(verify.data.user.emailVerified, true);
  await call('/auth/recover/request', 202, { body: { email } });
  let body = { email, code: matches(await messageFor(email)), password, confirmPassword: password };
  assert.match(body.code, /^\d{8}$/);
  advance(15 * 60_000);
  await call('/auth/recover/confirm', 422, { body });
  await call('/auth/recover/request', 202, { body: { email } });
  body = { ...body, code: matches(await messageFor(email)) };
  const recovered = await call('/auth/recover/confirm', 200, { body });
  await call('/auth/recover/confirm', 422, { body });
  assert.equal(recovered.data.user.id, owner.data.user.id);
  assert.equal((await call('/auth/me', 200, { cookie: owner.cookie })).data.user, null);
  await call('/auth/login', 401, { body: { email, password: oldPassword } });
  const login = await call('/auth/login', 200, { body: { email, password } });
  assert.equal(login.data.user.id, recovered.data.user.id);
  await call(`/designs/designs/${draft.id}`, 200, { cookie: recovered.cookie });
  await call(`/gifts/gifts/mine/${gift.slug}`, 200, { cookie: recovered.cookie });

  const google = async (mode, code) => {
    const start = await call('/auth/google' + mode, 302);
    const state = new URL(start.location).searchParams.get('state');
    return call(`/auth/google/callback?state=${state}&code=${code}`, 302, { cookie: start.cookie });
  };
  const first = await google('', 'synthetic-known');
  const initial = (await call('/auth/me', 200, { cookie: first.cookie })).data.user;
  const googleDraft = (await call('/designs/designs', 201, { cookie: first.cookie, body: {
    source: { kind: 'blank' }, mutationId: randomUUID(),
  } })).data.design;
  const linked = await google('?recover=1', 'synthetic-known');
  assert.equal((await call('/auth/me', 200, { cookie: linked.cookie })).data.user.id, initial.id);
  await call(`/designs/designs/${googleDraft.id}`, 200, { cookie: linked.cookie });
  const unlinked = await google('?recover=1', 'synthetic-unlinked');
  assert.match(unlinked.location, /\/recover\?google=unlinked$/);
  assert.match(unlinked.cookie, /^oauth_google=/);
}
