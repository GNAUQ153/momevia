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

export async function createHttpApp(config = environment(), { paymentProviders, paymentEnv, sendRecoveryMail, recoveryNow } = {}) {
  const identity = await identityApp(config, { sendRecoveryMail, recoveryNow });
  // Phiên và role được xác nhận từ Identity module tại mỗi request, kể cả sau khi logout.
  const resolveUser = async (req, _secret, required = true) => {
    const user = await identity.sessions.find(sessionToken(req));
    if (!user && required) throw new HttpError(401, 'Vui lòng đăng nhập để tiếp tục.');
    return user;
  };
  const catalog = await catalogApp(config, { resolveUser });
  const checkout = await checkoutApp(config, {
    resolveUser,
    paymentProviders, paymentEnv,
    catalog: { getTemplate: async id => catalog.service.publicOne(id) },
  });
  const designs = await designsApp(config, {
    resolveUser,
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
  const gifts = await giftsApp(config, {
    resolveUser,
    canvas: designs,
    catalog: { getTemplate: async id => catalog.service.publicOne(id) },
    checkout: { hasLicense: async (userId, templateId) => checkout.service.hasLicense(userId, templateId) },
  });
  const support = supportApp(config, { resolveUser, async resolveReport(kind, id, invite) {
    if (kind === 'template') return (await catalog.service.publicOne(id)).id;
    const gift = await gifts.service.validateSlug(id);
    requireGiftPermission(gift, invite);
    return gift.id;
  } });
  registerPublicationRoutes(gifts.router, { service: designs.service, resolveUser, config, writeLimit: designs.writeLimit });
  registerContextRoutes(checkout.router, { service: designs.service, resolveUser, config });
  gifts.router.on('GET', '/gifts/:slug/assets/:assetId', async ({ res, params, url }) => {
    const gift = await gifts.service.validateSlug(params.slug);
    requireGiftPermission(gift, url.searchParams.get('invite'));
    if (!designs.flags.read || !gift.documentSnapshot || !gift.assetIds?.includes(params.assetId)) throw canvasError(404, 'ASSET_NOT_FOUND', 'Không tìm thấy ảnh.');
    const asset = designs.profile.mode === 'mysql' ? await designs.publication.pinnedAsset(params.slug, params.assetId) : await designs.repository.getAsset(gift.userId, params.assetId);
    if (!asset || asset.status !== 'ready' || !designs.service.assetExists(asset)) throw canvasError(404, 'ASSET_NOT_FOUND', 'Không tìm thấy ảnh.');
    streamAsset(res, { filePath: designs.service.assetPath(asset), contentType: asset.mime });
  });
  const modules = { identity, catalog, checkout, gifts, support, designs };

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
    async close() { await Promise.all(Object.values(modules).map(module => module.close?.())); },
  };
}
