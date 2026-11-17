import { randomUUID } from 'node:crypto';
import { HttpError } from '../../shared/http.mjs';
import { randomId, sanitizeText, sanitizeOptionalText } from '../../shared/security.mjs';
import { decodePhoto } from './photo.mjs';

export class GiftService {
  constructor({ giftsRepo, repliesRepo, media, config, repliesLimit, catalog, checkout }) {
    Object.assign(this, { giftsRepo, repliesRepo, media, config, repliesLimit, catalog, checkout });
  }
  async validateSlug(slug) {
    if (!/^[A-Za-z0-9_-]{18,48}$/.test(slug)) throw new HttpError(404, 'Không tìm thấy món quà.');
    const gift = this.giftsRepo.getBySlug
      ? await this.giftsRepo.getBySlug(slug)
      : this.giftsRepo.all().find(item => item.slug === slug);
    if (!gift) throw new HttpError(404, 'Không tìm thấy món quà.');
    return gift;
  }
  ensureActive(gift) {
    if (new Date(gift.expiresAt) < new Date()) throw new HttpError(410, 'Món quà đã hết thời gian hoạt động.');
  }
  async mine(user) {
    const items = this.giftsRepo.allForUser
      ? await this.giftsRepo.allForUser(user.sub)
      : this.giftsRepo.all().filter(item => item.userId === user.sub).reverse();
    return items.map(({ userId, imageFile, ...gift }) => ({
      ...gift, photoUrl: imageFile ? `/api/gifts/gifts/${gift.slug}/photo` : null,
    }));
  }
  async photo(slug) {
    const gift = await this.validateSlug(slug);
    this.ensureActive(gift);
    if (!gift.imageFile) throw new HttpError(404, 'Không tìm thấy ảnh.');
    return this.media.find(gift.imageFile);
  }
  async replies(slug) {
    const gift = await this.validateSlug(slug);
    this.ensureActive(gift);
    return this.repliesRepo.allForGift
      ? this.repliesRepo.allForGift(gift.id)
      : this.repliesRepo.all().filter(item => item.giftId === gift.id);
  }
  async create(user, input) {
    const templateId = sanitizeText(input.templateId, 100);
    const template = await this.catalog.getTemplate(templateId);
    if (template.price > 0) {
      const licensed = await this.checkout.hasLicense(user.sub, templateId);
      if (!licensed) throw new HttpError(402, 'Bạn cần mua quyền sử dụng mẫu trước khi xuất bản quà.');
    }
    const recipientName = sanitizeText(input.recipientName, 60);
    const senderName = sanitizeText(input.senderName, 60);
    const message = sanitizeText(input.message, 1000);
    const photo = await decodePhoto(input.photoDataUrl);
    const slug = randomId(24);
    const imageFile = photo ? this.media.store(photo) : null;
    const gift = {
      id: randomUUID(), slug, userId: user.sub,
      templateId, templateTitle: template.title, theme: template.theme,
      recipientName, senderName, message, imageFile, replyCount: 0,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.config.giftTtlDays * 86400_000).toISOString(),
    };
    try { return await this.giftsRepo.insert(gift); }
    catch (error) {
      if (imageFile) {
        try { this.media.remove?.(imageFile); } catch { /* Preserve the original database error. */ }
      }
      throw error;
    }
  }
  async publicGift(slug) {
    const gift = await this.validateSlug(slug);
    this.ensureActive(gift);
    const { userId, imageFile, ...view } = gift;
    return { ...view, photoUrl: imageFile ? `/api/gifts/gifts/${slug}/photo` : null };
  }
  async reply(slug, body, ip) {
    const gift = await this.validateSlug(slug);
    this.ensureActive(gift);
    const key = `${slug}:${ip}`;
    if (!this.repliesLimit.consume(key)) throw new HttpError(429, 'Bạn đã gửi nhiều phản hồi. Vui lòng thử lại sau.');
    const reply = {
      id: randomUUID(), giftId: gift.id,
      name: sanitizeOptionalText(body.name, 50) || 'Người nhận',
      message: sanitizeText(body.message, 1000), createdAt: new Date().toISOString(),
    };
    if (this.giftsRepo.addReply) return this.giftsRepo.addReply(gift.id, reply);
    this.repliesRepo.insert(reply);
    this.giftsRepo.update(gift.id, { replyCount: gift.replyCount + 1 });
    return reply;
  }
}
