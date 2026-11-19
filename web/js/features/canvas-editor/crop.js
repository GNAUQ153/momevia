import { applyFocalPoint, renderElement } from "../gift-runtime/renderer.js";
import { node } from "./dom.js";

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
  const initial = model.props.focalPoint || { x: 0.5, y: 0.5 };
  let pointer = null, point = initial;
  const paint = value => {
    marker.style.left = `${value.x * 100}%`;
    marker.style.top = `${value.y * 100}%`;
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
  return viewport;
}
