// Quy tắc an toàn cho Fabric chạy trực tiếp trong Workspace.
// Không thay thế schema Canvas và không đưa trạng thái tạm lên máy chủ.

export function canStartInlineFabric(policy, quickMode = false) {
  return policy?.kind !== 'creator-template' && !quickMode;
}

export function assertInlineFabricRevision(startSequence, currentSequence, startSceneId, currentSceneId, disposed) {
  if (disposed || startSceneId !== currentSceneId || startSequence !== currentSequence) {
    throw new Error('Thiết kế đã thay đổi trong lúc chỉnh trực tiếp. Hãy đóng công cụ và mở lại.');
  }
}

export function inlineCanvasScale(documentWidth, availableWidth) {
  if (!Number.isFinite(documentWidth) || documentWidth <= 0) {
    throw new Error('Chiều rộng Canvas không hợp lệ.');
  }
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return 1;
  return Math.min(1, Math.max(0.15, availableWidth / documentWidth));
}
