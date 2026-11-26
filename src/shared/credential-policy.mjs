import { localizedError } from './http.mjs';

// Kiểm tra thông tin đăng nhập dùng chung, không khởi tạo repository hoặc scrypt.
export function normalizeEmail(value) {
  if (typeof value !== 'string') throw localizedError(400, 'errors.auth.invalidEmail');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw localizedError(400, 'errors.auth.emailRequired');
  }
  return email;
}

export function validatePassword(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) {
    throw localizedError(400, 'errors.auth.passwordLength');
  }
  if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) {
    throw localizedError(400, 'errors.auth.passwordComposition');
  }
}
