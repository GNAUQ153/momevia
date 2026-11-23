// Thuộc tính theo loại lớp; chỉ lưu document sau khi người dùng chọn Áp dụng.
import { message, setAttr, setText } from '../../core/i18n.js';
import { canInspectFabricShape } from './fabric-inspector.js';
import {
  currentStyleValue, styleFieldsFor, styleDiffFromDraft, validateFabricStyleField,
} from './fabric-style-patch.js';

const FIELD_INFO = Object.freeze({
  color: ['color'],
  fontToken: ['select', ['body', 'heading', 'serif']],
  fontSize: ['number', 10, 160, 1],
  align: ['select', ['left', 'center', 'right']],
  lineHeight: ['number', 1, 3, 0.1],
  strokeColor: ['color'],
  strokeWidth: ['number', 0, 40, 1],
  radius: ['number', 0, 512, 1],
  opacity: ['number', 0, 100, 5],
});

// Không để thông báo nội bộ hoặc dữ liệu lỗi không tin cậy lọt lên UI.
export function propertiesUiError(error) {
  const errors = {
    'Không có quyền chỉnh lớp này.': 'locked',
    'Vui lòng nhập số hợp lệ.': 'number',
    'Đối tượng Fabric không hợp lệ.': 'object',
    'Thuộc tính chưa hỗ trợ.': 'unsupported',
    'Thuộc tính lớp không được hỗ trợ.': 'unsupported',
  };
  return message(`editor.fabric.properties.error.${errors[String(error?.message ?? '')] ?? 'invalid'}`);
}

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
    case 'color':
      prop = { fill: accepted };
      for(const child of shape.getObjects?.()||[])if(child.momeviaFillBinding)child.set('fill',accepted);
      break;
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
  setAttr(panel, 'aria-label', message('editor.fabric.properties.aria'));
  const heading = make('div', 'fabric-properties__heading');
  const title = make('strong');
  setText(title, message('editor.fabric.properties.heading'));
  const toggle = make('button', 'fabric-properties__toggle');
  setText(toggle, message('editor.fabric.properties.toggle.open'));
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'fabric-properties-fields');
  const summary = make('p', 'fabric-properties__summary');
  setText(summary, message('editor.fabric.properties.empty'));
  summary.setAttribute('role', 'status');
  const body = make('div', 'fabric-properties__body');
  body.id = 'fabric-properties-fields';
  const fields = make('div', 'fabric-properties__grid');
  const hint = make('p', 'fabric-properties__hint');
  setText(hint, message('editor.fabric.properties.hint'));
  body.append(fields, hint);
  heading.append(title, toggle);
  panel.append(heading, summary, body);

  const getCurrent = () => canvas.getActiveObject();
  const getModel = () => layerModels.get(getCurrent()?.momeviaId);
  const allowed = () => canInspectFabricShape(getCurrent(), canEdit);

  function refresh() {
    const model = getModel();
    const enabled = allowed();
    if (!model) setText(summary, message('editor.fabric.properties.choose'));
    else {
      const kind = { format: 'message', key: `editor.fabric.properties.family.${
        ['text', 'shape', 'image'].includes(model.type) ? model.type : 'layer'}` };
      const name = model.name || model.accessibility?.label || model.id;
      setText(summary, message(enabled ? 'editor.fabric.properties.selected' :
        'editor.fabric.properties.readOnly', { kind, name }));
    }
    fields.replaceChildren();
    if (!model || !styleFieldsFor(model).length) return;
    const stored = changes.get(model.id);
    for (const field of styleFieldsFor(model)) {
      const [type, config, max, step] = FIELD_INFO[field];
      const label = make('label', 'fabric-properties__field');
      const caption = make('span');
      setText(caption, message(`editor.fabric.properties.field.${field}`));
      label.append(caption);
      const input = make(type === 'select' ? 'select' : 'input', 'fabric-properties__input');
      if (type === 'select') {
        for (const value of config) {
          const option = make('option');
          setText(option, message(`editor.fabric.properties.option.${field}.${value}`));
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
    if (FIELD_INFO[field]?.[0] === 'number') {
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
    setText(summary, message('editor.fabric.properties.changed'));
  }
  const onChange = event => {
    const input = event.target.closest('[data-fabric-style]');
    if (!input || !fields.contains(input)) return;
    try { update(input.dataset.fabricStyle, input.value); }
    catch (error) {
      refresh();
      setText(summary, propertiesUiError(error));
    }
  };
  const onToggle = () => {
    const expanded = toggle.getAttribute('aria-expanded') !== 'true';
    panel.classList.toggle('is-expanded', expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
    setText(toggle, message(`editor.fabric.properties.toggle.${expanded ? 'close' : 'open'}`));
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
    draft:()=>[...changes].map(([id,fields])=>[id,[...fields]]),
    restoreDraft:entries=>{changes.clear();for(const [id,fields]of entries)changes.set(id,new Map(fields));refresh();},
    setDraft:(id,fields)=>{if(fields?.length)changes.set(id,new Map(fields));else changes.delete(id);},
    dispose() {
      fields.removeEventListener('change', onChange);
      toggle.removeEventListener('click', onToggle);
      events.forEach(name => canvas.off(name, refresh));
      changes.clear();
    },
  };
}
