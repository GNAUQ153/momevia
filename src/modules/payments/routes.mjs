import { parseJson, sendJson, localizedError } from '../../shared/http.mjs';
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
  // Yêu cầu hoàn tiền chỉ là hồ sơ rà soát; API không chạm vào provider hoặc ledger.
  router.on('GET', '/payments/orders/:orderId/refund-request', async ({ req, res, params }) => {
    const user = await resolveUser(req, config.jwtSecret);
    sendJson(res, 200, { request: await service.refundReview.buyerGet(user, params.orderId) });
  });
  router.on('POST', '/payments/orders/:orderId/refund-request', async ({ req, res, params }) => {
    const user = await resolveUser(req, config.jwtSecret);
    const data = await parseJson(req, 2048);
    sendJson(res, 201, { request: await service.refundReview.buyerCreate(user, params.orderId, data) });
  });
  router.on('GET', '/payments/admin/refund-requests', async ({ req, res, url }) => {
    const admin = await resolveUser(req, config.jwtSecret);
    sendJson(res, 200, { requests: await service.refundReview.adminList(admin, url.searchParams.get('limit')) });
  });
  router.on('GET', '/payments/admin/refund-requests/:requestId/history', async ({ req, res, url, params }) => {
    const admin = await resolveUser(req, config.jwtSecret);
    sendJson(res, 200, { events: await service.refundReview.adminHistory(admin, params.requestId, url.searchParams.get('limit')) });
  });
  router.on('POST', '/payments/admin/refund-requests/:requestId/transition', async ({ req, res, params }) => {
    const admin = await resolveUser(req, config.jwtSecret);
    const data = await parseJson(req, 2048);
    sendJson(res, 200, { request: await service.refundReview.adminMove(admin, params.requestId, data) });
  });
  // Báo cáo chỉ đọc. Không nhận role/creatorId do client tự khai.
  router.on('GET', '/payments/creator/statement', async ({ req, res, url }) => {
    const creator = await resolveUser(req, config.jwtSecret);
    sendJson(res, 200, { statement: await service.creatorStatement(creator, url.searchParams.get('limit')) });
  });
  router.on('GET', '/payments/admin/finance', async ({ req, res }) => {
    const admin = await resolveUser(req, config.jwtSecret);
    sendJson(res, 200, { finance: await service.adminFinance(admin) });
  });
  router.on('GET', '/payments/admin/finance/exceptions', async ({ req, res, url }) => {
    const admin = await resolveUser(req, config.jwtSecret);
    sendJson(res, 200, { audit: await service.adminFinanceExceptions(admin, url.searchParams.get('limit')) });
  });
  // Admin-only inspection endpoints: no manual paid status, cancellation or retry unlock.
  router.on('GET', '/payments/admin/review', async ({ req, res, url }) => {
    const admin = await resolveUser(req, config.jwtSecret);
    sendJson(res, 200, { orders: await service.pendingReview(admin, url.searchParams.get('limit')) });
  });
  router.on('GET', '/payments/admin/orders/:orderId/audit', async ({ req, res, url, params }) => {
    const admin = await resolveUser(req, config.jwtSecret);
    sendJson(res, 200, { attempts: await service.reconciliationHistory(admin, params.orderId, url.searchParams.get('limit')) });
  });
  router.on('POST', '/payments/webhooks/:provider', async ({ req, res, params }) => {
    if (!['momo', 'payos'].includes(params.provider)) throw localizedError(404, 'errors.payment.unknownProvider');
    const body = await parseJson(req, 30_000);
    const result = await service.webhook(params.provider, body);
    sendJson(res, 200, { received: true, processed: result.settled });
  });
}
