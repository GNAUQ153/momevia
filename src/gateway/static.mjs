import { createGzip } from 'node:zlib';
import {Readable} from 'node:stream';
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
export function staticFile(req, res, url, { cacheControl, publicCatalog } = {}) {
  // Chỉ phục vụ tệp thật nằm trong web; không đọc thư mục hoặc symlink ra ngoài.
  const pathname = decodeURIComponent(url.pathname);
  const file = pathname.startsWith('/css/') || pathname.startsWith('/js/') || pathname.startsWith('/assets/') || pathname === '/favicon.svg'
    ? path.resolve(webRoot, `.${pathname}`)
    : fs.existsSync(path.join(webRoot,'assets/app/index.html')) ? path.join(webRoot,'assets/app/index.html') : path.join(webRoot, 'index.html');
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
  const compressible = type.startsWith('text/') || ['image/svg+xml','application/json'].includes(type);
  const encodings=new Map(String(req.headers['accept-encoding']||'').split(',').map(value=>{const [name,...params]=value.trim().toLowerCase().split(';'),quality=params.find(p=>p.trim().startsWith('q='));return [name,quality?Number(quality.trim().slice(2)):1];}));
  const quality=name=>{const n=encodings.get(name)??encodings.get('*')??0;return Number.isFinite(n)&&n>=0&&n<=1?n:0;};
  let brotli=false;
  if(compressible&&!type.startsWith('text/html')&&quality('br')>0&&quality('br')>=quality('gzip'))try{const candidate=fs.realpathSync(file+'.br');brotli=candidate.startsWith(fs.realpathSync(webRoot)+path.sep)&&fs.statSync(candidate).isFile();}catch{/* Source mode and older builds use gzip. */}
  const gzip = compressible&&!brotli&&quality('gzip')>0;
  headers.vary = 'Accept-Encoding';
  if (gzip||brotli) headers['content-encoding'] = brotli?'br':'gzip';
  if (req.method === 'HEAD') {
    res.writeHead(200, headers);
    return res.end();
  }
  let source;
  if(type.startsWith('text/html')&&publicCatalog){
    // Public DTO only, never auth or private design data. Escaping '<' also
    // prevents a Creator title containing </script> from closing this data tag.
    const data=JSON.stringify(publicCatalog).replaceAll('<','\\u003c');
    const html=fs.readFileSync(file,'utf8').replace(/(<link id="app-fonts"[^>]*href=")[^"]*("[^>]*data-catalog-css="([^"]+)")/,(_,before,rest,catalogCss)=>before+catalogCss+rest);
    const tag=`<script type="application/json" id="public-catalog-bootstrap">${data}</script>`,charset=/<meta charset="UTF-8"\s*\/?>/i;
    source=Readable.from([charset.test(html)?html.replace(charset,match=>match+tag):html.replace('<head>','<head>'+tag)]);
  }else source=fs.createReadStream(brotli?file+'.br':file);
  source.on('error', () => {
    // Tránh sự kiện lỗi stream không được xử lý làm dừng tiến trình HTTP.
    if (res.headersSent) res.destroy();
    else {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Unable to read file');
    }
  });
  res.writeHead(200, headers);
  if (!gzip) return source.pipe(res);
  const compressed = createGzip();compressed.on('error', () => res.destroy());
  return source.pipe(compressed).pipe(res);
}
