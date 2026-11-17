import { randomUUID } from 'node:crypto';
import { HttpError } from '../../shared/http.mjs';
import { sanitizeText } from '../../shared/security.mjs';

export class SupportService {
  constructor({ repository, attempts }) { this.repo = repository; this.attempts = attempts; }
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
    await this.repo.insert(ticket);
    return { code: ticket.code, status: ticket.status };
  }
}
