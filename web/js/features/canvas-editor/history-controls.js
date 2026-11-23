// Đồng bộ tất cả điều khiển lịch sử của cùng một Canvas store (desktop/mobile).
// Không đọc/ghi document, không thay đổi lịch sử hoặc lưu bản nháp.
export function syncHistoryControls(root, { canUndo = false, canRedo = false } = {}) {
  if (!root) return;
  for (const control of root.querySelectorAll('[data-editor-action="undo"], [data-editor-action="mobile-undo"]')) {
    control.disabled = !canUndo;
  }
  for (const control of root.querySelectorAll('[data-editor-action="redo"], [data-editor-action="mobile-redo"]')) {
    control.disabled = !canRedo;
  }
}
