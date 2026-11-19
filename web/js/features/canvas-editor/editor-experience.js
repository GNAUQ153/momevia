// Thành phần hiển thị UX Canvas; không tạo/thay đổi dữ liệu thiết kế.
export function canOpenAdvancedEditor(policy) {
  return policy?.kind !== 'creator-template';
}

export function scenePositionLabel(document, sceneId) {
  const scenes = Array.isArray(document?.scenes) ? document.scenes : [];
  if (!scenes.length) return 'Chưa có cảnh';
  const index = scenes.findIndex(scene => scene.id === sceneId);
  if (index < 0) return `Có ${scenes.length} cảnh`;
  return `Cảnh ${index + 1}/${scenes.length}`;
}

export function selectionDescription(document, sceneId, selectionId, policy) {
  if (!selectionId) return 'Chọn hình hoặc chữ trên thiệp để chỉnh vị trí, màu sắc và thuộc tính.';
  const scene = document?.scenes?.find(item => item.id === sceneId);
  if (!scene?.elementIds?.includes(selectionId)) return 'Chọn một thành phần trong cảnh hiện tại.';
  const element = document?.elements?.find(item => item.id === selectionId);
  if (!element) return 'Thành phần không còn tồn tại trong cảnh.';
  const label = String(element.name || ({ text: 'Văn bản', image: 'Ảnh', shape: 'Hình khối', sticker: 'Hình trang trí' }[element.type] || 'Thành phần'));
  const locked = Boolean(element.locked || policy?.lockedElements?.[element.id]);
  return locked ? `Đang chọn: ${label} · Lớp được bảo vệ` : `Đang chọn: ${label} · Chỉnh trong bảng thuộc tính`;
}
