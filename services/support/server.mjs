import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { environment } from '../shared/config.mjs';
import { JsonRepository } from '../shared/storage.mjs';
import { Router, HttpError, parseJson, sendJson } from '../shared/http.mjs';
import { currentUser, sanitizeText } from '../shared/security.mjs';

const config = environment();
const repo = new JsonRepository(path.resolve('services/support/data/requests.json'));
const router = new Router();

// Giới hạn yêu cầu liên hệ từ cùng một IP trên mỗi tiến trình.
const attempts = new Map();
class SupportService {
  create(data, user, ip) {
    const now = Date.now();
    const recent = (attempts.get(ip) || []).filter(t => now - t < 600000);
    if (recent.length >= 5) throw new HttpError(429, 'Bạn đã gửi quá nhiều yêu cầu. Hãy thử lại sau.');
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
    repo.insert(ticket);
    attempts.set(ip, [...recent, now]);
    return { code: ticket.code, status: ticket.status };
  }
}
const service = new SupportService();
router.on('GET', '/health', ({res}) => sendJson(res, 200, { name: 'support', ok: true }));
router.on('POST', '/requests', async ({req, res}) => {
  const user = currentUser(req, config.jwtSecret, false);
  const forwarded = String(req.headers['x-forwarded-for'] || '');
  const ip = forwarded.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const data = await parseJson(req, 8192);
  const result = service.create(data, user, ip);
  sendJson(res, 201, { ticket: result });
});
router.on('GET', '/admin/requests', ({req, res}) => {
  const user = currentUser(req, config.jwtSecret);
  if (user.role !== 'admin') throw new HttpError(403, 'Chỉ quản trị viên được xem yêu cầu hỗ trợ.');
  sendJson(res, 200, { requests: repo.all().sort((a,b) => b.createdAt.localeCompare(a.createdAt)) });
});
router.listen(4105);
