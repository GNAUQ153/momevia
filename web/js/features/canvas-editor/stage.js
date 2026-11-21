import { message, setAttr, t } from "../../core/i18n.js";
import { renderElement, applyLayout, resolveText, applyFocalPoint, textFont } from "../gift-runtime/renderer.js";
import { applySurface } from "../gift-runtime/effects.js";
import { logicalPoint, gestureLayout, snapLayout } from "./store.js";
import { node } from "./dom.js";

export function createStage(
  host,
  {
    store,
    getSceneId,
    getSelection,
    select,
    assetUrl,
    onGesture,
    textOptions,
    onTextChange,
    signal: parentSignal,
    isLayoutLocked = () => false,
    isReadOnly = () => false,
    getSnap = () => true,
  },
) {
  const lifecycle = new AbortController(),
    signal = AbortSignal.any([parentSignal, lifecycle.signal]);
  const surround = node("div", { class: "editor-artboard-surround" });
  const artboard = node("div", {
    class: "editor-artboard",
    tabindex: 0,
    "aria-label": message("editor.stage.edit"),
  });
  surround.append(artboard);
  host.replaceChildren(surround);
  let zoom = 1,
    gesture = null,
    disposed = false;
  let selectionOutline, inlineEditor;
  function setZoom(value) {
    if (gesture && value !== zoom) gesture.rect = null;
    zoom = value;
    const size = store.get().document.artboard.baseSize;
    artboard.style.width = `${size.width}px`;
    artboard.style.height = `${size.height}px`;
    artboard.style.transform = `scale(${zoom})`;
    surround.style.width = `${size.width * zoom}px`;
    surround.style.height = `${size.height * zoom}px`;
  }
  function render() {
    if (disposed || gesture || inlineEditor) return;
    const doc = store.get().document,
      scene =
        doc.scenes.find((item) => item.id === getSceneId()) || doc.scenes[0];
    artboard.replaceChildren();
    selectionOutline = null;
    artboard.style.backgroundColor = scene.background.color;
    applySurface(artboard, scene.effects?.surface);
    const readOnly = isReadOnly();
    setAttr(artboard, "aria-label", readOnly ? scene.name : message("editor.stage.edit"));
    for (const element of doc.elements.filter((item) => scene.elementIds.includes(item.id))) {
      if (readOnly && element.visible === false) continue;
      const id = element.id;
      const selected = !readOnly && id === getSelection();
      const item = renderElement(element, {
        document: doc,
        assetUrl,
        mode: "editor",
        signal,
      });
      applyLayout(item, element, doc.artboard.baseSize, { responsive: false });
      item.style.zIndex = String(scene.elementIds.indexOf(id));
      item.dataset.elementId = id;
      item.classList.add("editor-stage-element");
      item.setAttribute("tabindex", "-1");
      if (!readOnly && element.actions?.some(action => action.type === "goToScene" && !action.targetSceneId))
        item.append(node("span", { class: "editor-unlinked-action" }, message("editor.stage.missingTarget")));
      if (selected) {
        selectionOutline = node("span", {
          class: "editor-selection-outline",
          "data-element-id": id,
          "aria-hidden": "true",
        });
        applyLayout(selectionOutline, element.layout, doc.artboard.baseSize);
        selectionOutline.style.zIndex = String(scene.elementIds.length);
        if (!element.locked && !isLayoutLocked(id))
          selectionOutline.append(node("span", {
            class: "editor-resize-handle",
            "data-editor-resize": "true",
          }));
      }
      artboard.append(item);
    }
    if (selectionOutline) artboard.append(selectionOutline);
    setZoom(zoom);
  }
  function point(event, rect) {
    return logicalPoint(
      { x: event.clientX, y: event.clientY },
      rect,
      store.get().document.artboard.baseSize,
    );
  }
  function cancel() {
    if (!gesture) return;
    const { pointerId, frame } = gesture;
    gesture = null;
    cancelAnimationFrame(frame);
    if (artboard.hasPointerCapture(pointerId)) artboard.releasePointerCapture(pointerId);
    onGesture?.(false);
    render();
  }
  function finishText(save, focus = false) {
    if (!inlineEditor) return;
    const { field, id, original } = inlineEditor;
    inlineEditor = null;
    field.remove();
    if (save && field.value !== original) onTextChange(id, field.value);
    render();
    if (focus) artboard.focus({ preventScroll: true });
  }
  function editText(id) {
    if (isReadOnly() || inlineEditor || gesture) return false;
    const doc = store.get().document;
    const model = doc.elements.find(item => item.id === id);
    const options = textOptions(model);
    if (!options) return false;
    select(id);
    const original = resolveText(model, doc);
    const field = node("textarea", {
      class: "editor-inline-text",
      "aria-label": options.label,
      maxlength: options.maxlength,
      value: original,
    });
    applyLayout(field, model.layout, doc.artboard.baseSize);
    Object.assign(field.style, {
      fontFamily: textFont(model.props.fontToken),
      fontSize: `${model.props.fontSize ?? 24}px`,
      lineHeight: model.props.lineHeight ?? 1.4,
      textAlign: model.props.align ?? "left",
      color: model.props.color,
      backgroundColor: doc.scenes.find(scene => scene.id === getSceneId()).background.color,
      zIndex: doc.elements.length + 2,
    });
    inlineEditor = { field, id, original };
    field.addEventListener("blur", () => finishText(true), { once: true });
    field.addEventListener("keydown", event => {
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key !== "Escape" && !(event.key === "Enter" && (event.ctrlKey || event.metaKey))) return;
      event.preventDefault();
      event.stopPropagation();
      finishText(event.key === "Enter", true);
    });
    artboard.append(field);
    field.focus({ preventScroll: true });
    field.setSelectionRange(field.value.length, field.value.length);
    field.scrollIntoView({ block: "nearest", inline: "nearest" });
    return true;
  }
  artboard.addEventListener("dblclick", event => {
    const hit = globalThis.document.elementFromPoint(event.clientX, event.clientY)?.closest(".editor-stage-element");
    if (hit && artboard.contains(hit)) editText(hit.dataset.elementId);
  }, { signal });
  artboard.addEventListener("keydown", event => {
    if (event.target === artboard && event.key === "Enter" && editText(getSelection())) event.preventDefault();
  }, { signal });
  artboard.addEventListener(
    "pointerdown",
    (event) => {
      if (gesture || isReadOnly() || event.button !== 0 || event.target.closest(".editor-inline-text")) return;
      const target = event.target.closest("[data-element-id]");
      finishText(true);
      if (!target) {
        select(null);
        return;
      }
      const id = target.dataset.elementId;
      select(id);
      const element = store
        .get()
        .document.elements.find((item) => item.id === id);
      if (element.locked || isLayoutLocked(id)) return;
      event.preventDefault();
      artboard.focus({ preventScroll: true });
      const rect = artboard.getBoundingClientRect();
      gesture = {
        id,
        original: structuredClone(element.layout),
        start: point(event, rect),
        clientX: event.clientX,
        clientY: event.clientY,
        rect,
        pointerId: event.pointerId,
        mode: event.target.closest("[data-editor-resize]") ? "resize" : "move",
        node: artboard.querySelector(`.editor-stage-element[data-element-id="${CSS.escape(id)}"]`),
        type: element.type,
        model: element,
      };
      artboard.setPointerCapture(event.pointerId);
      onGesture?.(true);
    },
    { signal },
  );
  const invalidateBounds = () => { if (gesture) gesture.rect = null; };
  window.addEventListener("resize", invalidateBounds, { signal, passive: true });
  window.addEventListener("scroll", invalidateBounds, { signal, passive: true, capture: true });

  function paintGesture(event) {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gesture.rect ??= artboard.getBoundingClientRect();
    const size = store.get().document.artboard.baseSize;
    let layout = gestureLayout(gesture.original, gesture.start, point(event, gesture.rect), gesture.mode,
      { keepAspect: gesture.type === "image" && !event.shiftKey });
    if (gesture.mode === "move") {
      const snapped = getSnap() && !event.altKey ? snapLayout(layout, size) : null;
      if (snapped) layout = snapped.layout;
      for (const axis of ["x", "y"]) {
        let guide = artboard.querySelector(`.editor-guide-${axis}`);
        const position = snapped?.guides[axis];
        if (!guide && position != null) {
          guide = node("span", { class: `editor-guide editor-guide-${axis}`, "aria-hidden": "true" });
          artboard.append(guide);
        }
        if (guide) {
          guide.hidden = position == null;
          if (position != null) guide.style.translate = axis === "x" ? `${position}px 0` : `0 ${position}px`;
        }
      }
      const delta = `${layout.x - gesture.original.x}px ${layout.y - gesture.original.y}px`;
      gesture.node.style.translate = delta;
      selectionOutline.style.translate = delta;
    } else {
      applyLayout(gesture.node, { ...gesture.model, layout }, size);
      applyLayout(selectionOutline, layout, size);
    }
    gesture.latest = layout;
  }

  artboard.addEventListener(
    "pointermove",
    (event) => {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      const current = gesture;
      current.sample = event;
      if (current.frame) return;
      current.frame = requestAnimationFrame(() => {
        current.frame = 0;
        if (gesture === current) paintGesture(current.sample);
      });
    },
    { signal },
  );
  artboard.addEventListener(
    "pointerup",
    (event) => {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      const current = gesture;
      cancelAnimationFrame(current.frame);
      if (current.sample || event.clientX !== current.clientX || event.clientY !== current.clientY) paintGesture(event);
      gesture = null;
      onGesture?.(false);
      const changed = current.latest && store.update(
          (value) => {
            value.document.elements.find(
              (item) => item.id === current.id,
            ).layout = current.latest;
          },
          t(current.mode === "move" ? "editor.stage.move" : "editor.stage.resize"),
        );
      if (!changed) render();
    },
    { signal },
  );
  const cancelPointer = event => { if (gesture?.pointerId === event.pointerId) cancel(); };
  artboard.addEventListener("pointercancel", cancelPointer, { signal });
  artboard.addEventListener("lostpointercapture", cancelPointer, { signal });
  artboard.addEventListener(
    "click",
    (event) => {
      if (event.target.closest(".editor-inline-text")) return;
      event.preventDefault();
      event.stopPropagation();
    },
    { signal, capture: true },
  );
  return {
    render,
    setZoom,
    cancel,
    editText,
    previewFocal(id, focalPoint) {
      const img = artboard.querySelector(`.editor-stage-element[data-element-id="${CSS.escape(id)}"] img`);
      if (img) applyFocalPoint(img, focalPoint);
    },
    get textDirty() {
      return Boolean(inlineEditor && inlineEditor.field.value !== inlineEditor.original);
    },
    visibleArea() {
      const frame = host.getBoundingClientRect(), board = artboard.getBoundingClientRect();
      const { width, height } = store.get().document.artboard.baseSize;
      const left = Math.min(width - 1, Math.max(0, (frame.left - board.left) / zoom));
      const top = Math.min(height - 1, Math.max(0, (frame.top - board.top) / zoom));
      const right = Math.max(left, Math.min(width, (frame.right - board.left) / zoom));
      const bottom = Math.max(top, Math.min(height, (frame.bottom - board.top) / zoom));
      return { left, top, right, bottom };
    },
    get gestureActive() {
      return Boolean(gesture);
    },
    dispose() {
      disposed = true;
      lifecycle.abort();
      if (gesture) cancelAnimationFrame(gesture.frame);
      gesture = null;
      inlineEditor = null;
      host.replaceChildren();
    },
  };
}
