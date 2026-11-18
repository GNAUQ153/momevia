import { randomUUID } from 'node:crypto';
import { HttpError } from '../../shared/http.mjs';
import { sanitizeText, sanitizeOptionalText } from '../../shared/security.mjs';
import { createDocument, isPhotoFrame } from '../../../web/js/shared/canvas/index.js';
import { visibleBindingKeys } from '../../../web/js/shared/canvas/personalization.js';
import { searchText } from '../../../web/js/features/catalog/filter.js';

const publicFields = ['id', 'title', 'subtitle', 'theme', 'style', 'price', 'scenes', 'effect', 'creator', 'featured', 'category', 'status', 'createdAt'];
export function publicTemplate(template) {
  const view = Object.fromEntries(publicFields.filter(key => Object.hasOwn(template, key)).map(key => [key, template[key]]));
  if (template.versionId) {
    view.versionId = template.versionId;
    const version = template.versions.find(item => item.id === template.versionId);
    if (version) {
      view.thumbnail = `/api/catalog/templates/${template.id}/versions/${template.versionId}/cover`;
      view.personalization = { bindings: version.bindings, photoFrames: Number(Boolean(version.photoId)), layout: false };
    }
  } else {
    const document = createDocument({ template });
    view.personalization = { bindings: [...visibleBindingKeys(document)], photoFrames: document.elements.filter(isPhotoFrame).length, layout: true };
  }
  return view;
}

export class CatalogService {
  constructor(repository, favorites) { this.repo = repository; this.favorites = favorites; }

  async isPublic(template) {
    return template?.status === 'published' && (!template.creatorDesignId || Boolean(template.versionId && await this.creatorTemplates.canCreate(template.creatorId)));
  }
  async publicList() {
    const items = (await this.repo.all()).filter(item => item.status === 'published');
    const visible = await Promise.all(items.map(item => this.isPublic(item)));
    return items.filter((_, index) => visible[index]).map(publicTemplate);
  }
  async search({ q = '', style = '' }) {
    let items = await this.publicList();
    q = searchText(q.trim());
    if (q) items = items.filter(item => [item.title, item.subtitle, item.creator, item.style, item.category].some(value => searchText(value).includes(q)));
    if (style && style !== 'Tất cả') items = items.filter(item => item.style === style);
    return items;
  }
  async publishedIds() { return new Set((await this.publicList()).map(template => template.id)); }
  async favoriteIds(user) { return this.favorites.list(user.sub, await this.publishedIds()); }
  async saveFavorite(user, data) {
    return this.favorites.set(user.sub, sanitizeText(data.templateId, 90), data.saved, await this.publishedIds());
  }
  async mine(user) {
    if (!['creator', 'admin'].includes(user.role)) throw new HttpError(403, 'Bạn cần quyền Creator để xem danh sách mẫu.');
    return (await this.repo.all()).filter(item => item.creatorId === user.sub && !item.creatorDesignId);
  }
  requireAdmin(user, message) {
    if (user.role !== 'admin') throw new HttpError(403, message);
  }
  async pending(user) {
    this.requireAdmin(user, 'Chỉ quản trị viên được truy cập.');
    return (await this.repo.all()).filter(item => item.status === 'pending' && !item.creatorDesignId);
  }
  async approve(user, id) {
    this.requireAdmin(user, 'Chỉ quản trị viên được duyệt mẫu.');
    return this.reviewLegacy(id, { status: 'published' });
  }
  async reject(user, id, body) {
    this.requireAdmin(user, 'Chỉ quản trị viên được kiểm duyệt.');
    const reason = sanitizeOptionalText(body.reason, 250);
    return this.reviewLegacy(id, { status: 'rejected', rejectionReason: reason });
  }
  async reviewLegacy(id, patch) {
    const current = await this.repo.get(id);
    if (!current) throw new HttpError(404, 'Không tìm thấy mẫu.');
    if (current.creatorDesignId) throw new HttpError(404, 'Hãy duyệt phiên bản mẫu trong hàng đợi.');
    return this.repo.update(id, patch);
  }
  async publicOne(id) {
    const item = await this.repo.get(id);
    if (!await this.isPublic(item)) throw new HttpError(404, 'Mẫu quà không tồn tại.');
    return publicTemplate(item);
  }
  async createDraft(user, data) {
    if (!['creator', 'admin'].includes(user.role)) throw new HttpError(403, 'Bạn cần đăng ký Creator trước.');
    const themes = ['violet', 'sunshine', 'rose', 'navy', 'peach', 'sage', 'coral', 'sky', 'lilac', 'cream', 'amber', 'mint'];
    const theme = themes.includes(data.theme) ? data.theme : 'violet';
    const price = Number(data.price);
    if (!Number.isInteger(price) || price < 0 || price > 500000) throw new HttpError(400, 'Giá bán phải trong khoảng 0–500.000đ.');
    return this.repo.insert({
      id: randomUUID(),
      title: sanitizeText(data.title, 60),
      subtitle: sanitizeText(data.subtitle, 140),
      theme,
      style: 'Độc quyền',
      price,
      scenes: 3,
      effect: 'Mở quà',
      creator: user.name,
      creatorId: user.sub,
      featured: false,
      status: 'pending',
      category: 'Sinh nhật',
      createdAt: new Date().toISOString(),
    });
  }
}
