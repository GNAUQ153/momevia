import { applyFocalPoint, renderElement } from "../gift-runtime/renderer.js";
import { node } from "./dom.js";
import { CROP_ANCHORS, activeCropAnchor, getCropAnchor, normalizeFocalPoint } from "./crop-presets.js";

export function cropEditor(model, { document, assetUrl, editable, onPreview, onChange }) {
  const { width, height } = model.layout;
  const scale = Math.min(1, 204 / width, 154 / height);
  const radius = model.props.radius || 0;
  const viewport = node("div", { class: "editor-crop-surface", "aria-hidden": "true" });
  viewport.style.width = `min(100%, ${width * scale}px)`;
  viewport.style.aspectRatio = `${width} / ${height}`;
  const picture = renderElement(model, { document, assetUrl, mode: "editor" });
  picture.hidden = false;
  picture.style.borderRadius = `${radius / width * 100}% / ${radius / height * 100}%`;
  viewport.append(picture);
  if (!editable) return viewport;
  viewport.classList.add("is-editable");
  const marker = node("span", { class: "editor-crop-point" });
  viewport.append(marker);
  const initial = normalizeFocalPoint(model.props.focalPoint);
  let pointer = null, point = initial;
  // Các nút nằm ngoài vùng kéo crop nên không cản thao tác pointer/touch.
  const grid = node("div", {
    class: "editor-crop-presets", role: "group", "aria-label": "Chọn nhanh trọng tâm ảnh",
  });
  for (const anchor of CROP_ANCHORS) {
    grid.append(node("button", {
      class: "editor-crop-presets__button", type: "button",
      "aria-label": `Lấy nét: ${anchor.label}`, "aria-pressed": "false",
      "data-crop-anchor": anchor.id, title: anchor.label,
    }, node("span", { class: "editor-crop-presets__dot", "aria-hidden": "true" })));
  }
  const paint = value => {
    marker.style.left = `${value.x * 100}%`;
    marker.style.top = `${value.y * 100}%`;
    const active = activeCropAnchor(value);
    for (const button of grid.querySelectorAll("button[data-crop-anchor]")) {
      button.setAttribute("aria-pressed", String(button.dataset.cropAnchor === active));
    }
    const img = picture.querySelector("img");
    if (img) applyFocalPoint(img, value);
  };
  paint(point);
  const track = event => {
    const rect = viewport.getBoundingClientRect();
    const ratio = (coordinate, start, size) => Math.round(Math.min(1, Math.max(0, (coordinate - start) / size)) * 1000) / 1000;
    point = { x: ratio(event.clientX, rect.left, rect.width), y: ratio(event.clientY, rect.top, rect.height) };
    paint(point);
    onPreview(point);
  };
  viewport.addEventListener("pointerdown", event => {
    if (pointer !== null || event.button !== 0) return;
    event.preventDefault();
    pointer = event.pointerId;
    viewport.setPointerCapture(pointer);
    track(event);
  });
  viewport.addEventListener("pointermove", event => {
    if (event.pointerId === pointer) track(event);
  });
  viewport.addEventListener("pointerup", event => {
    if (event.pointerId !== pointer) return;
    track(event);
    pointer = null;
    onChange(point);
  });
  const cancel = event => {
    if (event.pointerId !== pointer) return;
    pointer = null;
    point = initial;
    paint(point);
    onPreview(point);
  };
  viewport.addEventListener("pointercancel", cancel);
  viewport.addEventListener("lostpointercapture", cancel);
  const panel = node("div", { class: "editor-crop-panel", "data-crop-for": model.id },
    viewport,
    node("p", { class: "editor-crop-presets__caption", text: "Chọn nhanh vị trí ảnh" }),
    grid);
  grid.addEventListener("click", event => {
    const button = event.target.closest("button[data-crop-anchor]");
    if (!button || !grid.contains(button)) return;
    const anchorId = button.dataset.cropAnchor;
    point = getCropAnchor(anchorId);
    paint(point);
    onPreview(point);
    // onChange đi qua commit/validation/Undo của Designer, không sửa trực tiếp document.
    onChange(point);
    // Inspector được dựng lại sau commit; giữ vị trí focus cho người dùng bàn phím.
    const next = [...panel.ownerDocument.querySelectorAll(".editor-crop-panel")]
      .find(item => item.dataset.cropFor === model.id);
    const target = [...(next?.querySelectorAll("button[data-crop-anchor]") || [])]
      .find(item => item.dataset.cropAnchor === anchorId);
    target?.focus({ preventScroll: true });
  });
  return panel;
}
