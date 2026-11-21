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
export function staticFile(req, res, url, { cacheControl } = {}) {
  // Chỉ phục vụ tệp thật nằm trong web; không đọc thư mục hoặc symlink ra ngoài.
  const pathname = decodeURIComponent(url.pathname);
  const file = pathname.startsWith('/css/') || pathname.startsWith('/js/') || pathname.startsWith('/assets/') || pathname === '/favicon.svg'
    ? path.resolve(webRoot, `.${pathname}`)
    : path.join(webRoot, 'index.html');
  let safeFile = false;
  try {
    const realRoot = fs.realpathSync(webRoot);
    const realFile = fs.realpathSync(file);
    safeFile = file.startsWith(webRoot + path.sep)
      && realFile.startsWith(realRoot + path.sep)
      && fs.statSync(realFile).isFile();
  } catch {
    // Tệp không tồn tại, bị khóa hoặc không thể truy cập.
  }
  if (!safeFile) {
    res.writeHead(404);
    return res.end('Not found');
  }
  const type = mime[path.extname(file)] || 'application/octet-stream';
  const headers = {
    'content-type': type,
    'cache-control': cacheControl ?? (type.startsWith('text/html') ? 'no-store' : 'public, max-age=300'),
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-frame-options': 'DENY',
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://www.gstatic.com https://upload.wikimedia.org; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  };
  if (req.method === 'HEAD') {
    res.writeHead(200, headers);
    return res.end();
  }
  const source = fs.createReadStream(file);
  source.on('error', () => {
    // Tránh sự kiện lỗi stream không được xử lý làm dừng tiến trình HTTP.
    if (res.headersSent) res.destroy();
    else {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Unable to read file');
    }
  });
  res.writeHead(200, headers);
  return source.pipe(res);
}
