import { currentLocale, formatCurrency, message, t } from './i18n.js';
import { vi } from '../shared/locale.js';

export { escapeHtml } from '../shared/locale.js';

// Tất cả API đi qua gateway, không nhúng secret hoặc địa chỉ microservice vào trình duyệt.
export class ApiError extends Error {
  constructor(status, description, data = {}, translation) {
    super(description);
    this.status = status;
    this.code = data.code;
    this.details = data.details;
    this.translation = translation;
  }
}

export function errorCopy(error, fallback) {
  return error.translation || error.message || fallback;
}

function fromResponse(status, data) {
  const key = data.messageKey;
  if (Object.hasOwn(vi, key))
    return new ApiError(status, t(key, data.messageParams), data, message(key, data.messageParams));
  if (currentLocale() === 'vi' && (data.error || data.message)) return new ApiError(status, data.error || data.message, data);
  const fallback = ({ 400: 'errors.validation', 401: 'errors.unauthorized', 403: 'errors.forbidden',
    404: 'errors.notFound', 410: 'errors.gift.closed', 413: 'errors.payloadTooLarge',
    415: 'errors.contentType', 422: 'errors.validation', 429: 'errors.rateLimit',
    500: 'errors.server', 502: 'errors.unavailable', 503: 'errors.unavailable' })[status] || 'errors.requestFailed';
  return new ApiError(status, t(fallback), data, message(fallback));
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
    const headers = new Headers(options.headers);
    headers.set('x-momevia-locale', currentLocale());
    try {
      response = await fetch(`/api${url}`, {
        credentials: "same-origin",
        ...options,
        headers,
      });
    } catch (error) {
      if (error.name === "AbortError") throw error;
      throw new ApiError(0, t("errors.network"), {}, message("errors.network"));
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw fromResponse(response.status, data || {});
    return data;
  },
};
export function formatPrice(value) {
  return Number(value) === 0
    ? t("common.price.free")
    : formatCurrency(value);
}
