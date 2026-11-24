import { parseJson, sendJson, requireInternal } from '../../shared/http.mjs';
import { currentUser, sanitizeText } from '../../shared/security.mjs';

export function registerRoutes(router, { config, service, resolveUser = currentUser }) {
  router.on('GET', '/health', ({res}) => sendJson(res, 200, {name:'checkout', ok:true}));
  router.on('GET', '/orders', async ({req,res}) => {
    const user = await resolveUser(req, config.jwtSecret);
    sendJson(res, 200, { orders: await service.orders(user) });
  });
  router.on('GET', '/licenses/:templateId', async ({req,res,params}) => {
    const user = await resolveUser(req, config.jwtSecret);
    sendJson(res, 200, await service.accessFor(user, sanitizeText(params.templateId, 100)));
  });
  router.on('GET', '/licenses/:templateId/details', async ({req,res,params}) => {
    const user = await resolveUser(req, config.jwtSecret);
    sendJson(res, 200, await service.entitlementDetails(user, sanitizeText(params.templateId, 100)));
  });
  router.on('GET', '/admin/entitlements/summary', async ({req,res}) => {
    const user = await resolveUser(req, config.jwtSecret);
    sendJson(res, 200, await service.adminEntitlementSummary(user));
  });
  router.on('POST', '/orders/demo-purchase', async ({req,res}) => {
    const user = await resolveUser(req, config.jwtSecret);
    const data = await parseJson(req, 4096);
    const templateId = sanitizeText(data.templateId, 100);
    const order = await service.purchase(user, templateId);
    sendJson(res, 201, { order, notice: 'Chỉ là đơn hàng mô phỏng. Không thu tiền thật.' });
  });
  router.on('GET', '/internal/license/:userId/:templateId', async ({req,res,params}) => {
    requireInternal(req, config.internalKey);
    sendJson(res, 200, { licensed: await service.hasLicense(params.userId, params.templateId) });
  });
}
