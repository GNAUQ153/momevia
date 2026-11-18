import { RateLimiter } from '../../shared/rate-limit.mjs';
import { clientIp } from '../../shared/proxy.mjs';
import { HttpError } from '../../shared/http.mjs';

// Đếm mọi lần thử, kể cả thành công. Không đưa email thô vào bucket lưu trữ.
export class AuthLimits {
  constructor() {
    this.limits = {
      login: new RateLimiter({ limit: 20, windowMs: 900_000 }),
      account: new RateLimiter({ limit: 10, windowMs: 900_000 }),
      register: new RateLimiter({ limit: 10, windowMs: 600_000 }),
      recovery: new RateLimiter({ limit: 20, windowMs: 900_000 }),
      admin: new RateLimiter({ limit: 3, windowMs: 900_000 }),
      demo: new RateLimiter({ limit: 20, windowMs: 600_000 }),
      global: new RateLimiter({ limit: 300, windowMs: 60_000, maxKeys: 1 }),
    };
  }
  consume(kind, req, res, email) {
    const ip = clientIp(req);
    const allowed = this.limits.global.consume('all') && this.limits[kind].consume(ip)
      && (typeof email !== 'string' || this.limits.account.consume(email.trim().toLowerCase()));
    if (!allowed) {
      res.setHeader('retry-after', '900');
      throw new HttpError(429, 'Quá nhiều lần thử xác thực. Vui lòng thử lại sau.');
    }
  }
  close() { Object.values(this.limits).forEach(limiter => limiter.close()); }
}
