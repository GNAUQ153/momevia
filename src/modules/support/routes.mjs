import { HttpError, parseJson, sendJson } from '../../shared/http.mjs';
import { currentUser } from '../../shared/security.mjs';
import { clientIp } from '../../shared/proxy.mjs';

export function registerRoutes(router, { config, globalAttempts, service }) {
  router.on('GET', '/health', ({res}) => sendJson(res, 200, { name: 'support', ok: true }));
  router.on('POST', '/requests', async ({req, res}) => {
    if (!globalAttempts.consume('all')) throw new HttpError(429, 'Hệ thống đang nhận nhiều yêu cầu. Vui lòng thử lại sau.');
    const user = await currentUser(req, config.jwtSecret, false);
    const data = await parseJson(req, 8192);
    const result = service.create(data, user, clientIp(req));
    sendJson(res, 201, { ticket: result });
  });
  router.on('GET', '/admin/requests', async ({req, res}) => {
    const user = await currentUser(req, config.jwtSecret);
    sendJson(res, 200, { requests: service.requests(user) });
  });
}
