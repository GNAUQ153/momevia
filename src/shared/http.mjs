import http from 'node:http';

export const serverTimeouts = Object.freeze({
  headersTimeout: 10_000, requestTimeout: 30_000, keepAliveTimeout: 5_000,
  connectionsCheckingInterval: 1_000,
});

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function parseJson(request, maxBytes = 3_500_000) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new HttpError(415, 'Yêu cầu phải dùng application/json.');
  if (Number(request.headers['content-length']) > maxBytes) throw new HttpError(413, 'Dữ liệu gửi lên vượt quá giới hạn.');
  const chunks = [];
  let size = 0;
  for await (const part of request) {
    size += part.length;
    if (size > maxBytes) throw new HttpError(413, 'Dữ liệu gửi lên vượt quá giới hạn.');
    chunks.push(part);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object');
    return value;
  } catch {
    throw new HttpError(400, 'Dữ liệu JSON không hợp lệ.');
  }
}

export function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...headers,
  });
  res.end(JSON.stringify(data));
}

export function sendError(res, error) {
  if (res.headersSent) return res.end();
  const status = error instanceof HttpError || (error.name === 'CanvasValidationError' && error.status === 422) ? error.status : 500;
  if (status === 500) console.error(error);
  sendJson(res, status, { error: status === 500 ? 'Máy chủ gặp lỗi. Vui lòng thử lại.' : error.message,
    ...(status !== 500 && error.code ? { code: error.code, message: error.message, details: error.details || [] } : {}),
    ...(error.code === 'AUTHORIZATION_UNAVAILABLE' ? { authorization: { status: 'unavailable', reasonCodes: ['AUTHORIZATION_UNAVAILABLE'] } } : {}) });
}

export class Router {
  constructor() { this.handlers = []; }
  on(method, path, fn) {
    const fields = [];
    const pattern = path.split('/').map(segment => {
      if (segment.startsWith(':')) {
        fields.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('/');
    this.handlers.push({ method, regex: new RegExp(`^${pattern}/?$`), fields, fn });
    return this;
  }
  async handle(req, res, { pathname, url } = {}) {
    // Có thể gắn Router vào server chung mà không đổi route nghiệp vụ.
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'no-referrer');
    try {
      const parsedUrl = url ?? new URL(req.url, 'http://localhost');
      const routePath = pathname ?? parsedUrl.pathname;
      const entry = this.handlers.find(handler => handler.method === req.method && handler.regex.test(routePath));
      if (!entry) return sendJson(res, 404, { error: 'Không tìm thấy tài nguyên.' });
      const match = routePath.match(entry.regex);
      const params = Object.fromEntries(entry.fields.map((field, i) => [field, decodeURIComponent(match[i + 1])]));
      return await entry.fn({ req, res, url: parsedUrl, params });
    } catch (error) {
      sendError(res, error);
    }
  }
  listen(port) {
    const server = http.createServer(serverTimeouts, (req, res) => this.handle(req, res));
    server.listen(port, '127.0.0.1', () => console.log(`[service] http://127.0.0.1:${port}`));
    return server;
  }
}

export async function internalFetch(url, key, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'x-service-key': key, ...(options.headers || {}) },
    signal: AbortSignal.timeout(4000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new HttpError(response.status, body.error || 'Dịch vụ nội bộ không khả dụng.');
  return body;
}

export function requireInternal(req, key) {
  if (req.headers['x-service-key'] !== key) throw new HttpError(403, 'Không có quyền truy cập nội bộ.');
}
