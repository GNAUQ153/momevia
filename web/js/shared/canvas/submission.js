import { bindingLabels } from './personalization.js';

export function submissionChanges(previous, current) {
  if (!previous) return [];
  const changes = [];
  if (previous.title !== current.title) changes.push(`Tên mẫu từ “${previous.title}” thành “${current.title}”.`);
  if (previous.coverSceneId !== current.coverSceneId) changes.push('Đổi cảnh dùng làm bìa mẫu.');
  const added = current.bindings.filter(key => !previous.bindings.includes(key));
  const removed = previous.bindings.filter(key => !current.bindings.includes(key));
  if (added.length) changes.push(`Mở quyền sửa ${added.map(key => bindingLabels[key]).join(', ')}.`);
  if (removed.length) changes.push(`Đóng quyền sửa ${removed.map(key => bindingLabels[key]).join(', ')}.`);
  if (previous.photoId !== current.photoId) {
    changes.push(current.photoId ? 'Đổi khung ảnh Sender được thay.' : 'Bỏ quyền thay ảnh của Sender.');
  }
  if (previous.assetIds.some(id => !current.assetIds.includes(id))) changes.push('Có ảnh demo từ bản trước đã bị xóa hoặc thay.');
  if (current.assetIds.some(id => !previous.assetIds.includes(id))) changes.push('Có ảnh demo mới cần kiểm tra quyền phân phối.');
  if ((previous.rights || '') !== (current.rights || ''))
    changes.push('Nguồn ảnh hoặc quyền phân phối đã thay đổi.');
  if (!added.length && !removed.length && previous.photoId === current.photoId)
    changes.push('Quyền chỉnh chữ và thay ảnh của Sender giữ nguyên.');
  return changes;
}
