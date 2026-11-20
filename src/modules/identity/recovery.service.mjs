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
  async finish(user, purpose, code, password) {
    this.requireMail();
    if (!user || typeof code !== 'string' || !/^\d{8}$/.test(code)) throw codeInvalid();
    let passwordHash;
    if (purpose === 'reset') {
      this.credentials.validatePassword(password);
      passwordHash = await this.credentials.hashPassword(password);
    }
    let changed = false;
    const updated = await this.users.mutate(user.id, current => {
      const challenge = current.recoveryChallenge;
      const now = this.now();
      if (current.email !== user.email || current.provider !== 'email' || !challenge || purpose !== challenge.purpose || now >= challenge.expiresAt ||
        (purpose === 'verify' && current.emailVerifiedAt)) return null;
      if (!timingSafeEqual(Buffer.from(challenge.digest, 'hex'), Buffer.from(this.digest(current, purpose, code), 'hex'))) {
        return { recoveryChallenge: challenge.attempts >= 4 ? null : { ...challenge, attempts: challenge.attempts + 1 } };
      }
      changed = true;
      return purpose === 'reset'
        ? { passwordHash, credentialVersion: (current.credentialVersion || 0) + 1,
            emailVerifiedAt: current.emailVerifiedAt || new Date(now).toISOString(), recoveryChallenge: null }
        : { emailVerifiedAt: new Date(now).toISOString(), recoveryChallenge: null };
    });
    if (!changed) throw codeInvalid();
    return updated;
  }
}
