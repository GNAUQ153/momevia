import { parseJson, sendJson, localizedError } from '../../shared/http.mjs';
import { currentUser } from '../../shared/security.mjs';
import { clientIp } from '../../shared/proxy.mjs';

export function registerRoutes(router, { config, globalAttempts, service, resolveUser = currentUser }) {
  router.on('GET', '/health', ({res}) => sendJson(res, 200, { name: 'support', ok: true }));
  router.on('POST', '/requests', async ({req, res}) => {
    if (!globalAttempts.consume('all')) throw localizedError(429, 'errors.support.busy');
    const user = await resolveUser(req, config.jwtSecret, false);
    const data = await parseJson(req, 8192);
    const result = await service.create(data, user, clientIp(req));
    sendJson(res, 201, { ticket: result });
  });
  router.on('GET', '/privacy-requests', async ({ req, res }) => {
    const user = await resolveUser(req, config.jwtSecret);
    sendJson(res, 200, { requests: await service.privacyRequests(user) });
  });
  router.on('GET', '/admin/requests', async ({req, res}) => {
    const user = await resolveUser(req, config.jwtSecret);
    sendJson(res, 200, { requests: await service.requests(user) });
  });
  // Keep the historical /resolve endpoint for existing clients; it now handles
  // both reports and ordinary support tickets.
  router.on('POST', '/admin/requests/:id/resolve', async ({req, res, params}) => {
    const user = await resolveUser(req, config.jwtSecret);
    sendJson(res, 200, await service.updateRequest(user, params.id, await parseJson(req, 4096)));
  });
}
