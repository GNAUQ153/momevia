// Chín điểm lấy nét nhanh sử dụng focalPoint đã có của Canvas V1/V2.
// Không lưu ảnh mới và không can thiệp đến action hoặc quyền lớp.
export const CROP_ANCHORS = Object.freeze([
  ['tl', 'Trên trái', 0, 0],
  ['tc', 'Trên giữa', 0.5, 0],
  ['tr', 'Trên phải', 1, 0],
  ['ml', 'Giữa trái', 0, 0.5],
  ['mc', 'Chính giữa', 0.5, 0.5],
  ['mr', 'Giữa phải', 1, 0.5],
  ['bl', 'Dưới trái', 0, 1],
  ['bc', 'Dưới giữa', 0.5, 1],
  ['br', 'Dưới phải', 1, 1],
].map(([id, label, x, y]) => Object.freeze({ id, label, x, y })));

export function getCropAnchor(id) {
  const anchor = CROP_ANCHORS.find(item => item.id === id);
  if (!anchor) throw new Error('Vị trí lấy nét không hợp lệ.');
  // Dữ liệu của preset phải độc lập với mỗi lần commit.
  return { x: anchor.x, y: anchor.y };
}

export function normalizeFocalPoint(point) {
  const clamp = value => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;
  return { x: clamp(point?.x), y: clamp(point?.y) };
}

export function activeCropAnchor(point) {
  const normalized = normalizeFocalPoint(point);
  const anchor = CROP_ANCHORS.find(item =>
    Math.abs(item.x - normalized.x) < 0.001 && Math.abs(item.y - normalized.y) < 0.001);
  return anchor?.id || null;
}
