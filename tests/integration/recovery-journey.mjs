import { registrationConsent } from '../../web/js/shared/registration-consent.js';
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

export async function runRecovery(base, { messageFor, mailFor, advance }) {
  const call = async (route, expected, { body, cookie, locale } = {}) => {
    const res = await fetch(base + '/api' + route, { redirect: 'manual', method: body ? 'POST' : 'GET',
      headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}),
        ...(locale ? { 'x-momevia-locale': locale } : {}) },
      body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => null);
    assert.equal(res.status, expected, `${route}: ${JSON.stringify(data)}`);
    return { data, location: res.headers.get('location'), cookie: res.headers.getSetCookie()[0]?.split(';')[0] };
  };
  const email = `recovery-${randomUUID()}@example.test`, oldPassword = 'OldSynthetic123', password = 'NewSynthetic123';
  const matches = message => /\b\d{8}\b/.exec(message)?.[0];
  const assertMail = async (address, subject, expiry) => {
    if (!mailFor) return;
    const mail = await mailFor(address);
    assert.equal(mail.subject, subject);
    assert.match(mail.text, /\b\d{8}\b/);
    assert.match(mail.text, expiry);
  };
  const viExpiry = /một lần và có hiệu lực trong 15 phút/, enExpiry = /once within 15 minutes/;
  // A newly registered email account can recover before the optional verify-email journey.
  // Possession of the one-time code verifies ownership and invalidates old sessions.
  const freshEmail = `fresh-${randomUUID()}@example.test`;
  const fresh = await call('/auth/register', 201, { body: { consent: registrationConsent(true, true),
    email: freshEmail, name: 'Tài khoản chưa xác minh', password: oldPassword, confirmPassword: oldPassword,
  } });
  assert.equal(fresh.data.user.emailVerified, false);
  if (mailFor) {
    await call('/auth/verify-email/request', 202, { cookie: fresh.cookie, body: {} });
    await assertMail(freshEmail, 'Mã xác minh email Momevia', viExpiry);
    advance(60_001);
  }
  await call('/auth/recover/request', 202, { body: { email: freshEmail } });
  await assertMail(freshEmail, 'Mã đặt lại mật khẩu Momevia', viExpiry);
  const freshCode = matches(await messageFor(freshEmail));
  assert.match(freshCode, /^\d{8}$/);
  const freshReset = await call('/auth/recover/confirm', 200, { body: {
    email: freshEmail, code: freshCode, password, confirmPassword: password,
  } });
  assert.equal(freshReset.data.user.id, fresh.data.user.id);
  assert.equal(freshReset.data.user.emailVerified, true);
  assert.equal((await call('/auth/me', 200, { cookie: fresh.cookie })).data.user, null);
  await call('/auth/login', 401, { body: { email: freshEmail, password: oldPassword } });
  await call('/auth/login', 200, { body: { email: freshEmail, password } });
  await call('/auth/recover/confirm', 422, { body: {
    email: freshEmail, code: freshCode, password, confirmPassword: password,
  } });
  const owner = await call('/auth/register', 201, { body: { consent: registrationConsent(true, true), email, name: 'Tài khoản khôi phục QA', password: oldPassword, confirmPassword: oldPassword } });
  const gift = (await call('/gifts/gifts', 201, { cookie: owner.cookie, body: {
    templateId: 'sunny-wishes', recipientName: 'Mai', senderName: 'An', message: 'Quà có trước khôi phục.',
  } })).data.gift;
  const draft = (await call('/designs/designs', 201, { cookie: owner.cookie,
    body: { source: { kind: 'blank' }, mutationId: randomUUID() } })).data.design;
  await call('/auth/verify-email/request', 202, { cookie: owner.cookie, locale: 'en', body: {} });
  await assertMail(email, 'Momevia email verification code', enExpiry);
  const verify = await call('/auth/verify-email/confirm', 200, { cookie: owner.cookie, body: { code: matches(await messageFor(email)) } });
  assert.equal(verify.data.user.emailVerified, true);
  await call('/auth/recover/request', 202, { locale: 'en', body: { email } });
  await assertMail(email, 'Momevia password reset code', enExpiry);
  if (mailFor) console.log('PASS Fake mail relay: English and default Vietnamese verification and reset, eight-digit OTP and 15-minute expiry copy.');
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
    const start = mode === 'register' ? await call('/auth/google/start', 200, { body: { consent: registrationConsent(true, true) } })
      : await call('/auth/google' + mode, 302);
    const state = new URL(start.data?.url || start.location).searchParams.get('state');
    return call(`/auth/google/callback?state=${state}&code=${code}`, 302, { cookie: start.cookie });
  };
  const denied = await google('', 'synthetic-known');
  assert.match(denied.location, /\/register\?oauth=consent$/);
  const first = await google('register', 'synthetic-known');
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
