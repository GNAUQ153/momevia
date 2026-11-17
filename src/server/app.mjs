import http from 'node:http';
import { environment } from '../shared/config.mjs';
import { HttpError, sendError, serverTimeouts } from '../shared/http.mjs';
import { isInternalRoute } from '../shared/proxy.mjs';
import { sessionToken } from '../shared/security.mjs';
import { staticFile } from '../gateway/static.mjs';
import { createApp as identityApp } from '../modules/identity/app.mjs';
import { createApp as catalogApp } from '../modules/catalog/app.mjs';
import { createApp as checkoutApp } from '../modules/checkout/app.mjs';
import { createApp as giftsApp } from '../modules/gifts/app.mjs';
import { createApp as supportApp } from '../modules/support/app.mjs';

const prefixes = [
  ['/api/auth', 'identity'],
  ['/api/catalog', 'catalog'],
  ['/api/checkout', 'checkout'],
  ['/api/gifts', 'gifts'],
  ['/api/support', 'support'],
];

export async function createHttpApp(config = environment()) {
  const identity = await identityApp(config);
  // Phiên và role được xác nhận từ Identity module tại mỗi request, kể cả sau khi logout.
  const resolveUser = async (req, _secret, required = true) => {
    const user = identity.sessions.find(sessionToken(req));
    if (!user && required) throw new HttpError(401, 'Vui lòng đăng nhập để tiếp tục.');
    return user;
  };
  const catalog = catalogApp(config, { resolveUser });
  const checkout = checkoutApp(config, {
    resolveUser,
    catalog: { getTemplate: async id => catalog.service.publicOne(id) },
  });
  const gifts = giftsApp(config, {
    resolveUser,
    catalog: { getTemplate: async id => catalog.service.publicOne(id) },
    checkout: { hasLicense: async (userId, templateId) => checkout.service.hasLicense(userId, templateId) },
  });
  const support = supportApp(config, { resolveUser });
  const modules = { identity, catalog, checkout, gifts, support };

  const server = http.createServer(serverTimeouts, (req, res) => {
    try {
      const url = new URL(req.url, config.baseUrl);
      const matching = prefixes.find(([prefix]) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));
      if (matching) {
        const [prefix, name] = matching;
        const pathname = url.pathname.slice(prefix.length) || '/';
        // Từ chối public API nội bộ, kể cả khi người gọi biết khóa service cũ.
        if (isInternalRoute(pathname)) {
          res.writeHead(403, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
          return res.end(JSON.stringify({ error: 'Không có quyền truy cập nội bộ qua API.' }));
        }
        if (!['GET', 'HEAD', 'POST'].includes(req.method)) {
          res.writeHead(405); return res.end();
        }
        if (req.method === 'POST' && req.headers.origin && req.headers.origin !== config.baseUrl) {
          res.writeHead(403); return res.end('Cross-origin request blocked');
        }
        // Không tin header do trình duyệt/client tự khai khi server nhận trực tiếp.
        for (const name of ['x-forwarded-for', 'x-real-ip', 'forwarded', 'x-service-key']) {
          delete req.headers[name];
        }
        return modules[name].router.handle(req, res, { pathname, url });
      }
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405); return res.end();
      }
      staticFile(req, res, url);
    } catch (error) {
      sendError(res, error);
    }
  });
  return {
    server,
    modules,
    listen(port = 4100, host = '127.0.0.1') {
      server.listen(port, host, () => console.log(`[Momevia] http://${host}:${port} — một backend process`));
      return server;
    },
    close() { Object.values(modules).forEach(module => module.close?.()); },
  };
}
