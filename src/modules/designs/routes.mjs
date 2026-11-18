import fs from 'node:fs';
import { parseJson, sendJson } from '../../shared/http.mjs';
import { canvasError } from './errors.mjs';
import { designView, giftSummary } from './designs.service.mjs';
import { imageBody } from './assets.service.mjs';
import { giftOwnerLinks } from '../gifts/links.mjs';

export function streamAsset(res, file) {
  res.writeHead(200, { 'content-type': file.contentType, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' });
  const stream = fs.createReadStream(file.filePath); stream.on('error', () => res.destroy()); stream.pipe(res);
}
export function registerDesignRoutes(router, { service, assets, resolveUser, config, writeLimit }) {
  const user = req => resolveUser(req, config.jwtSecret);
  const writeUser = async req => { const actor = await user(req); if (!writeLimit.consume(actor.sub)) throw canvasError(429, 'CANVAS_RATE_LIMIT', 'Bạn thao tác quá nhanh. Thử lại sau.'); return actor; };
  router.on('GET', '/health', ({ res }) => sendJson(res, 200, { name: 'designs', ok: true, profile: service.profile, capabilities: service.flags }));
  router.on('GET', '/designs', async ({ req, res, url }) => {
    const numberParam = (key, fallback, max) => { const raw = url.searchParams.get(key); if (raw === null) return fallback; const value = Number(raw); return Number.isSafeInteger(value) && value >= 0 ? Math.min(max, value) : fallback; };
    const limit = Math.max(1, numberParam('limit', 50, 100)); const offset = numberParam('offset', 0, 1000000);
    const designs = await service.list(await user(req), offset, limit);
    sendJson(res, 200, { designs, nextOffset: designs.length === limit ? offset + limit : null });
  });
  router.on('POST', '/designs', async ({ req, res }) => sendJson(res, 201, await service.create(await writeUser(req), await parseJson(req, 16384))));
  router.on('GET', '/designs/:id', async ({ req, res, params }) => sendJson(res, 200, { design: designView(await service.get(await user(req), params.id)) }));
  router.on('POST', '/designs/:id/save', async ({ req, res, params }) => sendJson(res, 200, await service.save(await writeUser(req), params.id, await parseJson(req, 600000))));
  router.on('POST', '/designs/:id/duplicate', async ({ req, res, params }) => sendJson(res, 201, await service.duplicate(await writeUser(req), params.id, await parseJson(req, 4096))));
  router.on('POST', '/designs/:id/archive', async ({ req, res, params }) => {
    service.requireEdit(); const actor = await writeUser(req); await service.get(actor, params.id);
    await service.repository.archive(actor.sub, params.id); sendJson(res, 200, { archived: true });
  });
  router.on('POST', '/designs/:id/preflight', async ({ req, res, params }) => sendJson(res, 200, await service.preflight(await user(req), params.id, await parseJson(req, 4096))));
  router.on('POST', '/designs/:id/assets', async ({ req, res, params }) => {
    const actor = await writeUser(req); await service.get(actor, params.id);
    const image = await imageBody(req); sendJson(res, 201, { asset: await assets.upload(actor, params.id, req.headers['x-mutation-id'], image) });
  });
  router.on('GET', '/designs/:id/assets/:assetId', async ({ req, res, params }) => streamAsset(res, await assets.owner(await user(req), params.id, params.assetId)));
}
export function registerPublicationRoutes(router, { service, resolveUser, config, writeLimit }) {
  router.on('POST', '/gifts/from-design', async ({ req, res }) => {
    const user = await resolveUser(req, config.jwtSecret);
    if (!writeLimit.consume(user.sub)) throw canvasError(429, 'CANVAS_RATE_LIMIT', 'Bạn thao tác quá nhanh. Thử lại sau.');
    const result = await service.publish(user, await parseJson(req, 4096));
    sendJson(res, result.replayed ? 200 : 201, { ...result, gift: { ...giftSummary(result.gift), ...giftOwnerLinks(config.baseUrl, result.gift) } });
  });
}
export function registerContextRoutes(router, { service, resolveUser, config }) {
  const actor = req => resolveUser(req, config.jwtSecret);
  router.on('POST', '/payments/orders/:orderId/design-contexts', async ({ req, res, params }) => sendJson(res, 201, { context: await service.attachContext(await actor(req), params.orderId, await parseJson(req, 4096)) }));
  router.on('GET', '/payments/orders/:orderId/design-contexts', async ({ req, res, params, url }) => {
    const contexts = await service.contexts(await actor(req), params.orderId); const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
    sendJson(res, 200, { contexts: contexts.slice(offset, offset + 50) });
  });
  router.on('GET', '/payments/orders/:orderId/design-contexts/:contextId', async ({ req, res, params }) => sendJson(res, 200, { context: await service.context(await actor(req), params.orderId, params.contextId) }));
}
