import { randomUUID } from 'node:crypto';
import { HttpError } from '../../shared/http.mjs';
import { randomId, sanitizeText, sanitizeOptionalText } from '../../shared/security.mjs';
import { decodePhoto } from './photo.mjs';
import { publicGiftView, giftSummary } from '../designs/designs.service.mjs';
import { createGiftAccess, requireGiftPermission } from './access.mjs';

export class GiftService {
  constructor({ giftsRepo, repliesRepo, media, config, repliesLimit, catalog, checkout, canvas }) {
    Object.assign(this, { giftsRepo, repliesRepo, media, config, repliesLimit, catalog, checkout, canvas });
  }
  async validateSlug(slug) {
    if (!/^[A-Za-z0-9_-]{18,48}$/.test(slug)) throw new HttpError(404, 'Không tìm thấy món quà.');
    let gift = this.giftsRepo.getBySlug
      ? await this.giftsRepo.getBySlug(slug)
      : this.giftsRepo.all().find(item => item.slug === slug);
    if (!gift && this.canvas?.profile.mode === 'json') gift = await this.canvas.repository.findBySlug(slug);
    if (!gift) throw new HttpError(404, 'Không tìm thấy món quà.');
    return gift;
  }
  ownerView(gift) {
    return { ...giftSummary(gift), access: gift.access, inviteToken: gift.inviteToken,
      photoUrl: gift.imageFile ? `/api/gifts/gifts/${gift.slug}/photo` : null };
  }
  async ownGift(user, slug) {
    const gift = await this.validateSlug(slug);
    if (gift.userId !== user.sub) throw new HttpError(404, 'Không tìm thấy món quà.');
    return gift;
  }
  async publicStatus(slug, invite) {
    requireGiftPermission(await this.validateSlug(slug), invite);
  }
  async revoke(user, slug) {
    const gift = await this.ownGift(user, slug);
    if (gift.revokedAt) return this.ownerView(gift);
    const revokedAt = new Date().toISOString();
    if (gift.documentSnapshot && this.canvas?.profile.mode === 'json')
      return this.ownerView(await this.canvas.repository.revoke(user.sub, gift.id, revokedAt));
    if (this.giftsRepo.revoke) return this.ownerView(await this.giftsRepo.revoke(user.sub, gift.id, revokedAt));
    return this.ownerView(this.giftsRepo.update(gift.id, { revokedAt }));
  }
  async mine(user) {
    const items = this.giftsRepo.allForUser
      ? await this.giftsRepo.allForUser(user.sub)
      : this.giftsRepo.all().filter(item => item.userId === user.sub).reverse();
    if (this.canvas?.profile.mode === 'json') items.push(...await this.canvas.repository.listForUser(user.sub));
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(gift => this.ownerView(gift));
  }
  async photo(slug, invite) {
    const gift = await this.validateSlug(slug);
    requireGiftPermission(gift, invite);
    if (!gift.imageFile) throw new HttpError(404, 'Không tìm thấy ảnh.');
    return this.media.find(gift.imageFile);
  }
  async replies(slug, invite) {
    const gift = await this.validateSlug(slug);
    requireGiftPermission(gift, invite, 'canRead');
    return this.giftReplies(gift);
  }
  async giftReplies(gift) {
    if (gift.documentSnapshot && this.canvas?.profile.mode === 'json') return this.canvas.repository.repliesForGift(gift.id);
    return this.repliesRepo.allForGift
      ? this.repliesRepo.allForGift(gift.id)
      : this.repliesRepo.all().filter(item => item.giftId === gift.id);
  }
  async create(user, input) {
    const templateId = sanitizeText(input.templateId, 100);
    const template = await this.catalog.getTemplate(templateId);
    if (template.versionId) throw new HttpError(409, 'Mở mẫu trong trình cá nhân hóa để dùng đúng phiên bản đã duyệt.');
    if (template.price > 0) {
      const licensed = await this.checkout.hasLicense(user.sub, templateId);
      if (!licensed) throw new HttpError(402, 'Bạn cần mua quyền sử dụng mẫu trước khi xuất bản quà.');
    }
    const recipientName = sanitizeText(input.recipientName, 60);
    const senderName = sanitizeText(input.senderName, 60);
    const message = sanitizeText(input.message, 1000);
    const access = createGiftAccess(input.access);
    const photo = await decodePhoto(input.photoDataUrl);
    const slug = randomId(24);
    const imageFile = photo ? this.media.store(photo) : null;
    const gift = {
      id: randomUUID(), slug, userId: user.sub,
      templateId, templateTitle: template.title, theme: template.theme,
      recipientName, senderName, message, imageFile, replyCount: 0,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.config.giftTtlDays * 86400_000).toISOString(), ...access,
    };
    try { return await this.giftsRepo.insert(gift); }
    catch (error) {
      if (imageFile) {
        try { this.media.remove?.(imageFile); } catch { /* Preserve the original database error. */ }
      }
      throw error;
    }
  }
  async publicGift(slug, invite) {
    const gift = await this.validateSlug(slug);
    const { canSend, canRead, replyAudience, repliesDisabled } = requireGiftPermission(gift, invite);
    if (gift.documentSnapshot && this.canvas && !this.canvas.flags.read) throw new HttpError(503, 'Đọc quà canvas đang tạm tắt.');
    const view = publicGiftView(gift);
    if (view.photoUrl && gift.access?.open === 'invite') view.photoUrl += `?invite=${encodeURIComponent(invite)}`;
    return { ...view, replyCount: canRead ? view.replyCount : undefined, replyPermissions: { canSend, canRead, replyAudience, repliesDisabled } };
  }
  async reply(slug, body, ip, invite) {
    const gift = await this.validateSlug(slug);
    requireGiftPermission(gift, invite, 'canSend');
    const key = `${slug}:${ip}`;
    if (!this.repliesLimit.consume(key)) throw new HttpError(429, 'Bạn đã gửi nhiều phản hồi. Vui lòng thử lại sau.');
    const reply = {
      id: randomUUID(), giftId: gift.id,
      name: sanitizeOptionalText(body.name, 50) || 'Người nhận',
      message: sanitizeText(body.message, 1000), createdAt: new Date().toISOString(),
    };
    if (gift.documentSnapshot && this.canvas?.profile.mode === 'json') return this.canvas.repository.addReply(gift.id, reply, invite);
    if (this.giftsRepo.addReply) return this.giftsRepo.addReply(gift.id, reply, invite);
    // The legacy JSON stores write synchronously in the same process.
    requireGiftPermission(this.giftsRepo.all().find(item => item.id === gift.id), invite, 'canSend');
    this.repliesRepo.insert(reply);
    this.giftsRepo.update(gift.id, { replyCount: gift.replyCount + 1 });
    return reply;
  }
}
