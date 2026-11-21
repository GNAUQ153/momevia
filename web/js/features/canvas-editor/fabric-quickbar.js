// Phase 6.0: Công cụ chỉnh nhanh trên Canvas; chỉ sửa trạng thái Fabric tạm.
// Document Momevia chỉ đổi khi người dùng bấm "Áp dụng vào thiết kế".
import { message, setAttr, setText } from '../../core/i18n.js';
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
  'move-left', 'move-right', 'move-up', 'move-down',
  'rotate-left', 'rotate-right', 'center-x', 'center-y',
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

// Lỗi từ lớp thao tác Canvas không được hiển thị nguyên văn trong giao diện.
// Giữ thông điệp nghiệp vụ để không làm thay đổi các bài kiểm thử hình học cũ.
export function quickbarUiError(error) {
  const errors = {
    'Bản vẽ hoặc bước di chuyển không hợp lệ.': 'step',
    'Thao tác Canvas không được hỗ trợ.': 'action',
    'Lớp đang khóa hoặc không có quyền chỉnh sửa.': 'locked',
    'Không đọc được kích thước của lớp đã chọn.': 'dimensions',
    'Bố cục lớp không hợp lệ.': 'geometry',
    'Kích thước bản vẽ không hợp lệ.': 'artboard',
    'Hướng căn giữa không hợp lệ.': 'direction',
    'Không thể chỉnh sửa hình dạng này.': 'shape',
  };
  return message(`editor.fabric.quickbar.error.${errors[String(error?.message ?? '')] ?? 'generic'}`);
}

export function mountFabricQuickbar({ canvas, artboard, layerModels, canEdit, dialog }) {
  if (!canvas || !dialog || !layerModels || typeof canEdit !== 'function') {
    throw new Error('Không thể khởi tạo thanh công cụ Canvas.');
  }
  const panel = createNode('section', 'fabric-quickbar');
  setAttr(panel, 'aria-label', message('editor.fabric.quickbar.aria'));
  const heading = createNode('div', 'fabric-quickbar__heading');
  const title = createNode('strong');
  setText(title, message('editor.fabric.quickbar.heading'));
  const status = createNode('span', 'fabric-quickbar__selection');
  status.setAttribute('aria-live', 'polite');
  setText(status, message('editor.fabric.quickbar.empty'));
  heading.append(title, status);
  const controls = createNode('div', 'fabric-quickbar__controls');
  controls.setAttribute('role', 'toolbar');
  setAttr(controls, 'aria-label', message('editor.fabric.quickbar.toolbar'));
  for (const action of ACTIONS) {
    const control = createNode('button', 'fabric-quickbar__button');
    control.type = 'button';
    control.disabled = true;
    control.dataset.quickbarAction = action;
    setText(control, message(`editor.fabric.quickbar.action.${action}.label`));
    setAttr(control, 'aria-label', message(`editor.fabric.quickbar.action.${action}.description`));
    setAttr(control, 'title', message(`editor.fabric.quickbar.action.${action}.description`));
    controls.append(control);
  }
  const hint = createNode('p', 'fabric-quickbar__hint');
  setText(hint, message('editor.fabric.quickbar.hint'));
  panel.append(heading, controls, hint);

  const current = () => canvas.getActiveObject();
  const refresh = () => {
    const shape = current();
    const editable = canInspectFabricShape(shape, canEdit);
    const model = shape?.momeviaId && layerModels.get(shape.momeviaId);
    const name = model?.name || model?.accessibility?.label || model?.type ||
      { format: 'message', key: 'editor.fabric.quickbar.layer' };
    setText(status, shape
      ? message(editable ? 'editor.fabric.quickbar.selected' : 'editor.fabric.quickbar.readOnly', { name })
      : message('editor.fabric.quickbar.empty'));
    controls.querySelectorAll('button').forEach(control => { control.disabled = !editable; });
  };

  function perform(action, step = 1) {
    try {
      const shape = current();
      const changed = applyQuickbarAction(shape, action, { artboard, canEdit, step });
      if (changed) {
        canvas.requestRenderAll();
        // Chỉ làm mới bảng thuộc tính, không ghi vào document người dùng.
        canvas.fire('object:modified', { target: shape });
        setText(status, message('editor.fabric.quickbar.changed'));
      }
    } catch (error) {
      setText(status, quickbarUiError(error));
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
