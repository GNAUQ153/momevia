import { validateDocument, runtimeVersionFor } from "../../shared/canvas/schema.js";
import { message, setAttr, setText, t } from "../../core/i18n.js";
import { focusVisibleTarget } from "../../core/motion.js";
import { renderElement, applyLayout, updateElementCopy } from "./renderer.js";
import { applySurface, createMotion, playAmbience, playElement, playReaction, sceneTransition } from "./effects.js";
import { playCelebrations } from './celebrations.js';
import { createSceneNavigation } from './scene-navigation.js';
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
  let document = validateDocument(input, {
    mode: mode === "public" ? "publish" : "draft",
    requiredBindings: [],
  });
  let activeSceneId = effectPreview?.sceneId || document.entrySceneId,
    disposed = false,
    sceneController = null,
    resizeObserver = null,
    navigationIntent = null;
  const shell = globalThis.document.createElement("div");
  shell.className = `gift-runtime gift-runtime-mode-${mode}`;
  if(effectPreview?.family)shell.dataset.effectPreview=effectPreview.family;
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
  const progress = globalThis.document.createElement("progress");
  progress.className = "gift-runtime-progress";
  setAttr(progress, "aria-label", message("gift.player.progressLabel"));
  const lifetime = new AbortController();
  const sceneNavigation = createSceneNavigation(navigation, progress, {
    onSelect: id => requestScene(id),
    signal: lifetime.signal,
  });
  const preference = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
  let motionOff = false, resumeCelebrations = () => {};
  const motion = createMotion(() => !preference.matches && !motionOff);
  const motionControl = globalThis.document.createElement("button");
  motionControl.type = "button";
  motionControl.className = "gift-motion-control";
  setText(motionControl, message("gift.player.motion"));
  const toolbar = globalThis.document.createElement("div");
  toolbar.className = "gift-motion-toolbar";
  const skip = globalThis.document.createElement("button");
  skip.type = "button";
  skip.className = "gift-typewriter-skip";
  skip.hidden = true;
  setText(skip, message("gift.player.skipTyping"));
  const typewriters = new Set();
  skip.addEventListener("click", () => typewriters.forEach(finish => finish()), { signal: lifetime.signal });
  toolbar.append(motionControl, skip);
  const updateMotionControl = () => {
    shell.dataset.motion=motion.enabled()?"on":"off";
    motionControl.setAttribute("aria-pressed", String(!motion.enabled()));
    motionControl.disabled = preference.matches;
    if (!motion.enabled()) motion.cancel();
    else resumeCelebrations();
  };
  motionControl.addEventListener("click", () => {
    motionOff = !motionOff;
    updateMotionControl();
  }, {signal:lifetime.signal});
  preference.addEventListener("change", updateMotionControl, {signal:lifetime.signal});
  updateMotionControl();
  const syncVisibility=()=>{shell.dataset.visibility=globalThis.document.hidden?'hidden':'visible';if(globalThis.document.hidden)motion.pause();else motion.resume();};
  globalThis.document.addEventListener('visibilitychange',syncVisibility,{signal:lifetime.signal});syncVisibility();
  shell.append(marker, stage, progress, navigation, status);
  if (document.schemaVersion === 2 && (document.scenes.some(scene => scene.effects) || document.elements.some(element => element.effects)))
    shell.insertBefore(toolbar, stage);
  root.replaceChildren(shell);
  const size = document.artboard.baseSize;
  let sceneContent;
  function syncSceneCopy() {
    const scene = document.scenes.find(s => s.id === activeSceneId);
    stage.setAttribute("aria-label", scene.name);
    sceneNavigation.sync(document.scenes, activeSceneId);
    setText(status, message("gift.player.scenePosition", {
      index: document.scenes.indexOf(scene) + 1, total: document.scenes.length, name: scene.name,
    }));
  }
  const render = ({ focus = true } = {}) => {
    if (disposed) return;
    sceneController?.abort();
    const signal = (sceneController = new AbortController()).signal;
    stage.inert = false;
    resizeObserver?.disconnect();
    const scene = document.scenes.find((s) => s.id === activeSceneId);
    const family = effectPreview?.family;
    const transition = ((!family && focus) || family === "transition") ? scene.effects?.transition : null;
    let previous;
    if (transition && motion.enabled()) {
      previous = sceneContent || globalThis.document.createElement("div");
      previous.style.backgroundColor = stage.style.backgroundColor || scene.background.color;
      if (stage.offsetHeight) previous.style.height = `${stage.offsetHeight}px`;
      for (const child of previous.children) child.removeAttribute("data-runtime-element");
    }
    sceneContent = globalThis.document.createElement("div");
    sceneContent.className = "gift-scene-content";
    stage.replaceChildren(sceneContent);
    stage.style.backgroundColor = scene.background.color;
    applySurface(stage, scene.effects?.surface);
    const nodes = [];
    let firstContentPhoto = true;
    // Layer order changes stacking, while document order preserves reading and Tab.
    const sceneIds = new Set(scene.elementIds);
    for (const model of document.elements.filter((e) => sceneIds.has(e.id))) {
      if (model.visible === false) continue;
      const imagePriority = firstContentPhoto && model.type === "image" &&
        Boolean(model.props?.assetId) && model.accessibility?.decorative !== true;
      if (imagePriority) firstContentPhoto = false;
      const node = renderElement(model, {
        document,
        imagePriority,
        assetUrl,
        mode,
        replyAdapter,
        signal, motion,
        previewFamily: family,
        onAction: (actions, react) => {
          const [action] = actions;
          if (action?.type === "replay") requestScene(document.entrySceneId, react);
          else if (action?.targetSceneId) requestScene(action.targetSceneId, react);
        },
      });
      node.style.zIndex = String(scene.elementIds.indexOf(model.id));
      nodes.push({ model, node });
      sceneContent.append(node);
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
    const transitionDone = sceneTransition(stage, sceneContent, previous, transition, motion, signal);
    if (transitionDone) stage.inert = true;
    resumeCelebrations = () => {};
    if (!family || family === 'ambience') {
      const target = effectPreview?.celebrationId;
      const settings = target ? { [target]: scene.effects?.celebrations?.[target] } : scene.effects?.celebrations;
      const ambience = scene.effects?.ambience;
      if (!target && ambience && !Object.hasOwn(settings || {}, ambience.id)) void playAmbience(stage, ambience, motion, signal);
      let stop = () => {};
      resumeCelebrations = () => {
        stop();
        if (!signal.aborted && !disposed) stop = playCelebrations(stage, settings, motion, signal);
      };
      resumeCelebrations();
    }
    for (const {node,model} of nodes) {
      if (!family || (effectPreview.elementId === model.id && ["emphasis","entrance"].includes(family))) {
        const animate = () => {
          if (signal.aborted) return;
          return playElement(node, model, motion, signal, family, (finish, text) => {
            typewriters.add(finish);
            skip.hidden = false;
            return () => {
              typewriters.delete(finish);
              if (typewriters.size) return;
              if (!signal.aborted && globalThis.document.activeElement === skip) {
                text.tabIndex = -1;
                text.focus({ preventScroll: true });
              }
              skip.hidden = true;
            };
          });
        };
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
    syncSceneCopy();
    onSceneChange(scene.id);
    const finish = () => {
      if (signal.aborted) return;
      stage.inert = false;
      if (focus) focusVisibleTarget(stage.querySelector("h1,h2,h3,h4,h5,h6") || stage, { reduce: !motion.enabled() });
    };
    if (transitionDone) void transitionDone.then(finish);
    else finish();
  };
  function requestScene(id, react) {
    if (!document.scenes.some((s) => s.id === id) || disposed) return;
    navigationIntent?.abort();
    const intent = navigationIntent = new AbortController();
    const commit = () => {
      if (intent.signal.aborted || navigationIntent !== intent || disposed) return;
      navigationIntent = null;
      activeSceneId = id;
      render();
    };
    const reaction = react?.(intent.signal);
    if (reaction) void reaction.then(commit);
    else commit();
  }
  const goToScene = id => requestScene(id);
  render({ focus: false });
  return {
    reset() {
      goToScene(document.entrySceneId);
    },
    goToScene,
    updatePreviewCopy(localized) {
      if (disposed || mode !== "preview") return;
      document = localized;
      const elements = new Map(localized.elements.map(model => [model.id, model]));
      for (const node of stage.querySelectorAll("[data-runtime-element]")) {
        const model = elements.get(node.dataset.runtimeElement);
        if (model) updateElementCopy(node, model, localized);
      }
      syncSceneCopy();
    },
    get sceneId() {
      return activeSceneId;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      lifetime.abort();
      navigationIntent?.abort();
      sceneController?.abort();
      resizeObserver?.disconnect();
      root.replaceChildren();
    },
  };
}
