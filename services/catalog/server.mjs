import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { environment } from '../shared/config.mjs';
import { JsonRepository } from '../shared/storage.mjs';
import { Router, HttpError, parseJson, sendJson, requireInternal } from '../shared/http.mjs';
import { currentUser, sanitizeText, sanitizeOptionalText } from '../shared/security.mjs';
import { templates as seed } from './seed.mjs';
import { FavoritesService } from './favorites.mjs';

const config = environment();
const repo = new JsonRepository(path.resolve('services/catalog/data/templates.json'), seed);
const router = new Router();
const favorites = new FavoritesService();
const publishedIds = () => new Set(repo.all().filter(t => t.status === 'published').map(t => t.id));

class CatalogService {
  publicList() { return repo.all().filter(t => t.status === 'published'); }
  publicOne(id) {
    const item = repo.get(id);
    if (!item || item.status !== 'published') throw new HttpError(404, 'Mẫu quà không tồn tại.');
    return item;
  }
  createDraft(user, data) {
    if (!['creator', 'admin'].includes(user.role)) throw new HttpError(403, 'Bạn cần đăng ký Creator trước.');
    const themes = ['violet', 'sunshine', 'rose', 'navy', 'peach', 'sage', 'coral', 'sky', 'lilac', 'cream', 'amber', 'mint'];
    const theme = themes.includes(data.theme) ? data.theme : 'violet';
    const price = Number(data.price);
    if (!Number.isInteger(price) || price < 0 || price > 500000) throw new HttpError(400, 'Giá bán phải trong khoảng 0–500.000đ.');
    return repo.insert({
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
const service = new CatalogService();
router.on('GET', '/health', ({ res }) => sendJson(res, 200, { name: 'catalog', ok: true }));
router.on('GET', '/templates', ({ res, url }) => {
  let items = service.publicList();
  const q = url.searchParams.get('q')?.toLocaleLowerCase('vi') || '';
  const style = url.searchParams.get('style') || '';
  if (q) items = items.filter(item => `${item.title} ${item.subtitle} ${item.creator}`.toLocaleLowerCase('vi').includes(q));
  if (style && style !== 'Tất cả') items = items.filter(item => item.style === style);
  return sendJson(res, 200, { templates: items });
});
router.on('GET', '/templates/:id', ({ res, params }) => sendJson(res, 200, { template: service.publicOne(params.id) }));
// Mỗi tài khoản chỉ đọc/ghi danh sách yêu thích của chính mình.
router.on('GET', '/favorites', async ({ req, res }) => {
  const user = await currentUser(req, config.jwtSecret);
  sendJson(res, 200, { templateIds: favorites.list(user.sub, publishedIds()) });
});
router.on('POST', '/favorites', async ({ req, res }) => {
  const user = await currentUser(req, config.jwtSecret);
  const data = await parseJson(req);
  const templateId = sanitizeText(data.templateId, 90);
  const favorite = favorites.set(user.sub, templateId, data.saved, publishedIds());
  sendJson(res, 200, { favorite });
});
router.on('GET', '/creator/templates', async ({ req, res }) => {
  const user = await currentUser(req, config.jwtSecret);
  if (!['creator', 'admin'].includes(user.role)) throw new HttpError(403, 'Bạn cần quyền Creator để xem danh sách mẫu.');
  sendJson(res, 200, { templates: repo.all().filter(item => item.creatorId === user.sub) });
});
router.on('POST', '/creator/templates', async ({ req, res }) => {
  const user = await currentUser(req, config.jwtSecret);
  const result = service.createDraft(user, await parseJson(req));
  sendJson(res, 201, { template: result });
});
router.on('GET', '/admin/pending', async ({ req, res }) => {
  const user = await currentUser(req, config.jwtSecret);
  if (user.role !== 'admin') throw new HttpError(403, 'Chỉ quản trị viên được truy cập.');
  sendJson(res, 200, { templates: repo.all().filter(item => item.status === 'pending') });
});
router.on('POST', '/admin/templates/:id/approve', async ({ req, res, params }) => {
  const user = await currentUser(req, config.jwtSecret);
  if (user.role !== 'admin') throw new HttpError(403, 'Chỉ quản trị viên được duyệt mẫu.');
  const template = repo.get(params.id);
  if (!template) throw new HttpError(404, 'Không tìm thấy mẫu.');
  sendJson(res, 200, { template: repo.update(params.id, { status: 'published' }) });
});
router.on('POST', '/admin/templates/:id/reject', async ({ req, res, params }) => {
  const user = await currentUser(req, config.jwtSecret);
  if (user.role !== 'admin') throw new HttpError(403, 'Chỉ quản trị viên được kiểm duyệt.');
  const reason = sanitizeOptionalText((await parseJson(req)).reason, 250);
  const template = repo.get(params.id);
  if (!template) throw new HttpError(404, 'Không tìm thấy mẫu.');
  sendJson(res, 200, { template: repo.update(params.id, { status: 'rejected', rejectionReason: reason }) });
});
router.on('GET', '/internal/templates/:id', ({ req, res, params }) => {
  requireInternal(req, config.internalKey);
  sendJson(res, 200, { template: service.publicOne(params.id) });
});
router.listen(4102);
