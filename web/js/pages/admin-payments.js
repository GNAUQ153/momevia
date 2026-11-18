import { escapeHtml as e, formatPrice } from '../core/api.js';

const dateText = value => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('vi-VN') : 'Chưa có dữ liệu';
};
const stateLabels = {
  pending: 'Đang chờ', paid: 'Đã thanh toán', terminal_review: 'Cần kiểm tra',
  provider_error: 'Lỗi kết nối nhà cung cấp', invalid_response: 'Phản hồi không hợp lệ',
  mismatch: 'Sai lệch thông tin', settlement_error: 'Lỗi ghi nhận giao dịch',
};
const providerLabels = { momo: 'MoMo', payos: 'payOS / VietQR' };

export function filterPendingReviews(orders, { search = '', provider = 'all', outcome = 'all' } = {}) {
  const q = String(search).trim().toLowerCase();
  return (Array.isArray(orders) ? orders : []).filter(order =>
    (provider === 'all' || order.provider === provider) &&
    (outcome === 'all' || (outcome === 'needs-review'
      ? ![null, undefined, '', 'pending', 'paid'].includes(order.lastInquiryOutcome)
      : order.lastInquiryOutcome === outcome)) &&
    (!q || String(order.orderId || '').toLowerCase().includes(q)));
}

export function paymentReviewRows(orders, filters = {}) {
  const matches = filterPendingReviews(orders, filters);
  if (!matches.length) return `<div class="empty-state empty-state--panel" role="status">
    <h3>Không có giao dịch phù hợp</h3><p>Danh sách chỉ gồm các đơn còn chờ quá 30 phút. Hãy thử bộ lọc khác.</p>
  </div>`;
  return matches.map(order => `<article class="payment-review-card" data-payment-order="${e(order.orderId)}">
    <div class="payment-review-card__main">
      <div><span class="payment-review-card__label">Mã đơn hàng</span>
        <strong class="payment-review-card__id">${e(order.orderId)}</strong></div>
      <strong class="payment-review-card__amount">${e(formatPrice(order.amountVnd))}</strong>
    </div>
    <div class="payment-review-card__meta">
      <span>${e(providerLabels[order.provider] || order.provider || 'Không rõ phương thức')}</span>
      <span>${order.sandbox ? 'Sandbox' : 'Live'}</span>
      <span>Chờ từ: ${e(dateText(order.pendingSince))}</span>
      <span>Đối soát: ${e(stateLabels[order.lastInquiryOutcome] || order.lastInquiryOutcome || 'Chưa có lần kiểm tra')}</span>
      ${order.lastInquiryAt ? `<span>Lần gần nhất: ${e(dateText(order.lastInquiryAt))}</span>` : ''}
    </div>
    <div class="payment-review-card__actions">
      <button class="btn btn--outline" type="button" data-action="admin-payment-audit" data-order-id="${e(order.orderId)}">Xem lịch sử đối soát</button>
    </div>
    <div class="payment-review-card__audit" data-payment-audit hidden aria-live="polite"></div>
  </article>`).join('');
}

export function paymentAuditRows(attempts) {
  if (!Array.isArray(attempts) || !attempts.length)
    return '<p class="helper-text">Chưa có lần đối soát nào được ghi nhận.</p>';
  return `<h3>Lịch sử đối soát</h3><ol class="payment-audit-list">${attempts.map(item => `<li>
    <span>${e(dateText(item.checkedAt))}</span><strong>${e(stateLabels[item.outcome] || item.outcome || 'Không rõ')}</strong>
  </li>`).join('')}</ol>`;
}

export function adminPaymentsPage(orders = [], { error = null } = {}) {
  const list = Array.isArray(orders) ? orders : [];
  return `<section class="section admin-payments"><div class="container">
    <p><a href="/admin" data-link>← Về kiểm duyệt và hỗ trợ</a></p>
    <div class="admin-payments__heading"><div><h1>Giám sát thanh toán</h1>
      <p>Chỉ xem các đơn còn chờ trên 30 phút. Trạng thái thanh toán phải được xác minh bởi nhà cung cấp.</p></div>
      <button class="btn btn--outline" type="button" data-action="admin-payment-refresh">Tải lại</button></div>
    <div class="admin-payments__summary"><strong>${error ? '—' : list.length}</strong><span>Đơn cần theo dõi (tối đa 100 đơn cũ nhất)</span></div>
    <div class="admin-payments__notice" role="note">Không thể xác nhận đã thanh toán, hủy đơn, hoàn tiền hay mở khóa thanh toán lại ở màn hình này. Với giao dịch bất thường, cần kiểm tra trạng thái trực tiếp tại MoMo/payOS.</div>
    ${error ? `<p role="alert">${e(error)}</p>` : ''}
    <div class="admin-payments__filters">
      <label for="admin-payment-search">Tìm theo mã đơn
        <input id="admin-payment-search" type="search" autocomplete="off" placeholder="Nhập mã đơn hàng" maxlength="100"/></label>
      <label for="admin-payment-provider">Phương thức
        <select id="admin-payment-provider"><option value="all">Tất cả</option><option value="momo">MoMo</option><option value="payos">payOS / VietQR</option></select></label>
      <label for="admin-payment-outcome">Trạng thái đối soát
        <select id="admin-payment-outcome"><option value="all">Tất cả</option><option value="needs-review">Cần kiểm tra</option><option value="pending">Vẫn đang chờ</option></select></label>
    </div>
    <p class="admin-payments__count" id="admin-payment-result-count" role="status">${error ? 'Chưa có dữ liệu để thống kê.' : `Hiển thị ${list.length} / ${list.length} đơn`}</p>
    <div class="admin-payments__list" id="admin-payment-results">${error ? '<p role="status">Dữ liệu chưa tải được.</p>' : paymentReviewRows(list)}</div>
  </div></section>`;
}
