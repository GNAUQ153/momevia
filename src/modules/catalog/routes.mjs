import { parseJson, sendJson, requireInternal } from '../../shared/http.mjs';
import { currentUser } from '../../shared/security.mjs';

export function registerRoutes(router, { config, service, resolveUser = currentUser }) {
  router.on('GET', '/health', ({ res }) => sendJson(res, 200, { name: 'catalog', ok: true }));
  router.on('GET', '/templates', async ({ res, url }) => {
    const templates = await service.search({ q: url.searchParams.get('q') || '', style: url.searchParams.get('style') || '' });
    return sendJson(res, 200, { templates });
  });
  router.on('GET', '/templates/:id', async ({ res, params }) => sendJson(res, 200, { template: await service.publicOne(params.id) }));
  // Mỗi tài khoản chỉ đọc/ghi danh sách yêu thích của chính mình.
  router.on('GET', '/favorites', async ({ req, res }) => {
    const user = await resolveUser(req, config.jwtSecret);
    sendJson(res, 200, { templateIds: await service.favoriteIds(user) });
  });
  router.on('POST', '/favorites', async ({ req, res }) => {
    const user = await resolveUser(req, config.jwtSecret);
    const data = await parseJson(req);
    const favorite = await service.saveFavorite(user, data);
    sendJson(res, 200, { favorite });
  });
  router.on('GET', '/creator/templates', async ({ req, res }) => {
    const user = await resolveUser(req, config.jwtSecret);
    sendJson(res, 200, { templates: await service.mine(user) });
  });
  router.on('POST', '/creator/templates', async ({ req, res }) => {
    const user = await resolveUser(req, config.jwtSecret);
    const result = await service.createDraft(user, await parseJson(req));
    sendJson(res, 201, { template: result });
  });
  router.on('GET', '/admin/pending', async ({ req, res }) => {
    const user = await resolveUser(req, config.jwtSecret);
    sendJson(res, 200, { templates: await service.pending(user) });
  });
  router.on('POST', '/admin/templates/:id/approve', async ({ req, res, params }) => {
    const user = await resolveUser(req, config.jwtSecret);
    sendJson(res, 200, { template: await service.approve(user, params.id) });
  });
  router.on('POST', '/admin/templates/:id/reject', async ({ req, res, params }) => {
    const user = await resolveUser(req, config.jwtSecret);
    service.requireAdmin(user, 'Chỉ quản trị viên được kiểm duyệt.');
    sendJson(res, 200, { template: await service.reject(user, params.id, await parseJson(req)) });
  });
  router.on('GET', '/internal/templates/:id', async ({ req, res, params }) => {
    requireInternal(req, config.internalKey);
    sendJson(res, 200, { template: await service.publicOne(params.id) });
  });
}
