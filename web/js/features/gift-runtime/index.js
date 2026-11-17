import { validateDocument } from "../../shared/canvas/index.js";
import { renderElement, applyLayout } from "./renderer.js";
export { renderElement, applyLayout, resolveText } from "./renderer.js";

export const RUNTIME_VERSION = 1;

export function mountPlayer(
  root,
  {
    document: input,
    assetUrl,
    mode = "preview",
    replyAdapter,
    onSceneChange = () => {},
    runtimeVersion = 1,
  } = {},
) {
  if (runtimeVersion !== RUNTIME_VERSION)
    throw new Error("Phiên bản trình phát chưa được hỗ trợ.");
  if (!["preview", "public"].includes(mode))
    throw new Error("Chế độ trình phát không hợp lệ.");
  const document = validateDocument(input, {
    mode: mode === "public" ? "publish" : "draft",
  });
  let activeSceneId = document.entrySceneId,
    disposed = false,
    sceneController = null,
    resizeObserver = null;
  const shell = globalThis.document.createElement("div");
  shell.className = `gift-runtime gift-runtime-mode-${mode}`;
  shell.style.maxWidth = `${document.responsive.desktop.maxContentWidth}px`;
  const marker = globalThis.document.createElement("p");
  marker.className = "gift-runtime-mode-label";
  marker.textContent =
    mode === "preview" ? "Đang xem thử · lời đáp được mô phỏng" : "";
  const status = globalThis.document.createElement("p");
  status.className = "gift-runtime-status";
  status.setAttribute("role", "status");
  const stage = globalThis.document.createElement("section");
  stage.className = "gift-runtime-stage";
  stage.tabIndex = -1;
  const navigation = globalThis.document.createElement("nav");
  navigation.className = "gift-runtime-navigation";
  navigation.setAttribute("aria-label", "Các cảnh của món quà");
  shell.append(marker, stage, navigation, status);
  root.replaceChildren(shell);
  const size = document.artboard.baseSize;
  const render = ({ focus = true } = {}) => {
    if (disposed) return;
    sceneController?.abort();
    sceneController = new AbortController();
    resizeObserver?.disconnect();
    const scene = document.scenes.find((s) => s.id === activeSceneId);
    stage.replaceChildren();
    stage.style.backgroundColor = scene.background.color;
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
        signal: sceneController.signal,
        onAction: (actions) => {
          for (const action of actions) {
            if (action.type === "replay") goToScene(document.entrySceneId);
            else if (action.targetSceneId) goToScene(action.targetSceneId);
          }
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
        if (model.type === "reply") node.style.height = "auto";
        if (model.type === "sticker")
          node.style.fontSize = `${Math.max(20, Math.min(model.layout.width, model.layout.height) * scale * 0.8)}px`;
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
    if (globalThis.ResizeObserver) {
      resizeObserver = new ResizeObserver(layout);
      resizeObserver.observe(stage);
      for (const { node, model } of nodes)
        if (["text", "reply"].includes(model.type))
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
    status.textContent = `Cảnh ${document.scenes.indexOf(scene) + 1} / ${document.scenes.length}: ${scene.name}`;
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
      sceneController?.abort();
      resizeObserver?.disconnect();
      root.replaceChildren();
    },
  };
}
