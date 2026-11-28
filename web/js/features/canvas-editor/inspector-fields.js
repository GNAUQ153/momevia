import {NATURAL_OPENINGS} from '../../shared/canvas/natural-objects.js';
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
  "text", "textBinding", "fontToken", "fontSize", "align", "assetId", "sealAssetId", "focalPoint",
]);

export function buildInspectorPropertyFields(element) {
  const { props } = element;
  const fields = [];
  for (const key of element.type === "interaction" ? [] : registry[element.type].inspector) {
    if(key==='objectDepth'){if(props.preset==='lid-source-v6')fields.push(input(message('crafted.depth'),'props.objectDepth',props.objectDepth??8,{type:'number',min:0,max:16}));continue;}
    if(['sealColor','paperColor'].includes(key)&&!props.preset?.startsWith('wax-letter')&&!['lid-volume-v4','lid-source-v6'].includes(props.preset))continue;
    if(['cornerRadius','motionSpeed'].includes(key)&&!Object.hasOwn(props,key)&&!['lid-card-v2','wax-letter-v2',...NATURAL_OPENINGS].includes(props.preset)&&!['paper-soft-v2','garden-soft-v2'].includes(props.appearance))continue;
    if(['cornerRadius','motionSpeed'].includes(key)&&['envelope','gift-box'].includes(element.type)&&!['lid-card-v2','wax-letter-v2',...NATURAL_OPENINGS].includes(props.preset))continue;
    if(key==='cornerRadius'&&element.type==='reply'&&!['paper-soft-v2','garden-soft-v2'].includes(props.appearance))continue;
    if(element.assembly && key!=='color')continue;
    if(key==='cardText'){if(NATURAL_OPENINGS.includes(props.preset))fields.push(input(message('natural.cardTextLabel'),'props.cardText',props.cardText||'',{maxlength:120}));continue;}
    if (dedicatedInspectorProperties.includes(key)) continue;
    if(key==='cornerRadius'){fields.push(input(message('soft.radius'),'props.cornerRadius',props.cornerRadius??24,{type:'number',min:0,max:48}));continue;}
    if(key==='motionSpeed'){fields.push(select(message('soft.speed'),'props.motionSpeed',props.motionSpeed||'normal',[['fast',message('soft.fast')],['normal',message('soft.normal')],['slow',message('soft.slow')]]));continue;}
    if (["color", "strokeColor", "sealColor", "paperColor"].includes(key)) {
      const colorControl = node('input', { type: 'color', 'data-editor-field': `props.${key}`, value: props[key] || '#514463' });
      fields.push(field(message(key === "color" ? "editor.interface.color" : key==='sealColor'?(element.type==='gift-box'?'natural.ribbonColor':'drive.sealColor'):key==='paperColor'?'drive.paperColor':"editor.interface.stroke"), colorControl));
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
        `props.${key}`, key==='radius'&&element.type==='button'?(props[key]??12):props[key], { type: "number", min: 0, max: key === "radius" ? 512 : 40 }));
    } else if (key === "kind") {
      fields.push(select(message("editor.interface.shape"), "props.kind", props.kind, [
        ["rectangle", message("editor.interface.shapeRectangle")],
        ["ellipse", message("editor.interface.shapeEllipse")],
        ["line", message("editor.interface.shapeLine")],
        ...artworkChoices("shape", Object.keys(shapes).map((id, i) => [id, message(id.startsWith("garden-door-") ? `templates.garden-tea.${id.includes("left") ? "doorLeft" : "doorRight"}` : `editor.interface.shape.${["triangle", "diamond", "hexagon", "arch", "ribbon", "bubble"][i]}`)]), currentLocale()),
      ]));
    } else if (key === "mask" && props.mask) {
      fields.push(select(message("editor.interface.imageMask"), "props.mask", props.mask,
        artworkChoices("mask", Object.keys(masks).map((id, i) => [id, message(`editor.interface.mask.${["round", "arch", "heart", "torn"][i]}`)]), currentLocale())));
     } else if(key==='preset'&&['classic','lid-card-v1','wax-letter-v1','lid-card-v2','wax-letter-v2',...NATURAL_OPENINGS].includes(props.preset)) {
      fields.push(select(message('drive.openingStyle'),'props.preset',props.preset,element.type==='gift-box'?[['lid-source-v6',message('crafted.giftStyle')],['lid-volume-v4',message('natural.style')],['lid-card-natural-v3',message('natural.legacyPhoto')],['lid-card-v2',message('soft.soft')],['lid-card-v1',message('drive.block.santa-gift-box')],['classic',message('interactive.foldClassic')]]:[['wax-letter-natural-v3',message('natural.style')],['wax-letter-v2',message('soft.soft')],['wax-letter-v1',message('drive.block.soiree-envelope')],['classic',message('interactive.foldClassic')]]));
    } else if (key === "caption" && Object.hasOwn(props, key)) {
      fields.push(field(message("editor.interface.caption"), node("textarea", {
        "data-editor-field": "props.caption", maxlength: LIMITS.text, rows: 3,
      }, props.caption)));
    } else if (key === "pattern" && props.pattern) {
      fields.push(select(message("editor.interface.linePattern"), "props.pattern", props.pattern,
        artworkChoices("line", Object.keys(lines).map((id, i) => [id, message(`editor.interface.pattern.${["arc", "stitch", "arrow", "wave", "brace", "corners"][i]}`)]), currentLocale())));
    } else if(key==='replyMode'&&element.type==='reply'&&props.replyMode!=='attendance'){
      fields.push(select(message('drive.replyStyle'),'props.replyMode',props.replyMode||'classic',[['classic',message('drive.replyClassic')],['message',message('drive.replyFolded')]]));
    } else if(key==='appearance'&&element.type==='reply'&&props.replyMode==='attendance'){
      fields.push(select(message('drive.rsvpStyle'),'props.appearance',props.appearance||'garden',[['garden',message('drive.rsvpGarden')],['paper-v1',message('drive.rsvpPaper')],['garden-soft-v2',message('soft.gardenRsvp')],['paper-soft-v2',message('soft.paperRsvp')]]));
    } else if (key === "variant") {
      fields.push(select(message('editor.buttonVariant.label'),'props.variant',props.variant||'filled',[
        ['filled',message('editor.buttonVariant.filled')],['text',message('editor.buttonVariant.text')],
      ]));
    } else if (key === 'placement') {
      fields.push(select(message('editor.buttonPlacement.label'),'props.placement',props.placement||'canvas',[
        ['canvas',message('editor.buttonPlacement.canvas')],['footer',message('editor.buttonPlacement.footer')],
      ]));
    } else if (key === 'placeholder' && props.optional) {
      fields.push(select(message('editor.emptyPhoto.label'),'props.placeholder',props.placeholder||'portrait',[
        ['portrait',message('editor.emptyPhoto.portrait')],['collapse',message('editor.emptyPhoto.collapse')],
      ]));
    } else if (key === "fontStyle") {
      if (Object.hasOwn(props, 'fontStyle')) fields.push(select(message("editor.fontStyle.label"), "props.fontStyle", props.fontStyle || "normal", [["normal", message("editor.fontStyle.normal")], ["italic", message("editor.fontStyle.italic")]]));
    } else if (key === "fit") {
      fields.push(select(message("editor.interface.photoFrame"), "props.fit", props.fit, [
        ["cover", message("editor.interface.fitCover")],
        ["contain", message("editor.interface.fitContain")],
      ]));
    } else if (key === "stickerId") {
      fields.push(select(message("editor.interface.sticker"), "props.stickerId", props.stickerId,
        artworkChoices("sticker", Object.keys(stickerNames).map(id => [id, message(`editor.library.item.${id}`)]), currentLocale())));
    } else if (!["preset", "pattern", "mask", "maskPath", "caption", "optional", "placeholder", "replyMode", "appearance"].includes(key)) {
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
