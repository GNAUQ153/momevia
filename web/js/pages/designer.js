import {
  createElement,
  registry,
  validateDocument,
  insertPhotoFrame,
  isPhotoFrame,
  assetIds,
  createDocument,
  PRESETS,
  LIMITS,
} from "../shared/canvas/index.js";
import { mountPlayer } from "../features/gift-runtime/index.js";
import { requiresCanvasV2 } from "../shared/canvas/schema.js";
import { lines, masks, shapes } from "../shared/canvas/artwork.js";
import { eventTimeFromLocal, interactionKinds, localEventTime, photoSlots } from "../shared/canvas/interactions.js";
import { effectFamilies, effectsFor, elementEffectFamilies, sceneEffectFamilies } from "../shared/canvas/effects.js";
import { textFont } from "../features/gift-runtime/renderer.js";
import { bindingLabels, clearTemplateBindingDefaults, lockedVisibleNames, visibleBindingKeys } from "../shared/canvas/personalization.js";
import { submissionChanges } from "../shared/canvas/submission.js";
import { giftLinkDescription } from "../shared/gift-permissions.js";
import { framePhoto, MEMORY_TEMPLATE_ID, memoryGreetingStarters } from "../shared/canvas/basic-templates.js";
import { materializeTemplateStart } from '../features/canvas-editor/template-start.js';
import { createEditorStore } from "../features/canvas-editor/store.js";
import { createSaveSession } from "../features/canvas-editor/session.js";
import { createStage } from "../features/canvas-editor/stage.js";
import { applyFabricWorkspacePatch } from "../features/canvas-editor/fabric-workspace.js";
import { sceneThumbnail, thumbnail } from "../features/canvas-editor/thumbnail.js";
import { bounds, catalog, fillPolaroid, isPolaroidPlaceholder, placeBlock, sampleBindings, stickerNames } from "../features/canvas-editor/library.js";
import { addRecent, discoveryModes, filteredIds, readRecent, recentKey } from "../features/canvas-editor/library-discovery.js";
import { cropEditor } from "../features/canvas-editor/crop.js";
import { canOpenAdvancedEditor, scenePositionLabel, selectionDescription } from "../features/canvas-editor/editor-experience.js";
import { icon } from "../ui/icons.js";
import {
  node,
  button,
  field,
  input,
  iconButton,
  select,
  trapDialog,
} from "../features/canvas-editor/dom.js";

const newId = () => crypto.randomUUID();
const zoomLevels = [0.25, 0.5, 0.75, 1, 1.5, 2];
const libraryTabs = { add: "Thêm", content: "Nội dung", assets: "Ảnh", layers: "Lớp" };
const sceneActions = [
  ["Nhân bản cảnh", "scene-duplicate"], ["Đưa cảnh lên", "scene-up"],
  ["Đưa cảnh xuống", "scene-down"], ["Chọn làm cảnh mở đầu", "scene-entry"],
  ["Xóa cảnh", "scene-delete"],
];
const starterActions = { blank: "create-blank", "envelope-basic": "create-starter", celebration: "create-celebration" };
const toPercent = value => Number((value * 100).toFixed(2));
const isLegacyFrame = element => isPhotoFrame(element) && !isPolaroidPlaceholder(element);

function imagePicker(label, slot) {
  return node("label", { class: "editor-image-picker" },
    node("span", {}, label),
    node("input", {
      type: "file", accept: "image/png,image/jpeg,image/webp",
      "data-editor-field": "upload", "data-slot": slot,
    }));
}
const stopKeys = (target) =>
  target?.closest('input,textarea,select,[contenteditable="true"]');

function readableInk(background) {
  const [red, green, blue] = background.slice(1).match(/../g).map(hex => {
    const value = parseInt(hex, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance > 0.179 ? "#000000" : "#FFFFFF";
}

// Mounted only on Sender design routes. The public player never imports this module.
export function mountDesigner(
  main,
  {
    id = null,
    templateId = null,
    templateVersionId = null,
    mode = null,
    user,
    api,
    navigate,
    toast = () => { },
    onCheckout,
    onRouteReplace,
  } = {},
) {
  const lifecycle = new AbortController(),
    { signal } = lifecycle;
  let disposed = false,
    design = null,
    store = null,
    session = null,
    stage = null;
  let selection = null,
    sceneId = null,
    zoom = 1,
    composing = false,
    assetPending = false,
    publishing = false,
    snap = true;
  let unsubscribe = null,
    preview = null,
    closePreview = null,
    sheet = null,
    creating = false;
  let libraryTab = "content", fitted = true, stageObserver;
  let discoveryMode = "all";
  // Bộ nhớ lịch sử chỉ lưu ID element, không lưu dữ liệu hoặc nội dung thiệp.
  let recentBlocks = (() => {
    try { return readRecent(localStorage.getItem(recentKey), catalog); }
    catch { return []; }
  })();
  const mobile = matchMedia("(max-width: 800px)");
  const dialogs = new Set();
  let quickMode = mode === "quick" || (Boolean(templateId) && mode !== "layout");
  const ownerId = user?.sub || user?.id;
  const modeKey = draftId => `momevia:canvas:mode:${ownerId}:${draftId}`;
  main.classList.add("editor-main");
  main.replaceChildren(
    node(
      "section",
      { class: "editor-loading", role: "status" },
      "Đang mở thiết kế…",
    ),
  );

  async function request(path, body, extra = {}) {
    const result = await api.request(path, {
      method: body === undefined ? "GET" : "POST",
      signal,
      ...(body === undefined
        ? {}
        : {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      ...extra,
    });
    if (disposed) throw new DOMException("Editor đã đóng", "AbortError");
    return result;
  }
  function warn(error) {
    if (!disposed && error.name !== "AbortError") {
      toast(error.message, "error");
      const banner = main.querySelector(".editor-error");
      if (banner) {
        banner.hidden = false;
        banner.textContent = error.message;
      }
    }
  }
  function clearError() {
    const banner = main.querySelector(".editor-error");
    if (banner) {
      banner.hidden = true;
      banner.textContent = "";
    }
    const blockers = main.querySelector(".editor-preflight");
    if (blockers) blockers.hidden = true;
  }
  function markStatus(message) {
    const status = main.querySelector(".editor-save-status");
    if (status) status.textContent = message;
  }
  function saveStatus(info) {
    if (info.status === "clean") clearError();
    if (info.revision > design.revision) {
      design.reviewTemplateDefaults = false;
      const note = main.querySelector(".editor-template-defaults");
      if (note) note.hidden = true;
    }
    markStatus(
      `${info.message}${info.status === "clean" ? ` · r${info.revision}` : ""}`,
    );
    const actions = main.querySelector(".editor-session-actions");
    if (!actions) return;
    actions.hidden = ![
      "conflict",
      "offline",
      "error",
      "session-expired",
    ].includes(info.status);
    actions.querySelector('[data-editor-action="retry-save"]').hidden = [
      "conflict",
      "session-expired",
    ].includes(info.status);
    actions.querySelector('[data-editor-action="server-view"]').hidden =
      info.status !== "conflict";
    actions.querySelector('[data-editor-action="server-reload"]').hidden =
      info.status !== "conflict";
    if (info.error) {
      const banner = main.querySelector(".editor-error");
      banner.hidden = false;
      banner.textContent = info.error.message;
    }
  }
  function currentScene() {
    const doc = store.get().document;
    return doc.scenes.find((item) => item.id === sceneId) || doc.scenes[0];
  }
  function selected() {
    return store.get().document.elements.find((item) => item.id === selection);
  }
  function choose(idValue) {
    selection = idValue;
    stage?.render();
    renderInspector();
    renderLayers();
    renderAssets();
    updateCanvasGuidance();
  }
  function updateCanvasGuidance() {
    if (!store || !design) return;
    const document = store.get().document;
    const sceneStatus = main.querySelector('[data-editor-scene-progress]');
    const selectionStatus = main.querySelector('[data-editor-selection]');
    if (sceneStatus) sceneStatus.textContent = scenePositionLabel(document, sceneId);
    if (selectionStatus) selectionStatus.textContent = selectionDescription(document, sceneId, selection, design.policy);
  }
  function commit(mutate, label, options) {
    const next = structuredClone(store.get());
    mutate(next);
    if (next.document.schemaVersion === 1 && requiresCanvasV2(next.document)) {
      next.document.schemaVersion = 2;
      next.document.registryVersion = 2;
    }
    validateDocument(next.document);
    store.replace(next, label, options);
    clearError();
  }
  function designView() {
    return {
      ...design,
      ...store.get(),
      revision: session.revision,
      documentHash: session.documentHash,
    };
  }
  function assetUrl(assetId) {
    return `/api/designs/designs/${encodeURIComponent(design.id)}/assets/${encodeURIComponent(assetId)}`;
  }
  function textOptions(element) {
    if (element?.type !== "text" || element.visible === false) return null;
    const binding = element.props.textBinding;
    if (design.policy?.lockedElements?.[element.id] && (!binding || !design.policy.editableBindings?.includes(binding))) return null;
    return binding
      ? { label: bindingLabels[binding], maxlength: binding === "message" ? 1000 : 60 }
      : { label: "Chữ trên thiệp", maxlength: LIMITS.text };
  }

  function commitInlineText(elementId, value) {
    try {
      commit(({ document }) => {
        const element = document.elements.find(item => item.id === elementId);
        if (!textOptions(element)) return;
        if (element.props.textBinding) document.bindings[element.props.textBinding].value = value;
        else element.props.text = value;
      }, "Sửa chữ trên thiệp");
    } catch (error) {
      warn(error);
    }
  }
  function safe(action) {
    return async (event) => {
      try {
        await action(event);
      } catch (error) {
        warn(error);
      }
    };
  }
  const statusNode = () =>
    node(
      "span",
      { class: "editor-save-status", role: "status", "aria-live": "polite" },
      "Đã lưu",
    );

  function quickPhotoFrame() {
    if (design.policy?.kind === "creator-template")
      return store.get().document.elements.find(element => element.id === design.policy.photoId);
    return store.get().document.elements.find(element =>
      isLegacyFrame(element) && element.visible !== false && !element.locked &&
      !design.policy?.lockedElements?.[element.id]
    );
  }
  function quickTemplateText(document) {
    const id = design.source.templateId;
    const name = id === MEMORY_TEMPLATE_ID ? "Chú thích ảnh" : id === "hai-phong-bi" ? "Nội dung kỷ niệm" : null;
    return name ? document.elements.find(element => element.type === "text" && element.name === name && Object.hasOwn(element.props, "text")) : null;
  }

  function syncDraftUrl() {
    const query = quickMode ? "?mode=quick" : "";
    history.replaceState(history.state, "", `/design/${encodeURIComponent(id)}${query}`);
    onRouteReplace?.();
  }

  function showMode() {
    if (design.source?.kind === "template") {
      try { localStorage.setItem(modeKey(design.id), quickMode ? "quick" : "layout"); } catch { /* Optional cache. */ }
    }
    const workspace = main.querySelector(".editor-workspace");
    workspace.classList.toggle("is-quick", quickMode);
    const mode = workspace.querySelector('[data-editor-action="toggle-mode"]');
    if (mode) mode.textContent = quickMode ? "Chỉnh bố cục" : "Cá nhân hóa nhanh";
    workspace.querySelector('[data-editor-action="preview"]').textContent = quickMode ? "Xem như người nhận" : "Xem trước";
    workspace.querySelector(".editor-library").setAttribute("aria-label", quickMode ? "Cá nhân hóa món quà" : "Công cụ thiết kế");
    const sceneBar = workspace.querySelector(".editor-scene-bar");
    const next = workspace.querySelector(quickMode ? ".editor-stage-scroll" : ".editor-mobile-dock");
    next.before(sceneBar);
    showLibrary(libraryTab);
    updateCanvasGuidance();
  }

  function showLibrary(tab) {
    libraryTab = tab;
    const library = main.querySelector(".editor-library");
    const add = library.querySelector("#editor-panel-add");
    if (!quickMode && tab === "add" && !add.hasChildNodes()) add.append(...blockLibrary());
    for (const panel of library.querySelectorAll("[data-library-panel]"))
      panel.hidden = panel.dataset.libraryPanel !== (quickMode ? "content" : tab);
    for (const control of library.querySelectorAll('[data-editor-action="library-tab"]'))
      control.setAttribute("aria-pressed", control.dataset.tab === tab);
  }

  function blockLibrary() {
    const sample = sampleBindings(createDocument());
    const cards = new Map();
    const fillThumbnail = control => {
      const block = cards.get(control);
      if (!block || control.querySelector(".editor-thumbnail")) return;
      const models = block.create();
      control.prepend(thumbnail(sample, models, bounds(models), { width: 62, height: 48 }));
    };
    const lazy = new IntersectionObserver(entries => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        fillThumbnail(target);
        lazy.unobserve(target);
      }
    }, { rootMargin: "120px" });
    signal.addEventListener("abort", () => lazy.disconnect(), { once: true });
    const groups = catalog.map(({ label, items }, index) => node("section", { class: "editor-block-group", "data-block-group": index },
      node("h3", {}, label),
      node("div", { class: "editor-block-grid" }, ...items.map(block => {
        const control = button("", "add", {
          "data-block": block.id, "aria-label": block.title,
          disabled: design.policy?.kind === "creator-template",
        });
        cards.set(control, block);
        control.append(node("span", {}, block.title));
        lazy.observe(control);
        return control;
      })),
    ));
    return [
      node("div", { class: "editor-discovery-heading" },
        node("span", { class: "editor-discovery-eyebrow" }, "THƯ VIỆN MOMEVIA"),
        node("strong", {}, "Tạo dấu ấn của riêng bạn"),
        node("p", {}, "Hình vector sắc nét, đổi màu và thêm trực tiếp vào thiệp.")),
      field("Tìm hình trang trí", node("input", {
        type: "search", "data-block-search": "", placeholder: "Hoa, sinh nhật, du lịch...",
        "aria-describedby": "editor-block-count",
      })),
      node("div", { class: "editor-discovery-filters", role: "group", "aria-label": "Bộ lọc thư viện" },
        ...discoveryModes.map(mode => button(mode.label, "filter-blocks", {
          class: "editor-discovery-chip", "data-filter-mode": mode.id,
          "aria-pressed": mode.id === discoveryMode ? "true" : "false",
        }))),
      node("p", { class: "editor-discovery-count", id: "editor-block-count", role: "status", "aria-live": "polite" },
        `${catalog.flatMap(group => group.items).length} elements có sẵn`),
      field("Nhóm khối", node("select", { "data-block-group-select": "" },
        node("option", { value: "" }, `Tất cả (${cards.size})`),
        ...catalog.map(({ label, items }, index) => node("option", { value: index }, `${label} (${items.length})`)))),
      node("div", { class: "editor-help", "data-block-empty": "", hidden: true },
        node("p", { role: "status" }, "Không tìm thấy khối phù hợp."),
        button("Xóa tìm kiếm", "clear-block-search")),
      ...groups,
    ];
  }

  function filterBlocks(query) {
    const panel = main.querySelector("#editor-panel-add");
    if (!panel?.querySelector("[data-block-group-select]")) return;
    const selectedGroup = panel.querySelector("[data-block-group-select]").value;
    const allowed = filteredIds(catalog, { query, group: selectedGroup, mode: discoveryMode, recent: recentBlocks });
    for (const [index, { items }] of catalog.entries()) {
      const section = panel.querySelector(`[data-block-group="${index}"]`);
      let count = 0;
      for (const [itemIndex, control] of [...section.querySelectorAll("[data-block]")].entries()) {
        control.hidden = !allowed.has(items[itemIndex].id);
        if (!control.hidden) count += 1;
      }
      section.hidden = count === 0;
    }
    panel.querySelector("#editor-block-count").textContent = `${allowed.size} kết quả trên ${catalog.flatMap(group => group.items).length} elements`;
    const empty = panel.querySelector("[data-block-empty]");
    empty.hidden = allowed.size !== 0;
    empty.querySelector("p").textContent = discoveryMode === "recent" && recentBlocks.length === 0
      ? "Chưa có hình vừa dùng. Chọn một hình từ thư viện để bắt đầu."
      : "Không tìm thấy hình phù hợp. Thử từ khóa hoặc bộ lọc khác.";
    for (const chip of panel.querySelectorAll("[data-filter-mode]"))
      chip.setAttribute("aria-pressed", String(chip.dataset.filterMode === discoveryMode));
  }

  function switchMode() {
    closeSheet();
    stage.cancel();
    quickMode = !quickMode;
    syncDraftUrl();
    showMode();
    renderAll();
    fit();
  }

  function shell() {
    const tools = node(
      "div",
      { class: "editor-top-actions" },
      iconButton("Hoàn tác (Ctrl Z)", "undo", "undo"),
      iconButton("Làm lại (Ctrl Shift Z)", "redo", "redo"),
      button("Lưu nháp", "save", { class: "editor-save" }),
      button("Xem trước", "preview"),
      canOpenAdvancedEditor(design.policy)
        ? button("Chỉnh sửa nâng cao", "advanced-design", {
          class: "editor-advanced-cta",
          title: "Kéo, xoay, căn chỉnh và quản lý các lớp bằng Fabric Studio",
        })
        : null,
      design.purpose === "creator"
        ? button("Gửi phiên bản để duyệt", "submit-template", { class: "editor-primary" })
        : button("Xuất bản", "publish", { class: "editor-primary editor-layout-only" }),
    );
    const heading = node(
      "div",
      { class: "editor-heading" },
      button(design.purpose === "creator" ? "← Mẫu của tôi" : "← Studio", "studio"),
      node("input", {
        class: "editor-title",
        "aria-label": "Tên thiết kế",
        "data-editor-field": "title",
        value: store.get().title,
        maxlength: 120,
      }),
      statusNode(),
      design.source?.kind === "template" ? button("", "toggle-mode", { class: "editor-mode" }) : null,
    );
    const top = node("header", { class: "editor-topbar" }, heading, tools);
    const sidebar = node(
      "aside",
      { class: "editor-library", id: "editor-library", "aria-label": "Công cụ thiết kế" },
      node(
        "div",
        { class: "editor-panel-heading editor-layout-only" },
        node("h2", {}, "Công cụ thiết kế"),
        iconButton("Đóng bảng công cụ", "close-sheet", "close", { class: "editor-sheet-close" }),
      ),
      node(
        "nav",
        { class: "editor-library-tabs editor-layout-only", "aria-label": "Công cụ thiết kế" },
        ...Object.entries(libraryTabs).map(([key, label]) =>
          button(label, "library-tab", { "data-tab": key, "aria-controls": `editor-panel-${key}` })),
      ),
      node(
        "div",
        { "data-library-panel": "add", id: "editor-panel-add" },
      ),
      node("div", { "data-library-panel": "content", id: "editor-panel-content" },
      node("h2", { class: "editor-quick-only" }, "Điền nội dung"),
      ...Object.entries(bindingLabels).filter(([key]) =>
        design.policy?.kind !== "creator-template" || design.policy.editableBindings.includes(key)).map(([key, label]) =>
          key === "message"
            ? field(
              label,
              node(
                "textarea",
                {
                  "data-editor-field": `binding.${key}`,
                  rows: 4,
                  maxlength: 1000,
                  value: store.get().document.bindings[key].value,
                },
                store.get().document.bindings[key].value,
              ),
            )
            : input(
              label,
              `binding.${key}`,
              store.get().document.bindings[key].value,
              { maxlength: 60 },
            ),
        ),
      node("div", { class: "editor-quick-only" },
        design.source.templateId === MEMORY_TEMPLATE_ID ? node("div", { class: "editor-greeting-starters" },
          node("p", { class: "editor-help" }, "Thêm câu mở đầu vào lời chúc"),
          ...memoryGreetingStarters.map((text, index) => button(text, "greeting-starter", { "data-index": index })),
        ) : null,
        quickTemplateText(store.get().document) ? input(
          quickTemplateText(store.get().document).name, "quick-template-text", quickTemplateText(store.get().document).props.text, { maxlength: 500 },
        ) : null,
        node("div", { class: "editor-quick-photo", hidden: true },
          field("Ảnh kỷ niệm", node("input", {
            type: "file",
            accept: "image/png,image/jpeg,image/webp",
            "data-editor-field": "quick-photo",
          })),
          node("p", { class: "editor-help" }, "PNG, JPEG hoặc WebP · Tối đa 2 MB"),
          design.source.templateId === MEMORY_TEMPLATE_ID ? button("Bỏ ảnh cá nhân", "remove-frame-photo", { hidden: true }) : null,
        ),
      ),
      node("p", { class: "editor-help editor-layout-only" },
        "Tên và lời chúc được dùng ở những khối có liên kết dữ liệu. Nhập đủ trước khi xuất bản.",
      ),
      ),
      node("div", { "data-library-panel": "assets", id: "editor-panel-assets", class: "editor-assets" }),
      node("div", { "data-library-panel": "layers", id: "editor-panel-layers", class: "editor-layers" }),
    );
    const zoomControl = node(
      "select",
      { "aria-label": "Mức thu phóng", "data-editor-field": "zoom" },
      ...zoomLevels.map((value) =>
        node("option", { value: String(value) }, `${value * 100}%`),
      ),
    );
    zoomControl.value = "1";
    const stageArea = node(
      "section",
      { class: "editor-stage-column", "aria-label": "Bản thiết kế" },
      node("h2", { class: "editor-quick-only" }, "Bố cục thiệp"),
      node("div", { class: "editor-experience-header editor-layout-only" },
        node("div", { class: "editor-experience-heading" },
          node("span", { class: "editor-experience-kicker" }, "KHÔNG GIAN THIẾT KẾ"),
          node("h2", {}, "Làm món quà mang dấu ấn riêng"),
          node("p", {}, "Thêm hình trang trí, chọn một lớp và chỉnh trực tiếp trên thiệp."),
        ),
        node("span", { class: "editor-scene-progress", "data-editor-scene-progress": "" }, "Cảnh 1/1"),
      ),
      node("p", { class: "editor-quick-tip editor-quick-only" },
        "Muốn di chuyển, xoay và căn chỉnh chi tiết? Chọn Chỉnh sửa nâng cao ở thanh trên."),
      node(
        "div",
        { class: "editor-stage-tools editor-layout-only" },
        iconButton("Thu nhỏ", "zoom-out", "zoom-out"),
        zoomControl,
        iconButton("Phóng to", "zoom-in", "zoom-in"),
        iconButton("Vừa khung", "fit", "fit"),
        field(
          "Căn hút",
          node("input", {
            type: "checkbox",
            "data-editor-field": "snap",
            checked: snap,
          }),
        ),
      ),
      node("p", { class: "editor-selection-summary editor-layout-only", "data-editor-selection": "", role: "status", "aria-live": "polite" },
        "Chọn một thành phần trên thiệp để chỉnh sửa."),
      node("div", { class: "editor-stage-scroll" }),
      node("details", { class: "editor-editing-help editor-layout-only" },
        node("summary", {}, "Cách sử dụng công cụ thiết kế"),
        node("ol", {},
          node("li", {}, "Chọn Thêm để tìm hình trang trí, chữ hoặc khung ảnh."),
          node("li", {}, "Chọn thành phần trên thiệp để mở bảng Chỉnh; dùng Lớp để quản lý thứ tự."),
          node("li", {}, "Chọn Chỉnh sửa nâng cao để kéo, xoay, căn hàng và đổi thứ tự bằng Fabric Studio."),
          node("li", {}, "Lưu nháp, rồi Xem trước trước khi xuất bản."),
        ),
      ),
    );
    const inspector = node("aside", {
      class: "editor-inspector editor-layout-only",
      id: "editor-inspector",
      "aria-label": "Chỉnh",
    });
    const sceneBar = node(
      "section",
      { class: "editor-scene-bar", id: "editor-scene-bar", "aria-label": "Các cảnh" },
      node("div", { class: "editor-panel-heading editor-layout-only" },
        node("h2", {}, "Cảnh"),
        iconButton("Đóng bảng cảnh", "close-sheet", "close", { class: "editor-sheet-close" })),
      node("div", { class: "editor-scenes" }),
      node(
        "div",
        { class: "editor-scene-actions editor-layout-only" },
        button("+ Cảnh", "scene-add"),
      ),
    );
    const dock = node(
      "nav",
      { class: "editor-mobile-dock editor-layout-only", "aria-label": "Bảng công cụ" },
      button("Thêm", "sheet-library", { "aria-controls": "editor-library", "aria-expanded": false }),
      button("Lớp", "sheet-layers", { "aria-controls": "editor-library", "aria-expanded": false }),
      button("Chỉnh", "sheet-inspector", { "aria-controls": "editor-inspector", "aria-expanded": false }),
      button("Cảnh", "sheet-scenes", { "aria-controls": "editor-scene-bar", "aria-expanded": false }),
    );
    main.replaceChildren(
      node(
        "section",
        { class: "editor-workspace" },
        top,
        design.policy?.kind === "creator-template" && lockedVisibleNames(design.document, design.policy.editableBindings).length
          ? node("p", { class: "editor-help" }, "Lớp tên bị khóa của mẫu cũ sẽ để trống trong quà.")
          : null,
        design.reviewTemplateDefaults
          ? node("p", { class: "editor-help editor-template-defaults", role: "status" }, "Đã bỏ chữ minh họa của mẫu cũ. Hãy xem lại nội dung rồi chọn Lưu nháp trước khi gửi.")
          : null,
        node("div", { class: "editor-error", role: "alert", hidden: true }),
        node("div", { class: "editor-preflight", hidden: true }),
        node(
          "div",
          { class: "editor-session-actions", hidden: true },
          button("Thử lưu lại", "retry-save"),
          button("Xem bản máy chủ", "server-view"),
          button("Dùng bản máy chủ", "server-reload"),
        ),
        node("div", { class: "editor-grid" }, sidebar, stageArea, inspector),
        sceneBar,
        dock,
      ),
    );
    if (design.policy?.kind === "creator-template") {
      for (const control of main.querySelectorAll('[data-editor-action="add"], .editor-scene-actions button, [data-editor-action="center"], [data-editor-action="inside"]'))
        control.disabled = true;
    }
    showMode();
    stage = createStage(main.querySelector(".editor-stage-scroll"), {
      store,
      getSceneId: () => sceneId,
      getSelection: () => selection,
      select: choose,
      assetUrl,
      textOptions,
      onTextChange: commitInlineText,
      signal,
      getSnap: () => snap,
      isReadOnly: () => quickMode,
      isLayoutLocked: (idValue) =>
        Boolean(design.policy?.lockedElements?.[idValue]),
      onGesture: (active) => main.classList.toggle("editor-dragging", active),
    });
    stageObserver?.disconnect();
    stageObserver = new ResizeObserver(() => { if (fitted && !sheet) fit(); });
    stageObserver.observe(main.querySelector(".editor-stage-scroll"));
    renderAll();
  }
  function renderLayers() {
    const host = main.querySelector(".editor-layers");
    if (!host) return;
    if (quickMode) {
      host.replaceChildren();
      return;
    }
    const scene = currentScene();
    host.replaceChildren(
      ...[...scene.elementIds].reverse().map((idValue) => {
        const item = store
          .get()
          .document.elements.find((element) => element.id === idValue);
        const label = item.name || registry[item.type].label;
        const locked = item.locked || design.policy?.lockedElements?.[item.id];
        const hidden = item.visible === false;
        const choice = button(
          label,
          "select",
          {
            "data-id": idValue,
            class: selection === idValue ? "is-selected" : "",
            "aria-pressed": selection === idValue,
            "aria-label": `${label}${hidden ? ", đang ẩn" : ""}${locked ? ", có khóa" : ""}`,
          },
        );
        if (hidden || locked) {
          const flags = node("span", { class: "editor-layer-flags", "aria-hidden": "true" });
          flags.innerHTML = (hidden ? icon("eye-off", 15) : "") + (locked ? icon("lock", 15) : "");
          choice.append(flags);
        }
        return choice;
      }),
    );
  }
  function renderScenes() {
    const host = main.querySelector(".editor-scenes");
    if (!host) return;
    const doc = store.get().document;
    const active = document.activeElement;
    const focusedId = host.contains(active) ? active.closest("[data-scene]")?.dataset.scene : null;
    const openId = host.querySelector("details[open]")?.closest("[data-scene]").dataset.scene;
    const locked = design.policy?.kind === "creator-template";
    host.replaceChildren(...doc.scenes.map((scene, index) => {
      const entry = scene.id === doc.entrySceneId;
      const selected = scene.id === sceneId;
      const card = button("", "scene-select", {
        "data-id": scene.id, "aria-pressed": selected,
        class: `editor-scene-choice${selected ? " is-selected" : ""}`,
      });
      if (!quickMode) card.append(sceneThumbnail(doc, scene, { assetUrl }));
      card.append(node("span", { class: "editor-scene-name" }, scene.name));
      if (entry && !quickMode) card.append(node("span", { class: "editor-scene-entry" }, "Mở đầu"));
      const summary = node("summary", { "aria-label": `Tùy chọn cảnh ${scene.name}` });
      summary.innerHTML = icon("more", 18);
      const menu = node("details", { class: "editor-scene-menu editor-layout-only" },
        summary,
        node("div", { class: "editor-scene-menu-actions" }, ...sceneActions.map(([label, action]) =>
          button(label, action, { "data-id": scene.id, disabled:
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
  function renderAssets() {
    const host = main.querySelector(".editor-assets");
    if (!host) return;
    if (quickMode) {
      host.replaceChildren();
      delete host.dataset.assetIds;
      return;
    }
    const doc = store.get().document;
    const images = doc.elements.filter(item => item.type === "image" && item.props.assetId);
    const assets = doc.assets;
    const canReuse = design.policy?.kind !== "creator-template" ||
      design.policy.lockedElements?.[selection]?.editableProps.includes("assetId");
    const signature = JSON.stringify([assets, images, Boolean(canReuse)]);
    if (host.dataset.assetIds === signature) return;
    host.dataset.assetIds = signature;
    host.replaceChildren(
      ...assets.flatMap(({ assetId }, index) => {
        const linked = images.filter(image => image.props.assetId === assetId);
        const models = linked.length ? linked : [createElement("image", { props: { assetId } })];
        return models.map(model => {
          const control = button(`Dùng ảnh · ${model.name || index + 1}`, "reuse-asset", {
            "data-id": assetId, class: "editor-asset-choice", disabled: !canReuse,
          });
          control.prepend(thumbnail(doc, [{ ...model, visible: true }], bounds([model]), { width: 58, height: 52, assetUrl }));
          return control;
        });
      }),
    );
    if (!assets.length)
      host.append(
        node(
          "p",
          { class: "editor-help" },
          "Thêm khối ảnh rồi chọn tệp từ thiết bị.",
        ),
      );
  }
  function effectFields(model, element) {
    const categories = element ? elementEffectFamilies : sceneEffectFamilies;
    return categories.flatMap(family => {
      const options = effectsFor(family, element);
      if (!options.length) return [];
      const preset = model.effects?.[family];
      const prefix = `effect.${family}.`;
      return [node("fieldset", {class:"editor-effect-settings"},
        node("legend",{},effectFamilies[family].label),
        select("Hiệu ứng",prefix+"id",preset?.id,[["", "Tắt"],...options]),
        preset && family !== "surface" ? select("Tốc độ",prefix+"speed",preset.speed || "normal",
          [["slow","Chậm"],["normal","Vừa"],["fast","Nhanh"]]) : null,
        preset && family === "entrance" ? select("Độ trễ",prefix+"delay",preset.delay || 0,
          [[0,"Ngay"],[150,"150 ms"],[300,"300 ms"]]) : null,
        preset && family === "ambience" ? select("Mật độ",prefix+"density",preset.density || "normal",
          [["sparse","Thưa"],["normal","Vừa"]]) : null,
        preset && ["S02","S04"].includes(preset.id) ? input("Màu viền",prefix+"color",
          preset.color || (preset.id === "S02" ? "#6D488A" : "#F3DA97"),{type:"color"}) : null,
        preset ? node("div",{class:"editor-control-row"},
          button("Xem thử","effect-preview",{"data-family":family}),
          button("Bỏ hiệu ứng","effect-remove",{"data-family":family})) : null,
      )];
    });
  }
  function interactionFields(model) {
    const p = model.props, spec = interactionKinds[p.kind], doc = store.get().document;
    const fields = [input("Màu nền khối", "props.color", p.color, {type:"color"})];
    for (const [i, entry] of (p.entries || []).entries()) {
      fields.push(input(spec.fields[i][0], `entry.${i}.heading`, entry.heading, {maxlength:120}));
      if (spec.fields[i][1]) fields.push(field(spec.fields[i][1], node("textarea", {
        "data-editor-field": `entry.${i}.body`, maxlength: LIMITS.text, rows: 3,
      }, entry.body)));
    }
    for (const [i, action] of (model.actions || []).entries())
      fields.push(select(`Cảnh đích cửa ${i+1}`, `door.${i}`, action.targetSceneId,
        [["", "Chọn cảnh"], ...doc.scenes.map(scene => [scene.id, scene.name])]));
    for (const [i, photo] of (p.photos || []).entries()) {
      const label = p.kind === "photo-comparison" ? (i ? "Ảnh sau" : "Ảnh trước") : `Ảnh ${i+1}`;
      const picture = createElement("image", { id: photo.id, layout: model.layout,
        props: { assetId: photo.assetId, focalPoint: photo.focalPoint }, accessibility: {alt:photo.alt} });
      const editPhoto = edit => commit(({document}) => {
        const slot = document.elements.find(item => item.id === model.id)?.props.photos.find(item => item.id === photo.id);
        if (slot) edit(slot);
      }, "Chỉnh ô ảnh");
      fields.push(node("fieldset", {class:"editor-interaction-photo"}, node("legend",{},label),
        imagePicker(photo.assetId ? `Thay ${label.toLowerCase()}` : `Chọn ${label.toLowerCase()}`, photo.id),
        doc.assets.length ? select("Ảnh đã tải", `slot.${photo.id}.assetId`, photo.assetId,
          [["", "Chưa có ảnh"], ...doc.assets.map(({assetId},index) => [assetId, `Ảnh đã tải ${index+1}`])]) : null,
        input("Mô tả ảnh", `slot.${photo.id}.alt`, photo.alt, {maxlength:LIMITS.accessibilityText}),
        field("Chú thích ảnh",node("textarea",{"data-editor-field":`slot.${photo.id}.caption`,maxlength:LIMITS.text,rows:2},photo.caption)),
        photo.assetId ? cropEditor(picture, {document:doc,assetUrl,
          editable: !design.policy?.lockedElements?.[model.id],
          onChange: safe(point => { editPhoto(slot => {slot.focalPoint = point;}); renderInspector(); }),
          onPreview: () => {},
        }) : null,
        node("div", {class:"editor-layout-fields"},
          ...["x","y"].map((axis,index) => input(index ? "Nét dọc (%)" : "Nét ngang (%)",
            `slot.${photo.id}.${axis}`, toPercent(photo.focalPoint[axis]), {type:"number",min:0,max:100,step:.1}))),
      ));
    }
    if (spec.clock) {
      const zones = new Set(["Asia/Ho_Chi_Minh", "UTC", p.timeZone, ...Intl.supportedValuesOf("timeZone")]);
      fields.push(select("Múi giờ hẹn","props.timeZone",p.timeZone,[...zones].map(zone=>[zone,zone])),
        input("Ngày giờ hẹn","event-time",p.eventAt ? localEventTime(p.eventAt,p.timeZone) : "",{type:"datetime-local"}));
    }
    return fields;
  }
  function renderInspector() {
    const host = main.querySelector(".editor-inspector");
    if (!host || composing) return;
    if (quickMode) {
      host.replaceChildren();
      return;
    }
    const element = selected(),
      scene = currentScene();
    const previousField = host.contains(document.activeElement) ? document.activeElement.dataset.editorField : null;
    const keepGeometry = host.dataset.modelId === element?.id && host.querySelector(".editor-geometry")?.open;
    const policy = design.policy?.lockedElements?.[element?.id];
    host.dataset.modelId = element?.id || "";
    const children = [
      node(
        "div",
        { class: "editor-panel-heading" },
        node(
          "h2",
          {},
          element ? element.name || registry[element.type].label : "Chỉnh cảnh",
        ),
        iconButton("Đóng bảng chỉnh", "close-sheet", "close", { class: "editor-sheet-close" }),
      ),
    ];
    if (!element) {
      children.push(
        input("Tên cảnh", "scene.name", scene.name, { maxlength: 100 }),
        input("Màu nền", "scene.color", scene.background.color, {
          type: "color",
        }),
        ...effectFields(scene),
        node(
          "p",
          { class: "editor-help" },
          "Chọn phần tử trên khung hoặc trong bảng lớp để chỉnh. Phím mũi tên di chuyển; Shift tăng bước.",
        ),
      );
    } else {
      const { props, layout } = element;
      children.push(
        input("Tên lớp", "element.name", element.name || "", {
          maxlength: 100,
        }),
        element.type === "image" ? imagePicker(props.assetId ? "Thay ảnh" : "Chọn ảnh") : null,
      );
      if (element.type === "text") {
        children.push(
          select("Nội dung", "textBinding", props.textBinding || "", [
            ["", "Văn bản riêng"],
            ...Object.entries(bindingLabels),
          ]),
        );
        if (!props.textBinding)
          children.push(
            field(
              "Văn bản",
              node(
                "textarea",
                { "data-editor-field": "props.text", rows: 4, maxlength: LIMITS.text },
                props.text || "",
              ),
            ),
          );
        else
          children.push(
            node(
              "p",
              { class: "editor-help" },
              `Dùng chung trường ${bindingLabels[props.textBinding]} trong các cảnh.`,
            ),
          );
        children.push(
          textOptions(element) ? button("Sửa trên thiệp", "inline-text") : null,
          node("div", { class: "editor-font-options", role: "group", "aria-label": "Kiểu chữ" },
            ...[["body", "Thân bài"], ["heading", "Tiêu đề"], ["serif", "Có chân"]].map(([token, label]) => {
              const sample = node("span", { "aria-hidden": "true" }, "Aa");
              sample.style.fontFamily = textFont(token);
              const control = button("", "text-font", {
                "data-font": token, "aria-label": `Kiểu chữ ${label.toLowerCase()}`,
                "aria-pressed": (props.fontToken || "body") === token,
              });
              control.append(sample, node("span", {}, label));
              return control;
            })),
          input("Cỡ chữ", "props.fontSize", props.fontSize, {
            type: "number",
            min: 10,
            max: 160,
          }),
          input("Giãn dòng", "props.lineHeight", props.lineHeight ?? 1.4, {
            type: "number", min: 1, max: 3, step: 0.05,
          }),
          node("div", { class: "editor-control-row", role: "group", "aria-label": "Căn chữ" },
            ...[["left", "trái"], ["center", "giữa"], ["right", "phải"]].map(([align, label]) =>
              iconButton(`Căn chữ ${label}`, "text-align", `align-${align}`, {
                "data-align": align, "aria-pressed": props.align === align,
              }))),
        );
      }
      if (element.type === "interaction") children.push(...interactionFields(element));
      for (const key of element.type === "interaction" ? [] : registry[element.type].inspector) {
        if (
          [
            "text",
            "textBinding",
            "fontToken",
            "fontSize",
            "align",
            "assetId",
            "focalPoint",
          ].includes(key)
        )
          continue;
        if (["color", "strokeColor"].includes(key))
          children.push(
            input(
              key === "color" ? "Màu sắc" : "Màu viền",
              `props.${key}`,
              props[key],
              { type: "color" },
            ),
          );
        else if (["radius", "strokeWidth"].includes(key))
          children.push(
            input(
              key === "radius" ? "Bo góc" : "Độ dày nét",
              `props.${key}`,
              props[key],
              { type: "number", min: 0, max: key === "radius" ? 512 : 40 },
            ),
          );
        else if (key === "kind")
          children.push(
            select("Hình", "props.kind", props.kind, [
              ["rectangle", "Chữ nhật"],
              ["ellipse", "Bầu dục"],
              ["line", "Đường kẻ"],
              ...Object.keys(shapes).map((id, i) => [id, ["Tam giác", "Hình thoi", "Lục giác", "Hình vòm", "Ruy băng", "Khung thoại"][i]]),
            ]),
          );
        else if (key === "mask" && props.mask)
          children.push(select("Mặt nạ ảnh", "props.mask", props.mask,
            Object.keys(masks).map((id, i) => [id, ["Ảnh tròn", "Ảnh vòm", "Ảnh trái tim", "Mép giấy xé"][i]])));
        else if (key === "caption" && Object.hasOwn(props, key))
          children.push(field("Chú thích ảnh", node("textarea", { "data-editor-field": "props.caption", maxlength: LIMITS.text, rows: 3 }, props.caption)));
        else if (key === "pattern" && props.pattern)
          children.push(select("Kiểu nét", "props.pattern", props.pattern,
            Object.keys(lines).map((id, i) => [id, ["Vòng cung", "Chỉ may", "Mũi tên cong", "Sóng", "Ngoặc", "Bốn góc"][i]])));
        else if (key === "fit")
          children.push(
            select("Khung ảnh", "props.fit", props.fit, [
              ["cover", "Lấp khung"],
              ["contain", "Vừa ảnh"],
            ]),
          );
        else if (key === "stickerId")
          children.push(
            select(
              "Sticker",
              "props.stickerId",
              props.stickerId,
              Object.entries(stickerNames),
            ),
          );
        else if (!["preset", "pattern", "mask", "caption", "optional"].includes(key))
          children.push(
            input(
              { label: "Nhãn nút", title: "Tiêu đề", submitLabel: "Nhãn gửi" }[
              key
              ] || key,
              `props.${key}`,
              props[key],
              { maxlength: 120 },
            ),
          );
      }
      if (element.type === "image") {
        const focal = props.focalPoint || { x: 0.5, y: 0.5 };
        children.push(
          field(
            "Mô tả ảnh",
            node("textarea", {
              "data-editor-field": "accessibility.alt", rows: 2, maxlength: LIMITS.accessibilityText,
              disabled: Boolean(element.accessibility.decorative),
              value: element.accessibility.alt || "",
            }),
          ),
          node("label", { class: "editor-checkbox" }, node("input", {
            type: "checkbox", "data-editor-field": "accessibility.decorative",
            checked: Boolean(element.accessibility.decorative),
          }), "Ảnh trang trí"),
          props.assetId ? cropEditor(element, {
            document: store.get().document,
            assetUrl,
            editable: !policy || policy.editableProps.includes("focalPoint"),
            onPreview: point => stage.previewFocal(element.id, point),
            onChange: safe(point => {
              commit(({ document }) => {
                const image = document.elements.find(item => item.id === element.id);
                if (image?.type === "image") image.props.focalPoint = point;
              }, "Chỉnh điểm lấy nét");
              renderInspector();
            }),
          }) : null,
          props.assetId && !policy ? node("p", { class: "editor-help" }, "Kéo điểm trên ảnh hoặc nhập vị trí bằng bàn phím.") : null,
          node("div", { class: "editor-layout-fields" },
            input("Ngang (%)", "crop.x", toPercent(focal.x), { type: "number", min: 0, max: 100, step: 0.1, "aria-label": "Điểm nét ngang (%)" }),
            input("Dọc (%)", "crop.y", toPercent(focal.y), { type: "number", min: 0, max: 100, step: 0.1, "aria-label": "Điểm nét dọc (%)" })),
          button("Đặt lại crop", "crop-reset"),
        );
      }
      if (isPolaroidPlaceholder(element)) {
        children.push(imagePicker("Thêm ảnh vào Polaroid"),
          node("p", { class: "editor-help" }, "Ảnh tùy chọn. Chọn lớp chú thích để sửa chữ."));
      }
      if (isLegacyFrame(element)) {
        children.push(field('Thêm ảnh vào khung', node('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', 'data-editor-field': 'upload' })), node('p', { class: 'editor-help' }, 'Chọn ảnh để thay cảnh minh họa. Khung và góc xoay được giữ nguyên.'));
      }
      if (registry[element.type].actions.length) {
        const action = element.actions?.[0];
        children.push(
          select("Tương tác", "action.type", action?.type || "goToScene", [
            ["goToScene", "Chuyển cảnh"],
            ["replay", "Phát lại từ đầu"],
          ]),
        );
        if (action?.type !== "replay") {
          const doc = store.get().document;
          const destination = doc.scenes.find(scene => scene.id === action?.targetSceneId);
          children.push(node("details", { class: "editor-target-picker" },
            node("summary", {}, destination ? `Cảnh đích · ${destination.name}` : "Chọn cảnh đích"),
            node("div", { class: "editor-target-scenes" }, ...doc.scenes.map(scene => {
              const choice = button("", "action-target", {
                "data-id": scene.id,
                "aria-pressed": scene.id === destination?.id,
              });
              choice.append(sceneThumbnail(doc, scene, { width: 28, assetUrl }), node("span", {}, scene.name));
              return choice;
            }))));
          if (!destination) children.push(node("p", { class: "editor-help" },
            "Chọn cảnh đích để nút hoạt động khi người nhận mở thiệp."));
        }
      }
      children.push(...effectFields(element, element));
      children.push(
        node(
          "details",
          { class: "editor-geometry" },
          node("summary", {}, "Vị trí và kích thước"),
          node("div", { class: "editor-layout-fields" },
            ...[["x", "X"], ["y", "Y"], ["width", "Rộng"], ["height", "Cao"], ["rotation", "Xoay °"]]
              .map(([key, label]) => input(label, `layout.${key}`, Number(layout[key].toFixed(2)), {
                type: "number",
                min: key === "width" || key === "height" ? 1 : key === "rotation" ? -360 : -LIMITS.coordinate,
                max: key === "rotation" ? 360 : LIMITS.coordinate,
                step: 1,
              })),
          ),
          node("div", { class: "editor-control-row", role: "group", "aria-label": "Vị trí phần tử trên thiệp" },
            button("Căn giữa theo chiều ngang", "center"),
            button("Vào khung", "inside"),
          ),
        ),
        input("Độ mờ (%)", "element.opacity", toPercent(1 - (element.opacity ?? 1)), {
          type: "number",
          min: 0,
          max: 100,
          step: 1,
          title: "0% hiện rõ, 100% trong suốt",
        }),
        node(
          "div",
          { class: "editor-control-row" },
          iconButton("Hiển thị lớp", "layer-visibility", element.visible === false ? "eye-off" : "eye", {
            "aria-pressed": element.visible !== false,
          }),
          iconButton("Khóa lớp", "layer-lock", element.locked ? "lock" : "unlock", {
            "aria-pressed": Boolean(element.locked),
          }),
          button("Đưa trước", "layer-up"),
          button("Đưa sau", "layer-down"),
          button("Nhân bản", "element-duplicate"),
          button("Xóa", "element-delete"),
        ),
      );
      const size = store.get().document.artboard.baseSize;
      if (
        layout.x < 0 ||
        layout.y < 0 ||
        layout.x + layout.width > size.width ||
        layout.y + layout.height > size.height
      )
        children.push(
          node(
            "p",
            { class: "editor-help" },
            "Phần tử vượt khung thiết kế. Dùng “Vào khung” hoặc chỉnh tọa độ/kích thước để đưa nội dung về vùng xem.",
          ),
        );
    }
    host.replaceChildren(...children);
    if (keepGeometry) host.querySelector(".editor-geometry").open = true;
    if (!element && design.policy?.kind === "creator-template")
      host.querySelectorAll("[data-editor-field], [data-editor-action='effect-remove']").forEach(control => { control.disabled = true; });
    if (policy) {
      const permitted = policy.editableProps || [];
      host.insertBefore(
        node(
          "p",
          { class: "editor-help" },
          "Vùng mẫu có khóa. Chỉ những thuộc tính được cho phép mới chỉnh được.",
        ),
        host.children[1] || null,
      );
      for (const control of host.querySelectorAll("[data-editor-field]")) {
        const key = control.dataset.editorField;
        control.disabled = !(
          (key.startsWith("props.") && permitted.includes(key.slice(6))) ||
          (key.startsWith("crop.") && permitted.includes("focalPoint")) ||
          (key === "upload" && permitted.includes("assetId"))
        );
      }
      for (const control of host.querySelectorAll("[data-editor-action]"))
        if (control.dataset.editorAction !== "close-sheet" &&
          !(control.dataset.editorAction === "text-align" && permitted.includes("align")) &&
          !(control.dataset.editorAction === "text-font" && permitted.includes("fontToken")) &&
          !(control.dataset.editorAction === "inline-text" && textOptions(element)))
          control.disabled = true;
    }
    if (previousField && !composing)
      host.querySelector(`[data-editor-field="${CSS.escape(previousField)}"]`)?.focus({ preventScroll: true });
  }
  function renderAll(change) {
    if (!store || disposed) return;
    const doc = store.get().document;
    if (!doc.scenes.some((value) => value.id === sceneId))
      sceneId = doc.entrySceneId;
    if (!currentScene().elementIds.includes(selection)) selection = null;
    stage?.render();
    renderLayers();
    renderScenes();
    renderAssets();
    main.querySelector(".editor-quick-photo").hidden = !quickPhotoFrame();
    const removePhoto = main.querySelector('[data-editor-action="remove-frame-photo"]');
    if (removePhoto) removePhoto.hidden = !framePhoto(doc, quickPhotoFrame());
    const quickText = main.querySelector('[data-editor-field="quick-template-text"]');
    if (quickText) {
      const text = quickTemplateText(doc);
      quickText.closest("label").hidden = !text;
      if (text && quickText !== document.activeElement) quickText.value = text.props.text;
    }
    if (
      change?.kind === "undo" || change?.kind === "redo" ||
      !main.querySelector(".editor-inspector")?.contains(document.activeElement)
    )
      renderInspector();
    const undo = main.querySelector('[data-editor-action="undo"]'),
      redo = main.querySelector('[data-editor-action="redo"]');
    if (undo) undo.disabled = !store.canUndo;
    if (redo) redo.disabled = !store.canRedo;
    for (const [key] of Object.entries(bindingLabels)) {
      const control = main.querySelector(
        `[data-editor-field="binding.${key}"]`,
      );
      if (control && control !== document.activeElement)
        control.value = doc.bindings[key].value;
    }
    const title = main.querySelector(".editor-title");
    if (title && title !== document.activeElement)
      title.value = store.get().title;
    updateCanvasGuidance();
  }
  async function initialize(loaded) {
    if (disposed) return;
    unsubscribe?.();
    session?.dispose();
    stage?.dispose();
    design = loaded;
    if (id && !templateId && !["quick", "layout"].includes(mode)) {
      try { quickMode = localStorage.getItem(modeKey(id)) === "quick"; } catch { /* Optional cache. */ }
    }
    quickMode = quickMode && design.source?.kind === "template";
    sceneId = design.document.entrySceneId;
    selection = null;
    store = createEditorStore(design);
    session = createSaveSession({
      design,
      store,
      request,
      userId: ownerId,
      onStatus: saveStatus,
    });
    shell();
    unsubscribe = store.subscribe(renderAll);
    const recovery = session.readRecovery();
    if (recovery && design.policy?.kind === "creator-template") {
      const editable = design.policy.editableBindings;
      clearTemplateBindingDefaults(recovery.value.document, editable);
      if (recovery.pending && clearTemplateBindingDefaults(recovery.pending.document, editable)) recovery.pending = null;
    }
    if (
      recovery &&
      JSON.stringify(recovery.value) !== JSON.stringify(store.get())
    ) {
      if (
        window.confirm(
          "Có bản chỉnh sửa cục bộ chưa được xác nhận. Khôi phục bản này? Bản máy chủ vẫn được giữ khi có xung đột.",
        )
      ) {
        try {
          validateDocument(recovery.value.document);
          session.restore(recovery);
          renderAll();
        } catch (error) {
          warn(error);
        }
      } else session.clearRecovery();
    }
    if (!session.dirty) markStatus(`Đã lưu · r${session.revision}`);
    fit();
  }
  async function create(presetId, source) {
    if (creating) return;
    creating = true;
    for (const button of main.querySelectorAll(".editor-start-options button"))
      button.disabled = true;
    try {
      const cacheKey = `momevia:canvas:create:${ownerId}:${source.kind}:${source.templateId || presetId}${source.templateVersionId ? `:${source.templateVersionId}` : ""}`;
      let mutationId;
      try {
        mutationId = sessionStorage.getItem(cacheKey);
      } catch {
        /* Optional idempotency recovery. */
      }
      mutationId ||= newId();
      try {
        sessionStorage.setItem(cacheKey, mutationId);
      } catch {
        /* Optional cache. */
      }
      const result = await request("/designs/designs", {
        source,
        presetId,
        mutationId,
      });
      let loaded = result.design;
      if (source.kind === 'template' && loaded.policy?.kind === 'sender-basic') {
        const { template } = await request(`/catalog/templates/${encodeURIComponent(source.templateId)}`);
        loaded = await materializeTemplateStart(loaded, { template, createMutationId: mutationId, request });
      }
      id = loaded.id;
      syncDraftUrl();
      try { sessionStorage.removeItem(cacheKey); } catch { /* Optional cache. */ }
      await initialize(loaded);
    } finally {
      creating = false;
      if (!disposed) for (const button of main.querySelectorAll(
        ".editor-start-options button",
      )) button.disabled = false;
    }
  }
  function picker() {
    main.replaceChildren(
      node(
        "section",
        { class: "editor-start" },
        node("h1", {}, "Tự thiết kế món quà"),
        node(
          "div",
          { class: "editor-start-options" },
          ...PRESETS.map(({ id, label }) => {
            const doc = sampleBindings(createDocument({ presetId: id }));
            const scene = doc.scenes.find(scene => scene.id === doc.entrySceneId);
            const card = button("", starterActions[id], { class: "editor-start-card", "data-preset": id });
            card.append(sceneThumbnail(doc, scene, { width: 104 }), node("span", {}, label));
            return card;
          }),
        ),
        button("← Về Studio", "studio"),
        node("div", { class: "editor-error", role: "alert", hidden: true }),
      ),
    );
  }
  function fit() {
    if (!store || !stage) return;
    fitted = true;
    const scroll = main.querySelector(".editor-stage-scroll");
    const padding = getComputedStyle(scroll);
    const width = scroll.clientWidth - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight);
    const height = scroll.clientHeight - parseFloat(padding.paddingTop) - parseFloat(padding.paddingBottom);
    const size = store.get().document.artboard.baseSize;
    setZoom(Math.min(1, Math.max(0.1, Math.min(width / size.width, quickMode ? 1 : height / size.height))));
  }
  function setZoom(value) {
    zoom = value;
    stage.setZoom(zoom);
    const control = main.querySelector('[data-editor-field="zoom"]');
    control.querySelector("[data-fit-zoom]")?.remove();
    if (!zoomLevels.includes(zoom))
      control.prepend(node("option", { value: String(zoom), "data-fit-zoom": "" }, `${Math.round(zoom * 100)}%`));
    control.value = String(zoom);
    main.querySelector('[data-editor-action="zoom-out"]').disabled = zoom <= zoomLevels[0];
    main.querySelector('[data-editor-action="zoom-in"]').disabled = zoom >= zoomLevels.at(-1);
  }
  function assignImage(value, elementId, assetId, slotId) {
    const index = value.document.elements.findIndex(item => item.id === elementId);
    const element = value.document.elements[index];
    if (!element) return;
    if (slotId) {
      const photo = element.props.photos?.find(item => item.id === slotId);
      if (!photo) return;
      photo.assetId = assetId;
    } else if (isLegacyFrame(element)) {
      value.document = insertPhotoFrame(value.document, assetId, elementId);
      return;
    }
    if (!slotId) {
      if (isPolaroidPlaceholder(element)) value.document.elements[index] = fillPolaroid(element, assetId);
      else if (element.type === "image") element.props.assetId = assetId;
      else return;
    }
    if (!value.document.assets.some(item => item.assetId === assetId))
      value.document.assets.push({ assetId, kind: "image" });
    if (design.policy?.kind === "creator-template" || value.document.schemaVersion === 2) {
      const used = new Set(assetIds(value.document));
      value.document.assets = value.document.assets.filter(ref => used.has(ref.assetId));
    }
  }
  async function upload(file, elementId, slotId) {
    if (!file || assetPending) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    )
      throw new Error(
        "Chọn ảnh PNG/JPEG/WebP tối đa 2 MB. Ảnh hiện tại được giữ nguyên.",
      );
    const frameUpload = isLegacyFrame(store.get().document.elements.find(element => element.id === elementId));
    assetPending = true;
    markStatus("Ảnh đang xử lý…");
    try {
      const result = await request(
        `/designs/designs/${encodeURIComponent(design.id)}/assets`,
        undefined,
        {
          method: "POST",
          headers: { "content-type": file.type, "x-mutation-id": newId() },
          body: file,
        },
      );
      if (result.asset.status !== "ready")
        throw new Error("Ảnh chưa sẵn sàng. Ảnh hiện tại được giữ nguyên.");
      commit(value => assignImage(value, elementId, result.asset.id, slotId), "Thay ảnh");
      if (frameUpload && !quickMode && selection === elementId) {
        const doc = store.get().document;
        const frame = doc.elements.find(element => element.id === elementId);
        choose(framePhoto(doc, frame)?.id || elementId);
      }
      renderInspector();
    } finally {
      assetPending = false;
      if (!disposed) markStatus(session.dirty ? "Chưa lưu" : `Đã lưu · r${session.revision}`);
    }
  }
  function openPreview(effectPreview) {
    if (assetPending) throw new Error("Chờ ảnh xử lý xong trước khi xem trước.");
    const dialog = node(
      "dialog",
      { class: "editor-preview-dialog", "aria-label": "Xem trước món quà" },
      node(
        "div",
        { class: "editor-preview-heading" },
        node("h2", {}, quickMode ? "Xem như người nhận" : "Xem trước món quà"),
        button("Phát lại", "preview-reset"),
        quickMode ? button("Sửa nội dung", "preview-close") : iconButton("Đóng xem trước", "preview-close", "close"),
        quickMode ? button("Gửi", "preview-send", { class: "editor-primary" }) : null,
      ),
      node("div", { class: "editor-preview-player" }),
    );
    document.body.append(dialog);
    dialogs.add(dialog);
    closePreview = trapDialog(dialog, () => {
      preview?.dispose();
      preview = null;
      closePreview = null;
      dialogs.delete(dialog);
    });
    try {
      preview = mountPlayer(dialog.querySelector(".editor-preview-player"), {
        document: structuredClone(store.get().document),
        assetUrl,
        mode: "preview",
        effectPreview,
      });
    } catch (error) {
      closePreview();
      throw error;
    }
    dialog.addEventListener(
      "click",
      (event) => {
        const action = event.target.closest("[data-editor-action]")?.dataset
          .editorAction;
        if (action === "preview-close") closePreview?.();
        if (action === "preview-reset") preview?.reset();
        if (action === "preview-send") {
          closePreview?.();
          void safe(publish)();
        }
      },
      { signal },
    );
  }
  async function flushSave(options) {
    if (composing)
      throw new Error("Hoàn tất nhập tiếng Việt trước khi lưu hoặc xuất bản.");
    if (assetPending) throw new Error("Chờ ảnh xử lý xong trước khi tiếp tục.");
    if (!session) throw new Error("Thiết kế chưa sẵn sàng.");
    return session.save(options);
  }
  async function submitTemplate() {
    const workspace = `/catalog/creator/workspaces/${encodeURIComponent(design.id)}`;
    const { previous } = await request(workspace + "/submission");
    const saved = await flushSave();
    if (session.dirty || session.revision !== saved.revision)
      throw new Error("Nháp vừa thay đổi. Hãy mở lại hộp gửi duyệt.");
    const snapshot = store.get();
    const { elements } = snapshot.document;
    const visible = elements.filter(element => element.visible !== false && element.opacity !== 0);
    const keys = visibleBindingKeys(snapshot.document);
    const bindings = Object.entries(bindingLabels).filter(([key]) => keys.has(key));
    const images = visible.filter(element => element.type === "image" && element.props.assetId);
    const currentAssets = assetIds(snapshot.document);
    const canKeepRights = previous && currentAssets.length && currentAssets.every(id => previous.assetIds.includes(id));
    const controls = bindings.map(([key, label]) => field(label, node("input", {
      type: "checkbox", value: key, checked: !previous || previous.bindings.includes(key), name: "binding",
    })));
    const photo = select("Khung ảnh Sender được thay", "template-photo", images.some(image => image.id === previous?.photoId) ? previous.photoId : "",
      [["", "Không có"], ...images.map((image, index) => [image.id, `${image.name || "Ảnh"} (${index + 1})`])]);
    const photoSelect = photo.querySelector("select");
    const scenes = snapshot.document.scenes;
    const cover = select("Cảnh dùng làm bìa mẫu", "template-cover",
      scenes.some(scene => scene.id === previous?.coverSceneId) ? previous.coverSceneId : snapshot.document.entrySceneId,
      scenes.map(scene => [scene.id, scene.name]));
    const coverSelect = cover.querySelector("select");
    const rights = node("textarea", { name: "rights", maxlength: 500, value: canKeepRights ? previous.rights || "" : "" });
    rights.required = currentAssets.length > 0;
    const changes = node("ul", { "aria-label": "Thay đổi từ lần gửi trước", "aria-live": "polite" });
    const identityWarning = node("p", { role: "status" });
    const form = node("form", {},
      node("h2", {}, "Gửi phiên bản để duyệt"),
      node("p", {}, "Chọn nội dung Sender được sửa. Tên và lời chúc minh họa chỉ dùng trong bản xem thử."),
      identityWarning,
      ...controls, photo, cover,
      rights.required ? field("Nguồn ảnh và quyền phân phối trong mẫu, quà", rights) : null,
      previous ? node("section", {}, node("h3", {}, "Thay đổi từ lần gửi trước"), changes) : null,
      node("p", { role: "alert" }),
      node("button", { type: "submit", class: "editor-primary" }, "Gửi duyệt"),
      node("button", { type: "button" }, "Quay lại"),
    );
    const dialog = node("dialog", { class: "editor-preview-dialog", "aria-label": "Gửi phiên bản để duyệt" }, form);
    const current = () => ({
      title: snapshot.title, bindings: new FormData(form).getAll("binding"),
      photoId: photoSelect.value || null, rights: rights.value.trim(), assetIds: currentAssets, coverSceneId: coverSelect.value
    });
    const updateChanges = () => {
      const selection = current();
      identityWarning.textContent = lockedVisibleNames(snapshot.document, selection.bindings).length
        ? "Mở quyền sửa các lớp tên đang hiển thị hoặc quay lại và đổi chúng thành chữ cố định trung tính." : "";
      changes.replaceChildren(...submissionChanges(previous, selection).map(change => node("li", {}, change)));
    };
    form.addEventListener("input", updateChanges, { signal });
    updateChanges();
    document.body.append(dialog);
    dialogs.add(dialog);
    const close = trapDialog(dialog, () => dialogs.delete(dialog));
    form.querySelector('button[type="button"]').addEventListener("click", close);
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      try {
        const { bindings, photoId, rights, coverSceneId } = current();
        await request(workspace + "/submit", {
          expectedRevision: saved.revision, bindings, photoId, rights, coverSceneId,
        });
        close();
        navigate("/creator");
      } catch (error) {
        form.querySelector('[role="alert"]').textContent = error.message;
        submit.disabled = false;
      }
    }, { signal });
  }
  function chooseGiftAccess() {
    const invite = ["invite", "Chỉ người có link mời"];
    const link = ["link", "Ai có link quà"];
    const choose = ["", "Chọn phạm vi"];
    const descriptions = node("div", { role: "status" });
    const form = node("form", {},
      node("h2", {}, "Quyền truy cập món quà"),
      node("p", {}, "Link mời có thể được chuyển tiếp. Bạn luôn xem được hồi đáp trong Studio."),
      select("Ai được mở quà?", "open", "", [choose, link, invite]),
      select("Ai được gửi hồi đáp?", "send", "", [choose, link, invite, ["disabled", "Tắt hồi đáp"]]),
      select("Ai được đọc hồi đáp?", "read", "", [choose, link, invite, ["sender", "Chỉ người gửi"]]),
      descriptions,
      node("button", { type: "submit", class: "editor-primary" }, "Xuất bản và lấy link"),
      node("button", { type: "button" }, "Quay lại"),
    );
    const controls = [...form.querySelectorAll("select")];
    controls.forEach(control => { control.required = true; });
    const selection = () => Object.fromEntries(controls.map(control => [control.dataset.editorField, control.value]));
    form.addEventListener("change", () => {
      const access = selection();
      const values = Object.values(access);
      descriptions.replaceChildren();
      if (!values.every(Boolean)) return;
      descriptions.append(node("p", {}, `Link thường. ${giftLinkDescription(access, false)}`));
      if (values.includes("invite")) descriptions.append(node("p", {}, `Link mời. ${giftLinkDescription(access, true)}`));
    }, { signal });
    const dialog = node("dialog", { class: "editor-preview-dialog", "aria-label": "Quyền truy cập món quà" }, form);
    return new Promise(resolve => {
      let access;
      document.body.append(dialog);
      dialogs.add(dialog);
      const close = trapDialog(dialog, () => {
        dialogs.delete(dialog);
        lifecycle.signal.removeEventListener("abort", close);
        resolve(access);
      });
      lifecycle.signal.addEventListener("abort", close, { once: true });
      form.querySelector('button[type="button"]').addEventListener("click", close);
      form.addEventListener("submit", event => {
        event.preventDefault();
        access = selection();
        close();
      });
    });
  }
  async function publish() {
    if (publishing) return;
    publishing = true;
    const control = main.querySelector('[data-editor-action="publish"]');
    control.disabled = true;
    try {
      const saved = await flushSave();
      markStatus("Đang kiểm tra quyền và nội dung…");
      const preflight = await request(
        `/designs/designs/${encodeURIComponent(design.id)}/preflight`,
        { expectedRevision: saved.revision },
      );
      if (session.dirty || session.revision !== saved.revision)
        throw new Error(
          "Thiết kế vừa thay đổi. Lưu và kiểm tra lại trước khi xuất bản.",
        );
      if (preflight.blockers?.some(({ code }) => code === "EMPTY_DESIGN")) {
        showBlockers(preflight.blockers);
        return;
      }
      if (preflight.authorization.status === "needs_template_license") {
        markStatus("Cần quyền sử dụng mẫu");
        if (!onCheckout)
          throw new Error("Cần mua quyền sử dụng mẫu trước khi xuất bản.");
        publishing = false;
        await onCheckout({ design: designView(), preflight, flushSave, mode: quickMode ? "quick" : "layout" });
        return;
      }
      if (!preflight.canPublish) {
        showBlockers(preflight.blockers || []);
        const messages = (preflight.blockers || [])
          .map((item) => `${item.path ? `${item.path}: ` : ""}${item.message}`)
          .join("\n");
        throw new Error(
          messages || `Chưa thể xuất bản (${preflight.authorization.status}).`,
        );
      }
      const access = await chooseGiftAccess();
      if (!access || disposed) return;
      if (session.dirty || session.revision !== saved.revision)
        throw new Error("Thiết kế vừa thay đổi. Lưu và kiểm tra lại trước khi xuất bản.");
      const accessKey = [access.open, access.send, access.read].join("-");
      const key = `momevia:canvas:publish:${ownerId}:${design.id}:${saved.revision}:${preflight.documentHash}:${accessKey}`;
      let intent;
      try {
        intent = sessionStorage.getItem(key);
      } catch {
        /* Optional cache. */
      }
      intent ||= newId();
      try {
        sessionStorage.setItem(key, intent);
      } catch {
        /* Optional cache. */
      }
      markStatus("Đang xuất bản…");
      const result = await request("/gifts/gifts/from-design", {
        designId: design.id,
        expectedRevision: saved.revision,
        expectedDocumentHash: preflight.documentHash,
        idempotencyKey: intent,
        access,
      });
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* Optional cache. */
      }
      publishing = false;
      toast("Đã xuất bản món quà.");
      await navigate(`/success/${encodeURIComponent(result.gift.slug)}`);
    } catch (error) {
      if (error.code !== "PUBLISH_BLOCKED" || !error.details?.some(({ code }) => code === "EMPTY_DESIGN")) throw error;
      showBlockers(error.details);
    } finally {
      publishing = false;
      if (!disposed) {
        control.disabled = false;
        if (session.status === "clean")
          markStatus(`Đã lưu · r${session.revision}`);
      }
    }
  }
  function showBlockers(blockers) {
    const host = main.querySelector(".editor-preflight");
    host.hidden = false;
    host.replaceChildren(
      node("strong", {}, "Cần hoàn thiện trước khi xuất bản"),
      ...blockers.map((blocker) => {
        if (blocker.code === "EMPTY_DESIGN") {
          return node("div", {},
            node("p", { role: "alert" }, blocker.message),
            button("Chèn lời chúc vào cảnh đang chọn", "insert-greeting"),
          );
        }
        const path = blocker.path || "",
          doc = store.get().document;
        const index = /^elements\.(\d+)/.exec(path)?.[1];
        let element = index !== undefined ? doc.elements[Number(index)] : null;
        if (!element && path.startsWith("assets."))
          element = doc.elements.find(
            (item) => photoSlots(item).some(photo => photo.assetId === path.slice(7)),
          );
        const missingPhoto = /\.props\.photos\.(\d+)\.(alt|assetId)$/.exec(path);
        const slot = missingPhoto && element?.props.photos?.[Number(missingPhoto[1])];
        const missingDoor = /\.actions\.(\d+)\.targetSceneId$/.exec(path);
        const binding = /^bindings\.(recipientName|senderName|message)/.exec(
          path,
        )?.[1];
        const control = button(
          blocker.message || blocker.code || "Nội dung chưa sẵn sàng",
          "focus-blocker",
          {
            "data-id": element?.id,
            "data-field": binding ? `binding.${binding}` : null,
            "data-photo-slot": slot?.id,
            "data-element-field": slot && missingPhoto[2] === "alt" ? `slot.${slot.id}.alt`
              : missingDoor && element?.props.kind === "scene-choices" ? `door.${missingDoor[1]}`
              : path.endsWith(".props.eventAt") ? "event-time" : null,
          },
        );
        return control;
      }),
    );
  }
  function sceneMove(delta) {
    commit((value) => {
      const list = value.document.scenes,
        index = list.findIndex((item) => item.id === sceneId),
        next = index + delta;
      if (next >= 0 && next < list.length)
        [list[index], list[next]] = [list[next], list[index]];
    }, "Sắp xếp cảnh");
  }
  function openSheet(kind, trigger) {
    if (!mobile.matches || quickMode) return;
    const target = main.querySelector(
      kind === "inspector" ? ".editor-inspector" :
        kind === "scenes" ? ".editor-scene-bar" : ".editor-library",
    );
    closeSheet();
    if (target.matches(".editor-library")) showLibrary(kind === "layers" ? "layers" : kind === "content" ? "content" : "add");
    const dockTrigger = trigger?.closest(".editor-mobile-dock") ? trigger :
      main.querySelector(`[data-editor-action="sheet-${kind === "content" ? "library" : kind}"]`);
    const background = [];
    for (let panel = target; panel && !panel.matches(".editor-workspace"); panel = panel.parentElement) {
      for (const peer of panel.parentElement.children) {
        if (peer !== panel && !peer.inert) {
          peer.inert = true;
          background.push(peer);
        }
      }
    }
    sheet = { target, previous: trigger || document.activeElement, dockTrigger, background };
    dockTrigger?.setAttribute("aria-expanded", "true");
    target.classList.add("editor-sheet-open");
    target.setAttribute("role", "dialog");
    target.setAttribute("aria-modal", "true");
    target.setAttribute("tabindex", "-1");
    target.focus();
  }
  function closeSheet() {
    if (!sheet) return;
    sheet.target.classList.remove("editor-sheet-open");
    sheet.target.removeAttribute("tabindex");
    sheet.target.removeAttribute("role");
    sheet.target.removeAttribute("aria-modal");
    const { previous, dockTrigger, background } = sheet;
    for (const panel of background) panel.inert = false;
    dockTrigger?.setAttribute("aria-expanded", "false");
    sheet = null;
    (previous?.isConnected && previous.getClientRects().length ? previous : dockTrigger)?.focus();
  }
  mobile.addEventListener("change", () => {
    if (!mobile.matches) closeSheet();
    if (fitted) fit();
  }, { signal });
  async function action(name, target) {
    if (name === "studio") {
      await navigate(design?.purpose === "creator" ? "/creator" : "/studio");
      return;
    }
    if (Object.values(starterActions).includes(name)) {
      target.disabled = true;
      try {
        await create(target.dataset.preset, {
          kind: "blank",
        });
      } finally {
        if (!disposed) target.disabled = false;
      }
      return;
    }
    if (name === "load-retry") {
      target.disabled = true;
      try {
        if (id)
          await initialize(
            (await request(`/designs/designs/${encodeURIComponent(id)}`))
              .design,
          );
        else if (templateId)
          await create("envelope-basic", { kind: "template", templateId });
      } finally {
        if (!disposed) target.disabled = false;
      }
      return;
    }
    if (!store) return;
    if (name === "advanced-design" || name === "fabric-studio") {
      if (!canOpenAdvancedEditor(design.policy))
        throw new Error("Mẫu hiện tại không cho phép thay đổi bố cục nâng cao.");
      // Người dùng vào từ chế độ nhanh sẽ được chuyển sang chế độ bố cục có quyền chỉnh.
      if (quickMode && name === "advanced-design") switchMode();
      if (quickMode) throw new Error("Hãy chuyển sang chế độ chỉnh bố cục trước khi mở Fabric Studio.");
      const { openFabricStudio } = await import("../features/canvas-editor/fabric-studio.js");
      const initialSequence = store.sequence;
      const studio = await openFabricStudio({
        snapshot: structuredClone(store.get().document),
        sceneId,
        policy: design.policy,
        assetUrl,
        onApply: (patch) => {
          if (store.sequence !== initialSequence)
            throw new Error("Nháp đã đổi trong lúc mở Fabric Studio. Hãy mở lại để tránh ghi đè.");
          commit(value => {
            // Chỉ persist metadata và bố cục qua schema Momevia; không lưu Fabric JSON.
            value.document = applyFabricWorkspacePatch(value.document, sceneId, patch, design.policy);
          }, "Fabric Studio: chỉnh lớp và bố cục");
        },
        onClose: () => {
          for (const item of dialogs)
            if (item.classList.contains("editor-fabric-dialog")) dialogs.delete(item);
        },
      });
      if (studio?.dialog && studio.dialog.open) dialogs.add(studio.dialog);
      return;
    }
    if (name === "toggle-mode") {
      switchMode();
      return;
    }
    if (name === "focus-blocker") {
      if (target.dataset.id) {
        if (quickMode) switchMode();
        selection = target.dataset.id;
        sceneId =
          store
            .get()
            .document.scenes.find((item) => item.elementIds.includes(selection))
            ?.id || sceneId;
        renderAll();
        renderInspector();
        openSheet("inspector", target);
        const focus = target.dataset.elementField
          ? `[data-editor-field="${CSS.escape(target.dataset.elementField)}"]`
          : target.dataset.photoSlot ? `[data-slot="${CSS.escape(target.dataset.photoSlot)}"]` : null;
        if (focus) main.querySelector(focus)?.focus();
      }
      if (target.dataset.field) {
        showLibrary("content");
        openSheet("content", target);
        main
          .querySelector(
            `[data-editor-field="${CSS.escape(target.dataset.field)}"]`,
          )
          ?.focus();
      }
      return;
    }
    if (name === "reuse-asset") {
      const assetId = target.dataset.id;
      if (selected()?.type === "image" || isPhotoFrame(selected()) || isPolaroidPlaceholder(selected())) {
        commit(value => assignImage(value, selection, assetId), "Dùng ảnh đã tải");
        renderInspector();
      }
      else {
        const image = createElement("image", {
          id: newId(),
          props: { assetId },
        });
        commit((value) => {
          value.document.elements.push(image);
          value.document.scenes
            .find((item) => item.id === sceneId)
            .elementIds.push(image.id);
        }, "Thêm ảnh đã tải");
        choose(image.id);
      }
      return;
    }
    if (name === "server-view") {
      const current = (
        await request(`/designs/designs/${encodeURIComponent(design.id)}`)
      ).design;
      const dialog = node(
        "dialog",
        { class: "editor-preview-dialog", "aria-label": "Bản máy chủ" },
        node("h2", {}, `Bản máy chủ · revision ${current.revision}`),
        node(
          "p",
          {},
          "Nội dung cục bộ vẫn được giữ trong editor. Chỉ dùng bản máy chủ khi bạn chủ động bỏ các thay đổi cục bộ.",
        ),
        node(
          "pre",
          { class: "editor-document-comparison" },
          JSON.stringify(
            {
              title: current.title,
              bindings: current.document.bindings,
              scenes: current.document.scenes.map((item) => ({
                id: item.id,
                name: item.name,
              })),
            },
            null,
            2,
          ),
        ),
        button("Đóng", "comparison-close"),
      );
      document.body.append(dialog);
      dialogs.add(dialog);
      const close = trapDialog(dialog, () => dialogs.delete(dialog));
      dialog
        .querySelector("button")
        .addEventListener("click", close, { once: true });
      return;
    }
    if (name === "server-reload") {
      if (
        !window.confirm(
          "Dùng bản máy chủ sẽ bỏ nội dung và lịch sử chỉnh sửa cục bộ hiện tại. Tiếp tục?",
        )
      )
        return;
      const current = (
        await request(`/designs/designs/${encodeURIComponent(design.id)}`)
      ).design;
      session.dispose();
      session.clearRecovery();
      session = null;
      await initialize(current);
      return;
    }
    if (name === "save" || name === "retry-save") {
      await flushSave({ force: Boolean(design.reviewTemplateDefaults) });
      return;
    }
    if (name === "undo") {
      store.undo();
      return;
    }
    if (name === "redo") {
      store.redo();
      return;
    }
    if (name === "select") {
      choose(target.dataset.id);
      main.querySelector(`.editor-layers [data-id="${CSS.escape(selection)}"]`)?.focus({ preventScroll: true });
      return;
    }
    if (name === "scene-select") {
      sceneId = target.dataset.id;
      selection = null;
      stage.render();
      renderScenes();
      renderLayers();
      renderInspector();
      updateCanvasGuidance();
      return;
    }
    if (name === "fit") {
      fit();
      return;
    }
    if (name === "zoom-in" || name === "zoom-out") {
      fitted = false;
      const next = name === "zoom-in" ? zoomLevels.find(level => level > zoom) : zoomLevels.findLast(level => level < zoom);
      if (next) setZoom(next);
      return;
    }
    if (name === "library-tab") {
      showLibrary(target.dataset.tab);
      return;
    }
    if (name === "filter-blocks") {
      discoveryMode = target.dataset.filterMode;
      filterBlocks(main.querySelector("[data-block-search]").value);
      return;
    }
    if (name === "clear-block-search") {
      const search = main.querySelector("[data-block-search]");
      search.value = "";
      discoveryMode = "all";
      main.querySelector("[data-block-group-select]").value = "";
      filterBlocks("");
      search.focus();
      return;
    }
    if (name === "greeting-starter") {
      const starter = memoryGreetingStarters[Number(target.dataset.index)];
      const message = store.get().document.bindings.message.value;
      const next = message ? `${message}\n${starter}` : starter;
      if (next.length > 1000) throw new Error("Lời chúc vượt 1.000 ký tự. Hãy rút ngắn trước khi chèn.");
      commit(value => { value.document.bindings.message.value = next; }, "Chèn câu mở đầu");
      const control = main.querySelector('[data-editor-field="binding.message"]');
      control.focus();
      control.setSelectionRange(next.length, next.length);
      return;
    }
    if (name === "remove-frame-photo") {
      const photo = framePhoto(store.get().document, quickPhotoFrame());
      if (!photo) return;
      commit(({ document }) => {
        document.elements = document.elements.filter(element => element.id !== photo.id);
        const scene = document.scenes.find(item => item.elementIds.includes(photo.id));
        scene.elementIds = scene.elementIds.filter(elementId => elementId !== photo.id);
        document.assets = document.assets.filter(asset => assetIds(document).includes(asset.assetId));
      }, "Bỏ ảnh cá nhân");
      return;
    }
    if (name === "preview") {
      openPreview();
      return;
    }
    if (name === "effect-preview") {
      openPreview({family:target.dataset.family,elementId:selection,sceneId:currentScene().id});
      return;
    }
    if (name === "effect-remove") {
      commit(({document}) => {
        const model = document.elements.find(item => item.id === selection) || document.scenes.find(scene => scene.id === sceneId);
        delete model.effects[target.dataset.family];
        if (!Object.keys(model.effects).length) delete model.effects;
      }, "Bỏ hiệu ứng");
      renderInspector();
      return;
    }
    if (name === "publish") {
      await publish();
      return;
    }
    if (name === "submit-template") return submitTemplate();
    if (name.startsWith("sheet-")) {
      openSheet(name.slice(6), target);
      return;
    }
    if (name === "close-sheet") {
      closeSheet();
      return;
    }
    if (name === "add" || name === "insert-greeting") {
      const scene = currentScene();
      const insertingGreeting = name === "insert-greeting";
      const block = catalog.flatMap(group => group.items).find(item => item.id === (insertingGreeting ? "greeting" : target.dataset.block));
      if (!block) return;
      const models = block.create();
      if (insertingGreeting) models[0].props.color = readableInk(scene.background.color);
      models.at(-1).name ||= block.title;
      placeBlock(models, stage.visibleArea(), store.get().document.elements.filter(item => scene.elementIds.includes(item.id)));
      commit((value) => {
        value.document.elements.push(...models);
        value.document.scenes
          .find((item) => item.id === scene.id)
          .elementIds.push(...models.map(item => item.id));
      }, `Chèn ${block.title.toLowerCase()}`);
      choose(models.at(-1).id);
      if (!insertingGreeting) {
        recentBlocks = addRecent(recentBlocks, block.id, catalog);
        try { localStorage.setItem(recentKey, JSON.stringify(recentBlocks)); }
        catch { /* Lưu cục bộ tùy chọn, không ảnh hưởng thao tác thêm hình. */ }
      }
      if (sheet) closeSheet();
      if (insertingGreeting) main.querySelector('[data-editor-action="preview"]').focus();
      return;
    }
    if (sceneActions.some(([, action]) => action === name)) {
      if (target.dataset.id !== sceneId) {
        sceneId = target.dataset.id;
        choose(null);
      }
    }
    if (name === "scene-add") {
      const nextId = newId();
      commit(
        (value) =>
          value.document.scenes.push({
            id: nextId,
            name: `Cảnh ${value.document.scenes.length + 1}`,
            background: { kind: "solid", color: "#FFF7EE" },
            elementIds: [],
          }),
        "Thêm cảnh",
      );
      sceneId = nextId;
      choose(null);
      renderScenes();
      return;
    }
    if (name === "scene-duplicate") {
      const original = currentScene(),
        nextId = newId(),
        idMap = new Map(
          original.elementIds.map((idValue) => [idValue, newId()]),
        );
      commit((value) => {
        const copy = structuredClone(original);
        copy.id = nextId;
        copy.name = `${copy.name.slice(0, 85)} (bản sao)`;
        copy.elementIds = original.elementIds.map((idValue) =>
          idMap.get(idValue),
        );
        const originals = value.document.elements.filter((item) => original.elementIds.includes(item.id));
        for (const model of originals) {
          const item = structuredClone(model);
          item.id = idMap.get(model.id);
          for (const a of item.actions || [])
            if (a.targetSceneId === original.id) a.targetSceneId = nextId;
          value.document.elements.push(item);
        }
        value.document.scenes.splice(
          value.document.scenes.findIndex((item) => item.id === sceneId) + 1,
          0,
          copy,
        );
      }, "Nhân bản cảnh");
      sceneId = nextId;
      choose(null);
      renderScenes();
      return;
    }
    if (name === "scene-up" || name === "scene-down") {
      sceneMove(name === "scene-up" ? -1 : 1);
      return;
    }
    if (name === "scene-entry") {
      commit((value) => {
        value.document.entrySceneId = sceneId;
      }, "Đổi cảnh mở đầu");
      return;
    }
    if (name === "scene-delete") {
      if (store.get().document.scenes.length === 1)
        throw new Error("Thiết kế cần ít nhất một cảnh.");
      const original = currentScene(),
        refs = store
          .get()
          .document.elements.filter(
            (item) =>
              !original.elementIds.includes(item.id) &&
              item.actions?.some((a) => a.targetSceneId === sceneId),
          );
      if (refs.length)
        throw new Error(
          `Cảnh đang được tham chiếu bởi: ${refs.map((item) => item.name || registry[item.type].label).join(", ")}. Đổi cảnh đích của các nút trước khi xóa.`,
        );
      if (
        !window.confirm(
          `Xóa cảnh “${original.name}” và ${original.elementIds.length} phần tử? Có thể hoàn tác trong phiên này.`,
        )
      )
        return;
      commit((value) => {
        value.document.scenes = value.document.scenes.filter(
          (item) => item.id !== sceneId,
        );
        value.document.elements = value.document.elements.filter(
          (item) => !original.elementIds.includes(item.id),
        );
        if (value.document.entrySceneId === sceneId)
          value.document.entrySceneId = value.document.scenes[0].id;
      }, "Xóa cảnh");
      selection = null;
      renderAll();
      return;
    }
    if (!selected()) throw new Error("Chọn một phần tử trước.");
    if (name === "inline-text") {
      closeSheet();
      stage.editText(selection);
      return;
    }
    if (name === "action-target") {
      commit(({ document }) => {
        document.elements.find(item => item.id === selection).actions = [
          { on: "activate", type: "goToScene", targetSceneId: target.dataset.id },
        ];
      }, "Chọn cảnh đích");
      renderInspector();
      main.querySelector(".editor-target-picker summary")?.focus();
      return;
    }
    if (["text-align", "text-font", "layer-visibility", "layer-lock"].includes(name)) {
      commit(({ document }) => {
        const item = document.elements.find(element => element.id === selection);
        if (name === "text-align") item.props.align = target.dataset.align;
        if (name === "text-font") item.props.fontToken = target.dataset.font;
        if (name === "layer-visibility") item.visible = item.visible === false;
        if (name === "layer-lock") item.locked = !item.locked;
      }, target.getAttribute("aria-label"));
      renderInspector();
      const variant = name === "text-align" ? `[data-align="${target.dataset.align}"]` :
        name === "text-font" ? `[data-font="${target.dataset.font}"]` : "";
      main.querySelector(`[data-editor-action="${name}"]${variant}`)?.focus({ preventScroll: true });
      return;
    }
    if (name === "center" || name === "inside") {
      commit(
        (value) => {
          const item = value.document.elements.find(
            (item) => item.id === selection,
          ),
            size = value.document.artboard.baseSize;
          item.layout.x =
            name === "center"
              ? (size.width - item.layout.width) / 2
              : Math.max(
                0,
                Math.min(item.layout.x, size.width - item.layout.width),
              );
          if (name === "inside")
            item.layout.y = Math.max(
              0,
              Math.min(item.layout.y, size.height - item.layout.height),
            );
        },
        name === "center" ? "Căn giữa" : "Đưa vào khung",
      );
      renderInspector();
      return;
    }
    if (name === "crop-reset") {
      commit((value) => {
        value.document.elements.find(
          (item) => item.id === selection,
        ).props.focalPoint = { x: 0.5, y: 0.5 };
      }, "Đặt lại crop");
      renderInspector();
      return;
    }
    if (name === "element-delete") {
      commit((value) => {
        value.document.elements = value.document.elements.filter(
          (item) => item.id !== selection,
        );
        for (const scene of value.document.scenes)
          scene.elementIds = scene.elementIds.filter(
            (idValue) => idValue !== selection,
          );
      }, "Xóa phần tử");
      selection = null;
      renderInspector();
      return;
    }
    if (name === "element-duplicate") {
      const nextId = newId();
      commit((value) => {
        const item = structuredClone(
          value.document.elements.find((item) => item.id === selection),
        );
        item.id = nextId;
        item.layout.x += 16;
        item.layout.y += 16;
        value.document.elements.push(item);
        value.document.scenes
          .find((item) => item.id === sceneId)
          .elementIds.push(nextId);
      }, "Nhân bản phần tử");
      choose(nextId);
      return;
    }
    if (name === "layer-up" || name === "layer-down") {
      commit((value) => {
        const list = value.document.scenes.find(
          (item) => item.id === sceneId,
        ).elementIds,
          index = list.indexOf(selection),
          next = index + (name === "layer-up" ? 1 : -1);
        if (next >= 0 && next < list.length)
          [list[index], list[next]] = [list[next], list[index]];
      }, "Sắp xếp lớp");
      return;
    }
  }
  async function change(event) {
    if (event.target.matches("[data-block-group-select]")) {
      filterBlocks(main.querySelector("[data-block-search]").value);
      return;
    }
    const control = event.target.closest("[data-editor-field]");
    if (!control || !store || composing) return;
    const key = control.dataset.editorField;
    if (key === "zoom") {
      fitted = false;
      setZoom(Number(control.value));
      return;
    }
    if (key === "snap") {
      snap = control.checked;
      return;
    }
    if (key === "upload" || key === "quick-photo") {
      const target = key === "quick-photo" ? quickPhotoFrame()?.id : selection;
      try {
        if (target) await upload(control.files?.[0], target, control.dataset.slot);
      } finally {
        control.value = "";
      }
      return;
    }
    const value =
      control.type === "checkbox"
        ? control.checked
        : control.type === "number"
          ? Number(control.value)
          : control.value;
    if (
      control.type === "number" &&
      (!Number.isFinite(value) || control.value === "")
    )
      throw new Error("Nhập một số hữu hạn.");
    commit(
      (next) => {
        if (key === "title") {
          next.title = String(value).trim() || "Món quà của tôi";
          return;
        }
        if (key.startsWith("binding.")) {
          next.document.bindings[key.slice(8)].value = value;
          return;
        }
        if (key === "quick-template-text") {
          const text = quickTemplateText(next.document);
          if (text) text.props.text = value;
          return;
        }
        if (key === "scene.name") {
          next.document.scenes.find((item) => item.id === sceneId).name = value;
          return;
        }
        if (key === "scene.color") {
          next.document.scenes.find(
            (item) => item.id === sceneId,
          ).background.color = value;
          return;
        }
        if (key.startsWith("effect.")) {
          const [,family,field] = key.split(".");
          const model = next.document.elements.find(item => item.id === selection) ||
            next.document.scenes.find(scene => scene.id === sceneId);
          if (field === "id") {
            if (value) (model.effects ??= {})[family] = {id:value};
            else {
              delete model.effects?.[family];
              if (model.effects && !Object.keys(model.effects).length) delete model.effects;
            }
          } else model.effects[family][field] = field === "delay" ? Number(value) : value;
          return;
        }
        const item = next.document.elements.find(
          (item) => item.id === selection,
        );
        if (!item) return;
        if (key.startsWith("entry.")) {
          const [,index,field] = key.split(".");
          item.props.entries[index][field] = value;
          return;
        }
        if (key.startsWith("door.")) {
          item.actions[Number(key.slice(5))].targetSceneId = value || null;
          return;
        }
        if (key.startsWith("slot.")) {
          const [,id,field] = key.split(".");
          const photo = item.props.photos.find(photo => photo.id === id);
          if (field === "x" || field === "y") photo.focalPoint[field] = value / 100;
          else photo[field] = value || (field === "assetId" ? null : "");
          return;
        }
        if (key === "event-time") {
          item.props.eventAt = value ? eventTimeFromLocal(value, item.props.timeZone) : null;
          return;
        }
        if (key === "textBinding") {
          if (value) {
            item.props.textBinding = value;
            delete item.props.text;
          } else {
            item.props.text =
              next.document.bindings[item.props.textBinding]?.value ||
              "Lời chúc của bạn";
            delete item.props.textBinding;
          }
          return;
        }
        if (key.startsWith("crop.")) {
          item.props.focalPoint ??= { x: 0.5, y: 0.5 };
          item.props.focalPoint[key.slice(5)] = value / 100;
          return;
        }
        if (key === "element.opacity") {
          item.opacity = (100 - value) / 100;
          return;
        }
        if (key === "action.type") {
          item.actions = [
            value === "replay"
              ? { on: "activate", type: "replay" }
              : { on: "activate", type: "goToScene", targetSceneId: null },
          ];
          return;
        }
        const [group, fieldName] = key.split(".");
        if (group === "element") item[fieldName] = value;
        else if (["props", "layout", "accessibility"].includes(group))
          item[group][fieldName] = value;
        if (
          ["label", "title"].includes(fieldName) &&
          ["button", "envelope", "gift-box"].includes(item.type)
        )
          item.accessibility.label = value;
      },
      "Chỉnh thuộc tính",
      {
        merge:
          event.type === "input" || event.type === "compositionend"
            ? control
            : null,
      },
    );
    if (["textBinding", "action.type", "props.fit", "props.radius", "props.timeZone", "accessibility.decorative"].includes(key) ||
      key.endsWith(".assetId") || (key.startsWith("effect.") && key.endsWith(".id")) ||
      key.startsWith("crop.")) renderInspector();
  }
  main.addEventListener(
    "click",
    safe(async (event) => {
      const target = event.target.closest("[data-editor-action]");
      if (!target) return;
      event.preventDefault();
      await action(target.dataset.editorAction, target);
    }),
    { signal },
  );
  main.addEventListener("change", safe(change), { signal });
  main.addEventListener("toggle", event => {
    if (event.target.matches(".editor-scene-menu[open]"))
      for (const menu of main.querySelectorAll(".editor-scene-menu[open]"))
        if (menu !== event.target) menu.open = false;
  }, { signal, capture: true });
  main.addEventListener(
    "input",
    safe((event) => {
      if (event.target.matches("[data-block-search]")) {
        filterBlocks(event.target.value);
        return;
      }
      if (
        composing ||
        !event.target.matches('input[type="text"],input:not([type]),textarea')
      )
        return;
      return change(event);
    }),
    { signal },
  );
  main.addEventListener("focusout", () => store?.endMerge(), { signal });
  main.addEventListener(
    "compositionstart",
    () => {
      composing = true;
    },
    { signal },
  );
  main.addEventListener(
    "compositionend",
    (event) => {
      composing = false;
      safe(change)(event);
    },
    { signal },
  );
  const beforeUnload = (event) => {
    if (session?.dirty || assetPending || stage?.gestureActive || stage?.textDirty || composing) {
      event.preventDefault();
      event.returnValue = "";
    }
  };
  window.addEventListener("beforeunload", beforeUnload, { signal });
  window.addEventListener(
    "online",
    () => {
      if (session && !["conflict", "session-expired"].includes(session.status))
        session.save().catch(warn);
    },
    { signal },
  );
  window.addEventListener(
    "keydown",
    safe((event) => {
      if (disposed || !store || composing || event.isComposing) return;
      if (event.key === "Escape") {
        if (document.querySelector("dialog[open]")) return;
        if (stage.gestureActive) {
          event.preventDefault();
          stage.cancel();
          return;
        }
        if (sheet) {
          event.preventDefault();
          closeSheet();
          return;
        }
        const menu = event.target.closest(".editor-scene-menu[open]");
        if (menu) {
          menu.open = false;
          menu.querySelector("summary").focus();
          return;
        }
        if (stopKeys(event.target)) {
          event.preventDefault();
          event.target.blur();
          return;
        }
        return;
      }
      if (sheet && event.key === "Tab") {
        const controls = [
          ...sheet.target.querySelectorAll(
            'button,input,textarea,select,summary,[tabindex="0"]',
          ),
        ].filter((control) => !control.disabled && control.getClientRects().length),
          first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
        return;
      }
      if (stopKeys(event.target) || document.querySelector("dialog[open]"))
        return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        return flushSave({ force: Boolean(design?.reviewTemplateDefaults) });
      }
      if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
          event.key,
        ) &&
        selected() &&
        !quickMode &&
        !selected().locked &&
        !design.policy?.lockedElements?.[selection]
      ) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        commit((value) => {
          const layout = value.document.elements.find(
            (item) => item.id === selection,
          ).layout;
          if (event.key === "ArrowLeft") layout.x -= step;
          if (event.key === "ArrowRight") layout.x += step;
          if (event.key === "ArrowUp") layout.y -= step;
          if (event.key === "ArrowDown") layout.y += step;
        }, "Di chuyển bằng phím");
        renderInspector();
      }
    }),
    { signal },
  );
  function hasUnsaved() {
    return Boolean(
      session?.dirty ||
      assetPending ||
      stage?.gestureActive ||
      stage?.textDirty ||
      publishing ||
      composing,
    );
  }
  function beforeLeave() {
    return (
      !hasUnsaved() ||
      window.confirm(
        "Thiết kế còn thay đổi chưa được xác nhận. Rời trang và giữ bản phục hồi cục bộ? Chọn Hủy để lưu trước.",
      )
    );
  }
  const ready = (async () => {
    if (!ownerId) throw new Error("Đăng nhập để thiết kế món quà.");
    if (id)
      await initialize(
        (await request(`/designs/designs/${encodeURIComponent(id)}`)).design,
      );
    else if (templateId)
      await create("envelope-basic", { kind: "template", templateId, ...(templateVersionId ? { templateVersionId } : {}) });
    else picker();
  })().catch((error) => {
    warn(error);
    if (!disposed && !store)
      main.append(
        node(
          "p",
          { class: "editor-load-failed", role: "alert" },
          error.message,
        ),
        button("Thử mở lại", "load-retry"),
      );
  });
  return {
    ready,
    flushSave,
    hasUnsaved,
    beforeLeave,
    canLeave: beforeLeave,
    get design() {
      return store ? designView() : null;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      lifecycle.abort();
      session?.dispose();
      unsubscribe?.();
      stageObserver?.disconnect();
      stage?.dispose();
      preview?.dispose();
      for (const dialog of dialogs) {
        dialog.close();
        dialog.remove();
      }
      dialogs.clear();
      main.classList.remove("editor-main", "editor-dragging");
    },
  };
}
