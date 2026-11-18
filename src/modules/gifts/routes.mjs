import fs from 'node:fs';
import { HttpError, parseJson, sendJson } from '../../shared/http.mjs';
import { currentUser } from '../../shared/security.mjs';
import { clientIp } from '../../shared/proxy.mjs';
import { giftOwnerLinks, giftShareUrl } from './links.mjs';

export function registerRoutes(router, { config, creationLimit, globalReplies, service, resolveUser = currentUser }) {
  const withShareUrl = gift => ({ ...gift, url: giftShareUrl(config.baseUrl, gift.slug) });
  const ownerShare = gift => {
    const { inviteToken, ...view } = gift;
    return { ...view, ...giftOwnerLinks(config.baseUrl, { slug: view.slug, inviteToken }) };
  };
  router.on('GET', '/health', ({res}) => sendJson(res, 200, {name:'gifts', ok:true}));
  router.on('GET', '/gifts/mine', async ({req,res}) => {
    const user = await resolveUser(req, config.jwtSecret);
    sendJson(res, 200, { gifts: (await service.mine(user)).map(ownerShare) });
  });
  router.on('GET', '/gifts/mine/:slug', async ({req,res,params}) => {
    const user = await resolveUser(req, config.jwtSecret);
    sendJson(res, 200, { gift: ownerShare(service.ownerView(await service.ownGift(user, params.slug))) });
  });
  router.on('GET', '/gifts/mine/:slug/replies', async ({req,res,params}) => {
    const user = await resolveUser(req, config.jwtSecret);
    sendJson(res, 200, { replies: await service.giftReplies(await service.ownGift(user, params.slug)) });
  });
  router.on('POST', '/gifts/mine/:slug/revoke', async ({req,res,params}) => {
    const user = await resolveUser(req, config.jwtSecret);
    sendJson(res, 200, { gift: ownerShare(await service.revoke(user, params.slug)) });
  });
  router.on('POST', '/gifts', async ({req,res}) => {
    const user = await resolveUser(req, config.jwtSecret);
    if (!creationLimit.consume(user.sub)) throw new HttpError(429, 'Bạn đã tạo nhiều món quà. Vui lòng thử lại sau.');
    const gift = await service.create(user, await parseJson(req));
    sendJson(res, 201, { gift: ownerShare({ ...gift, imageFile: undefined, userId: undefined }) });
  });
  router.on('GET', '/gifts/:slug', async ({res,params,url}) => sendJson(res, 200, {gift: withShareUrl(await service.publicGift(params.slug, url.searchParams.get('invite')))}));
  router.on('GET', '/gifts/:slug/status', async ({res,params,url}) => {
    await service.publicStatus(params.slug, url.searchParams.get('invite'));
    sendJson(res, 200, { status: 'active' });
  });
  router.on('GET', '/gifts/:slug/photo', async ({res,params,url}) => {
    const { filePath, contentType } = await service.photo(params.slug, url.searchParams.get('invite'));
    res.writeHead(200, {
      'content-type': contentType,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    });
    fs.createReadStream(filePath).pipe(res);
  });
  router.on('GET', '/gifts/:slug/replies', async ({res,params,url}) => {
    sendJson(res, 200, { replies: await service.replies(params.slug, url.searchParams.get('invite')) });
  });
  router.on('POST', '/gifts/:slug/replies', async ({req,res,params,url}) => {
    if (!globalReplies.consume('all')) throw new HttpError(429, 'Hệ thống đang nhận nhiều phản hồi. Vui lòng thử lại sau.');
    const body = await parseJson(req, 8192);
    const reply = await service.reply(params.slug, body, clientIp(req), url.searchParams.get('invite'));
    sendJson(res, 201, {reply});
  });
}
