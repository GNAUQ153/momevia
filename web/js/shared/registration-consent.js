// Tăng phiên bản khi thay đổi nội dung điều khoản hoặc chính sách bảo mật.
export const registrationPolicyVersion = '2026-11-28.1';

export function registrationConsent(terms, privacy) {
  return { terms, privacy, version: registrationPolicyVersion };
}
