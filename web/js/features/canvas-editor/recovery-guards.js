// Kiểm tra cấu trúc envelope phục hồi trước khi đọc/khôi phục từ localStorage.
// Đây không phải kiểm tra schema Canvas: validateDocument vẫn chạy ở tầng Designer.
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function isRecoveryEnvelope(item, { userId, designId }) {
  if (!record(item) || item.ownerId !== userId || item.designId !== designId ||
      item.schemaVersion !== 1 || !Number.isSafeInteger(item.revision) || item.revision < 0) return false;
  if (!record(item.value) || typeof item.value.title !== 'string' || !record(item.value.document)) return false;
  if (item.pending === null || item.pending === undefined) return true;
  const pending = item.pending;
  return record(pending) &&
    typeof pending.mutationId === 'string' && pending.mutationId.length > 0 &&
    Number.isSafeInteger(pending.expectedRevision) && pending.expectedRevision === item.revision &&
    typeof pending.title === 'string' && record(pending.document);
}
