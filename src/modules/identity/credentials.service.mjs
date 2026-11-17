import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { HttpError } from '../../shared/http.mjs';

const scrypt = promisify(scryptCallback);

// Dịch vụ quản lý thông tin đăng nhập local cho MVP, không lưu mật khẩu gốc.
export class CredentialsService {
  constructor(repository) {
    this.repository = repository;
    this.activeHashes = 0;
  }

  normalizeEmail(value) {
    if (typeof value !== 'string') throw new HttpError(400, 'Email không hợp lệ.');
    const email = value.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, 'Vui lòng nhập địa chỉ email hợp lệ.');
    }
    return email;
  }

  validatePassword(value) {
    if (typeof value !== 'string' || value.length < 10 || value.length > 128) {
      throw new HttpError(400, 'Mật khẩu phải từ 10 đến 128 ký tự.');
    }
    if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) {
      throw new HttpError(400, 'Mật khẩu cần có ít nhất một chữ cái và một chữ số.');
    }
  }

  async hashPassword(password) {
    const salt = randomBytes(16);
    const hash = await this.derivePassword(password, salt, 64);
    return `${salt.toString('hex')}:${hash.toString('hex')}`;
  }

  async derivePassword(password, salt, length) {
    if (this.activeHashes >= 4) throw new HttpError(503, 'Xác thực đang bận. Vui lòng thử lại sau.');
    this.activeHashes++;
    try { return await scrypt(password, salt, length); }
    finally { this.activeHashes--; }
  }

  async verifyPassword(password, stored) {
    if (!stored || typeof password !== 'string' || password.length > 128) return false;
    const [saltHex, hashHex] = stored.split(':');
    if (!saltHex || !hashHex || saltHex.length !== 32 || hashHex.length !== 128) return false;
    try {
      const expected = Buffer.from(hashHex, 'hex');
      const actual = await this.derivePassword(password, Buffer.from(saltHex, 'hex'), expected.length);
      return timingSafeEqual(expected, actual);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      return false;
    }
  }

  async register({ name, email, password }) {
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 50) {
      throw new HttpError(400, 'Tên hiển thị phải từ 2 đến 50 ký tự.');
    }
    const normalizedEmail = this.normalizeEmail(email);
    this.validatePassword(password);
    if ((this.repository.findByEmail ? await this.repository.findByEmail(normalizedEmail)
      : this.repository.all().some(u => u.provider === 'email' && u.email === normalizedEmail))) {
      throw new HttpError(409, 'Email này đã được đăng ký. Vui lòng đăng nhập.');
    }
    const passwordHash = await this.hashPassword(password);
    // Một đăng ký khác có thể hoàn tất trong lúc scrypt chạy bất đồng bộ.
    // Kiểm tra lại và insert đồng bộ trong cùng tiến trình sở hữu repository.
    if ((this.repository.findByEmail ? await this.repository.findByEmail(normalizedEmail)
      : this.repository.all().some(u => u.provider === 'email' && u.email === normalizedEmail))) {
      throw new HttpError(409, 'Email này đã được đăng ký. Vui lòng đăng nhập.');
    }
    return this.repository.insert({
      id: cryptoRandomId(),
      provider: 'email',
      providerId: normalizedEmail,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      avatar: null,
      role: 'sender',
      createdAt: new Date().toISOString(),
    });
  }

  async login({ email, password }) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = this.repository.findByEmail
      ? await this.repository.findByEmail(normalizedEmail)
      : this.repository.all().find(u => u.provider === 'email' && u.email === normalizedEmail);
    if (!user || !(await this.verifyPassword(password, user.passwordHash))) {
      throw new HttpError(401, 'Email hoặc mật khẩu không chính xác.');
    }
    return user;
  }
}

import { randomUUID as cryptoRandomId } from 'node:crypto';

// Chỉ trả dữ liệu công khai của tài khoản ra API; tuyệt đối không gửi passwordHash.
export function publicUser(user) {
  if (!user) return null;
  const { id, name, email, avatar, role, provider, createdAt } = user;
  return { id, name, email, avatar, role, provider, createdAt };
}
