import fs from 'node:fs';
import { HttpError, parseJson, sendJson } from '../../shared/http.mjs';
import { currentUser } from '../../shared/security.mjs';
import { clientIp } from '../../shared/proxy.mjs';

export function registerRoutes(router, { config, creationLimit, globalReplies, service, resolveUser = currentUser }) {
  router.on('GET', '/health', ({res}) => sendJson(res, 200, {name:'gifts', ok:true}));
  router.on('GET', '/gifts/mine', async ({req,res}) => {
    const user = await resolveUser(req, config.jwtSecret);
    sendJson(res, 200, { gifts: service.mine(user) });
  });
  router.on('POST', '/gifts', async ({req,res}) => {
    const user = await resolveUser(req, config.jwtSecret);
    if (!creationLimit.consume(user.sub)) throw new HttpError(429, 'Bạn đã tạo nhiều món quà. Vui lòng thử lại sau.');
    const gift = await service.create(user, await parseJson(req));
    sendJson(res, 201, { gift: { ...gift, imageFile: undefined, userId: undefined, url: `${config.baseUrl}/g/${gift.slug}` } });
  });
  router.on('GET', '/gifts/:slug', ({res,params}) => sendJson(res, 200, {gift: service.publicGift(params.slug)}));
  router.on('GET', '/gifts/:slug/photo', ({res,params}) => {
    const { filePath, contentType } = service.photo(params.slug);
    res.writeHead(200, {
      'content-type': contentType,
      'cache-control': 'private, max-age=3600',
      'x-content-type-options': 'nosniff',
    });
    fs.createReadStream(filePath).pipe(res);
  });
  router.on('GET', '/gifts/:slug/replies', ({res,params}) => {
    sendJson(res, 200, { replies: service.replies(params.slug) });
  });
  router.on('POST', '/gifts/:slug/replies', async ({req,res,params}) => {
    if (!globalReplies.consume('all')) throw new HttpError(429, 'Hệ thống đang nhận nhiều phản hồi. Vui lòng thử lại sau.');
    const body = await parseJson(req, 8192);
    const reply = service.reply(params.slug, body, clientIp(req));
    sendJson(res, 201, {reply});
  });
}
