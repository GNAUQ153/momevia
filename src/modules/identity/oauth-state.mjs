import { createHmac, timingSafeEqual } from 'node:crypto';
import { localizedError } from '../../shared/http.mjs';
import { cookie, parseCookies } from '../../shared/security.mjs';

const lifetime = 600;
const signature = (secret, provider, payload) => createHmac('sha256', secret)
  .update(`momevia:oauth-state:v1:${provider}:${payload}`).digest();

// State có chữ ký và hạn dùng phía máy chủ; không chứa hồ sơ hoặc access token.
export function oauthStateCookie(secret, provider, state, verifier, { recovery = false, consent = null } = {}) {
  const payload = Buffer.from(JSON.stringify({ state, verifier, recovery, consent,
    expires: Math.floor(Date.now() / 1000) + lifetime })).toString('base64url');
  return cookie(`oauth_${provider}`, `${payload}.${signature(secret, provider, payload).toString('base64url')}`, lifetime);
}

export function readOAuthState(secret, req, provider, state) {
  const invalid = () => localizedError(403, 'errors.auth.oauthSession');
  const raw = parseCookies(req.headers.cookie || '')[`oauth_${provider}`] || '';
  if (raw.length > 4096) throw invalid();
  const parts = raw.split('.');
  if (parts.length !== 2 || !state) throw invalid();
  const [payload, mac] = parts;
  const expected = signature(secret, provider, payload);
  const actual = Buffer.from(mac, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw invalid();
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString()); }
  catch { throw invalid(); }
  if (!data || data.state !== state || typeof data.verifier !== 'string' ||
      !Number.isInteger(data.expires) || data.expires <= Math.floor(Date.now() / 1000)) throw invalid();
  return data;
}
