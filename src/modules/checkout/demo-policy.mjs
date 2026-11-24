// Đăng nhập demo không đồng nghĩa với quyền tạo giao dịch mô phỏng.
// Không cấp quyền demo mới khi đang bật thanh toán hoặc chạy production.
export function demoPurchaseAllowed(config, env = process.env) {
  return config?.demoEnabled === true && config?.demoTemplateCheckout === true
    && env.NODE_ENV !== 'production' && env.PAYMENT_ENABLED !== 'true'
    && env.PAYMENT_LIVE_ENABLED !== 'true';
}
