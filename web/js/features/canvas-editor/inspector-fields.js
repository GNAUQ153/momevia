// Các điều khiển thuần giao diện của Inspector; không ghi Canvas JSON hoặc gọi API.
import { currentLocale, message } from "../../core/i18n.js";
import { LIMITS, registry } from "../../shared/canvas/registry.js";
import { lines, masks, shapes } from "../../shared/canvas/artwork.js";
import { artworkChoices } from "../../shared/canvas/library-state.js";
import { stickerNames } from "./library.js";
import { toPercent } from "./designer-helpers.js";
import { button, field, iconButton, input, node, select } from "./dom.js";

// Những trường đã có trình điều khiển chuyên dụng (văn bản, ảnh, crop).
export const dedicatedInspectorProperties = Object.freeze([
  "text", "textBinding", "fontToken", "fontSize", "align", "assetId", "focalPoint",
]);

export function buildInspectorPropertyFields(element) {
  const { props } = element;
  const fields = [];
  for (const key of element.type === "interaction" ? [] : registry[element.type].inspector) {
    if(element.assembly && key!=='color')continue;
    // Vector Signature đã lưu đường nét riêng; không đổi sang hình Classic hoặc trường không có tác dụng.
    if (element.type === 'shape' && element.artwork && props.kind?.startsWith('signature-')) {
      if (key !== 'color' || !element.artwork.paths.some(path => path.fill === 'color' || path.stroke === 'color')) continue;
    }
    if (dedicatedInspectorProperties.includes(key)) continue;
    if (["color", "strokeColor"].includes(key)) {
      const colorControl = node('input', { type: 'color', 'data-editor-field': `props.${key}`, value: props[key] || '#514463' });
      fields.push(field(message(key === "color" ? "editor.interface.color" : "editor.interface.stroke"), colorControl));
      if ((element.type === 'text' && key === 'color') || (element.type === 'sticker' && key === 'strokeColor')) {
        const palette = node('select', { 'data-editor-color-preset': `props.${key}` },
          node('option', { value: '' }, message('editor.interface.customColor')),
          node('option', { value: '#32243B' }, message('editor.interface.onLight')),
          node('option', { value: '#FFF7EE' }, message('editor.interface.onDark')));
        palette.value = ['#32243B', '#FFF7EE'].includes(props[key]) ? props[key] : '';
        palette.onchange = () => {
          if (!palette.value || palette.disabled || colorControl.disabled) return;
          colorControl.value = palette.value;
          colorControl.dispatchEvent(new Event('change', { bubbles: true }));
        };
        fields.push(field(message('editor.interface.readablePalette'), palette));
      }
    } else if (["radius", "strokeWidth"].includes(key)) {
      fields.push(input(message(key === "radius" ? "editor.interface.radius" : "editor.interface.strokeWidth"),
        `props.${key}`, props[key], { type: "number", min: 0, max: key === "radius" ? 512 : 40 }));
    } else if (key === "kind") {
      fields.push(select(message("editor.interface.shape"), "props.kind", props.kind, [
        ["rectangle", message("editor.interface.shapeRectangle")],
        ["ellipse", message("editor.interface.shapeEllipse")],
        ["line", message("editor.interface.shapeLine")],
        ...artworkChoices("shape", Object.keys(shapes).map((id, i) => [id, message(`editor.interface.shape.${["triangle", "diamond", "hexagon", "arch", "ribbon", "bubble"][i]}`)]), currentLocale()),
      ]));
    } else if (key === "mask" && props.mask) {
      fields.push(select(message("editor.interface.imageMask"), "props.mask", props.mask,
        artworkChoices("mask", Object.keys(masks).map((id, i) => [id, message(`editor.interface.mask.${["round", "arch", "heart", "torn"][i]}`)]), currentLocale())));
    } else if (key === "caption" && Object.hasOwn(props, key)) {
      fields.push(field(message("editor.interface.caption"), node("textarea", {
        "data-editor-field": "props.caption", maxlength: LIMITS.text, rows: 3,
      }, props.caption)));
    } else if (key === "pattern" && props.pattern) {
      fields.push(select(message("editor.interface.linePattern"), "props.pattern", props.pattern,
        artworkChoices("line", Object.keys(lines).map((id, i) => [id, message(`editor.interface.pattern.${["arc", "stitch", "arrow", "wave", "brace", "corners"][i]}`)]), currentLocale())));
    } else if (key === "fit") {
      fields.push(select(message("editor.interface.photoFrame"), "props.fit", props.fit, [
        ["cover", message("editor.interface.fitCover")],
        ["contain", message("editor.interface.fitContain")],
      ]));
    } else if (key === "stickerId") {
      fields.push(select(message("editor.interface.sticker"), "props.stickerId", props.stickerId,
        artworkChoices("sticker", Object.keys(stickerNames).map(id => [id, message(`editor.library.item.${id}`)]), currentLocale())));
    } else if (!["preset", "pattern", "mask", "maskPath", "caption", "optional"].includes(key)) {
      fields.push(input({
        label: message("editor.interface.label.button"),
        title: message("editor.interface.label.title"),
        submitLabel: message("editor.interface.label.submitLabel"),
      }[key] || key, `props.${key}`, props[key], { maxlength: 120 }));
    }
  }
  return fields;
}

export function geometryOutsideCanvas(layout, size) {
  return layout.x < 0 || layout.y < 0 ||
    layout.x + layout.width > size.width || layout.y + layout.height > size.height;
}

export function buildInspectorGeometryFields(element, artboardSize, { layout = element.layout, locked = element.locked } = {}) {
  const children = [
    node("details", { class: "editor-geometry" },
      node("summary", {}, message(element.groupId ? "editor.interface.groupGeometry" : "editor.interface.geometry")),
      node("div", { class: "editor-layout-fields" },
        ...[["x", "X"], ["y", "Y"], ["width", message("editor.interface.geometry.width")],
          ["height", message("editor.interface.geometry.height")], ["rotation", message("editor.interface.geometry.rotation")]]
          .map(([key, label]) => input(label, `layout.${key}`, Number(layout[key].toFixed(2)), {
            type: "number",
            min: key === "width" || key === "height" ? 1 : key === "rotation" ? -360 : -LIMITS.coordinate,
            max: key === "rotation" ? 360 : LIMITS.coordinate,
            step: 1,
            disabled: Boolean(locked),
          }))),
      node("div", { class: "editor-control-row", role: "group", "aria-label": message("editor.interface.positionGroup") },
        button(message("editor.interface.centerHorizontal"), "center", { disabled: Boolean(locked) }),
        button(message("editor.interface.inside"), "inside", { disabled: Boolean(locked) }))),
    input(message("editor.interface.opacity"), "element.opacity", toPercent(1 - (element.opacity ?? 1)), {
      type: "number", min: 0, max: 100, step: 1, title: message("editor.interface.opacityHint"),
    }),
    node("div", { class: "editor-control-row" },
      iconButton(message("editor.interface.layerShow"), "layer-visibility", element.visible === false ? "eye-off" : "eye", {
        "aria-pressed": element.visible !== false,
      }),
      iconButton(message("editor.interface.layerLock"), "layer-lock", locked ? "lock" : "unlock", {
        "aria-pressed": Boolean(locked),
      }),
      button(message("editor.interface.layerUp"), "layer-up"),
      button(message("editor.interface.layerDown"), "layer-down"),
      button(message("editor.interface.duplicate"), "element-duplicate"),
      button(message("editor.interface.delete"), "element-delete")),
  ];
  if (geometryOutsideCanvas(layout, artboardSize))
    children.push(node("p", { class: "editor-help" }, message("editor.interface.outsideCanvas")));
  return children;
}

// Khóa UI chỉ hỗ trợ trải nghiệm; quyền thật vẫn phải được kiểm tra tại server.
export function canEditInspectorField(key, permitted = []) {
  if (typeof key !== "string" || !Array.isArray(permitted)) return false;
  return (key.startsWith("props.") && permitted.includes(key.slice(6))) ||
    (key.startsWith("crop.") && permitted.includes("focalPoint")) ||
    (key === "upload" && permitted.includes("assetId"));
}

export function canUseInspectorAction(action, permitted = [], allowInlineText = false) {
  if (action === "close-sheet") return true;
  if (!Array.isArray(permitted)) return false;
  return (action === "text-align" && permitted.includes("align")) ||
    (action === "text-font" && permitted.includes("fontToken")) ||
    (action === "inline-text" && allowInlineText);
}

export function lockInspectorControls(host, policy, allowInlineText = false) {
  if (!policy) return;
  const permitted = policy.editableProps || [];
  host.insertBefore(node("p", { class: "editor-help" }, message("editor.interface.lockedTemplate")),
    host.children[1] || null);
  for (const control of host.querySelectorAll("[data-editor-field]"))
    control.disabled = !canEditInspectorField(control.dataset.editorField, permitted);
  for (const control of host.querySelectorAll('[data-editor-color-preset]'))
    control.disabled = !canEditInspectorField(control.dataset.editorColorPreset, permitted);
  for (const control of host.querySelectorAll("[data-editor-action]"))
    control.disabled = !canUseInspectorAction(control.dataset.editorAction, permitted, allowInlineText);
}
