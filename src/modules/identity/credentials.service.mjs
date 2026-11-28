import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { HttpError, localizedError } from '../../shared/http.mjs';
import { registrationEvidence } from './consent.mjs';
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
    if (typeof stored !== 'string' || stored.length !== 161 || typeof password !== 'string' || password.length > 128 ||
      !/^[a-fA-F0-9]{32}:[a-fA-F0-9]{128}$/.test(stored)) return false;
    const [saltHex, hashHex] = stored.split(':');
    try {
      const expected = Buffer.from(hashHex, 'hex');
      const actual = await this.derivePassword(password, Buffer.from(saltHex, 'hex'), expected.length);
      return timingSafeEqual(expected, actual);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      return false;
    }
  }

  // Đăng ký công khai phải qua consent; provision tài khoản QA nội bộ không giả lập đồng ý.
  async registerPublic(body, locale) {
    const evidence = registrationEvidence(body.consent, locale);
    return this.register(body, evidence);
  }

  async register({ name, email, password }, evidence) {
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
      ...(evidence ? { registrationConsent: evidence } : {}),
      createdAt: new Date().toISOString(),
    });
  }

  // Đổi mật khẩu chỉ cho credential local; giữ nguyên consent và vai trò.
  async changePassword(session, { currentPassword, password, confirmPassword }, commitAuthenticated) {
    if (!session?.sub) throw localizedError(401, 'errors.unauthorized');
    const user = await this.repository.get(session.sub);
    if (!user || (user.credentialVersion || 0) !== (session.cv || 0)) throw localizedError(401, 'errors.unauthorized');
    if (user.provider !== 'email' || !user.passwordHash) throw localizedError(403, 'errors.auth.localPasswordOnly');
    if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 128)
      throw localizedError(400, 'errors.auth.currentPassword');
    this.validatePassword(password);
    if (password !== confirmPassword) throw localizedError(400, 'auth.password.mismatch');
    if (!(await this.verifyPassword(currentPassword, user.passwordHash)))
      throw localizedError(400, 'errors.auth.currentPassword');
    if (password === currentPassword) throw localizedError(400, 'errors.auth.passwordUnchanged');
    const passwordHash = await this.hashPassword(password);
    // Không giữ khóa trong lúc scrypt. Kiểm tra phiên trong cùng thao tác ghi.
    let changed = false;
    const updated = await commitAuthenticated(current => {
      if (current.provider !== 'email' || current.passwordHash !== user.passwordHash ||
        (current.credentialVersion || 0) !== (session.cv || 0)) return null;
      changed = true;
      return { passwordHash, credentialVersion: (session.cv || 0) + 1, recoveryChallenge: null };
    });
    if (!changed || !updated) throw localizedError(409, 'errors.auth.credentialChanged');
    return updated;
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
