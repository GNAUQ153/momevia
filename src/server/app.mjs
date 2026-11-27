import {requireLocalVideo} from '../modules/designs/local-video.service.mjs';
import { createPerformanceMonitor, performanceInterval } from '../shared/performance-monitor.mjs';
import { MySqlClient } from '../infrastructure/mysql/client.mjs';
import { receiptFor } from '../modules/gifts/recipients.mjs';
import http from 'node:http';
import https from 'node:https';
import { loadTlsOptions } from '../shared/tls.mjs';
import { environment } from '../shared/config.mjs';
import { HttpError, sendError, serverTimeouts, localizedError } from '../shared/http.mjs';
import { isInternalRoute } from '../shared/proxy.mjs';
import { requireRequestOrigin } from '../shared/request-origin.mjs';
import { sessionToken } from '../shared/security.mjs';
import { staticFile } from '../gateway/static.mjs';
import { createApp as identityApp } from '../modules/identity/app.mjs';
import { createApp as catalogApp } from '../modules/catalog/app.mjs';
import { createApp as checkoutApp } from '../modules/checkout/app.mjs';
import { createApp as giftsApp } from '../modules/gifts/app.mjs';
import { createApp as supportApp } from '../modules/support/app.mjs';
import { createApp as designsApp } from '../modules/designs/app.mjs';
import { registerPublicationRoutes, registerContextRoutes, streamAsset } from '../modules/designs/routes.mjs';
import { canvasError } from '../modules/designs/errors.mjs';
import { requireGiftPermission } from '../modules/gifts/access.mjs';
import { CreatorTemplates } from '../modules/catalog/creator-templates.mjs';
import { registerCreatorRoutes } from '../modules/catalog/creator-routes.mjs';

const prefixes = [
  ['/api/auth', 'identity'],
  ['/api/catalog', 'catalog'],
  ['/api/checkout', 'checkout'],
  ['/api/gifts', 'gifts'],
  ['/api/support', 'support'],
  ['/api/designs', 'designs'],
];

export async function createHttpApp(config = environment(), options = {}) {
  // Composition Root sở hữu một client lazy cho toàn bộ module trong tiến trình.
  const monitor = createPerformanceMonitor({ intervalMs: performanceInterval() });
  const mysqlClient = (options.createMysqlClient ?? (() => new MySqlClient({ monitor })))();
  const modules = {};
  let closing;
  const close = () => closing ??= (async () => {
    monitor?.stop();
    const results = await Promise.allSettled(Object.values(modules).map(async module => module.close?.()));
    results.push(...await Promise.allSettled([mysqlClient.close()]));
    const errors = results.filter(result => result.status === 'rejected').map(result => result.reason);
    if (errors.length) throw new AggregateError(errors, 'Không đóng được toàn bộ tài nguyên Backend.');
  })();
  try {
    const app = await assembleHttpApp(config, options, mysqlClient, modules, close, monitor);
    monitor?.start(() => mysqlClient.active?.size ?? 0);
    return app;
  } catch (error) {
    // Startup lỗi vẫn đóng module đã khởi tạo và pool; giữ lỗi gốc.
    try { await close(); } catch { /* Giữ lỗi startup. */ }
    throw error;
  }
}

async function assembleHttpApp(config, { paymentProviders, paymentEnv, sendRecoveryMail, recoveryNow, staticOptions }, mysqlClient, modules, close, monitor) {
  const tlsOptions = loadTlsOptions(config);
  const identity = modules.identity = await identityApp(config, { sendRecoveryMail, recoveryNow, mysqlClient });
  // Phiên và role được xác nhận từ Identity module tại mỗi request, kể cả sau khi logout.
  const resolveUser = async (req, _secret, required = true) => {
    const user = await identity.sessions.find(sessionToken(req));
    if (!user && required) throw localizedError(401, 'errors.unauthorized');
    return user;
  };
  const catalog = modules.catalog = await catalogApp(config, { resolveUser, mysqlClient });
  const checkout = modules.checkout = await checkoutApp(config, {
    resolveUser, mysqlClient,
    paymentProviders, paymentEnv,
    catalog: { getTemplate: async id => catalog.service.publicOne(id) },
  });
  const designs = modules.designs = await designsApp(config, {
    resolveUser, mysqlClient,
    catalog: { getTemplate: id => catalog.service.publicOne(id),
      approvedVersion: (id, version) => catalog.service.creatorTemplates.approved(id, version),
      reusableVersion: (id, version) => catalog.service.creatorTemplates.reusable(id, version) },
    checkout: { hasLicense: (userId, templateId) => checkout.service.hasLicense(userId, templateId) },
    orders: user => checkout.service.orders(user),
  });
  const creatorTemplates = new CreatorTemplates(catalog.service.repo, {
    async getDraft(user, id) {
      const draft = await designs.service.get(user, id);
      if (draft.provenance?.purpose !== 'creator') throw new HttpError(404, 'Không tìm thấy nháp mẫu.');
      return draft;
    },
    async getAsset(user, id) {
      const asset = await designs.repository.getAsset(user.sub, id);
      const source = asset && await designs.repository.get(user.sub, asset.designId);
      if (source?.provenance?.purpose !== 'creator' || asset.status !== 'ready' || !designs.service.assetExists(asset))
        throw new HttpError(422, 'Ảnh demo phải được tải từ Creator Studio và sẵn sàng.');
      return asset;
    },
    async canCreate(ownerId) {
      return ['creator', 'admin'].includes((await identity.service.users.get(ownerId))?.role);
    },
  });
  catalog.service.creatorTemplates = creatorTemplates;
  registerCreatorRoutes(catalog.router, { service: creatorTemplates, user: req => resolveUser(req), designs: designs.service, streamAsset });
  const gifts = modules.gifts = await giftsApp(config, {
    resolveUser, mysqlClient,
    canvas: designs,
    catalog: { getTemplate: async id => catalog.service.publicOne(id) },
    checkout: { hasLicense: async (userId, templateId) => checkout.service.hasLicense(userId, templateId) },
  });
  modules.support = supportApp(config, { resolveUser, mysqlClient, async resolveReport(kind, id, invite) {
    if (kind === 'template') return (await catalog.service.publicOne(id)).id;
    const gift = await gifts.service.validateSlug(id);
    requireGiftPermission(gift, invite);
    return gift.id;
  } });
  registerPublicationRoutes(gifts.router, { service: designs.service, resolveUser, config, writeLimit: designs.writeLimit });
  registerContextRoutes(checkout.router, { service: designs.service, resolveUser, config });
  gifts.router.on('GET', '/gifts/:slug/assets/:assetId', async ({ req, res, params, url }) => {
    const gift = await gifts.service.validateSlug(params.slug);
    requireGiftPermission(gift, url.searchParams.get('invite'));
    receiptFor(gift, url.searchParams.get('r'));
    if (!designs.flags.read || !gift.documentSnapshot || !gift.assetIds?.includes(params.assetId)) throw canvasError(404, 'ASSET_NOT_FOUND', 'Không tìm thấy ảnh.');
    const asset = designs.profile.mode === 'mysql' ? await designs.publication.pinnedAsset(params.slug, params.assetId) : await designs.repository.getAsset(gift.userId, params.assetId);
    if (!asset || asset.status !== 'ready' || !designs.service.assetExists(asset)) throw canvasError(404, 'ASSET_NOT_FOUND', 'Không tìm thấy ảnh.');
    if(asset.mediaKind==='video')requireLocalVideo(req);
    streamAsset(res, { filePath: designs.service.assetPath(asset), contentType: asset.mime,range:req.headers.range });
  });

  const server = (tlsOptions ? https : http).createServer({ ...serverTimeouts, ...tlsOptions }, async (req, res) => {
    const classify = monitor?.observeResponse(res);
    try {
      res.setHeader('x-content-type-options', 'nosniff');
      res.setHeader('referrer-policy', 'no-referrer');
      res.setHeader('x-frame-options', 'DENY');
      const url = new URL(req.url, config.baseUrl);
      try { decodeURIComponent(url.pathname); }
      catch { throw new HttpError(400, 'Đường dẫn không hợp lệ.'); }
      const matching = prefixes.find(([prefix]) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));
      if (matching) {
        const [prefix, name] = matching;
        classify?.(name);
        const pathname = url.pathname.slice(prefix.length) || '/';
        // Từ chối public API nội bộ, kể cả khi người gọi biết khóa service cũ.
        if (isInternalRoute(pathname)) {
          res.writeHead(403, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
          return res.end(JSON.stringify({ error: 'Không có quyền truy cập nội bộ qua API.' }));
        }
        if (!['GET', 'HEAD', 'POST'].includes(req.method)) {
          res.writeHead(405); return res.end();
        }
        if (req.method === 'POST') requireRequestOrigin(req, config);
        // Không tin header do trình duyệt/client tự khai khi server nhận trực tiếp.
        for (const name of ['x-forwarded-for', 'x-real-ip', 'forwarded', 'x-service-key']) {
          delete req.headers[name];
        }
        return modules[name].router.handle(req, res, { pathname, url });
      }
      classify?.('static');
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405); return res.end();
      }
      let publicCatalog;
      if(req.method==='GET'){
        const detail=url.pathname.match(/^\/template\/([^/]+)\/?$/);
        try{
          if(/^\/explore\/?$/.test(url.pathname))publicCatalog={endpoint:'/catalog/templates',data:{templates:await catalog.service.publicList()}};
          else if(detail)publicCatalog={endpoint:`/catalog/templates/${detail[1]}`,data:{template:await catalog.service.publicOne(decodeURIComponent(detail[1]))}};
          if(publicCatalog&&Buffer.byteLength(JSON.stringify(publicCatalog))>65536)publicCatalog=undefined;
        }catch{/* The app retains its normal API retry/error path. */}
      }
      staticFile(req, res, url, {...staticOptions,publicCatalog});
    } catch (error) {
      sendError(res, error);
    }
  });
  return {
    server,
    modules,
    listen(port = 4100, host = '127.0.0.1') {
      server.listen(port, host, () => console.log(`[Momevia] ${tlsOptions ? 'https' : 'http'}://${host}:${port} — một backend process`));
      return server;
    },
    close,
  };
}
