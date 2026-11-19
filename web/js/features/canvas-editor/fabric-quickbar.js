// Phase 6.0: Công cụ chỉnh nhanh trên Canvas; chỉ sửa trạng thái Fabric tạm.
// Document Momevia chỉ đổi khi người dùng bấm "Áp dụng vào thiết kế".
import {
  readInspectorGeometry,
  applyInspectorGeometry,
  centerInspectorGeometry,
  canInspectFabricShape,
} from './fabric-inspector.js';

const MOVE_ACTIONS = Object.freeze({
  'move-left': [-1, 0],
  'move-right': [1, 0],
  'move-up': [0, -1],
  'move-down': [0, 1],
});
const ACTIONS = Object.freeze([
  ['move-left', 'Trái', 'Dịch lớp sang trái'],
  ['move-right', 'Phải', 'Dịch lớp sang phải'],
  ['move-up', 'Lên', 'Dịch lớp lên trên'],
  ['move-down', 'Xuống', 'Dịch lớp xuống dưới'],
  ['rotate-left', 'Xoay −15°', 'Xoay ngược chiều kim đồng hồ 15 độ'],
  ['rotate-right', 'Xoay +15°', 'Xoay theo chiều kim đồng hồ 15 độ'],
  ['center-x', 'Giữa ngang', 'Căn giữa theo chiều ngang'],
  ['center-y', 'Giữa dọc', 'Căn giữa theo chiều dọc'],
]);

const round = value => Math.round(value * 100) / 100;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function isQuickbarTypingTarget(target) {
  if (!target) return false;
  if (target.isContentEditable === true) return true;
  if (typeof target.closest !== 'function') return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
}

export function shortcutFromKey(event) {
  if (!event || event.altKey || event.ctrlKey || event.metaKey || event.isComposing ||
    isQuickbarTypingTarget(event.target)) return null;
  const action = {
    ArrowLeft: 'move-left',
    ArrowRight: 'move-right',
    ArrowUp: 'move-up',
    ArrowDown: 'move-down',
  }[event.key];
  return action ? { action, step: event.shiftKey ? 10 : 1 } : null;
}

export function nextQuickbarGeometry(geometry, action, artboard, step = 1) {
  if (!geometry || !finite(artboard?.width) || !finite(artboard?.height) ||
    artboard.width <= 0 || artboard.height <= 0 || !finite(step) || step <= 0 || step > 100) {
    throw new Error('Bản vẽ hoặc bước di chuyển không hợp lệ.');
  }
  if (Object.hasOwn(MOVE_ACTIONS, action)) {
    const [dx, dy] = MOVE_ACTIONS[action];
    // Giới hạn theo bounding box đã xoay để lớp không bị cắt mất ngoài artboard.
    const angle = (geometry.rotation || 0) * Math.PI / 180;
    const extentX = (Math.abs(Math.cos(angle) * geometry.width) +
      Math.abs(Math.sin(angle) * geometry.height)) / 2;
    const extentY = (Math.abs(Math.sin(angle) * geometry.width) +
      Math.abs(Math.cos(angle) * geometry.height)) / 2;
    const constrain = (position, delta, baseSize, extent, boundary) => {
      if (!delta) return position;
      const minCenter = extent;
      const maxCenter = boundary - extent;
      // Với lớp lớn hơn artboard, giữ tâm ở giữa thay vì tạo NaN.
      if (minCenter > maxCenter) return round((boundary - baseSize) / 2);
      return round(clamp(position + baseSize / 2 + delta * step,
        minCenter, maxCenter) - baseSize / 2);
    };
    return {
      ...geometry,
      x: constrain(geometry.x, dx, geometry.width, extentX, artboard.width),
      y: constrain(geometry.y, dy, geometry.height, extentY, artboard.height),
    };
  }
  if (action === 'center-x' || action === 'center-y') {
    return centerInspectorGeometry(geometry, action === 'center-x' ? 'horizontal' : 'vertical', artboard);
  }
  if (action === 'rotate-left' || action === 'rotate-right') {
    const angle = geometry.rotation + (action === 'rotate-left' ? -15 : 15);
    // Chuẩn hóa góc để luôn phù hợp schema Canvas: -360..360.
    const rotation = ((angle + 180) % 360 + 360) % 360 - 180;
    return { ...geometry, rotation: round(rotation) };
  }
  throw new Error('Thao tác Canvas không được hỗ trợ.');
}

export function applyQuickbarAction(shape, action, { artboard, canEdit, step = 1 }) {
  if (typeof canEdit !== 'function' || !canInspectFabricShape(shape, canEdit)) {
    throw new Error('Lớp đang khóa hoặc không có quyền chỉnh sửa.');
  }
  const before = readInspectorGeometry(shape);
  const next = nextQuickbarGeometry(before, action, artboard, step);
  if (Object.keys(next).every(field => before[field] === next[field])) return false;
  applyInspectorGeometry(shape, next);
  return true;
}

function createNode(tag, className, text = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

export function mountFabricQuickbar({ canvas, artboard, layerModels, canEdit, dialog }) {
  if (!canvas || !dialog || !layerModels || typeof canEdit !== 'function') {
    throw new Error('Không thể khởi tạo thanh công cụ Canvas.');
  }
  const panel = createNode('section', 'fabric-quickbar');
  panel.setAttribute('aria-label', 'Chỉnh nhanh lớp đang chọn');
  const heading = createNode('div', 'fabric-quickbar__heading');
  const title = createNode('strong', '', 'Chỉnh nhanh');
  const status = createNode('span', 'fabric-quickbar__selection', 'Chưa chọn lớp');
  status.setAttribute('aria-live', 'polite');
  heading.append(title, status);
  const controls = createNode('div', 'fabric-quickbar__controls');
  controls.setAttribute('role', 'toolbar');
  controls.setAttribute('aria-label', 'Dịch chuyển, xoay và căn giữa lớp');
  for (const [action, label, description] of ACTIONS) {
    const control = createNode('button', 'fabric-quickbar__button', label);
    control.type = 'button';
    control.disabled = true;
    control.dataset.quickbarAction = action;
    control.setAttribute('aria-label', description);
    control.title = description;
    controls.append(control);
  }
  const hint = createNode('p', 'fabric-quickbar__hint',
    'Phím mũi tên: 1px · Shift + mũi tên: 10px · Lưu bằng nút Áp dụng.');
  panel.append(heading, controls, hint);

  const current = () => canvas.getActiveObject();
  const refresh = () => {
    const shape = current();
    const editable = canInspectFabricShape(shape, canEdit);
    const model = shape?.momeviaId && layerModels.get(shape.momeviaId);
    status.textContent = shape ?
      `${model?.name || model?.accessibility?.label || model?.type || 'Lớp'}${editable ? '' : ' · chỉ xem'}` :
      'Chưa chọn lớp';
    controls.querySelectorAll('button').forEach(control => { control.disabled = !editable; });
  };

  function perform(action, step = 1) {
    try {
      const shape = current();
      const changed = applyQuickbarAction(shape, action, { artboard, canEdit, step });
      if (changed) {
        canvas.requestRenderAll();
        // Đồng bộ bảng thuộc tính Phase 5.9 mà không chạm document thật.
        canvas.fire('object:modified', { target: shape });
        status.textContent = 'Đã chỉnh · chưa áp dụng vào thiết kế';
      }
    } catch (error) {
      status.textContent = error.message;
    }
  }
  const onClick = event => {
    const control = event.target.closest('[data-quickbar-action]');
    if (!control || !controls.contains(control) || control.disabled) return;
    perform(control.dataset.quickbarAction);
  };
  const onKeydown = event => {
    if (event.defaultPrevented || !dialog.contains(event.target)) return;
    const shortcut = shortcutFromKey(event);
    if (!shortcut || !canInspectFabricShape(current(), canEdit)) return;
    event.preventDefault();
    event.stopPropagation();
    perform(shortcut.action, shortcut.step);
  };
  const events = ['selection:created', 'selection:updated', 'selection:cleared', 'object:modified'];
  controls.addEventListener('click', onClick);
  dialog.addEventListener('keydown', onKeydown);
  events.forEach(name => canvas.on(name, refresh));
  refresh();
  return {
    panel,
    refresh,
    dispose() {
      controls.removeEventListener('click', onClick);
      dialog.removeEventListener('keydown', onKeydown);
      events.forEach(name => canvas.off(name, refresh));
    },
  };
}
