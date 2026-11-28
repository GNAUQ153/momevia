import { randomUUID } from 'node:crypto';
import { localizedError } from '../../shared/http.mjs';
import { sanitizeText } from '../../shared/security.mjs';
import { withdrawalTopic, withdrawalHistoryLimit } from '../../../web/js/shared/privacy-requests.js';

export class SupportService {
  constructor({ repository, attempts, resolveReport }) { this.repo = repository; this.attempts = attempts; this.resolveReport = resolveReport; }
  async requests(user) {
    if (user.role !== 'admin') throw localizedError(403, 'errors.support.viewDenied');
    return (await this.repo.all()).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }

  async privacyRequests(user) {
    if (typeof user?.sub !== 'string' || !user.sub) throw localizedError(401, 'errors.unauthorized');
    const rows = this.repo.findPrivacyRequests
      ? await this.repo.findPrivacyRequests(user.sub, withdrawalTopic, withdrawalHistoryLimit)
      : (await this.repo.all()).filter(item => item.userId === user.sub && item.topic === withdrawalTopic);
    return rows.filter(item => item.userId === user.sub && item.topic === withdrawalTopic)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.code.localeCompare(a.code))
      .slice(0, withdrawalHistoryLimit)
      .map(({ code, status, createdAt }) => ({ code, status, createdAt }));
  }

  async create(data, user, ip) {
    const name = sanitizeText(data.name, 60);
    const email = sanitizeText(data.email, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw localizedError(400, 'errors.auth.invalidEmail');
    const topic = sanitizeText(data.topic, 80);
    if (topic === withdrawalTopic) {
      if (typeof user?.sub !== 'string' || !user.sub) throw localizedError(401, 'errors.unauthorized');
      if (data.reportKind || data.reportId) throw localizedError(400, 'errors.validation');
    }
    const message = sanitizeText(data.message, 2000);
    if (message.length < 15) throw localizedError(400, 'errors.support.shortMessage');
    const ticket = {
      id: randomUUID(),
      code: `HT-${new Date().getFullYear()}-${randomUUID().slice(0,8).toUpperCase()}`,
      userId: user?.sub || null,
      name,
      email,
      topic,
      message,
      status: 'new',
      createdAt: new Date().toISOString(),
    };
    if (!this.attempts.consume(ip)) throw localizedError(429, 'errors.support.rateLimit');
    if (data.reportKind || data.reportId) {
      if (!this.resolveReport || !['gift', 'template'].includes(data.reportKind) || typeof data.reportId !== 'string')
        throw localizedError(400, 'errors.support.report');
      ticket.reportKind = data.reportKind;
      ticket.reportTarget = await this.resolveReport(data.reportKind, data.reportId, data.invite);
    }
    await this.repo.insert(ticket);
    return { code: ticket.code, status: ticket.status };
  }
  async updateRequest(user, id, data) {
    if (user.role !== 'admin') throw localizedError(403, 'errors.support.handleDenied');
    const ticket = (await this.repo.all()).find(item => item.id === id);
    if (!ticket) throw localizedError(404, 'errors.support.notFound');
    const claim = data.action === 'claim' && ticket.status === 'new';
    const resolve = data.action === 'resolve' && ticket.status === 'in_progress' && ticket.assignedTo === user.sub;
    if (!claim && !resolve) throw localizedError(409, 'errors.support.inProgress');
    const resolution = claim ? null : sanitizeText(data.resolution, 500);
    if (resolve && !resolution) throw localizedError(422, 'errors.support.requireResolution');
    const patch = { assignedTo: user.sub, status: claim ? 'in_progress' : 'resolved', resolution };
    if (this.repo.updateRequest || this.repo.updateReport) {
      const update = this.repo.updateRequest || this.repo.updateReport;
      if (!await update.call(this.repo, id, patch, ticket)) throw localizedError(409, 'errors.support.stale');
    } else if (this.repo.mutate) {
      let applied = false;
      const updated = await this.repo.mutate(id, current => {
        if (current.status !== ticket.status || (current.assignedTo || null) !== (ticket.assignedTo || null)) return null;
        applied = true;
        return patch;
      });
      if (!updated || !applied) throw localizedError(409, 'errors.support.stale');
    } else throw new Error('Support repository thiếu cập nhật có kiểm soát trạng thái.');
    return { status: patch.status };
  }
  // Backward-compatible name for existing report routes and tests.
  async updateReport(user, id, data) { return this.updateRequest(user, id, data); }
}
