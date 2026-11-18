import { randomUUID } from 'node:crypto';
import { HttpError } from '../../shared/http.mjs';
import { sanitizeText } from '../../shared/security.mjs';

export class SupportService {
  constructor({ repository, attempts, resolveReport }) { this.repo = repository; this.attempts = attempts; this.resolveReport = resolveReport; }
  async requests(user) {
    if (user.role !== 'admin') throw new HttpError(403, 'Chỉ quản trị viên được xem yêu cầu hỗ trợ.');
    return (await this.repo.all()).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }

  async create(data, user, ip) {
    const name = sanitizeText(data.name, 60);
    const email = sanitizeText(data.email, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Email không hợp lệ.');
    const topic = sanitizeText(data.topic, 80);
    const message = sanitizeText(data.message, 2000);
    if (message.length < 15) throw new HttpError(400, 'Nội dung cần có ít nhất 15 ký tự.');
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
    if (!this.attempts.consume(ip)) throw new HttpError(429, 'Bạn đã gửi quá nhiều yêu cầu. Hãy thử lại sau.');
    if (data.reportKind || data.reportId) {
      if (!this.resolveReport || !['gift', 'template'].includes(data.reportKind) || typeof data.reportId !== 'string')
        throw new HttpError(400, 'Nội dung báo cáo không hợp lệ.');
      ticket.reportKind = data.reportKind;
      ticket.reportTarget = await this.resolveReport(data.reportKind, data.reportId, data.invite);
    }
    await this.repo.insert(ticket);
    return { code: ticket.code, status: ticket.status };
  }
  async updateReport(user, id, data) {
    if (user.role !== 'admin') throw new HttpError(403, 'Chỉ quản trị viên được xử lý báo cáo.');
    const ticket = (await this.repo.all()).find(item => item.id === id && item.reportKind);
    if (!ticket) throw new HttpError(404, 'Không tìm thấy báo cáo.');
    const claim = data.action === 'claim' && ticket.status === 'new';
    const resolve = data.action === 'resolve' && ticket.status === 'in_progress' && ticket.assignedTo === user.sub;
    if (!claim && !resolve) throw new HttpError(409, 'Báo cáo đã được xử lý hoặc giao cho quản trị viên khác.');
    const patch = { assignedTo: user.sub, status: claim ? 'in_progress' : 'resolved', resolution: claim ? null : sanitizeText(data.resolution, 500) };
    if (this.repo.updateReport) {
      if (!await this.repo.updateReport(id, patch, ticket)) throw new HttpError(409, 'Báo cáo vừa thay đổi. Tải lại trước khi xử lý.');
    } else this.repo.update(id, patch);
    return { status: patch.status };
  }
}
