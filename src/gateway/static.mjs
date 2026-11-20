import fs from 'node:fs';
import path from 'node:path';
import { projectRoot } from '../shared/paths.mjs';

const webRoot = path.join(projectRoot, 'web');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};
export function staticFile(req, res, url) {
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
    'referrer-policy': 'no-referrer',
    'x-frame-options': 'DENY',
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://www.gstatic.com https://upload.wikimedia.org; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}
