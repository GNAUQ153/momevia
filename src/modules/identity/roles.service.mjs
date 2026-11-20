import { localizedError } from '../../shared/http.mjs';

const roles = new Set(['sender', 'creator', 'admin']);

export class RoleService {
  constructor(repository) { this.repository = repository; }

  requireAdmin(actorId) {
    // Nguồn quyết định là role hiện tại, không phải role cũ trong JWT/body.
    if (this.repository.get(actorId)?.role !== 'admin') {
      throw localizedError(403, 'errors.auth.adminRole');
    }
  }

  list(actorId) {
    this.requireAdmin(actorId);
    return this.repository.all();
  }

  change(actorId, userId, role) {
    this.requireAdmin(actorId);
    if (typeof userId !== 'string' || !userId || userId.length > 100 || !roles.has(role)) {
      throw localizedError(400, 'errors.auth.invalidRole');
    }
    const user = this.repository.get(userId);
    if (!user) throw localizedError(404, 'errors.auth.noAccount');
    return user.role === role ? user : this.repository.update(userId, { role });
  }
}
