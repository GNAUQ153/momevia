import fs from 'node:fs';
import path from 'node:path';
import { CredentialsService } from '../modules/identity/credentials.service.mjs';
import { parseAllowedOrigins } from './request-origin.mjs';
import { quotaQaEnabled } from '../modules/checkout/quota-config.mjs';

// Tải biến môi trường từ tệp .env ở thư mục gốc mà không cần thư viện ngoài.
export function loadEnvironment() {
  const source = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(source)) return;
  for (const line of fs.readFileSync(source, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

export function environment() {
  loadEnvironment();
  validateSecrets(process.env);
  quotaQaEnabled(process.env);
  const demoEnabled = process.env.DEMO_AUTH_ENABLED === 'true' && process.env.NODE_ENV !== 'production';
  return {
    baseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:4100',
    httpsCertFile: process.env.HTTPS_CERT_FILE || '',
    httpsKeyFile: process.env.HTTPS_KEY_FILE || '',
    allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
    jwtSecret: process.env.JWT_SECRET,
    internalKey: process.env.INTERNAL_SERVICE_KEY,
    demoEnabled,
    demoTemplateCheckout: demoEnabled && process.env.DEMO_TEMPLATE_CHECKOUT_ENABLED === 'true',
    adminCode: process.env.DEMO_ADMIN_CODE || '',
    testAccount: testAccountConfig(process.env),
    giftTtlDays: Math.max(1, Number(process.env.GIFT_TTL_DAYS || 365)),
    googleId: process.env.GOOGLE_CLIENT_ID || '',
    googleSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    googleCallback: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4100/api/auth/google/callback',
    recoveryMailUrl: process.env.RECOVERY_MAIL_URL || '',
    recoveryMailToken: process.env.RECOVERY_MAIL_TOKEN || '',
    zaloId: process.env.ZALO_APP_ID || '',
    zaloSecret: process.env.ZALO_APP_SECRET || '',
    zaloCallback: process.env.ZALO_CALLBACK_URL || 'http://localhost:4100/api/auth/zalo/callback',
  };
}

export function testAccountConfig(env) {
  if (env.TEST_ACCOUNT_ENABLED !== 'true') return null;
  if (env.NODE_ENV === 'production') throw new Error('TEST_ACCOUNT_ENABLED không được bật trong production.');
  const credentials = new CredentialsService();
  const name = env.TEST_ACCOUNT_NAME?.trim() || 'Tài khoản kiểm thử';
  if (name.length < 2 || name.length > 50) throw new Error('TEST_ACCOUNT_NAME phải từ 2 đến 50 ký tự.');
  let email;
  try { email = credentials.normalizeEmail(env.TEST_ACCOUNT_EMAIL); }
  catch { throw new Error('TEST_ACCOUNT_EMAIL phải là địa chỉ email hợp lệ.'); }
  try { credentials.validatePassword(env.TEST_ACCOUNT_PASSWORD); }
  catch { throw new Error('TEST_ACCOUNT_PASSWORD phải từ 10 đến 128 ký tự, gồm chữ cái và chữ số.'); }
  const role = env.TEST_ACCOUNT_ROLE || 'sender';
  if (!['sender', 'creator', 'admin'].includes(role)) throw new Error('TEST_ACCOUNT_ROLE phải là sender, creator hoặc admin.');
  return { name, email, password: env.TEST_ACCOUNT_PASSWORD, role };
}

export function validateSecrets(env) {
  for (const name of ['JWT_SECRET', 'INTERNAL_SERVICE_KEY']) {
    const value = env[name];
    if (!value || value.length < 32) throw new Error(`${name} phải có ít nhất 32 ký tự; cấu hình trước khi chạy service.`);
    if (env.NODE_ENV === 'production' && /unsafe|dev.only|dev.internal|change.this|change.to|example|placeholder/i.test(value)) {
      throw new Error(`${name} production không được dùng khóa mẫu.`);
    }
  }
  if (env.JWT_SECRET === env.INTERNAL_SERVICE_KEY) throw new Error('JWT_SECRET và INTERNAL_SERVICE_KEY phải khác nhau.');
}
