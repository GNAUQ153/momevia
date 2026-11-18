import { HttpError, parseJson, sendJson } from '../../shared/http.mjs';
import { versionView } from './creator-templates.mjs';
import { sanitizeText } from '../../shared/security.mjs';

export function registerCreatorRoutes(router, { service, user, designs, streamAsset }) {
  const own = '/creator/workspaces';
  const pending = '/admin/version-queue';
  const review = '/admin/templates/:id/versions/:version';
  const published = '/templates/:id/versions/:version';
  async function serveAsset(res, version, id) {
    const asset = Object.hasOwn(version.assets, id) && version.assets[id];
    if (!asset || !designs.assetExists(asset)) throw new HttpError(404, 'Không tìm thấy ảnh minh họa.');
    streamAsset(res, { filePath: designs.assetPath(asset), contentType: asset.mime });
  }
  router.on('GET', own, async ({ req, res }) =>
    sendJson(res, 200, { templates: await service.mine(await user(req)) }));
  router.on('POST', own, async ({ req, res }) => {
    const actor = await user(req);
    service.requireCreator(actor);
    const input = await parseJson(req, 4096);
    const subtitle = sanitizeText(input.subtitle, 140);
    const title = sanitizeText(input.title, 60);
    const result = await designs.create(actor, { source: { kind: 'blank' }, presetId: 'envelope-basic', purpose: 'creator', title, mutationId: input.mutationId });
    sendJson(res, 201, await service.register(actor, { designId: result.design.id, subtitle }));
  });
  router.on('POST', `${own}/:id/duplicate`, async ({ req, res, params }) => {
    const actor = await user(req);
    service.requireCreator(actor);
    const item = service.authored(await service.repository.get(params.id), actor.sub);
    const draft = await service.getDraft(actor, params.id);
    const result = await designs.duplicate(actor, draft.id, await parseJson(req, 4096));
    sendJson(res, 201, await service.register(actor, { designId: result.design.id, subtitle: item.subtitle }));
  });
  router.on('POST', `${own}/:id/submit`, async ({ req, res, params }) =>
    sendJson(res, 200, { version: await service.submit(await user(req), params.id, await parseJson(req, 4096)) }));
  router.on('POST', `${own}/:id/withdraw`, async ({ req, res, params }) => {
    await service.withdraw(await user(req), params.id);
    sendJson(res, 200, { withdrawn: true });
  });
  router.on('GET', pending, async ({ req, res }) =>
    sendJson(res, 200, { queue: await service.queue(await user(req)) }));
  router.on('GET', review, async ({ req, res, params }) =>
    sendJson(res, 200, { version: versionView(await service.version(await user(req), params.id, params.version)) }));
  router.on('POST', review, async ({ req, res, params }) =>
    sendJson(res, 200, { version: await service.decide(await user(req), params.id, params.version, await parseJson(req, 4096)) }));
  router.on('GET', `${review}/assets/:assetId`, async ({ req, res, params }) =>
    serveAsset(res, await service.version(await user(req), params.id, params.version), params.assetId));
  router.on('GET', published, async ({ res, params }) => {
    const { id, document, bindings, photoId } = await service.approved(params.id, params.version);
    sendJson(res, 200, { version: { id, document, bindings, photoId } });
  });
  router.on('GET', `${published}/assets/:assetId`, async ({ res, params }) =>
    serveAsset(res, await service.approved(params.id, params.version), params.assetId));
}
