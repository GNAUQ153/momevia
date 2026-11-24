import path from 'node:path';
import { validateSecrets } from './config.mjs';
import { parseAllowedOrigins } from './request-origin.mjs';

const storageKeys = ['IDENTITY_STORAGE', 'CATALOG_STORAGE', 'CHECKOUT_STORAGE', 'GIFTS_STORAGE', 'DESIGNS_STORAGE', 'SUPPORT_STORAGE'];

// Chỉ kiểm tra cấu hình, không kết nối hoặc sửa dữ liệu MySQL.
export function productionIssues(env = process.env) {
  const issues = [];
  if (env.NODE_ENV !== 'production') issues.push('NODE_ENV phải là production.');
  try { validateSecrets({ ...env, NODE_ENV: 'production' }); } catch (error) { issues.push(error.message); }
  try {
    const url = new URL(env.PUBLIC_BASE_URL || '');
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash
      || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error();
  } catch { issues.push('PUBLIC_BASE_URL phải là origin HTTPS công khai, không có đường dẫn.'); }
  try {
    if (parseAllowedOrigins(env.ALLOWED_ORIGINS).some(origin => !origin.startsWith('https://')))
      issues.push('ALLOWED_ORIGINS production chỉ được dùng HTTPS.');
  } catch (error) { issues.push(error.message); }
  for (const key of storageKeys) if (env[key] !== 'mysql') issues.push(`${key} phải là mysql sau khi đã kiểm tra/import dữ liệu.`);
  for (const key of ['DEMO_AUTH_ENABLED', 'DEMO_TEMPLATE_CHECKOUT_ENABLED', 'TEST_ACCOUNT_ENABLED'])
    if (env[key] === 'true') issues.push(`${key} không được bật trên production.`);
  for (const key of ['MYSQL_HOST', 'MYSQL_DATABASE', 'MYSQL_USER', 'MYSQL_PASSWORD'])
    if (!env[key]?.trim()) issues.push(`${key} chưa cấu hình.`);
  if (!env.MOMEVIA_DATA_DIR?.trim() || !path.isAbsolute(env.MOMEVIA_DATA_DIR.trim()))
    issues.push('MOMEVIA_DATA_DIR phải trỏ tới thư mục tuyệt đối trên ổ lưu trữ bền vững.');
  if (env.PAYMENT_ENABLED === 'true' && (env.PAYMENT_ENV !== 'production' || env.PAYMENT_LIVE_ENABLED !== 'true'))
    issues.push('Thanh toán đang bật nhưng chưa cấu hình chế độ production/live.');
  return issues;
}

export function checkProductionStartup(env = process.env, warn = console.warn) {
  if (env.NODE_ENV !== 'production' && env.PRODUCTION_STRICT !== 'true') return;
  const issues = productionIssues(env);
  if (!issues.length) return;
  const message = `Kiểm tra production:\n- ${issues.join('\n- ')}`;
  // Bật strict sau khi xác minh volume và các adapter hiện có để tránh mất dữ liệu khi chuyển kho.
  if (env.PRODUCTION_STRICT === 'true') throw new Error(message);
  warn(message);
}
