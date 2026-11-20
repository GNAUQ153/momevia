// UI thuần túy cho trạng thái autosave. Không đọc document hay phát dữ liệu giữa các tab.
const safeRevision = value => Number.isSafeInteger(value) && value >= 0 ? value : null;

export function describeSaveFeedback({ status, revision, recoveryPersisted = false, lastSavedAt = null } = {}) {
  const r = safeRevision(revision);
  const stamp = Number.isFinite(lastSavedAt) && lastSavedAt > 0
    ? new Date(lastSavedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : null;
  const states = {
    clean: ['Đã lưu trên máy chủ', 'saved'],
    dirty: ['Có thay đổi chưa lưu', 'pending'],
    saving: ['Đang lưu bản nháp…', 'saving'],
    offline: ['Chưa đồng bộ · mất kết nối', 'warning'],
    error: ['Chưa lưu được · thử lại', 'warning'],
    conflict: ['Xung đột phiên bản', 'danger'],
    'session-expired': ['Phiên đăng nhập hết hạn', 'danger'],
    'asset-pending': ['Ảnh đang xử lý…', 'pending'],
    publishing: ['Đang xuất bản…', 'saving'],
  };
  const [label, tone] = states[status] || ['Trạng thái lưu chưa xác định', 'warning'];
  let detail = '';
  if (status === 'clean') {
    detail = stamp ? `Lần lưu được xác nhận lúc ${stamp}.` : 'Đang hiển thị bản trên máy chủ.';
  } else if (['dirty', 'saving', 'offline', 'error', 'conflict', 'session-expired'].includes(status)) {
    detail = recoveryPersisted
      ? 'Có bản nháp tạm trong tab này; chưa chắc đã đồng bộ lên máy chủ.'
      : 'Trình duyệt chưa lưu được bản nháp dự phòng. Tránh đóng tab.';
  }
  return {
    status: states[status] ? status : 'unknown',
    label: `${label}${status === 'clean' && r !== null ? ` · r${r}` : ''}`,
    detail,
    tone,
  };
}
