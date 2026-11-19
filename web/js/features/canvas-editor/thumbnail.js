import { renderElement, applyLayout } from "../gift-runtime/renderer.js";
import { applySurface } from "../gift-runtime/effects.js";
import { node } from "./dom.js";

export function thumbnail(document, models, box, { width, height, background, assetUrl, surfaceEffect }) {
  const size = { width: box.right - box.left, height: box.bottom - box.top };
  const scale = Math.min(width / size.width, height / size.height);
  const frame = node("span", { class: "editor-thumbnail", "aria-hidden": "true" });
  const surface = node("span", { class: "editor-thumbnail-surface" });
  frame.style.width = `${width}px`;
  frame.style.height = `${height}px`;
  surface.style.width = `${size.width}px`;
  surface.style.height = `${size.height}px`;
  surface.style.transform = `translate(${(width - size.width * scale) / 2}px, ${(height - size.height * scale) / 2}px) scale(${scale})`;
  if (background) surface.style.backgroundColor = background;
  applySurface(surface, surfaceEffect);
  for (const model of models) {
    if (!model || model.visible === false) continue;
    const rendered = renderElement(model, { document, assetUrl, mode: "thumbnail" });
    applyLayout(rendered, {
      ...model, layout: { ...model.layout, x: model.layout.x - box.left, y: model.layout.y - box.top },
    }, size);
    surface.append(rendered);
  }
  frame.append(surface);
  return frame;
}

export function sceneThumbnail(document, scene, { width = 42, assetUrl } = {}) {
  const size = document.artboard.baseSize;
  const indexed = new Map(document.elements.map(model => [model.id, model]));
  return thumbnail(document, scene.elementIds.map(id => indexed.get(id)), {
    left: 0, top: 0, right: size.width, bottom: size.height,
  }, { width, height: size.height * width / size.width, background: scene.background.color, assetUrl, surfaceEffect: scene.effects?.surface });
}
