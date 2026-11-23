import { createDocument,templatePreviewDocument } from '../../../web/js/shared/canvas/presets.js';
import { serverText } from '../../shared/locale.mjs';
import { RESTYLE_PAIRS } from '../../../web/js/shared/canvas/template-slots.js';
import { previewRestyle, createRestyle } from './restyle.mjs';
import fs from 'node:fs';
import { parseJson, sendJson } from '../../shared/http.mjs';
import { canvasError } from './errors.mjs';
import { designView, giftSummary } from './designs.service.mjs';
import { imageBody } from './assets.service.mjs';
import { giftOwnerLinks } from '../gifts/links.mjs';
import { requestLocale } from '../../shared/locale.mjs';
import { AudioAssetsService, audioBody, sfxCatalog, librarySound } from './audio.service.mjs';

export function streamAsset(res, file) {
  res.writeHead(200, { 'content-type': file.contentType, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' });
  const stream = fs.createReadStream(file.filePath); stream.on('error', () => res.destroy()); stream.pipe(res);
}
export function registerDesignRoutes(router, { service, assets, resolveUser, config, writeLimit }) {
  const audio=new AudioAssetsService(service);
  const user = req => resolveUser(req, config.jwtSecret);
  const writeUser = async req => { const actor = await user(req); if (!writeLimit.consume(actor.sub)) throw canvasError(429, 'CANVAS_RATE_LIMIT', 'Bạn thao tác quá nhanh. Thử lại sau.'); return actor; };
  router.on('GET', '/health', ({ res }) => sendJson(res, 200, { name: 'designs', ok: true, profile: service.profile, capabilities: service.flags }));
  router.on('GET', '/library', async ({ res }) => sendJson(res, 200, { library: await service.library.refresh(), audioLibrary: await service.musicLibrary.list() }));
  router.on('GET', '/sfx', async ({res})=>{
    const curated=new Map((await service.musicLibrary.list()).items.map(row=>[row.key,row]));
    const catalog=sfxCatalog();
    sendJson(res,200,{...catalog,assets:catalog.assets.filter(a=>curated.get(`sfx:${a.version}:${a.id}`)?.status!=='disabled').map(a=>{
      const row=curated.get(`sfx:${a.version}:${a.id}`),group=row?.theme??a.group;
      return {...a,name:row?.title??a.name,keywords:row?.keywords??a.keywords,group,groupName:catalog.assets.find(item=>item.group===group)?.groupName??a.groupName};
    }),createEnabled:service.flags.sfxCreate!==false});
  });
  router.on('GET', '/admin/music-library', async ({req,res})=>{
    if((await user(req)).role!=='admin')throw canvasError(403,'ADMIN_REQUIRED','Admin required.');
    sendJson(res,200,{audioLibrary:await service.musicLibrary.list()});
  });
  router.on('POST', '/admin/music-library/:key', async ({req,res,params})=>{
    const actor=await writeUser(req);
    if(actor.role!=='admin')throw canvasError(403,'ADMIN_REQUIRED','Admin required.');
    sendJson(res,200,{audioLibrary:await service.musicLibrary.put(actor,params.key,await parseJson(req,8192))});
  });
  router.on('GET', '/sfx/:version/:id', async ({res,params})=>streamAsset(res,librarySound(params.version,params.id)));
  router.on('POST','/designs/:id/audio',async ({req,res,params})=>{
    const actor=await writeUser(req);await service.get(actor,params.id);
    sendJson(res,201,{asset:await audio.upload(actor,params.id,req.headers['x-mutation-id'],await audioBody(req))});
  });
  router.on('GET', '/library/templates/:id/preview', async ({res,params})=>{
    await service.library.refresh();
    const template=await service.catalog.getTemplate(params.id);
    if(template.versionId)throw canvasError(404,'LIBRARY_ITEM_NOT_FOUND','Use the approved Creator version preview.');
    const documents=Object.fromEntries(['vi','en'].map(locale=>[locale,templatePreviewDocument(template,(key,values)=>serverText(template.systemOwned?locale:'vi',key,values))]));
    sendJson(res,200,{documents});
  });
  router.on('GET', '/library/templates/:id/cover', async ({ res, params, url }) => {
    const svg = await service.library.cover(params.id, url.searchParams.get('locale') === 'en' ? 'en' : 'vi');
    res.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    res.end(svg);
  });
  router.on('GET', '/admin/library', async ({ req, res }) => {
    if ((await user(req)).role !== 'admin') throw canvasError(403, 'ADMIN_REQUIRED', 'Admin required.');
    sendJson(res, 200, { library: await service.library.refresh({ admin: true }) });
  });
  router.on('POST', '/admin/library/:kind/:id', async ({ req, res, params }) => {
    const actor = await writeUser(req);
    if (actor.role !== 'admin') throw canvasError(403, 'ADMIN_REQUIRED', 'Admin required.');
    sendJson(res, 200, { library: await service.library.put(actor, params.kind, params.id, await parseJson(req, 1500000)) });
  });
  router.on('POST', '/admin/library/preview/:kind/:id', async ({ req, res, params }) => {
    const actor = await writeUser(req);
    if (actor.role !== 'admin') throw canvasError(403, 'ADMIN_REQUIRED', 'Admin required.');
    const input = await parseJson(req, 1500000);
    sendJson(res, 200, await service.library.preview(actor, params.kind, params.id, input, input.locale === 'en' ? 'en' : 'vi'));
  });
  router.on('POST', '/template-trial', async ({req,res}) => {
    const input=await parseJson(req,4096);
    if (!RESTYLE_PAIRS[input.templateId]) throw canvasError(422,'RESTYLE_INCOMPATIBLE','Mẫu này chưa có bản phối tương thích.');
    await service.library?.refresh();
    const resolved=await service.source({kind:'template',templateId:input.templateId});
    sendJson(res,200,{source:resolved.source,document:createDocument({template:resolved.template,localize:(key,params)=>serverText(requestLocale(req),key,params)})});
  });
  router.on('GET', '/designs', async ({ req, res, url }) => {
    const numberParam = (key, fallback, max) => { const raw = url.searchParams.get(key); if (raw === null) return fallback; const value = Number(raw); return Number.isSafeInteger(value) && value >= 0 ? Math.min(max, value) : fallback; };
    const limit = Math.max(1, numberParam('limit', 50, 100)); const offset = numberParam('offset', 0, 1000000);
    const designs = await service.list(await user(req), offset, limit);
    sendJson(res, 200, { designs, nextOffset: designs.length === limit ? offset + limit : null });
  });
  router.on('POST', '/designs', async ({ req, res }) => sendJson(res, 201,
    await service.create(await writeUser(req), await parseJson(req, 16384), { locale: requestLocale(req) })));
  router.on('GET', '/designs/:id', async ({ req, res, params }) => sendJson(res, 200, { design: designView(await service.get(await user(req), params.id)) }));
  router.on('POST', '/designs/:id/save', async ({ req, res, params }) => sendJson(res, 200, await service.save(await writeUser(req), params.id, await parseJson(req, 600000))));
  router.on('POST', '/designs/:id/restyle/preview', async ({req,res,params}) => sendJson(res,200,await previewRestyle(service,await user(req),params.id,await parseJson(req,8192),requestLocale(req))));
  router.on('POST', '/designs/:id/restyle', async ({req,res,params}) => sendJson(res,201,await createRestyle(service,await writeUser(req),params.id,await parseJson(req,8192),requestLocale(req))));
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
