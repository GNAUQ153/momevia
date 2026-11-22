import fs from 'node:fs';
import path from 'node:path';
import { parseAllowedOrigins } from '../../src/shared/request-origin.mjs';

// An explicit per-profile cutover survives launcher restarts and code mirrors.
// Unmigrated/new demo profiles continue to use their isolated JSON store.
export function demoStorage(directory) {
  const file = path.join(directory, 'storage.json');
  if (!fs.existsSync(file)) return { mode: 'json', env: {} };
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (value.formatVersion !== 1 || value.mode !== 'mysql' || !/^[a-zA-Z0-9_]{1,64}$/.test(value.database || '') ||
      !value.host || !value.user || !value.password || !Number.isSafeInteger(value.port) || value.port < 1 || value.port > 65535)
    throw new Error('Cấu hình MySQL của profile demo không hợp lệ.');
  return { mode: 'mysql', env: {
    IDENTITY_STORAGE: 'mysql', CATALOG_STORAGE: 'mysql', CHECKOUT_STORAGE: 'mysql',
    GIFTS_STORAGE: 'mysql', DESIGNS_STORAGE: 'mysql', SUPPORT_STORAGE: 'mysql',
    MYSQL_DATABASE: value.database, MYSQL_HOST: value.host, MYSQL_PORT: String(value.port),
    MYSQL_USER: value.user, MYSQL_PASSWORD: value.password,
  } };
}

export function demoProfile(root, port, requested) {
  if (requested) return path.resolve(root, requested);
  const current = path.join(root, 'local', `web-demo-${port}`);
  const legacy = path.join(root, 'local', 'web-demo-20261118');
  if (port === 4110 && !fs.existsSync(current) && fs.existsSync(path.join(legacy, 'trang-thai-demo.json'))) return legacy;
  return current;
}
export function demoEndpoints(port, publicUrl, origins = '', secure = false) {
  const localBase = `${secure ? 'https' : 'http'}://127.0.0.1:${port}`;
  const publicBase = publicUrl ? parseAllowedOrigins(publicUrl)[0] : localBase;
  if (!publicBase || (publicUrl && parseAllowedOrigins(publicUrl).length !== 1)) throw new Error('Chọn một địa chỉ HTTPS đầy đủ cho bản demo.');
  return { localBase, publicBase, allowedOrigins: parseAllowedOrigins([origins, ...(publicBase !== localBase ? [localBase] : [])].join(',')) };
}
export function existingDemoKeys(directory) {
  const source = fs.readFileSync(path.join(directory, 'app', '.env'), 'utf8');
  const values = {};
  for (const line of source.split(/\r?\n/)) {
    const match = /^\s*(JWT_SECRET|INTERNAL_SERVICE_KEY)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  if (!values.JWT_SECRET || !values.INTERNAL_SERVICE_KEY) throw new Error('Không tìm thấy khóa của demo cũ; giữ nguyên dữ liệu và cấu hình trước khi chuyển.');
  return { jwtSecret: values.JWT_SECRET, internalKey: values.INTERNAL_SERVICE_KEY };
}
