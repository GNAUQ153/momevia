import http from 'node:http';
import { environment } from '../shared/config.mjs';
import { isInternalRoute } from '../shared/proxy.mjs';
import { serverTimeouts, sendError } from '../shared/http.mjs';
import { requireRequestOrigin } from '../shared/request-origin.mjs';
import { proxy } from './proxy.mjs';
import { staticFile } from './static.mjs';

const config = environment();
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
      if (req.method === 'POST') requireRequestOrigin(req, config);
      return proxy(req, res, service[1], route + url.search);
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405); return res.end();
    }
    staticFile(req, res, url);
  } catch(error) {
    if (error.status) return sendError(res, error);
    res.writeHead(400); res.end('Invalid request');
  }
}).listen(4100, '127.0.0.1', () => console.log('[gateway] http://localhost:4100'));
