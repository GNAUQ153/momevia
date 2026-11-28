import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { localizedError } from '../../shared/http.mjs';
import { serverText } from '../../shared/locale.mjs';

const codeInvalid = () => localizedError(422, 'errors.invalidRecoveryCode');
export const recoveryTtlMs = 15 * 60_000;

export function recoveryMailer(config) {
  if (!config.recoveryMailUrl || !config.recoveryMailToken) return null;
  const url = new URL(config.recoveryMailUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash)
    throw new Error('RECOVERY_MAIL_URL needs an HTTPS mail relay endpoint.');
  return async message => {
    const response = await fetch(url, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.recoveryMailToken}` },
      body: JSON.stringify(message),
    });
    if (!response.ok) throw new Error('Recovery mail relay unavailable.');
  };
}

export class RecoveryService {
  constructor({ users, credentials, secret, sendMail, now = Date.now }) {
    Object.assign(this, { users, credentials, secret, sendMail, now });
  }
  requireMail() {
    if (!this.sendMail) throw localizedError(503, 'errors.recoveryDisabled');
  }
  async byEmail(email) {
    const address = this.credentials.normalizeEmail(email);
    return this.users.findByEmail ? this.users.findByEmail(address)
      : this.users.all().find(user => user.provider === 'email' && user.email === address);
  }
  digest(user, purpose, code) {
    return createHmac('sha256', this.secret).update(JSON.stringify([user.id, user.email, purpose, code])).digest('hex');
  }
  async start(user, purpose, locale = 'vi') {
    this.requireMail();
    if (user?.provider !== 'email' || !user.email) return;
    const code = String(randomInt(0, 100_000_000)).padStart(8, '0');
    const now = this.now();
    let challenge;
    await this.users.mutate(user.id, current => {
      if (current.email !== user.email || current.provider !== 'email' || (purpose === 'verify' && current.emailVerifiedAt)) return null;
      if (current.recoveryChallenge?.issuedAt + 60_000 > now) return null;
      challenge = { purpose, digest: this.digest(current, purpose, code), issuedAt: now, expiresAt: now + recoveryTtlMs, attempts: 0 };
      return { recoveryChallenge: challenge };
    });
    if (!challenge) return;
    // Keep relay latency out of the public request for both known and unknown accounts.
    void this.deliver(user, purpose, code, challenge, locale);
  }
  async deliver(user, purpose, code, challenge, locale) {
    try {
      await this.sendMail({
        to: user.email,
        subject: serverText(locale, purpose === 'reset' ? 'mail.recovery.resetSubject' : 'mail.recovery.verifySubject'),
        text: serverText(locale, 'mail.recovery.code', { code, minutes: recoveryTtlMs / 60_000 }),
      });
    } catch {
      try {
        await this.users.mutate(user.id, current => current.recoveryChallenge?.digest === challenge.digest ? { recoveryChallenge: null } : null);
      } catch {
        console.error('Momevia recovery challenge cleanup failed.');
      }
      console.error('Momevia recovery mail delivery failed.');
    }
  }
  // Kiểm tra challenge trong mutate đồng bộ (MySQL khóa hàng), kể cả lượt nhập sai.
  validChallenge(current, user, purpose, now) {
    const challenge = current.recoveryChallenge;
    return current.email === user.email && current.provider === 'email' &&
      !(purpose === 'verify' && current.emailVerifiedAt) && challenge && purpose === challenge.purpose &&
      Number.isFinite(challenge.issuedAt) && Number.isFinite(challenge.expiresAt) &&
      challenge.issuedAt <= now && now < challenge.expiresAt &&
      Number.isInteger(challenge.attempts) && challenge.attempts >= 0 && challenge.attempts < 5 &&
      typeof challenge.digest === 'string' && challenge.digest.length === 64 && /^[a-f0-9]{64}$/.test(challenge.digest);
  }
  async finish(user, purpose, code, password) {
    this.requireMail();
    if (!user || !['reset', 'verify'].includes(purpose) || typeof code !== 'string' || !/^\d{8}$/.test(code)) throw codeInvalid();
    if (purpose === 'reset') this.credentials.validatePassword(password);
    let approved;
    let verified = false;
    const inspected = await this.users.mutate(user.id, current => {
      const now = this.now();
      if (!this.validChallenge(current, user, purpose, now)) return null;
      const challenge = current.recoveryChallenge;
      if (!timingSafeEqual(Buffer.from(challenge.digest, 'hex'), Buffer.from(this.digest(current, purpose, code), 'hex'))) {
        return { recoveryChallenge: challenge.attempts >= 4 ? null : { ...challenge, attempts: challenge.attempts + 1 } };
      }
      if (purpose === 'verify') {
        verified = true;
        return { emailVerifiedAt: new Date(now).toISOString(), recoveryChallenge: null };
      }
      approved = { digest: challenge.digest, issuedAt: challenge.issuedAt, expiresAt: challenge.expiresAt,
        credentialVersion: current.credentialVersion || 0 };
      return null;
    });
    if (purpose === 'verify') {
      if (!verified || !inspected) throw codeInvalid();
      return inspected;
    }
    if (!approved || !inspected) throw codeInvalid();
    // Chỉ chạy scrypt khi OTP đúng; không giữ khóa MySQL trong lúc băm mật khẩu.
    const passwordHash = await this.credentials.hashPassword(password);
    let changed = false;
    const updated = await this.users.mutate(user.id, current => {
      const now = this.now();
      const challenge = current.recoveryChallenge;
      // OTP có thể đã hết hạn, bị thay thế, dùng hết lượt hoặc được yêu cầu khác sử dụng.
      if (!this.validChallenge(current, user, purpose, now) || challenge.digest !== approved.digest ||
        challenge.issuedAt !== approved.issuedAt || challenge.expiresAt !== approved.expiresAt ||
        (current.credentialVersion || 0) !== approved.credentialVersion) return null;
      changed = true;
      return { passwordHash, credentialVersion: approved.credentialVersion + 1,
        emailVerifiedAt: current.emailVerifiedAt || new Date(now).toISOString(), recoveryChallenge: null };
    });
    if (!changed || !updated) throw codeInvalid();
    return updated;
  }
}
