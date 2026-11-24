// Phạm vi xác thực do server xác định, không lấy từ body webhook hoặc client.
// null là cấu hình không hợp lệ; false là live, true là sandbox.
export function configuredPaymentScope(env, provider) {
  if (!['momo', 'payos'].includes(provider)) return null;
  if (env.PAYMENT_ENV === 'production') return false;
  if (env.PAYMENT_ENV === 'sandbox' && env.NODE_ENV !== 'production' && provider === 'momo') return true;
  return null;
}

// MySQL lưu BOOLEAN bằng TINYINT; từ chối giá trị không xác định thay vì ép kiểu.
export function storedPaymentScope(value) {
  if (value === 0 || value === false) return false;
  if (value === 1 || value === true) return true;
  return null;
}

export function samePaymentScope(expected, actual) {
  return typeof expected === 'boolean' && typeof actual === 'boolean' && expected === actual;
}
