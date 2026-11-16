import { dataPath } from '../../shared/paths.mjs';
import { JsonRepository } from '../../shared/storage.mjs';
import { HttpError } from '../../shared/http.mjs';

// Danh sách yêu thích gắn với ID tài khoản, không phụ thuộc trình duyệt.
export class FavoritesService {
  constructor(repository = dataPath('catalog', 'favorites.json')) {
    this.repo = typeof repository === 'string' ? new JsonRepository(repository) : repository;
  }

  list(userId, publishedIds) {
    return this.repo.all()
      .filter(row => row.userId === userId && publishedIds.has(row.templateId))
      .map(row => row.templateId);
  }

  set(userId, templateId, saved, publishedIds) {
    if (!publishedIds.has(templateId)) throw new HttpError(404, 'Mẫu chưa được phát hành.');
    if (typeof saved !== 'boolean') throw new HttpError(400, 'Trạng thái yêu thích không hợp lệ.');
    const all = this.repo.all();
    const otherRows = all.filter(row => !(row.userId === userId && row.templateId === templateId));
    if (saved) otherRows.push({ userId, templateId, createdAt: new Date().toISOString() });
    this.repo.write(otherRows);
    return { templateId, saved };
  }
}
