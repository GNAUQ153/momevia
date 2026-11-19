// Phase 5.2: căn chỉnh nhiều lớp bằng hình học thuần, không lưu dữ liệu Fabric.
// Hộp bao là AABB thực tế (kể cả khi đã xoay) theo toạ độ artboard.
export const FABRIC_ARRANGE_ACTIONS = Object.freeze([
  'left', 'center-x', 'right', 'top', 'middle', 'bottom', 'space-x', 'space-y',
]);

const round = value => Math.round(value * 100) / 100;

function checkBox(item) {
  if (!item || typeof item.id !== 'string' || !item.id ||
      ![item.x, item.y, item.width, item.height].every(Number.isFinite) ||
      item.width <= 0 || item.height <= 0) {
    throw new Error('Hộp bao layer không hợp lệ.');
  }
}

// Đầu vào: danh sách bounding box và ID đã tích chọn. Đầu ra: độ dời toạ độ.
// Không thay đổi size/rotation/text/action, không phụ thuộc Fabric hoặc DOM.
export function arrangeFabricBoxes(boxes, selectedIds, action, { canMove = () => true } = {}) {
  if (!Array.isArray(boxes) || !Array.isArray(selectedIds) ||
      typeof canMove !== 'function' || !FABRIC_ARRANGE_ACTIONS.includes(action)) {
    throw new Error('Yêu cầu căn chỉnh không hợp lệ.');
  }
  const items = new Map();
  for (const item of boxes) {
    checkBox(item);
    if (items.has(item.id)) throw new Error('ID layer bị trùng.');
    items.set(item.id, item);
  }
  if (new Set(selectedIds).size !== selectedIds.length ||
      selectedIds.some(id => !items.has(id) || !canMove(id))) {
    throw new Error('Không được căn chỉnh lớp bị khóa hoặc ngoài cảnh.');
  }
  const distribution = action.startsWith('space-');
  if (selectedIds.length < (distribution ? 3 : 2)) {
    throw new Error(distribution ? 'Cần ít nhất ba lớp để chia đều.' : 'Cần ít nhất hai lớp để căn chỉnh.');
  }
  const selected = selectedIds.map(id => items.get(id));
  const left = Math.min(...selected.map(item => item.x));
  const right = Math.max(...selected.map(item => item.x + item.width));
  const top = Math.min(...selected.map(item => item.y));
  const bottom = Math.max(...selected.map(item => item.y + item.height));
  const changes = new Map();
  if (distribution) {
    const horizontal = action === 'space-x';
    const axis = horizontal ? 'x' : 'y';
    const size = horizontal ? 'width' : 'height';
    const sorted = [...selected].sort((a, b) => a[axis] - b[axis] || a.id.localeCompare(b.id));
    const start = sorted[0][axis];
    const end = sorted.at(-1)[axis] + sorted.at(-1)[size];
    const contentSize = sorted.reduce((sum, item) => sum + item[size], 0);
    const remaining = end - start - contentSize;
    if (remaining < -0.001) throw new Error('Các lớp đang chồng nhau, không đủ khoảng trống để chia đều.');
    const gap = Math.max(0, remaining) / (sorted.length - 1);
    let cursor = start;
    for (const item of sorted) {
      changes.set(item.id, { dx: horizontal ? round(cursor - item.x) : 0,
        dy: horizontal ? 0 : round(cursor - item.y) });
      cursor += item[size] + gap;
    }
  } else {
    for (const item of selected) {
      const nextX = action === 'left' ? left : action === 'center-x' ? (left + right - item.width) / 2 :
        action === 'right' ? right - item.width : item.x;
      const nextY = action === 'top' ? top : action === 'middle' ? (top + bottom - item.height) / 2 :
        action === 'bottom' ? bottom - item.height : item.y;
      changes.set(item.id, { dx: round(nextX - item.x), dy: round(nextY - item.y) });
    }
  }
  return selectedIds.map(id => ({ id, ...changes.get(id) })).filter(item => item.dx !== 0 || item.dy !== 0);
}
