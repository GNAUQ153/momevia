// Các quy tắc UI thuần túy: không phụ thuộc DOM hay dữ liệu người dùng.
// Được dùng chung khi rời route và khi đóng tab trình duyệt.
export function hasPendingEditorWork({
  sessionDirty = false,
  inlineFabricOpening = false,
  inlineFabricActive = false,
  assetPending = false,
  gestureActive = false,
  textDirty = false,
  publishing = false,
  composing = false,
} = {}) {
  return Boolean(
    sessionDirty || inlineFabricOpening || inlineFabricActive ||
    assetPending || gestureActive || textDirty || publishing || composing
  );
}

// Nhận diện Undo/Redo; điều kiện input, dialog và quyền layer do Designer kiểm soát.
export function historyShortcut(event) {
  if (!event || event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)) return null;
  const key = String(event.key || '').toLowerCase();
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y' && !event.shiftKey) return 'redo';
  return null;
}
