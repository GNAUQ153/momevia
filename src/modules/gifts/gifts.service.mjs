import { randomUUID } from 'node:crypto';
import { localizedError } from '../../shared/http.mjs';
import { randomId, sanitizeText, sanitizeOptionalText } from '../../shared/security.mjs';
import { decodePhoto } from './photo.mjs';
import { publicGiftView, giftSummary } from '../designs/designs.service.mjs';
import { createGiftAccess, requireGiftPermission } from './access.mjs';
import { checkReplyReplay, replyId, replyView } from './replies.mjs';

export class GiftService {
  constructor({ giftsRepo, repliesRepo, media, config, repliesLimit, catalog, checkout, canvas }) {
    Object.assign(this, { giftsRepo, repliesRepo, media, config, repliesLimit, catalog, checkout, canvas });
  }
  async validateSlug(slug) {
    if (!/^[A-Za-z0-9_-]{18,48}$/.test(slug)) throw localizedError(404, 'errors.gift.notFound');
    let gift = this.giftsRepo.getBySlug
      ? await this.giftsRepo.getBySlug(slug)
      : this.giftsRepo.all().find(item => item.slug === slug);
    if (gift && !this.giftsRepo.getBySlug) {
      const rows = this.repliesRepo.all().filter(reply => reply.giftId === gift.id);
      gift = { ...gift, replyCount: rows.length, unreadCount: rows.filter(reply => reply.readStatus === 'unread').length };
    }
    if (!gift && this.canvas?.profile.mode === 'json') {
      gift = await this.canvas.repository.findBySlug(slug);
      if (gift) gift.unreadCount = (await this.canvas.repository.repliesForGift(gift.id)).filter(reply => reply.readStatus === 'unread').length;
    }
    if (!gift) throw localizedError(404, 'errors.gift.notFound');
    return gift;
  }
  ownerView(gift) {
    return { ...giftSummary(gift), unreadCount: gift.unreadCount ?? 0, canRegift: Boolean(this.canvas?.flags.edit && (gift.templateId || gift.documentSnapshot)),
      access: gift.access, inviteToken: gift.inviteToken,
      photoUrl: gift.imageFile ? `/api/gifts/gifts/${gift.slug}/photo` : null };
  }
  async ownGift(user, slug) {
    const gift = await this.validateSlug(slug);
    if (gift.userId !== user.sub) throw localizedError(404, 'errors.gift.notFound');
    return gift;
  }
  async regift(user, slug, input) {
    if (!this.canvas) throw localizedError(503, 'errors.gift.layoutDisabled');
    if (!this.canvas.writeLimit.consume(user.sub)) throw localizedError(429, 'errors.rateLimit');
    return this.canvas.service.regift(user, await this.ownGift(user, slug), input);
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
    const legacyStats = new Map();
    if (!this.giftsRepo.allForUser) {
      for (const reply of this.repliesRepo.all()) {
        const stat = legacyStats.get(reply.giftId) || { replyCount: 0, unreadCount: 0 };
        stat.replyCount++;
        stat.unreadCount += Number(reply.readStatus === 'unread');
        legacyStats.set(reply.giftId, stat);
      }
    }
    const items = this.giftsRepo.allForUser
      ? await this.giftsRepo.allForUser(user.sub)
      : this.giftsRepo.all().filter(item => item.userId === user.sub).reverse().map(gift => ({
        ...gift, ...(legacyStats.get(gift.id) || { replyCount: 0, unreadCount: 0 }),
      }));
    if (this.canvas?.profile.mode === 'json') items.push(...await this.canvas.repository.listForUser(user.sub));
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(gift => this.ownerView(gift));
  }
  async photo(slug, invite) {
    const gift = await this.validateSlug(slug);
    requireGiftPermission(gift, invite);
    if (!gift.imageFile) throw localizedError(404, 'errors.gift.emptyPhoto');
    return this.media.find(gift.imageFile);
  }
  async replies(slug, invite) {
    const gift = await this.validateSlug(slug);
    requireGiftPermission(gift, invite, 'canRead');
    return (await this.giftReplies(gift)).map(reply => replyView(reply));
  }
  async giftReplies(gift) {
    if (gift.documentSnapshot && this.canvas?.profile.mode === 'json') return this.canvas.repository.repliesForGift(gift.id);
    return this.repliesRepo.allForGift
      ? this.repliesRepo.allForGift(gift.id)
      : this.repliesRepo.all().filter(item => item.giftId === gift.id);
  }
  async markRepliesRead(gift, ids) {
    if (gift.documentSnapshot && this.canvas?.profile.mode === 'json')
      return this.canvas.repository.markRepliesRead(gift.id, ids);
    if (this.repliesRepo.markRead) return this.repliesRepo.markRead(gift.id, ids);
    const rows = this.repliesRepo.all();
    let unread = 0, changed = false;
    for (const reply of rows) {
      if (reply.giftId !== gift.id || reply.readStatus !== 'unread') continue;
      if (ids.has(reply.id)) { reply.readStatus = 'read'; changed = true; }
      else unread++;
    }
    if (changed) this.repliesRepo.write(rows);
    return unread;
  }
  async create(user, input) {
    const templateId = sanitizeText(input.templateId, 100);
    const template = await this.catalog.getTemplate(templateId);
    if (template.versionId) throw localizedError(409, 'errors.gift.versionRequired');
    if (template.price > 0) {
      const licensed = await this.checkout.hasLicense(user.sub, templateId);
      if (!licensed) throw localizedError(402, 'errors.gift.licenseRequired');
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
    if (gift.documentSnapshot && this.canvas && !this.canvas.flags.read) throw localizedError(503, 'errors.gift.canvasReadDisabled');
    const view = publicGiftView(gift);
    if (view.photoUrl && gift.access?.open === 'invite') view.photoUrl += `?invite=${encodeURIComponent(invite)}`;
    return { ...view, replyCount: canRead ? view.replyCount : undefined, replyPermissions: { canSend, canRead, replyAudience, repliesDisabled } };
  }
  async reply(slug, body, ip, invite) {
    const gift = await this.validateSlug(slug);
    requireGiftPermission(gift, invite, 'canSend');
    const key = `${slug}:${ip}`;
    const acceptNew = () => {
      if (!this.repliesLimit.consume(key)) throw localizedError(429, 'errors.gift.replyLimit');
    };
    const reply = {
      id: replyId(gift.id, body.intentId), giftId: gift.id,
      name: sanitizeOptionalText(body.name, 50) || 'Người nhận',
      message: sanitizeText(body.message, 1000), createdAt: new Date().toISOString(), readStatus: 'unread',
    };
    if (gift.documentSnapshot && this.canvas?.profile.mode === 'json') return this.canvas.repository.addReply(gift.id, reply, invite, acceptNew);
    if (this.giftsRepo.addReply) return this.giftsRepo.addReply(gift.id, reply, invite, acceptNew);
    // The legacy JSON reply list is authoritative if a process stops between the two writes.
    requireGiftPermission(this.giftsRepo.all().find(item => item.id === gift.id), invite, 'canSend');
    const existing = this.repliesRepo.all().filter(item => item.giftId === gift.id);
    const replay = existing.find(item => item.id === reply.id);
    if (replay) checkReplyReplay(replay, reply);
    else {
      acceptNew();
      this.repliesRepo.insert(reply);
    }
    this.giftsRepo.update(gift.id, { replyCount: existing.length + Number(!replay) });
    return replay || reply;
  }
}
