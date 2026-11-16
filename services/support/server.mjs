import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { environment } from '../shared/config.mjs';
import { JsonRepository } from '../shared/storage.mjs';
import { Router, HttpError, parseJson, sendJson } from '../shared/http.mjs';
import { currentUser, sanitizeText } from '../shared/security.mjs';
import { clientIp } from '../shared/proxy.mjs';
import { RateLimiter } from '../shared/rate-limit.mjs';

const config = environment();
const repo = new JsonRepository(path.resolve('services/support/data/requests.json'));
const router = new Router();

// Giới hạn yêu cầu liên hệ từ cùng một IP trên mỗi tiến trình.
const attempts = new RateLimiter({ limit: 5, windowMs: 600_000 });
const globalAttempts = new RateLimiter({ limit: 60, windowMs: 60_000, maxKeys: 1 });
class SupportService {
  create(data, user, ip) {
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
    if (!attempts.consume(ip)) throw new HttpError(429, 'Bạn đã gửi quá nhiều yêu cầu. Hãy thử lại sau.');
    repo.insert(ticket);
    return { code: ticket.code, status: ticket.status };
  }
}
const service = new SupportService();
router.on('GET', '/health', ({res}) => sendJson(res, 200, { name: 'support', ok: true }));
router.on('POST', '/requests', async ({req, res}) => {
  if (!globalAttempts.consume('all')) throw new HttpError(429, 'Hệ thống đang nhận nhiều yêu cầu. Vui lòng thử lại sau.');
  const user = await currentUser(req, config.jwtSecret, false);
  const data = await parseJson(req, 8192);
  const result = service.create(data, user, clientIp(req));
  sendJson(res, 201, { ticket: result });
});
router.on('GET', '/admin/requests', async ({req, res}) => {
  const user = await currentUser(req, config.jwtSecret);
  if (user.role !== 'admin') throw new HttpError(403, 'Chỉ quản trị viên được xem yêu cầu hỗ trợ.');
  sendJson(res, 200, { requests: repo.all().sort((a,b) => b.createdAt.localeCompare(a.createdAt)) });
});
router.listen(4105);
