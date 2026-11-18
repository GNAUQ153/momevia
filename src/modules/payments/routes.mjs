import { HttpError, parseJson, sendJson } from '../../shared/http.mjs';
import { currentUser, sanitizeText } from '../../shared/security.mjs';
export function registerPaymentRoutes(router, { service, config, resolveUser = currentUser }) {
  router.on('GET', '/payments/methods', ({ res }) => {
    const methods = service.methods();
    sendJson(res, 200, { methods, ...(!methods.length && config.demoTemplateCheckout ? { demoPurchaseAvailable: true } : {}) });
  });
  router.on('POST', '/payments/create', async ({ req, res }) => {
    const user = await resolveUser(req, config.jwtSecret);
    const data = await parseJson(req, 2048);
    const templateId = sanitizeText(data.templateId, 100);
    const method = sanitizeText(data.method, 30);
    sendJson(res, 201, { payment: await service.create(user, templateId, method) });
  });
  router.on('GET', '/payments/orders/:orderId', async ({ req, res, params }) => {
    const user = await resolveUser(req, config.jwtSecret);
    sendJson(res, 200, { payment: await service.status(user, params.orderId) });
  });
  router.on('POST', '/payments/orders/:orderId/reconcile', async ({ req, res, params }) => {
    const user = await resolveUser(req, config.jwtSecret);
    sendJson(res, 200, await service.reconcile(user, params.orderId));
  });
  router.on('GET', '/payments/orders/:orderId/receipt', async ({ req, res, params }) => {
    const user = await resolveUser(req, config.jwtSecret);
    sendJson(res, 200, { receipt: await service.receipt(user, params.orderId) });
  });
  router.on('POST', '/payments/webhooks/:provider', async ({ req, res, params }) => {
    if (!['momo', 'payos'].includes(params.provider)) throw new HttpError(404, 'Không hỗ trợ provider.');
    const body = await parseJson(req, 30_000);
    const result = await service.webhook(params.provider, body);
    sendJson(res, 200, { received: true, processed: result.settled });
  });
}
