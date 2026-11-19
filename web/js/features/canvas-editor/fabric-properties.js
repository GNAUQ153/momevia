// Phase 6.0b: Thanh thuộc tính theo loại lớp; dữ liệu chỉ lưu sau thao tác Áp dụng.
import { canInspectFabricShape } from './fabric-inspector.js';
import {
  currentStyleValue, styleFieldsFor, styleDiffFromDraft, validateFabricStyleField,
} from './fabric-style-patch.js';

const FIELD_INFO = Object.freeze({
  color: ['Màu nội dung', 'color'],
  fontToken: ['Kiểu chữ', 'select', [['body', 'Hiện đại'], ['heading', 'Tiêu đề'], ['serif', 'Thanh lịch']]],
  fontSize: ['Cỡ chữ (px)', 'number', 10, 160, 1],
  align: ['Căn chữ', 'select', [['left', 'Trái'], ['center', 'Giữa'], ['right', 'Phải']]],
  lineHeight: ['Giãn dòng', 'number', 1, 3, 0.1],
  strokeColor: ['Màu viền', 'color'],
  strokeWidth: ['Độ dày viền', 'number', 0, 40, 1],
  radius: ['Bo góc', 'number', 0, 512, 1],
  opacity: ['Độ mờ (0–100%)', 'number', 0, 100, 5],
});

const FAMILY = Object.freeze({ text: 'Văn bản', shape: 'Hình khối', image: 'Ảnh' });
function make(tag, className = '', text = '') {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function propertyToFabric(shape, model, field, value) {
  if (!shape || typeof shape.set !== 'function') throw new Error('Đối tượng Fabric không hợp lệ.');
  const accepted = validateFabricStyleField(model, field, value);
  let prop = {};
  switch (field) {
    case 'opacity': prop = { opacity: accepted }; break;
    case 'color': prop = { fill: accepted }; break;
    case 'strokeColor': prop = { stroke: accepted }; break;
    case 'strokeWidth': prop = { strokeWidth: accepted }; break;
    case 'radius': prop = { rx: accepted, ry: accepted }; break;
    case 'fontToken': prop = { fontFamily: accepted === 'serif' ? 'Georgia' : 'Arial' }; break;
    case 'fontSize': prop = { fontSize: accepted }; break;
    case 'align': prop = { textAlign: accepted }; break;
    case 'lineHeight': prop = { lineHeight: accepted }; break;
    default: throw new Error('Thuộc tính chưa hỗ trợ.');
  }
  shape.set(prop);
  if (typeof shape.setCoords === 'function') shape.setCoords();
  return accepted;
}

export function mountFabricProperties({ canvas, layerModels, canEdit }) {
  const changes = new Map();
  const panel = make('section', 'fabric-properties');
  panel.setAttribute('aria-label', 'Kiểu dáng đối tượng đã chọn');
  const heading = make('div', 'fabric-properties__heading');
  const title = make('strong', '', 'Kiểu dáng');
  const toggle = make('button', 'fabric-properties__toggle', 'Mở thuộc tính');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'fabric-properties-fields');
  const summary = make('p', 'fabric-properties__summary', 'Chọn một lớp để chỉnh kiểu dáng.');
  summary.setAttribute('role', 'status');
  const body = make('div', 'fabric-properties__body');
  body.id = 'fabric-properties-fields';
  const fields = make('div', 'fabric-properties__grid');
  body.append(fields, make('p', 'fabric-properties__hint', 'Hủy để bỏ thay đổi · Áp dụng vào thiết kế để lưu.'));
  heading.append(title, toggle);
  panel.append(heading, summary, body);

  const getCurrent = () => canvas.getActiveObject();
  const getModel = () => layerModels.get(getCurrent()?.momeviaId);
  const allowed = () => canInspectFabricShape(getCurrent(), canEdit);

  function refresh() {
    const model = getModel();
    const enabled = allowed();
    summary.textContent = !model ? 'Chọn một lớp trên Canvas.' :
      `${FAMILY[model.type] || 'Lớp'}: ${model.name || model.accessibility?.label || model.id}` +
      (enabled ? '' : ' · Chỉ xem');
    fields.replaceChildren();
    if (!model || !styleFieldsFor(model).length) return;
    const stored = changes.get(model.id);
    for (const field of styleFieldsFor(model)) {
      const [labelText, type, config, max, step] = FIELD_INFO[field];
      const label = make('label', 'fabric-properties__field');
      label.append(make('span', '', labelText));
      const input = make(type === 'select' ? 'select' : 'input', 'fabric-properties__input');
      if (type === 'select') {
        for (const [value, label] of config) {
          const option = make('option', '', label);
          option.value = value;
          input.append(option);
        }
      } else {
        input.type = type;
        if (type === 'number') {
          input.min = String(config);
          input.max = String(max);
          input.step = String(step);
          input.inputMode = 'decimal';
        }
      }
      input.dataset.fabricStyle = field;
      input.disabled = !enabled;
      const value = stored?.has(field) ? stored.get(field) : currentStyleValue(model, field);
      input.value = String(field === 'opacity' ? Math.round(value * 100) : value);
      label.append(input);
      fields.append(label);
    }
  }

  function update(field, raw) {
    const shape = getCurrent();
    const model = getModel();
    if (!allowed() || !model) throw new Error('Không có quyền chỉnh lớp này.');
    let value = raw;
    if (FIELD_INFO[field]?.[1] === 'number') {
      if (raw.trim() === '') throw new Error('Vui lòng nhập số hợp lệ.');
      value = Number(raw);
      if (field === 'opacity') value /= 100;
    }
    value = validateFabricStyleField(model, field, value);
    propertyToFabric(shape, model, field, value);
    const updated = changes.get(model.id) || new Map();
    if (String(value).toUpperCase() === String(currentStyleValue(model, field)).toUpperCase()) {
      updated.delete(field);
    } else updated.set(field, value);
    if (updated.size) changes.set(model.id, updated);
    else changes.delete(model.id);
    canvas.requestRenderAll();
    summary.textContent = 'Đã chỉnh kiểu dáng · chưa áp dụng vào thiết kế.';
  }
  const onChange = event => {
    const input = event.target.closest('[data-fabric-style]');
    if (!input || !fields.contains(input)) return;
    try { update(input.dataset.fabricStyle, input.value); }
    catch (error) {
      refresh();
      summary.textContent = error.message;
    }
  };
  const onToggle = () => {
    const expanded = toggle.getAttribute('aria-expanded') !== 'true';
    panel.classList.toggle('is-expanded', expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.textContent = expanded ? 'Thu gọn' : 'Mở thuộc tính';
  };
  const events = ['selection:created', 'selection:updated', 'selection:cleared'];
  fields.addEventListener('change', onChange);
  toggle.addEventListener('click', onToggle);
  events.forEach(name => canvas.on(name, refresh));
  refresh();
  return {
    panel,
    refresh,
    changes: () => styleDiffFromDraft(layerModels, changes),
    dispose() {
      fields.removeEventListener('change', onChange);
      toggle.removeEventListener('click', onToggle);
      events.forEach(name => canvas.off(name, refresh));
      changes.clear();
    },
  };
}
