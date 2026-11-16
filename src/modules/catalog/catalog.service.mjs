import { randomUUID } from 'node:crypto';
import { HttpError } from '../../shared/http.mjs';
import { sanitizeText, sanitizeOptionalText } from '../../shared/security.mjs';

export class CatalogService {
  constructor(repository, favorites) { this.repo = repository; this.favorites = favorites; }

  publicList() { return this.repo.all().filter(t => t.status === 'published'); }
  search({ q = '', style = '' }) {
    let items = this.publicList();
    q = q.toLocaleLowerCase('vi');
    if (q) items = items.filter(item => `${item.title} ${item.subtitle} ${item.creator}`.toLocaleLowerCase('vi').includes(q));
    if (style && style !== 'Tất cả') items = items.filter(item => item.style === style);
    return items;
  }
  publishedIds() { return new Set(this.publicList().map(template => template.id)); }
  favoriteIds(user) { return this.favorites.list(user.sub, this.publishedIds()); }
  saveFavorite(user, data) {
    return this.favorites.set(user.sub, sanitizeText(data.templateId, 90), data.saved, this.publishedIds());
  }
  mine(user) {
    if (!['creator', 'admin'].includes(user.role)) throw new HttpError(403, 'Bạn cần quyền Creator để xem danh sách mẫu.');
    return this.repo.all().filter(item => item.creatorId === user.sub);
  }
  requireAdmin(user, message) {
    if (user.role !== 'admin') throw new HttpError(403, message);
  }
  pending(user) {
    this.requireAdmin(user, 'Chỉ quản trị viên được truy cập.');
    return this.repo.all().filter(item => item.status === 'pending');
  }
  approve(user, id) {
    this.requireAdmin(user, 'Chỉ quản trị viên được duyệt mẫu.');
    if (!this.repo.get(id)) throw new HttpError(404, 'Không tìm thấy mẫu.');
    return this.repo.update(id, { status: 'published' });
  }
  reject(user, id, body) {
    this.requireAdmin(user, 'Chỉ quản trị viên được kiểm duyệt.');
    const reason = sanitizeOptionalText(body.reason, 250);
    if (!this.repo.get(id)) throw new HttpError(404, 'Không tìm thấy mẫu.');
    return this.repo.update(id, { status: 'rejected', rejectionReason: reason });
  }
  publicOne(id) {
    const item = this.repo.get(id);
    if (!item || item.status !== 'published') throw new HttpError(404, 'Mẫu quà không tồn tại.');
    return item;
  }
  createDraft(user, data) {
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
