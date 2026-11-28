import { parseAllowedOrigins } from './request-origin.mjs';

// Không gọi provider, không đọc hoặc trả giá trị secret trong báo cáo.
export function authProductionIssues(env, { requireProviders = false } = {}) {
  const issues = [];
  const configured = key => typeof env[key] === 'string' && env[key].length > 0;
  const clean = key => configured(key) && !/\s/.test(env[key]);
  let origin;
  try {
    const value = env.PUBLIC_BASE_URL;
    if (typeof value !== 'string' || value !== value.trim() || !/^https:\/\/[^,/?#\\\s]+\/?$/i.test(value)) throw new Error();
    const parsed = parseAllowedOrigins(value);
    if (parsed.length !== 1) throw new Error();
    origin = parsed[0];
  } catch { issues.push('PUBLIC_BASE_URL phải là HTTPS origin hợp lệ cho Auth.'); }
  for (const [provider, id, secret, callback] of [
    ['google', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL'],
    ['zalo', 'ZALO_APP_ID', 'ZALO_APP_SECRET', 'ZALO_CALLBACK_URL'],
  ]) {
    // Callback mẫu có thể tồn tại khi provider bị tắt. Chỉ kiểm tra khi dùng hoặc yêu cầu nghiệm thu.
    if (!requireProviders && !configured(id) && !configured(secret)) continue;
    if (!clean(id) || !clean(secret)) issues.push(`${id} và ${secret} phải cấu hình đầy đủ, không có khoảng trắng.`);
    if (!origin || env[callback] !== `${origin}/api/auth/${provider}/callback`)
      issues.push(`${callback} phải khớp public origin và đường dẫn callback của MOMEVIA.`);
  }
  if (requireProviders || configured('RECOVERY_MAIL_URL') || configured('RECOVERY_MAIL_TOKEN')) {
    if (!clean('RECOVERY_MAIL_TOKEN')) issues.push('RECOVERY_MAIL_TOKEN phải được cấu hình, không có khoảng trắng.');
    try {
      const value = env.RECOVERY_MAIL_URL;
      if (!clean('RECOVERY_MAIL_URL')) throw new Error();
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.hash || value.includes('\\')) throw new Error();
    } catch { issues.push('RECOVERY_MAIL_URL phải là endpoint HTTPS hợp lệ, không chứa userinfo hoặc fragment.'); }
  }
  return issues;
}
