// Tất cả API đi qua gateway, không nhúng secret hoặc địa chỉ microservice vào trình duyệt.
export class ApiError extends Error {
  constructor(status, message, data = {}) {
    super(message);
    this.status = status;
    this.code = data.code;
    this.details = data.details;
  }
}
export const api = {
  async get(url, options = {}) {
    return this.request(url, { method: "GET", ...options });
  },
  async post(url, body = {}, options = {}) {
    return this.request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      ...options,
    });
  },
  async request(url, options) {
    let response;
    try {
      response = await fetch(`/api${url}`, {
        credentials: "same-origin",
        ...options,
      });
    } catch (error) {
      if (error.name === "AbortError") throw error;
      throw new ApiError(
        0,
        "Không thể kết nối máy chủ. Kiểm tra các dịch vụ đang chạy.",
      );
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new ApiError(
        response.status,
        data.error || "Yêu cầu không thành công.",
        data,
      );
    return data;
  },
};
export function formatPrice(value) {
  return Number(value) === 0
    ? "Miễn phí"
    : `${new Intl.NumberFormat("vi-VN").format(value)}đ`;
}
export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}
