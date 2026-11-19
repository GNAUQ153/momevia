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
    "aria-label": "Vùng thiết kế. Chọn phần tử hoặc dùng bảng lớp.",
  });
  surround.append(artboard);
  host.replaceChildren(surround);
  let zoom = 1,
    gesture = null,
    disposed = false;
  let selectionOutline, inlineEditor;
  function setZoom(value) {
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
    artboard.setAttribute("aria-label", readOnly ? scene.name : "Vùng thiết kế. Chọn phần tử hoặc dùng bảng lớp.");
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
        item.append(node("span", { class: "editor-unlinked-action" }, "Chọn cảnh đích trong Chỉnh"));
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
  function point(event) {
    return logicalPoint(
      { x: event.clientX, y: event.clientY },
      artboard.getBoundingClientRect(),
      store.get().document.artboard.baseSize,
    );
  }
  function cancel() {
    if (!gesture) return;
    gesture = null;
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
      if (isReadOnly() || event.button !== 0 || event.target.closest(".editor-inline-text")) return;
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
      gesture = {
        id,
        original: structuredClone(element.layout),
        start: point(event),
        pointerId: event.pointerId,
        mode: event.target.closest("[data-editor-resize]") ? "resize" : "move",
        node: artboard.querySelector(`.editor-stage-element[data-element-id="${CSS.escape(id)}"]`),
        type: element.type,
      };
      artboard.setPointerCapture(event.pointerId);
      onGesture?.(true);
    },
    { signal },
  );
  artboard.addEventListener(
    "pointermove",
    (event) => {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      let layout = gestureLayout(
        gesture.original,
        gesture.start,
        point(event),
        gesture.mode,
        { keepAspect: gesture.type === "image" && !event.shiftKey },
      );
      if (gesture.mode === "move" && getSnap() && !event.altKey) {
        const snapped = snapLayout(
          layout,
          store.get().document.artboard.baseSize,
        );
        layout = snapped.layout;
        for (const axis of ["x", "y"]) {
          let guide = artboard.querySelector(`.editor-guide-${axis}`);
          if (!guide) {
            guide = node("span", {
              class: `editor-guide editor-guide-${axis}`,
              "aria-hidden": "true",
            });
            artboard.append(guide);
          }
          guide.hidden = snapped.guides[axis] === null;
          if (!guide.hidden)
            guide.style[axis === "x" ? "left" : "top"] =
              `${snapped.guides[axis]}px`;
        }
      }
      gesture.latest = layout;
      const item = gesture.node;
      item.style.left = `${layout.x}px`;
      item.style.top = `${layout.y}px`;
      item.style.width = `${layout.width}px`;
      item.style.height = `${layout.height}px`;
      item.style.minHeight = `${layout.height}px`;
      applyLayout(selectionOutline, layout, store.get().document.artboard.baseSize);
      if (gesture.type === "sticker")
        applyLayout(item, { type: "sticker", layout }, store.get().document.artboard.baseSize);
    },
    { signal },
  );
  artboard.addEventListener(
    "pointerup",
    (event) => {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      const current = gesture;
      gesture = null;
      onGesture?.(false);
      if (current.latest)
        store.update(
          (value) => {
            value.document.elements.find(
              (item) => item.id === current.id,
            ).layout = current.latest;
          },
          current.mode === "move" ? "Di chuyển" : "Đổi kích thước",
        );
      render();
    },
    { signal },
  );
  artboard.addEventListener("pointercancel", cancel, { signal });
  artboard.addEventListener("lostpointercapture", cancel, { signal });
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
      gesture = null;
      inlineEditor = null;
      host.replaceChildren();
    },
  };
}
