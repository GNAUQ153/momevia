import { validateDocument, runtimeVersionFor } from "../../shared/canvas/schema.js";
import { message, setAttr, setText, t } from "../../core/i18n.js";
import { renderElement, applyLayout } from "./renderer.js";
import { applySurface, createMotion, playAmbience, playElement, playReaction, sceneTransition } from "./effects.js";
export { renderElement, applyLayout, resolveText } from "./renderer.js";

export function mountPlayer(
  root,
  {
    document: input,
    assetUrl,
    mode = "preview",
    replyAdapter,
    onSceneChange = () => {},
    effectPreview,
    runtimeVersion = runtimeVersionFor(input),
  } = {},
) {
  if (runtimeVersion !== runtimeVersionFor(input))
    throw new Error(t("gift.runtime.unsupportedVersion"));
  if (!["preview", "public"].includes(mode))
    throw new Error(t("gift.runtime.invalidMode"));
  const document = validateDocument(input, {
    mode: mode === "public" ? "publish" : "draft",
    requiredBindings: [],
  });
  let activeSceneId = effectPreview?.sceneId || document.entrySceneId,
    disposed = false,
    sceneController = null,
    resizeObserver = null;
  const shell = globalThis.document.createElement("div");
  shell.className = `gift-runtime gift-runtime-mode-${mode}`;
  shell.style.maxWidth = `${document.responsive.desktop.maxContentWidth}px`;
  const marker = globalThis.document.createElement("p");
  marker.className = "gift-runtime-mode-label";
  setText(marker, mode === "preview" ? message("gift.player.previewMode") : "");
  const status = globalThis.document.createElement("p");
  status.className = "gift-runtime-status";
  status.setAttribute("role", "status");
  const stage = globalThis.document.createElement("section");
  stage.className = "gift-runtime-stage";
  stage.tabIndex = -1;
  const navigation = globalThis.document.createElement("nav");
  navigation.className = "gift-runtime-navigation";
  setAttr(navigation, "aria-label", message("gift.player.scenes"));
  const lifetime = new AbortController();
  const preference = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
  let motionOff = false;
  const motion = createMotion(() => !preference.matches && !motionOff);
  const motionControl = globalThis.document.createElement("button");
  motionControl.type = "button";
  motionControl.className = "gift-motion-control";
  setText(motionControl, message("gift.player.motion"));
  const updateMotionControl = () => {
    motionControl.setAttribute("aria-pressed", String(!motion.enabled()));
    motionControl.disabled = preference.matches;
    if (!motion.enabled()) motion.cancel();
  };
  motionControl.addEventListener("click", () => {
    motionOff = !motionOff;
    updateMotionControl();
  }, {signal:lifetime.signal});
  preference.addEventListener("change", updateMotionControl, {signal:lifetime.signal});
  updateMotionControl();
  shell.append(marker, stage, navigation, status);
  if (document.schemaVersion === 2 && (document.scenes.some(scene => scene.effects) || document.elements.some(element => element.effects)))
    shell.insertBefore(motionControl, stage);
  root.replaceChildren(shell);
  const size = document.artboard.baseSize;
  const render = ({ focus = true } = {}) => {
    if (disposed) return;
    sceneController?.abort();
    const signal = (sceneController = new AbortController()).signal;
    resizeObserver?.disconnect();
    const scene = document.scenes.find((s) => s.id === activeSceneId);
    const family = effectPreview?.family;
    const transition = ((!family && focus) || family === "transition") ? scene.effects?.transition : null;
    let previous;
    if (transition && motion.enabled()) {
      previous = globalThis.document.createElement("div");
      previous.style.backgroundColor = stage.style.backgroundColor || scene.background.color;
      if (stage.offsetHeight) previous.style.height = `${stage.offsetHeight}px`;
      for (const child of [...stage.children]) {
        if (!child.hasAttribute("data-runtime-element")) continue;
        child.removeAttribute("data-runtime-element");
        previous.append(child);
      }
    }
    stage.replaceChildren();
    stage.style.backgroundColor = scene.background.color;
    applySurface(stage, scene.effects?.surface);
    stage.setAttribute("aria-label", scene.name);
    const nodes = [];
    // Layer order changes stacking, while document order preserves reading and Tab.
    const sceneIds = new Set(scene.elementIds);
    for (const model of document.elements.filter((e) => sceneIds.has(e.id))) {
      if (model.visible === false) continue;
      const node = renderElement(model, {
        document,
        assetUrl,
        mode,
        replyAdapter,
        signal, motion,
        previewFamily: family,
        onAction: (actions) => {
          const [action] = actions;
          if (action?.type === "replay") goToScene(document.entrySceneId);
          else if (action?.targetSceneId) goToScene(action.targetSceneId);
        },
      });
      node.style.zIndex = String(scene.elementIds.indexOf(model.id));
      nodes.push({ model, node });
      stage.append(node);
    }
    const layout = () => {
      if (disposed) return;
      const scale = Math.max(0.01, stage.clientWidth / size.width);
      // Intentional overlaps form a cohort. Preserve every position inside it;
      // only overflow beyond its original bottom pushes later disjoint cohorts.
      let shift = 0,
        actualEnd = 0;
      const content = nodes
        .filter(
          ({ model }) => !["shape", "line", "sticker"].includes(model.type),
        )
        .sort((a, b) => a.model.layout.y - b.model.layout.y);
      for (const { model, node } of nodes) {
        applyLayout(node, model, size, { responsive: true, scale });
        if (model.type === "text") {
          node.style.fontSize = `${Math.max(16, (model.props.fontSize || 24) * scale)}px`;
          node.style.height = "auto";
        }
        if (["reply", "interaction"].includes(model.type) || (model.type === "image" && model.props.caption))
          node.style.height = "auto";
      }
      const cohorts = [];
      for (const item of content) {
        const { y, height } = item.model.layout;
        const previous = cohorts.at(-1);
        if (previous && y < previous.logicalEnd) {
          previous.items.push(item);
          previous.logicalEnd = Math.max(previous.logicalEnd, y + height);
        } else cohorts.push({ items: [item], logicalEnd: y + height });
      }
      const stageTop = stage.getBoundingClientRect().top;
      for (const cohort of cohorts) {
        let cohortBottom = -Infinity;
        for (const { model, node } of cohort.items) {
          const top = model.layout.y * scale + shift;
          node.style.top = `${top}px`;
          cohortBottom = Math.max(cohortBottom, node.getBoundingClientRect().bottom - stageTop);
        }
        actualEnd = Math.max(actualEnd, cohortBottom);
        shift += Math.max(0, cohortBottom - (cohort.logicalEnd * scale + shift));
      }
      stage.style.minHeight = `${Math.max(size.height * scale, actualEnd + 24)}px`;
    };
    layout();
    const transitionDone = sceneTransition(stage, previous, transition, motion, signal);
    if (!family || family === "ambience") void playAmbience(stage, scene.effects?.ambience, motion, signal);
    for (const {node,model} of nodes) {
      if (!family || (effectPreview.elementId === model.id && ["emphasis","entrance"].includes(family))) {
        const animate = () => { if (!signal.aborted) return playElement(node,model,motion,signal,family); };
        if (transitionDone) void transitionDone.then(animate);
        else void animate();
      }
      if (family === "reaction" && effectPreview.elementId === model.id) {
        const control = node.matches("button") ? node : node.querySelector("button");
        if (control) {
          if (model.effects?.reaction?.id === "R04") control.click();
          else void playReaction(control,model.effects?.reaction,motion,signal);
        }
      }
    }
    if (globalThis.ResizeObserver) {
      resizeObserver = new ResizeObserver(layout);
      resizeObserver.observe(stage);
      for (const { node, model } of nodes)
        if (["text", "reply", "interaction"].includes(model.type) || (model.type === "image" && model.props.caption))
          resizeObserver.observe(node);
    }
    navigation.replaceChildren();
    for (const [i, s] of document.scenes.entries()) {
      const button = globalThis.document.createElement("button");
      button.type = "button";
      button.textContent = `${i + 1}. ${s.name}`;
      button.setAttribute(
        "aria-current",
        s.id === activeSceneId ? "step" : "false",
      );
      button.addEventListener("click", () => goToScene(s.id), {
        signal: sceneController.signal,
      });
      navigation.append(button);
    }
    setText(status, message("gift.player.scenePosition", {
      index: document.scenes.indexOf(scene) + 1, total: document.scenes.length, name: scene.name,
    }));
    onSceneChange(scene.id);
    if (focus) {
      const target = stage.querySelector("h1,h2,h3,h4,h5,h6");
      if (target) {
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
      } else stage.focus({ preventScroll: true });
    }
  };
  function goToScene(id) {
    if (!document.scenes.some((s) => s.id === id) || disposed) return;
    activeSceneId = id;
    render();
  }
  render({ focus: false });
  return {
    reset() {
      goToScene(document.entrySceneId);
    },
    goToScene,
    get sceneId() {
      return activeSceneId;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      lifetime.abort();
      sceneController?.abort();
      resizeObserver?.disconnect();
      root.replaceChildren();
    },
  };
}
