import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { environment } from '../shared/config.mjs';
import { JsonRepository } from '../shared/storage.mjs';
import { Router, HttpError, parseJson, sendJson, internalFetch } from '../shared/http.mjs';
import { currentUser, randomId, sanitizeText, sanitizeOptionalText } from '../shared/security.mjs';
import { clientIp } from '../shared/proxy.mjs';
import { RateLimiter } from '../shared/rate-limit.mjs';

const config = environment();
const giftsRepo = new JsonRepository(path.resolve('services/gifts/data/gifts.json'));
const repliesRepo = new JsonRepository(path.resolve('services/gifts/data/replies.json'));
const imagesDir = path.resolve('services/gifts/data/images');
fs.mkdirSync(imagesDir, { recursive: true });
const router = new Router();
const repliesLimit = new RateLimiter({ limit: 3, windowMs: 60_000 });
const globalReplies = new RateLimiter({ limit: 300, windowMs: 60_000, maxKeys: 1 });
const creationLimit = new RateLimiter({ limit: 10, windowMs: 600_000 });

function validateSlug(slug) {
  if (!/^[A-Za-z0-9_-]{18,48}$/.test(slug)) throw new HttpError(404, 'Không tìm thấy món quà.');
  const gift = giftsRepo.all().find(item => item.slug === slug);
  if (!gift) throw new HttpError(404, 'Không tìm thấy món quà.');
  return gift;
}
function ensureActive(gift) {
  if (new Date(gift.expiresAt) < new Date()) throw new HttpError(410, 'Món quà đã hết thời gian hoạt động.');
}
function decodePhoto(raw) {
  if (!raw) return null;
  if (typeof raw !== 'string') throw new HttpError(400, 'Hình ảnh không hợp lệ.');
  const match = raw.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new HttpError(400, 'Chỉ hỗ trợ ảnh PNG, JPG hoặc WebP.');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length < 16 || bytes.length > 2 * 1024 * 1024) throw new HttpError(413, 'Ảnh phải nhỏ hơn 2 MB.');
  const isPng = bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if ((match[1] === 'png' && !isPng) || (match[1] === 'jpeg' && !isJpeg) || (match[1] === 'webp' && !isWebp)) throw new HttpError(400, 'Định dạng ảnh không khớp nội dung.');
  return { bytes, ext: match[1] === 'jpeg' ? 'jpg' : match[1] };
}

class GiftService {
  async create(user, input) {
    const templateId = sanitizeText(input.templateId, 100);
    const { template } = await internalFetch(`http://127.0.0.1:4102/internal/templates/${encodeURIComponent(templateId)}`, config.internalKey);
    if (template.price > 0) {
      const { licensed } = await internalFetch(`http://127.0.0.1:4104/internal/license/${encodeURIComponent(user.sub)}/${encodeURIComponent(templateId)}`, config.internalKey);
      if (!licensed) throw new HttpError(402, 'Bạn cần mua quyền sử dụng mẫu trước khi xuất bản quà.');
    }
    const recipientName = sanitizeText(input.recipientName, 60);
    const senderName = sanitizeText(input.senderName, 60);
    const message = sanitizeText(input.message, 1000);
    const photo = decodePhoto(input.photoDataUrl);
    const slug = randomId(24);
    let imageFile = null;
    if (photo) {
      imageFile = `${randomUUID()}.${photo.ext}`;
      fs.writeFileSync(path.join(imagesDir, imageFile), photo.bytes);
    }
    const gift = {
      id: randomUUID(), slug, userId: user.sub,
      templateId, templateTitle: template.title, theme: template.theme,
      recipientName, senderName, message,
      imageFile, replyCount: 0,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + config.giftTtlDays * 86400_000).toISOString(),
    };
    return giftsRepo.insert(gift);
  }
  publicGift(slug) {
    const gift = validateSlug(slug);
    ensureActive(gift);
    // Chỉ trả dữ liệu đủ cho người sở hữu link xem quà.
    const { userId, imageFile, ...view } = gift;
    return { ...view, photoUrl: imageFile ? `/api/gifts/gifts/${slug}/photo` : null };
  }
  reply(slug, body, ip) {
    const gift = validateSlug(slug);
    ensureActive(gift);
    const key = `${slug}:${ip}`;
    if (!repliesLimit.consume(key)) throw new HttpError(429, 'Bạn đã gửi nhiều phản hồi. Vui lòng thử lại sau.');
    const reply = {
      id: randomUUID(), giftId: gift.id,
      name: sanitizeOptionalText(body.name, 50) || 'Người nhận',
      message: sanitizeText(body.message, 1000),
      createdAt: new Date().toISOString(),
    };
    repliesRepo.insert(reply);
    giftsRepo.update(gift.id, { replyCount: gift.replyCount + 1 });
    return reply;
  }
}
const service = new GiftService();
router.on('GET', '/health', ({res}) => sendJson(res, 200, {name:'gifts', ok:true}));
router.on('GET', '/gifts/mine', async ({req,res}) => {
  const user = await currentUser(req, config.jwtSecret);
  const gifts = giftsRepo.all().filter(item => item.userId === user.sub).reverse().map(({userId, imageFile, ...gift}) => ({
    ...gift,
    photoUrl: imageFile ? `/api/gifts/gifts/${gift.slug}/photo` : null,
  }));
  sendJson(res, 200, { gifts });
});
router.on('POST', '/gifts', async ({req,res}) => {
  const user = await currentUser(req, config.jwtSecret);
  if (!creationLimit.consume(user.sub)) throw new HttpError(429, 'Bạn đã tạo nhiều món quà. Vui lòng thử lại sau.');
  const gift = await service.create(user, await parseJson(req));
  sendJson(res, 201, { gift: { ...gift, imageFile: undefined, userId: undefined, url: `${config.baseUrl}/g/${gift.slug}` } });
});
router.on('GET', '/gifts/:slug', ({res,params}) => sendJson(res, 200, {gift: service.publicGift(params.slug)}));
router.on('GET', '/gifts/:slug/photo', ({res,params}) => {
  const gift = validateSlug(params.slug);
  ensureActive(gift);
  if (!gift.imageFile) throw new HttpError(404, 'Không tìm thấy ảnh.');
  const filePath = path.join(imagesDir, gift.imageFile);
  if (!fs.existsSync(filePath)) throw new HttpError(404, 'Ảnh không tồn tại.');
  const ext = path.extname(filePath);
  res.writeHead(200, {
    'content-type': ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg',
    'cache-control': 'private, max-age=3600',
    'x-content-type-options': 'nosniff',
  });
  fs.createReadStream(filePath).pipe(res);
});
router.on('GET', '/gifts/:slug/replies', ({res,params}) => {
  const gift = validateSlug(params.slug);
  ensureActive(gift);
  sendJson(res, 200, { replies: repliesRepo.all().filter(item => item.giftId === gift.id) });
});
router.on('POST', '/gifts/:slug/replies', async ({req,res,params}) => {
  if (!globalReplies.consume('all')) throw new HttpError(429, 'Hệ thống đang nhận nhiều phản hồi. Vui lòng thử lại sau.');
  const body = await parseJson(req, 8192);
  const reply = service.reply(params.slug, body, clientIp(req));
  sendJson(res, 201, {reply});
});
router.listen(4103);
