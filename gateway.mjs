import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { environment } from './services/shared/config.mjs';
import { isInternalRoute, upstreamHeaders } from './services/shared/proxy.mjs';
import { serverTimeouts } from './services/shared/http.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const config = environment();
const webRoot = path.join(root, 'web');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};
function proxy(req, res, target, route) {
  const options = {
    hostname: '127.0.0.1', port: target,
    path: route, method: req.method,
    headers: upstreamHeaders(req, target),
  };
  const upstream = http.request(options, response => {
    res.writeHead(response.statusCode || 502, response.headers);
    response.pipe(res);
  });
  upstream.setTimeout(30_000, () => upstream.destroy(new Error('Upstream timeout')));
  req.on('aborted', () => upstream.destroy());
  res.on('close', () => { if (!res.writableEnded) upstream.destroy(); });
  upstream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({error:'Dịch vụ đang khởi động hoặc tạm thời không khả dụng.'}));
    } else res.destroy();
  });
  req.pipe(upstream);
}
function staticFile(req, res, url) {
  // Trình duyệt định tuyến phía client cho mọi đường dẫn không phải /api/.
  const pathname = decodeURIComponent(url.pathname);
  const file = pathname.startsWith('/css/') || pathname.startsWith('/js/') || pathname.startsWith('/assets/') || pathname === '/favicon.svg'
    ? path.resolve(webRoot, `.${pathname}`)
    : path.join(webRoot, 'index.html');
  if (!file.startsWith(webRoot + path.sep) || !fs.existsSync(file)) {
    res.writeHead(404);
    return res.end('Not found');
  }
  const type = mime[path.extname(file)] || 'application/octet-stream';
  res.writeHead(200, {
    'content-type': type,
    'cache-control': type.startsWith('text/html') ? 'no-store' : 'public, max-age=300',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-frame-options': 'DENY',
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://www.gstatic.com https://upload.wikimedia.org; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}
const routes = [
  ['/api/auth', 4101],
  ['/api/catalog', 4102],
  ['/api/checkout', 4104],
  ['/api/gifts', 4103],
  ['/api/support', 4105],
];
http.createServer(serverTimeouts, (req, res) => {
  try {
    const url = new URL(req.url, config.baseUrl);
    const service = routes.find(([prefix]) => url.pathname === prefix || url.pathname.startsWith(prefix + '/'));
    if (service) {
      const route = url.pathname.slice(service[0].length) || '/';
      if (isInternalRoute(route)) {
        res.writeHead(403, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        return res.end(JSON.stringify({ error: 'Không có quyền truy cập nội bộ qua Gateway.' }));
      }
      if (!['GET', 'HEAD', 'POST'].includes(req.method)) {
        res.writeHead(405); return res.end();
      }
      // Bảo vệ các thao tác ghi khỏi yêu cầu cross-origin qua cookie phiên.
      if (req.method === 'POST' && req.headers.origin && req.headers.origin !== config.baseUrl) {
        res.writeHead(403); return res.end('Cross-origin request blocked');
      }
      return proxy(req, res, service[1], route + url.search);
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405); return res.end();
    }
    staticFile(req, res, url);
  } catch(error) {
    res.writeHead(400); res.end('Invalid request');
  }
}).listen(4100, '127.0.0.1', () => console.log('[gateway] http://localhost:4100'));
