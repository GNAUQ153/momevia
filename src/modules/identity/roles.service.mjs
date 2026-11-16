import { HttpError } from '../../shared/http.mjs';

const roles = new Set(['sender', 'creator', 'admin']);

export class RoleService {
  constructor(repository) { this.repository = repository; }

  requireAdmin(actorId) {
    // Nguồn quyết định là role hiện tại, không phải role cũ trong JWT/body.
    if (this.repository.get(actorId)?.role !== 'admin') {
      throw new HttpError(403, 'Chỉ quản trị viên được thay đổi vai trò tài khoản.');
    }
  }

  list(actorId) {
    this.requireAdmin(actorId);
    return this.repository.all();
  }

  change(actorId, userId, role) {
    this.requireAdmin(actorId);
    if (typeof userId !== 'string' || !userId || userId.length > 100 || !roles.has(role)) {
      throw new HttpError(400, 'Tài khoản hoặc vai trò không hợp lệ.');
    }
    const user = this.repository.get(userId);
    if (!user) throw new HttpError(404, 'Tài khoản không tồn tại.');
    return user.role === role ? user : this.repository.update(userId, { role });
  }
}
