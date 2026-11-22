import { HttpError, parseJson, sendJson } from '../../shared/http.mjs';
import { previewTemplateDocument, versionView } from './creator-templates.mjs';
import { sanitizeText } from '../../shared/security.mjs';
import { previewSvg } from '../../../web/js/shared/canvas/cover-svg.js';
import { imageAssetIds } from '../../../web/js/shared/canvas/schema.js';
import sharp from 'sharp';

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
  async function serveCover(res, version) {
    const document = previewTemplateDocument(version);
    const scene = document.scenes.find(item => item.id === (version.coverSceneId || document.entrySceneId));
    const imageIds = imageAssetIds({ elements: document.elements.filter(item => scene.elementIds.includes(item.id)
      && item.visible !== false && item.opacity !== 0) });
    const images = new Map();
    for (const id of imageIds) {
      const asset = version.assets[id];
      if (!asset || !designs.assetExists(asset)) throw new HttpError(404, 'Ảnh của bìa mẫu đang tạm thời không khả dụng.');
      const { data, info } = await sharp(designs.assetPath(asset)).resize({ width: 390, height: 844, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 72 }).toBuffer({resolveWithObject:true});
      const url = `data:image/webp;base64,${data.toString('base64')}`;
      images.set(id, document.schemaVersion === 1 ? url : {url,width:info.width,height:info.height});
    }
    const svg = previewSvg(document, scene.id, images);
    res.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'no-store',
      'content-security-policy': "default-src 'none'; img-src data:; sandbox", 'x-content-type-options': 'nosniff' });
    res.end(svg);
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
  router.on('GET', `${own}/:id/submission`, async ({ req, res, params }) =>
    sendJson(res, 200, { previous: await service.previousSubmission(await user(req), params.id) }));
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
  router.on('GET', `${review}/cover`, async ({ req, res, params }) =>
    serveCover(res, await service.version(await user(req), params.id, params.version)));
  router.on('GET', published, async ({ res, params }) => {
    const version = await service.approved(params.id, params.version);
    const { id, bindings, photoId } = version;
    sendJson(res, 200, { version: { id, document: previewTemplateDocument(version), bindings, photoId } });
  });
  router.on('GET', `${published}/assets/:assetId`, async ({ res, params }) =>
    serveAsset(res, await service.approved(params.id, params.version), params.assetId));
  router.on('GET', `${published}/cover`, async ({ res, params }) =>
    serveCover(res, await service.approved(params.id, params.version)));
}
