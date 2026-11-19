// Phase 5.9: Bảng thuộc tính bố cục của Fabric Studio.
// Chỉ sửa đối tượng Fabric tạm; bản nháp Momevia được cập nhật khi nhấn Áp dụng.
const FIELDS = Object.freeze({
  x: { label: 'Tọa độ X', min: -10000, max: 10000 },
  y: { label: 'Tọa độ Y', min: -10000, max: 10000 },
  width: { label: 'Chiều rộng', min: 1, max: 10000 },
  height: { label: 'Chiều cao', min: 1, max: 10000 },
  rotation: { label: 'Góc xoay', min: -360, max: 360 },
});

const round = value => Math.round(value * 100) / 100;
const finite = number => typeof number === 'number' && Number.isFinite(number);

export function readInspectorGeometry(shape) {
  const baseWidth = Number(shape?.width);
  const baseHeight = Number(shape?.momeviaBaseHeight ?? shape?.height);
  const scaleX = Number(shape?.scaleX ?? 1);
  const scaleY = Number(shape?.scaleY ?? 1);
  const left = Number(shape?.left);
  const top = Number(shape?.top);
  const rotation = Number(shape?.angle ?? 0);
  if (![baseWidth, baseHeight, scaleX, scaleY, left, top, rotation].every(finite) ||
    baseWidth <= 0 || baseHeight <= 0 || scaleX <= 0 || scaleY <= 0) {
    throw new Error('Không đọc được kích thước của lớp đã chọn.');
  }
  const width = baseWidth * scaleX;
  const height = baseHeight * scaleY;
  return {
    x: round(left - width / 2),
    y: round(top - height / 2),
    width: round(width),
    height: round(height),
    rotation: round(rotation),
  };
}

export function validateInspectorGeometry(geometry) {
  if (!geometry || typeof geometry !== 'object') {
    throw new Error('Bố cục lớp không hợp lệ.');
  }
  for (const [name, config] of Object.entries(FIELDS)) {
    const value = geometry[name];
    if (!finite(value) || value < config.min || value > config.max) {
      throw new Error(`${config.label} không hợp lệ.`);
    }
  }
  return { ...Object.fromEntries(Object.keys(FIELDS).map(name => [name, round(geometry[name])])) };
}

export function updateInspectorField(geometry, field, rawValue) {
  if (!Object.hasOwn(FIELDS, field)) throw new Error('Thuộc tính lớp không được hỗ trợ.');
  const value = typeof rawValue === 'number' ? rawValue : Number(String(rawValue).trim());
  if (String(rawValue).trim() === '' || !finite(value)) {
    throw new Error('Vui lòng nhập một số hợp lệ.');
  }
  return validateInspectorGeometry({ ...geometry, [field]: value });
}

export function centerInspectorGeometry(geometry, direction, artboard) {
  const current = validateInspectorGeometry(geometry);
  if (!finite(artboard?.width) || !finite(artboard?.height) ||
    artboard.width <= 0 || artboard.height <= 0) {
    throw new Error('Kích thước bản vẽ không hợp lệ.');
  }
  if (direction === 'horizontal') {
    return validateInspectorGeometry({ ...current, x: round((artboard.width - current.width) / 2) });
  }
  if (direction === 'vertical') {
    return validateInspectorGeometry({ ...current, y: round((artboard.height - current.height) / 2) });
  }
  throw new Error('Hướng căn giữa không hợp lệ.');
}

export function applyInspectorGeometry(shape, geometry) {
  const next = validateInspectorGeometry(geometry);
  const baseWidth = Number(shape?.width);
  const baseHeight = Number(shape?.momeviaBaseHeight ?? shape?.height);
  if (!finite(baseWidth) || !finite(baseHeight) || baseWidth <= 0 || baseHeight <= 0 ||
    typeof shape?.set !== 'function' || typeof shape?.setCoords !== 'function') {
    throw new Error('Không thể chỉnh sửa hình dạng này.');
  }
  shape.set({
    left: next.x + next.width / 2,
    top: next.y + next.height / 2,
    scaleX: next.width / baseWidth,
    scaleY: next.height / baseHeight,
    angle: next.rotation,
  });
  shape.setCoords();
  return next;
}

export function canInspectFabricShape(shape, canEdit) {
  return Boolean(shape?.momeviaId && !shape.momeviaMissingImage &&
    shape.selectable && shape.visible !== false && canEdit(shape.momeviaId));
}

function element(tag, className, label = '') {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (label) result.textContent = label;
  return result;
}

export function mountFabricInspector({ canvas, artboard, layerModels, canEdit }) {
  const panel = element('section', 'fabric-inspector');
  panel.setAttribute('aria-label', 'Thuộc tính lớp đang chọn');
  const heading = element('div', 'fabric-inspector__heading');
  heading.append(element('strong', '', 'Thuộc tính lớp'));
  const status = element('p', 'fabric-inspector__status', 'Chọn một lớp có thể chỉnh sửa.');
  status.setAttribute('aria-live', 'polite');
  const fields = element('div', 'fabric-inspector__fields');
  const inputs = new Map();
  for (const [name, config] of Object.entries(FIELDS)) {
    const label = element('label', 'fabric-inspector__field');
    label.append(element('span', '', config.label));
    const input = element('input', 'fabric-inspector__input');
    input.type = 'number';
    input.step = '0.01';
    input.min = String(config.min);
    input.max = String(config.max);
    input.disabled = true;
    input.dataset.fabricInspectorField = name;
    label.append(input);
    fields.append(label);
    inputs.set(name, input);
  }
  const actions = element('div', 'fabric-inspector__actions');
  for (const [action, label] of [['horizontal', 'Giữa ngang'], ['vertical', 'Giữa dọc']]) {
    const button = element('button', '', label);
    button.type = 'button';
    button.disabled = true;
    button.dataset.fabricInspectorCenter = action;
    actions.append(button);
  }
  const help = element('p', 'fabric-inspector__help',
    'Thay đổi tại đây chỉ được lưu sau khi chọn “Áp dụng vào thiết kế”.');
  heading.append(status);
  panel.append(heading, fields, actions, help);

  const active = () => canvas.getActiveObject();
  const editable = shape => canInspectFabricShape(shape, canEdit);
  const refresh = () => {
    const shape = active();
    const allowed = editable(shape);
    const model = shape?.momeviaId ? layerModels.get(shape.momeviaId) : null;
    status.textContent = shape ?
      `${model?.name || model?.accessibility?.label || model?.type || 'Lớp'}${allowed ? '' : ' · chỉ xem'}` :
      'Chọn một lớp có thể chỉnh sửa.';
    let geometry = null;
    try { if (shape) geometry = readInspectorGeometry(shape); }
    catch { /* Hình minh họa không hỗ trợ nhập hình học. */ }
    for (const [name, input] of inputs) {
      input.disabled = !allowed || !geometry;
      input.value = geometry ? String(geometry[name]) : '';
    }
    actions.querySelectorAll('button').forEach(button => { button.disabled = !allowed || !geometry; });
  };

  function update(next) {
    const shape = active();
    if (!editable(shape)) throw new Error('Lớp này bị khóa hoặc không có quyền chỉnh sửa.');
    applyInspectorGeometry(shape, next);
    canvas.requestRenderAll();
    refresh();
    status.textContent = 'Đã chỉnh bố cục · chưa áp dụng vào thiết kế';
  }
  const onChange = event => {
    const input = event.target.closest('[data-fabric-inspector-field]');
    if (!input || !panel.contains(input)) return;
    try {
      const shape = active();
      if (!editable(shape)) throw new Error('Vui lòng chọn lớp được phép chỉnh sửa.');
      update(updateInspectorField(readInspectorGeometry(shape), input.dataset.fabricInspectorField, input.value));
    } catch (error) {
      refresh();
      status.textContent = error.message;
    }
  };
  const onClick = event => {
    const button = event.target.closest('[data-fabric-inspector-center]');
    if (!button || !panel.contains(button)) return;
    try {
      const shape = active();
      if (!editable(shape)) throw new Error('Vui lòng chọn lớp được phép chỉnh sửa.');
      update(centerInspectorGeometry(readInspectorGeometry(shape), button.dataset.fabricInspectorCenter, artboard));
    } catch (error) {
      refresh();
      status.textContent = error.message;
    }
  };
  fields.addEventListener('change', onChange);
  actions.addEventListener('click', onClick);
  const events = ['selection:created', 'selection:updated', 'selection:cleared', 'object:modified'];
  events.forEach(name => canvas.on(name, refresh));
  refresh();
  return {
    panel,
    refresh,
    dispose() {
      fields.removeEventListener('change', onChange);
      actions.removeEventListener('click', onClick);
      events.forEach(name => canvas.off(name, refresh));
    },
  };
}
