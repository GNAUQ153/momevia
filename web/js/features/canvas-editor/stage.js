import { message, setAttr, t } from "../../core/i18n.js";
import { renderElement, applyLayout, resolveText, applyFocalPoint, textFont, applyStationerySurface } from "../gift-runtime/renderer.js";
import { applySurface, createMotion, playElement } from "../gift-runtime/effects.js";
import { logicalPoint, gestureLayout, snapLayout } from "./store.js";
import { node } from "./dom.js";
import { createEditorSceneMotion } from './scene-motion.js';
import { stationeryFlow } from '../../shared/canvas/stationery-flow.js';
import { groupMembers } from '../../shared/canvas/element-groups.js';
import { applyGroupLayout, dragGroupCorner, groupLayout, transformedLayout } from './group-layout.js';

export function createStage(
  host,
  {
    store,
    getSceneId,
    getSelection,
    getSelections = () => [getSelection()],
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
    'aria-keyshortcuts':'Delete Backspace Control+x Control+c Control+v Control+d Control+a Control+z Control+y Control+s',
  });
  surround.append(artboard);
  host.replaceChildren(surround);
  let zoom = 1, displayHeight = store.get().document.artboard.baseSize.height,
    gesture = null,
    disposed = false;
  let selectionOutline, inlineEditor, renderLifecycle;
  let displayLayouts = new Map();
  const preference=globalThis.matchMedia('(prefers-reduced-motion: reduce)');
  const sceneMotion = createEditorSceneMotion(artboard, { signal, preference });
  const motion=createMotion(()=>!preference.matches&&!disposed);
  const loopPhases=new Map(),effectSignatures=new WeakMap();
  const entered=new Map();let lastSceneId=null;
  signal.addEventListener('abort',()=>{renderLifecycle?.abort();motion.cancel();},{once:true});
  preference.addEventListener('change',()=>{motion.cancel();loopPhases.clear();render();},{signal});
  const visibility=()=>globalThis.document.hidden?motion.pause():motion.resume();
  globalThis.document.addEventListener('visibilitychange',visibility,{signal});visibility();
  function setZoom(value) {
    if (gesture && value !== zoom) gesture.rect = null;
    zoom = value;
    const size = store.get().document.artboard.baseSize;
    artboard.style.width = `${size.width}px`;
    artboard.style.height = `${displayHeight}px`;
    artboard.style.transform = `scale(${zoom})`;
    surround.style.width = `${size.width * zoom}px`;
    surround.style.height = `${displayHeight * zoom}px`;
  }
  function render() {
    if (disposed || signal.aborted || gesture || inlineEditor) return;
    const currentModels=new Map(store.get().document.elements.map(e=>[e.id,e]));
    for(const item of artboard.querySelectorAll('.editor-stage-element')){
      const model=currentModels.get(item.dataset.elementId);
      if(!model)continue;
      for(const layer of item.querySelectorAll('[data-motion-row]')){
        const row=model.motions?.rows.find(r=>r.id===layer.dataset.motionRow),key=item.dataset.elementId+':'+layer.dataset.motionRow+':'+layer.dataset.motionTrack;
        const animation=layer.getAnimations()[0];
        if(!row||JSON.stringify(row)!==layer.dataset.motionSignature)loopPhases.delete(key);
        else if(animation?.currentTime!=null)loopPhases.set(key,{time:animation.currentTime,at:performance.now(),running:animation.playState==='running',signature:layer.dataset.motionSignature});
      }
      const signature=JSON.stringify(model.effects||{}),animation=model.effects?.emphasis?.definition?.animation.iterations==='infinite'?(item.querySelector('[data-motion-family="emphasis"]')||item).getAnimations().find(a=>!a.animationName&&a.effect?.getTiming().iterations===Infinity):null;
      if(signature!==effectSignatures.get(item))loopPhases.delete(item.dataset.elementId);
      else if(animation?.currentTime!=null)loopPhases.set(item.dataset.elementId,{time:animation.currentTime,at:performance.now(),running:animation.playState==='running',signature});
    }
    for(const id of loopPhases.keys())if(!currentModels.has(id.split(':')[0]))loopPhases.delete(id);
    renderLifecycle?.abort();renderLifecycle=new AbortController();
    const doc = store.get().document,
      scene =
        doc.scenes.find((item) => item.id === getSceneId()) || doc.scenes[0];
    if(lastSceneId!==scene.id){loopPhases.clear();entered.clear();lastSceneId=scene.id;}
    motion.cancel();
    artboard.replaceChildren();
    selectionOutline = null;
    artboard.style.backgroundColor = scene.background.color;
    applySurface(artboard, scene.effects?.surface);
    const readOnly = isReadOnly();
    setAttr(artboard, "aria-label", readOnly ? scene.name : message("editor.stage.edit"));
    const selectedIds = new Set(readOnly ? [] : [...getSelections(), getSelection()]);
    const outlines = new Map();
    for (const element of doc.elements.filter((item) => scene.elementIds.includes(item.id))) {
      if (readOnly && element.visible === false) continue;
      const id = element.id;
      const item = renderElement(element, {
        document: doc,
        assetUrl,
        mode: "editor",
        signal:renderLifecycle.signal,
      });
      applyLayout(item, element, doc.artboard.baseSize, { responsive: false });
      item.style.zIndex = String(scene.elementIds.indexOf(id));
      item.dataset.elementId = id;
      effectSignatures.set(item,JSON.stringify(element.effects||{}));
      item.classList.add("editor-stage-element");
      item.setAttribute("tabindex", "-1");
      if (!readOnly && element.actions?.some(action => action.type === "goToScene" && !action.targetSceneId))
        item.append(node("span", { class: "editor-unlinked-action" }, message("editor.stage.missingTarget")));
      const key = element.groupId || id;
      if (selectedIds.has(id) && (!outlines.has(key) || id === getSelection())) outlines.set(key, element);
      artboard.append(item);
      if(element.visible!==false&&(element.opacity??1)>0&&(element.effects||element.motions)){
        const currentSignal=renderLifecycle.signal;
        void Promise.all([...item.querySelectorAll('img')].map(img=>img.decode().catch(()=>{}))).then(()=>{
          if(!currentSignal.aborted&&item.isConnected&&!gesture&&!inlineEditor){
            const phase=loopPhases.get(id),resume=phase?.signature===effectSignatures.get(item),entranceSignature=JSON.stringify(element.effects?.entrance||null),alreadyEntered=element.motions&&entered.get(id)===entranceSignature;
            const playing=playElement(item,element,motion,currentSignal,resume||alreadyEntered?'emphasis':undefined);entered.set(id,entranceSignature);
            const animation=(item.querySelector('[data-motion-family="emphasis"]')||item).getAnimations().find(a=>!a.animationName&&a.effect?.getTiming().iterations===Infinity);
            if(animation&&resume)animation.currentTime=phase.time+(phase.running?performance.now()-phase.at:0);
            for(const layer of item.querySelectorAll('[data-motion-row]')){
              const saved=loopPhases.get(id+':'+layer.dataset.motionRow+':'+layer.dataset.motionTrack),a=layer.getAnimations()[0];
              if(a&&saved?.signature===layer.dataset.motionSignature)a.currentTime=saved.time+(saved.running?performance.now()-saved.at:0);
            }
            return playing;
          }
        });
      }
    }
    const selections = [...outlines.values()].map(element => {
      const members = groupMembers(doc.elements, element);
      const outline = node("span", { class: "editor-selection-outline", "data-element-id": element.id, "aria-hidden": "true" });
      outline.style.zIndex = String(scene.elementIds.length);
      if (!members.some(member => member.locked || isLayoutLocked(member.id)))
        outline.append(node("span", { class: "editor-resize-handle", "data-editor-resize": "true" }));
      artboard.append(outline);
      if (element.id === getSelection()) selectionOutline = outline;
      return { members, outline };
    });
    const applyFlow = () => {
      if (gesture) return;
      displayHeight = doc.artboard.baseSize.height;
      displayLayouts = new Map();
      if (scene.flow) {
        artboard.style.transitionProperty='none';
        const items = artboard.querySelectorAll('.editor-stage-element');
        for (const item of items) {
          item.style.transitionProperty='none';
          item.style.overflowWrap='anywhere';
          const model = currentModels.get(item.dataset.elementId);
          if (model) applyLayout(item, model, doc.artboard.baseSize);
        }
        const heights = new Map([...artboard.querySelectorAll('.editor-stage-element.gift-runtime-text')].map(item => [item.dataset.elementId, item.scrollHeight]));
        const flow = stationeryFlow(scene, doc.elements, heights);
        displayLayouts = flow.layouts;
        for (const item of items) {
          const layout = flow.layouts.get(item.dataset.elementId);
          if (layout) applyLayout(item, layout, doc.artboard.baseSize);
          if(flow.surfaces.has(item.dataset.elementId))applyStationerySurface(item);
        }
        displayHeight += flow.growth;
      }
      for (const { members, outline } of selections) applyLayout(outline, groupLayout(members, displayLayouts), doc.artboard.baseSize);
      setZoom(zoom);
    };
    applyFlow();
    if (scene.flow) {
      const active = renderLifecycle.signal;
      globalThis.document.fonts?.ready.then(()=>{if(!active.aborted&&!disposed)applyFlow();});
    }
    sceneMotion.sync(scene.id);
  }
  function point(event, rect) {
    return logicalPoint(
      { x: event.clientX, y: event.clientY },
      rect,
      { ...store.get().document.artboard.baseSize, height: displayHeight },
    );
  }
  function cancel() {
    if (!gesture) return;
    const { pointerId, frame } = gesture;
    gesture = null;
    motion.resume();
    cancelAnimationFrame(frame);
    if (artboard.hasPointerCapture(pointerId)) artboard.releasePointerCapture(pointerId);
    onGesture?.(false);
    render();
  }
  function finishText(save, focus = false) {
    if (!inlineEditor) return;
    const { field, id, original } = inlineEditor;
    inlineEditor = null;
    motion.resume();
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
    applyLayout(field, displayLayouts.get(id) || model.layout, doc.artboard.baseSize);
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
    motion.pause();
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
      const additive=event.shiftKey||event.ctrlKey||event.metaKey;
      select(id,{additive});if(additive){event.preventDefault();return;}
      const elements = store.get().document.elements;
      const element = elements.find(item => item.id === id);
      const members = groupMembers(elements, element);
      if (!members.length || members.some(member => member.locked || isLayoutLocked(member.id))) return;
      event.preventDefault();
      artboard.focus({ preventScroll: true });
      const rect = artboard.getBoundingClientRect();
      gesture = {
        id,
        original: groupLayout(members),
        members,
        start: point(event, rect),
        clientX: event.clientX,
        clientY: event.clientY,
        rect,
        pointerId: event.pointerId,
        sequence: store.sequence,
        mode: event.target.closest("[data-editor-resize]") ? "resize" : "move",
        nodes: members.map(member => artboard.querySelector(`.editor-stage-element[data-element-id="${CSS.escape(member.id)}"]`)),
        type: element.type,
      };
      motion.pause();
      for (const item of gesture.nodes) for (const animation of item.getAnimations({subtree:true})) animation.pause();
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
    const current = point(event, gesture.rect);
    let layout = gesture.mode === 'resize' && gesture.members.length > 1
      ? dragGroupCorner(gesture.members, gesture.original, current.x - gesture.start.x, current.y - gesture.start.y)
      : gestureLayout(gesture.original, gesture.start, current, gesture.mode, { keepAspect: gesture.type === "image" && !event.shiftKey });
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
      for (const item of gesture.nodes) item.style.translate = delta;
      selectionOutline.style.translate = delta;
    } else {
      const painted = new Map();
      gesture.members.forEach((member, index) => {
        const original = member.layout, display = displayLayouts.get(member.id);
        const next = gesture.members.length > 1 ? transformedLayout(original, gesture.original, layout) : layout;
        const box = display ? { ...next, y: next.y + display.y - original.y, height: next.height * display.height / original.height } : next;
        painted.set(member.id, box);
        applyLayout(gesture.nodes[index], { ...member, layout: box }, size);
      });
      applyLayout(selectionOutline, groupLayout(gesture.members, painted), size);
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
      motion.resume();
      onGesture?.(false);
      const changed = current.latest && current.sequence === store.sequence && store.update(
          (value) => {
            const elements = value.document.elements;
            const members = groupMembers(elements, elements.find(item => item.id === current.id));
            if (members.length === current.members.length && members.every(member => !member.locked && !isLayoutLocked(member.id)))
              applyGroupLayout(members, current.original, current.latest);
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
    playMotions(rowId){
      if(!rowId){loopPhases.clear();motion.cancel();}
      else for(const item of artboard.querySelectorAll('.editor-stage-element'))if(item.dataset.elementId===getSelection()){
        for(const layer of item.querySelectorAll('[data-motion-row]'))if(layer.dataset.motionRow===rowId){loopPhases.delete(item.dataset.elementId+':'+rowId+':'+layer.dataset.motionTrack);layer.getAnimations().forEach(a=>a.cancel());}
      }
      render();
    },
    setZoom,
    cancel,
    editText,
    flushText(){if(inlineEditor&&inlineEditor.field.value!==inlineEditor.original){inlineEditor.original=inlineEditor.field.value;onTextChange(inlineEditor.id,inlineEditor.field.value);}},
    previewFocal(id, focalPoint) {
      const img = artboard.querySelector(`.editor-stage-element[data-element-id="${CSS.escape(id)}"] img`);
      if (img) applyFocalPoint(img, focalPoint);
    },
    get textDirty() {
      return Boolean(inlineEditor && inlineEditor.field.value !== inlineEditor.original);
    },
    visibleArea() {
      const frame = host.getBoundingClientRect(), board = artboard.getBoundingClientRect();
      const { width } = store.get().document.artboard.baseSize;
      const height = displayHeight;
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
      if (disposed) return;
      disposed = true;
      lifecycle.abort();
      if (gesture) {
        const { frame, pointerId } = gesture;
        gesture = null;
        cancelAnimationFrame(frame);
        if (artboard.hasPointerCapture(pointerId)) artboard.releasePointerCapture(pointerId);
        onGesture?.(false);
      }
      // Không lưu text khi hủy Stage; luồng flush/recovery vẫn do Editor quản lý.
      inlineEditor = null;
      loopPhases.clear();
      entered.clear();
      // Chỉ xóa DOM của Stage này, không xóa Stage mới trong cùng host.
      surround.remove();
    },
  };
}
