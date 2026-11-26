import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { HttpError, localizedError } from '../../shared/http.mjs';
import { normalizeEmail, validatePassword } from '../../shared/credential-policy.mjs';

const scrypt = promisify(scryptCallback);

// Dịch vụ quản lý thông tin đăng nhập local cho MVP, không lưu mật khẩu gốc.
export class CredentialsService {
  constructor(repository) {
    this.repository = repository;
    this.activeHashes = 0;
  }

  normalizeEmail(value) { return normalizeEmail(value); }

  validatePassword(value) { return validatePassword(value); }

  async hashPassword(password) {
    const salt = randomBytes(16);
    const hash = await this.derivePassword(password, salt, 64);
    return `${salt.toString('hex')}:${hash.toString('hex')}`;
  }

  async derivePassword(password, salt, length) {
    if (this.activeHashes >= 4) throw localizedError(503, 'errors.auth.busy');
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
      throw localizedError(400, 'errors.auth.nameLength');
    }
    const normalizedEmail = this.normalizeEmail(email);
    this.validatePassword(password);
    if ((this.repository.findByEmail ? await this.repository.findByEmail(normalizedEmail)
      : this.repository.all().some(u => u.provider === 'email' && u.email === normalizedEmail))) {
      throw localizedError(409, 'errors.auth.emailTaken');
    }
    const passwordHash = await this.hashPassword(password);
    // Một đăng ký khác có thể hoàn tất trong lúc scrypt chạy bất đồng bộ.
    // Kiểm tra lại và insert đồng bộ trong cùng tiến trình sở hữu repository.
    if ((this.repository.findByEmail ? await this.repository.findByEmail(normalizedEmail)
      : this.repository.all().some(u => u.provider === 'email' && u.email === normalizedEmail))) {
      throw localizedError(409, 'errors.auth.emailTaken');
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
      throw localizedError(401, 'errors.auth.badCredentials');
    }
    return user;
  }
}

import { randomUUID as cryptoRandomId } from 'node:crypto';

// Chỉ trả dữ liệu công khai của tài khoản ra API; tuyệt đối không gửi passwordHash.
export function publicUser(user) {
  if (!user) return null;
  const { id, name, email, avatar, role, provider, createdAt } = user;
  return { id, name, email, avatar, role, provider, createdAt,
    ...(provider === 'email' ? { emailVerified: Boolean(user.emailVerifiedAt) } : {}) };
}
