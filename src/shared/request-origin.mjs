import { HttpError } from './http.mjs';

function originUrl(value) {
  // Validate the raw shape before URL normalization can collapse /a/.. or
  // treat a backslash as a slash. An allowlist entry is an origin, not a path.
  if (typeof value !== 'string' || !/^https?:\/\/[^/?#\\\s]+\/?$/i.test(value)) throw new Error('Expected an HTTP(S) origin.');
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.hostname.includes('*') || url.username || url.password
    || url.pathname !== '/' || url.search || url.hash) throw new Error('Expected an HTTP(S) origin.');
  return url;
}

export function parseAllowedOrigins(value = '') {
  return [...new Set(value.split(',').map(item => item.trim()).filter(Boolean).map(item => {
    try { return originUrl(item).origin; }
    catch { throw new Error('ALLOWED_ORIGINS phải gồm các địa chỉ HTTP(S) đầy đủ, phân cách bằng dấu phẩy; không dùng wildcard hoặc đường dẫn.'); }
  }))];
}

export function requireRequestOrigin(req, config) {
  const origin = req.headers.origin;
  // CLI và các callback server-to-server không gửi Origin.
  if (origin === undefined) return;
  let requested;
  try { requested = originUrl(origin); } catch { /* Từ chối Origin null hoặc sai định dạng. */ }
  if (requested) {
    for (const allowed of [config.baseUrl, ...(config.allowedOrigins || [])]) {
      const url = originUrl(allowed);
      if (requested.origin === url.origin) return;
      if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
        && ['localhost', '127.0.0.1', '[::1]'].includes(requested.hostname)
        && requested.protocol === url.protocol && requested.port === url.port) return;
    }
  }
  throw new HttpError(403, 'Địa chỉ truy cập chưa được cho phép. Hãy mở địa chỉ đã cấu hình hoặc thêm URL này vào ALLOWED_ORIGINS.');
}
