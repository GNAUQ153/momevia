import { registry } from "../../shared/canvas/index.js";
import { sceneActions } from "./designer-helpers.js";
import { sceneThumbnail } from "./thumbnail.js";
import { node, button } from "./dom.js";
import { icon } from "../../ui/icons.js";

// Khoá cấu trúc chỉ thay đổi khi thứ tự/tên cảnh hoặc loại policy thay đổi.
// Những thay đổi nội dung không thay DOM điều hướng; thumbnail được cập nhật riêng.
export function sceneStructureKey(doc, quickMode, policyKind) {
  return JSON.stringify([
    quickMode,
    policyKind,
    doc.entrySceneId,
    doc.scenes.map(({ id, name }) => [id, name]),
  ]);
}

// Lấy danh sách lớp theo thứ tự hiển thị (trên cùng trước), không sửa Canvas JSON.
export function sceneLayerEntries(doc, sceneId, selection, lockedElements = {}) {
  const scene = doc.scenes.find(item => item.id === sceneId) || doc.scenes[0];
  if (!scene) return [];
  const index = new Map(doc.elements.map(item => [item.id, item]));
  return [...scene.elementIds].reverse().flatMap(id => {
    const item = index.get(id);
    if (!item) return []; // Không dựng nút lỗi cho bản nháp có ID lớp đã mất.
    return [{
      id,
      label: item.name || registry[item.type]?.label || item.type,
      locked: Boolean(item.locked || lockedElements?.[id]),
      hidden: item.visible === false,
      selected: id === selection,
    }];
  });
}

// Panel có cache riêng theo vòng đời Designer; không giữ tham chiếu toàn cục.
export function createSceneLayerPanel({
  main, getDocument, getSceneId, getSelection, getPolicy, isQuickMode, assetUrl, message,
}) {
  const sceneThumbs = new Map();

  function renderLayers() {
    const host = main.querySelector(".editor-layers");
    if (!host) return;
    if (isQuickMode()) {
      host.replaceChildren();
      return;
    }
    const layers = sceneLayerEntries(getDocument(), getSceneId(), getSelection(), getPolicy()?.lockedElements);
    host.replaceChildren(...layers.map(({ id, label, locked, hidden, selected }) => {
      const choice = button(label, "select", {
        "data-id": id,
        class: selected ? "is-selected" : "",
        "aria-pressed": selected,
        "aria-label": message("editor.interface.layerLabel", {
          name: label,
          hidden: hidden ? { format: "message", key: "editor.interface.layerHidden" } : "",
          locked: locked ? { format: "message", key: "editor.interface.layerLocked" } : "",
        }),
      });
      if (hidden || locked) {
        const flags = node("span", { class: "editor-layer-flags", "aria-hidden": "true" });
        flags.innerHTML = (hidden ? icon("eye-off", 15) : "") + (locked ? icon("lock", 15) : "");
        choice.append(flags);
      }
      return choice;
    }));
  }

  function renderScenes() {
    const host = main.querySelector(".editor-scenes");
    if (!host) return;
    const doc = getDocument();
    const quickMode = isQuickMode();
    const sceneId = getSceneId();
    const policy = getPolicy();
    const indexed = quickMode ? null : new Map(doc.elements.map(model => [model.id, model]));
    const structure = sceneStructureKey(doc, quickMode, policy?.kind);
    function updateThumbnail(card, scene) {
      if (quickMode) return;
      const models = scene.elementIds.map(id => indexed.get(id));
      const bindings = models.map(model => doc.bindings[model?.props.textBinding]?.value);
      const signature = JSON.stringify([doc.artboard.baseSize, scene.background, scene.effects?.surface, models, bindings]);
      const cached = sceneThumbs.get(scene.id);
      const thumbnail = cached?.signature === signature
        ? cached.thumbnail : sceneThumbnail(doc, scene, { assetUrl, indexed });
      sceneThumbs.set(scene.id, { signature, thumbnail });
      const current = card.querySelector(".editor-thumbnail");
      if (current === thumbnail) return;
      if (current) current.replaceWith(thumbnail);
      else card.prepend(thumbnail);
    }
    if (host.dataset.structure === structure) {
      for (const [index, wrapper] of [...host.children].entries()) {
        const scene = doc.scenes[index];
        const card = wrapper.firstElementChild;
        const selected = scene.id === sceneId;
        card.classList.toggle("is-selected", selected);
        card.setAttribute("aria-pressed", String(selected));
        updateThumbnail(card, scene);
      }
      return;
    }
    host.dataset.structure = structure;
    for (const id of sceneThumbs.keys()) if (!doc.scenes.some(scene => scene.id === id)) sceneThumbs.delete(id);
    const active = document.activeElement;
    const focusedId = host.contains(active) ? active.closest("[data-scene]")?.dataset.scene : null;
    const openId = host.querySelector("details[open]")?.closest("[data-scene]").dataset.scene;
    const locked = policy?.kind === "creator-template";
    host.replaceChildren(...doc.scenes.map((scene, index) => {
      const entry = scene.id === doc.entrySceneId;
      const selected = scene.id === sceneId;
      const card = button("", "scene-select", {
        "data-id": scene.id, "aria-pressed": selected,
        class: `editor-scene-choice${selected ? " is-selected" : ""}`,
      });
      updateThumbnail(card, scene);
      card.append(node("span", { class: "editor-scene-name" }, scene.name));
      if (entry && !quickMode) card.append(node("span", { class: "editor-scene-entry" }, message("editor.scene.entry")));
      const summary = node("summary", { "aria-label": message("editor.interface.sceneMenu", { name: scene.name }) });
      summary.innerHTML = icon("more", 18);
      const menu = node("details", { class: "editor-scene-menu editor-layout-only" },
        summary,
        node("div", { class: "editor-scene-menu-actions" }, ...sceneActions.map(([, action]) =>
          button(message(`editor.interface.sceneAction.${action}`), action, {
            "data-id": scene.id, disabled:
              action === "scene-up" && index === 0 ||
              action === "scene-down" && index === doc.scenes.length - 1 ||
              action === "scene-entry" && entry ||
              action === "scene-delete" && doc.scenes.length === 1,
          }))));
      menu.open = scene.id === openId;
      return node("div", { class: "editor-scene-card", "data-scene": scene.id }, card, locked ? null : menu);
    }));
    if (focusedId) {
      const card = host.querySelector(`[data-scene="${CSS.escape(focusedId)}"]`);
      const focusTarget = active.matches("summary") ? card?.querySelector("summary") :
        active.dataset.editorAction !== "scene-select" ? card?.querySelector("summary") : card?.firstElementChild;
      focusTarget?.focus({ preventScroll: true });
    }
  }

  return {
    renderLayers,
    renderScenes,
    clear: () => sceneThumbs.clear(),
  };
}
