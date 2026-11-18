import { renderElement, applyLayout } from "../gift-runtime/index.js";
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
    if (disposed || gesture) return;
    const doc = store.get().document,
      scene =
        doc.scenes.find((item) => item.id === getSceneId()) || doc.scenes[0];
    artboard.replaceChildren();
    artboard.style.backgroundColor = scene.background.color;
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
      item.style.zIndex = String(selected ? scene.elementIds.length + 1 : scene.elementIds.indexOf(id));
      item.dataset.elementId = id;
      item.classList.add("editor-stage-element");
      item.setAttribute("tabindex", "-1");
      if (element.visible === false)
        item.classList.add("editor-element-hidden");
      if (selected) {
        item.classList.add("editor-selected");
        item.append(
          node("span", {
            class: "editor-resize-handle",
            "data-editor-resize": "true",
            "aria-hidden": "true",
          }),
        );
      }
      artboard.append(item);
    }
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
  artboard.addEventListener(
    "pointerdown",
    (event) => {
      if (isReadOnly() || event.button !== 0) return;
      const target = event.target.closest("[data-element-id]");
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
        node: artboard.querySelector(`[data-element-id="${CSS.escape(id)}"]`),
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
      event.preventDefault();
      event.stopPropagation();
    },
    { signal, capture: true },
  );
  return {
    render,
    setZoom,
    cancel,
    get gestureActive() {
      return Boolean(gesture);
    },
    dispose() {
      disposed = true;
      lifecycle.abort();
      gesture = null;
      host.replaceChildren();
    },
  };
}
