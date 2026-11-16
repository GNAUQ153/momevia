import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { HttpError, internalFetch } from './http.mjs';
import { environment } from './config.mjs';

export function signSession(user, secret, ttlSeconds = 7 * 24 * 3600) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: user.id, role: user.role, name: user.name, jti: randomId(24), exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString('base64url');
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export function verifySession(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
  const actual = Buffer.from(parts[2], 'base64url');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (header.alg !== 'HS256' || typeof payload.sub !== 'string' || !payload.sub
      || typeof payload.jti !== 'string' || !payload.jti || !Number.isFinite(payload.exp) || payload.exp <= Date.now() / 1000) return null;
    return payload;
  } catch { return null; }
}

export function sessionToken(req) {
  const bearer = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
  const cookie = parseCookies(req.headers.cookie || '').session;
  return bearer || cookie;
}

export async function currentUser(req, secret, required = true) {
  const token = sessionToken(req);
  let user = verifySession(token, secret);
  if (user) {
    const config = environment();
    // Không cache: đăng xuất phải có hiệu lực ngay ở mọi service.
    try {
      const result = await internalFetch('http://127.0.0.1:4101/internal/session', config.internalKey, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }),
      });
      user = result.user;
    } catch {
      throw new HttpError(503, 'Không thể kiểm tra phiên đăng nhập. Vui lòng thử lại.');
    }
  }
  if (!user && required) throw new HttpError(401, 'Vui lòng đăng nhập để tiếp tục.');
  return user;
}

export function parseCookies(cookieString) {
  return Object.fromEntries(cookieString.split(';').map(row => row.trim()).filter(Boolean).map(row => {
    const index = row.indexOf('=');
    return [row.slice(0, index), row.slice(index + 1)];
  }));
}

export function cookie(name, value, maxAge = 600) {
  const secure = process.env.PUBLIC_BASE_URL?.startsWith('https://') ? '; Secure' : '';
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function randomId(bytes = 18) { return randomBytes(bytes).toString('base64url'); }
export function sanitizeText(value, max = 160) {
  if (typeof value !== 'string') throw new HttpError(400, 'Trường văn bản không hợp lệ.');
  const trimmed = value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').trim();
  if (!trimmed || trimmed.length > max) throw new HttpError(400, `Nội dung bắt buộc từ 1 đến ${max} ký tự.`);
  return trimmed;
}
export function sanitizeOptionalText(value, max = 160) {
  return value ? sanitizeText(value, max) : '';
}
