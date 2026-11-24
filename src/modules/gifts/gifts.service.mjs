import { checkedSettings, createRecipients, receiptFor, confirmRecipient, namingError } from './recipients.mjs';
import { recipientText, recipientCsv } from '../../../web/js/shared/recipient-naming.js';
import { giftOwnerLinks } from './links.mjs';
import { randomUUID } from 'node:crypto';
import { localizedError } from '../../shared/http.mjs';
import { randomId, sanitizeText, sanitizeOptionalText } from '../../shared/security.mjs';
import { decodePhoto } from './photo.mjs';
import { publicGiftView, giftSummary, hash } from '../designs/designs.service.mjs';
import { createGiftAccess, requireGiftPermission } from './access.mjs';
import { checkReplyReplay, replyId, replyView } from './replies.mjs';
import { supportsRsvp, rsvpRecord, rsvpView, updateRsvp } from './rsvp.mjs';
import { setGiftArchive } from './lifecycle.mjs';
import { renewalView, renewGift } from './renewal.mjs';

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
      ...renewalView(gift, this.config.giftRenewalDays),
      ...(gift.senderArchivedAt ? { senderArchivedAt: gift.senderArchivedAt } : {}),
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
  async mutateGift(gift, update) {
    if (gift.documentSnapshot && this.canvas?.profile.mode === 'json') return this.canvas.repository.mutateGift(gift.id, update);
    if (this.giftsRepo.mutateGift) return this.giftsRepo.mutateGift(gift.id, update);
    let result;
    this.giftsRepo.mutate(gift.id, current => { result = update(current); return current; });
    return result;
  }
  async confirmName(slug, invite, body) {
    const gift = await this.validateSlug(slug);
    return this.mutateGift(gift, current => {
      requireGiftPermission(current, invite);
      const receipt = confirmRecipient(current, body);
      return { id: receipt.id, name: receipt.name };
    });
  }
  async recipientRows(user, slug) {
    const gift = await this.ownGift(user, slug);
    const replies = await this.giftReplies(gift);
    const { url: publicUrl, inviteUrl } = giftOwnerLinks(this.config.baseUrl, gift);
    const hasRsvp = supportsRsvp(gift);
    return (gift.recipients || []).map(({ token, rsvp, ...receipt }) => {
      const link = new URL(inviteUrl || publicUrl);
      if (receipt.source === 'list') link.searchParams.set('r', token);
      return { ...receipt, ...(hasRsvp ? { rsvp: rsvpRecord({ rsvp }) } : {}), url: link.href, status: replies.some(r => r.recipientId === receipt.id) ? 'replied' : receipt.confirmedAt ? 'confirmed' : 'created' };
    });
  }
  async recipientExport(user, slug) { return recipientCsv(await this.recipientRows(user, slug)); }
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
  async archive(user, slug, body) {
    const gift = await this.ownGift(user, slug);
    const result = await this.mutateGift(gift, current => setGiftArchive(current, user.sub, body));
    if (!result) throw localizedError(404, 'errors.gift.notFound');
    return result;
  }
  async renew(user, slug, body) {
    const gift = await this.ownGift(user, slug);
    const result = await this.mutateGift(gift, current => renewGift(current, user.sub, body, this.config.giftRenewalDays));
    if (!result) throw localizedError(404, 'errors.gift.notFound');
    return result;
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
  async photo(slug, invite, token) {
    const gift = await this.validateSlug(slug);
    requireGiftPermission(gift, invite);
    receiptFor(gift, token);
    if (!gift.imageFile) throw localizedError(404, 'errors.gift.emptyPhoto');
    return this.media.find(gift.imageFile);
  }
  async replies(slug, invite, token) {
    const gift = await this.validateSlug(slug);
    requireGiftPermission(gift, invite, 'canRead');
    const receipt = receiptFor(gift, token);
    return (await this.giftReplies(gift)).filter(reply => !receipt || reply.recipientId === receipt.id).map(reply => replyView(reply));
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
    const settings = checkedSettings(input.personalization);
    if (settings && settings.mode !== 'manual' && !input.idempotencyKey) throw namingError('recipient.error.intent');
    const creationId = input.idempotencyKey ? replyId(user.sub, input.idempotencyKey) : null;
    const creationHash = creationId ? hash({ ...input, personalization: settings }) : null;
    const previousCreation = async () => {
      const gift = creationId && (this.giftsRepo.get ? await this.giftsRepo.get(creationId) : this.giftsRepo.all().find(g => g.id === creationId));
      if (!gift) return null;
      if (gift.userId !== user.sub || gift.creationHash !== creationHash) throw namingError('recipient.error.retry', 409);
      return gift;
    };
    const previous = await previousCreation();
    if (previous) return previous;
    const templateId = sanitizeText(input.templateId, 100);
    const template = await this.catalog.getTemplate(templateId);
    if (template.versionId) throw localizedError(409, 'errors.gift.versionRequired');
    if (template.price > 0) {
      const licensed = await this.checkout.hasLicense(user.sub, templateId);
      if (!licensed) throw localizedError(402, 'errors.gift.licenseRequired');
    }
    const recipients = createRecipients(settings, user.sub);
    const recipientName = settings && settings.mode !== 'manual' ? '' : sanitizeText(input.recipientName, 60);
    const senderName = sanitizeText(input.senderName, 60);
    const message = sanitizeText(input.message, 1000);
    const access = createGiftAccess(input.access);
    const photo = await decodePhoto(input.photoDataUrl);
    const slug = randomId(24);
    const imageFile = photo ? this.media.store(photo) : null;
    const gift = {
      id: creationId || randomUUID(), slug, userId: user.sub, ...(creationHash ? { creationHash } : {}),
      templateId, templateTitle: template.title, theme: template.theme,
      recipientName, senderName, message, imageFile, replyCount: 0, ...recipients,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.config.giftTtlDays * 86400_000).toISOString(), ...access,
    };
    try {
      // JSON insertion is synchronous after this recheck; MySQL's primary key
      // resolves concurrent creates. The same full payload commits the roster.
      const replay = await previousCreation();
      if (replay) { if (imageFile) this.media.remove?.(imageFile); return replay; }
      if (creationId && !this.giftsRepo.client) {
        const existing = this.giftsRepo.all().find(g => g.id === creationId);
        if (existing) {
          if (existing.creationHash !== creationHash) throw namingError('recipient.error.retry', 409);
          if (imageFile) this.media.remove?.(imageFile);
          return existing;
        }
      }
      return await this.giftsRepo.insert(gift);
    }
    catch (error) {
      if (creationId) {
        // An interrupted DB ACK may already have committed the photo reference.
        const replay = await previousCreation();
        if (replay) { if (imageFile && imageFile !== replay.imageFile) this.media.remove?.(imageFile); return replay; }
      }
      if (imageFile) {
        try { this.media.remove?.(imageFile); } catch { /* Preserve the original database error. */ }
      }
      throw error;
    }
  }
  async publicGift(slug, invite, token) {
    const gift = await this.validateSlug(slug);
    const { canSend, canRead, replyAudience, repliesDisabled } = requireGiftPermission(gift, invite);
    if (gift.documentSnapshot && this.canvas && !this.canvas.flags.read) throw localizedError(503, 'errors.gift.canvasReadDisabled');
    const receipt = receiptFor(gift, token, gift.recipientMode === 'list' || Boolean(token));
    if (gift.recipientMode === 'self' && !receipt) return { slug: gift.slug, recipientMode: 'self', nameRequired: true };
    const resolved = structuredClone(gift);
    if (receipt) {
      resolved.recipientName = receipt.name;
      if (resolved.documentSnapshot) {
        resolved.documentSnapshot.bindings.recipientName.value = receipt.name;
        resolved.documentSnapshot.personalization = { version: 1, mode: gift.recipientMode, resolved: true };
      }
    }
    const view = publicGiftView(resolved);
    if (gift.recipientTextVersion === 1) view.message = recipientText(view.message, resolved.recipientName, true);
    const ownCount = receipt ? (await this.giftReplies(gift)).filter(r => r.recipientId === receipt.id).length : view.replyCount;
    if (view.photoUrl && token) view.photoUrl += `?r=${encodeURIComponent(token)}`;
    if (view.photoUrl && gift.access?.open === 'invite') view.photoUrl += `${view.photoUrl.includes('?') ? '&' : '?'}invite=${encodeURIComponent(invite)}`;
    const rsvp = rsvpView(gift, receipt, canSend);
    return { ...view, ...(rsvp ? { rsvp } : {}), recipientCount: undefined, receiptId: receipt?.id, replyCount: canRead ? ownCount : undefined, replyPermissions: { canSend, canRead, replyAudience, repliesDisabled } };
  }
  async respondRsvp(slug, invite, token, body) {
    const gift = await this.validateSlug(slug);
    if (gift.documentSnapshot && this.canvas && !this.canvas.flags.read) throw localizedError(503, 'errors.gift.canvasReadDisabled');
    return this.mutateGift(gift, current => updateRsvp(current, invite, token, body, recipientId => {
      if (!this.repliesLimit.consume(`rsvp:${slug}:${recipientId}`)) throw localizedError(429, 'errors.gift.replyLimit');
    }));
  }
  async reply(slug, body, ip, invite, token) {
    const gift = await this.validateSlug(slug);
    requireGiftPermission(gift, invite, 'canSend');
    const receipt = receiptFor(gift, token);
    const key = `${slug}:${receipt?.id || ip}`;
    const acceptNew = () => {
      if (!this.repliesLimit.consume(key)) throw localizedError(429, 'errors.gift.replyLimit');
    };
    const reply = {
      id: replyId(receipt ? `${gift.id}:${receipt.id}` : gift.id, body.intentId), giftId: gift.id,
      ...(receipt ? { recipientId: receipt.id, cardName: receipt.name } : {}),
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
