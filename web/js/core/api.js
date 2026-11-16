// Tất cả API đi qua gateway, không nhúng secret hoặc địa chỉ microservice vào trình duyệt.
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const api = {
  async get(url) { return this.request(url, {method:'GET'}); },
  async post(url, body = {}) {
    return this.request(url, {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify(body),
    });
  },
  async request(url, options) {
    let response;
    try {
      response = await fetch(`/api${url}`, { credentials:'same-origin', ...options });
    } catch {
      throw new ApiError(0, 'Không thể kết nối máy chủ. Kiểm tra các dịch vụ đang chạy.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(response.status, data.error || 'Yêu cầu không thành công.');
    return data;
  },
};
export function formatPrice(value) {
  return Number(value) === 0 ? 'Miễn phí' : `${new Intl.NumberFormat('vi-VN').format(value)}đ`;
}
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
