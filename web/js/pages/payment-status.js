import { escapeHtml as e, formatPrice } from '../core/api.js';
import { icon } from '../ui/icons.js';

// Chỉ hiển thị trạng thái do Backend trả về, tuyệt đối không dùng query URL làm bằng chứng đã trả tiền.
export function paymentStatusPanel(payment) {
  const paid = payment?.status === 'paid';
  const pending = payment?.status === 'pending';
  const needsReview = pending && payment?.needsReview === true;
  const title = paid ? 'Thanh toán thành công'
    : pending ? 'Đang xác nhận thanh toán'
      : 'Cần kiểm tra giao dịch';
  const message = paid
    ? 'Nhà cung cấp đã xác nhận giao dịch. Quyền sử dụng mẫu được kiểm tra khi xuất bản quà.'
    : pending
      ? 'Giao dịch đang chờ xác nhận từ nhà cung cấp. Đóng hoặc tải lại trang không làm mất thông tin đơn hàng.'
      : 'Trạng thái đơn hàng cần được nhân viên hỗ trợ kiểm tra trước khi thực hiện giao dịch khác.';

  return `<header class="payment-status payment-status--${paid ? 'success' : needsReview ? 'review' : 'pending'}">
    <span class="payment-status__icon" aria-hidden="true">${icon(paid ? 'check-circle' : needsReview ? 'shield' : 'clock', 26)}</span>
    <span class="payment-status__eyebrow">TRẠNG THÁI GIAO DỊCH</span>
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="payment-status__facts" aria-label="Thông tin đơn hàng">
      <div><span>Mã đơn</span><strong>${e(payment?.orderId || 'Chưa có')}</strong></div>
      <div><span>Số tiền</span><strong>${e(formatPrice(payment?.amountVnd || 0))}</strong></div>
    </div>
    ${!paid ? `<div class="payment-status__notice" role="note">
      ${icon('shield', 18)}
      <span>Không thanh toán lại khi đơn còn chờ. Chỉ nhà cung cấp xác nhận giao dịch thành công mới được cấp quyền sử dụng mẫu.</span>
    </div>
    <div class="payment-status__actions">
      <button class="btn btn--dark" type="button" data-action="refresh-payment">Tải lại trạng thái ${icon('arrow', 17)}</button>
      ${pending ? `<button class="btn btn--outline" type="button" data-action="reconcile-payment">Đối soát với nhà cung cấp</button>` : ''}
    </div>` : ''}
    ${needsReview ? `<div class="payment-status__review" role="alert">
      <strong>Đơn hàng cần được kiểm tra thêm.</strong>
      <p>${e(payment.notice || 'Đơn đang chờ quá lâu. Nếu đã chuyển tiền, không thanh toán lại.')}</p>
      <button type="button" class="btn btn--outline" data-action="support">Liên hệ hỗ trợ</button>
    </div>` : ''}
  </header>`;
}
