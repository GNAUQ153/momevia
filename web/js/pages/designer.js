import {
  createElement,
  registry,
  validateDocument,
  insertPhotoFrame,
  isPhotoFrame,
  assetIds,
} from "../shared/canvas/index.js";
import { mountPlayer } from "../features/gift-runtime/index.js";
import { bindingLabels, clearTemplateBindingDefaults, lockedVisibleNames, visibleBindingKeys } from "../shared/canvas/personalization.js";
import { submissionChanges } from "../shared/canvas/submission.js";
import { giftLinkDescription } from "../shared/gift-permissions.js";
import { framePhoto, MEMORY_TEMPLATE_ID, memoryGreetingStarters } from "../shared/canvas/basic-templates.js";
import { materializeTemplateStart } from '../features/canvas-editor/template-start.js';
import { createEditorStore } from "../features/canvas-editor/store.js";
import { createSaveSession } from "../features/canvas-editor/session.js";
import { createStage } from "../features/canvas-editor/stage.js";
import { applyFabricWorkspacePatch } from "../features/canvas-editor/fabric-workspace.js";
import {
  node,
  button,
  field,
  input,
  select,
  trapDialog,
} from "../features/canvas-editor/dom.js";

const newId = () => crypto.randomUUID();
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
  }
  function commit(mutate, label, options) {
    const next = structuredClone(store.get());
    mutate(next);
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
      isPhotoFrame(element) && element.visible !== false && !element.locked &&
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
      button("Hoàn tác", "undo", { "aria-label": "Hoàn tác (Ctrl Z)" }),
      button("Làm lại", "redo", { "aria-label": "Làm lại (Ctrl Shift Z)" }),
      button("Lưu nháp", "save", { class: "editor-save" }),
      button("Xem trước", "preview"),
      button("Fabric Studio", "fabric-studio", { class: "editor-layout-only" }),
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
      { class: "editor-library", "aria-label": "Công cụ thiết kế" },
      node(
        "div",
        { class: "editor-panel-heading editor-layout-only" },
        node("h2", {}, "Thêm vào món quà"),
        button("Đóng", "close-sheet", { class: "editor-sheet-close" }),
      ),
      node(
        "p",
        { class: "editor-help editor-layout-only" },
        "Chọn một khối, rồi chỉnh nội dung và vị trí.",
      ),
      node(
        "div",
        { class: "editor-add-grid editor-layout-only" },
        ...Object.entries(registry).map(([type, value]) =>
          button(value.label, "add", { "data-type": type }),
        ),
      ),
      node("h2", { class: "editor-quick-only" }, "Điền nội dung"),
      node("h3", { class: "editor-layout-only" }, "Nội dung cá nhân hóa"),
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
      node("h3", { class: "editor-layout-only" }, "Ảnh đã dùng"),
      node("div", { class: "editor-assets editor-layout-only" }),
      node("h3", { class: "editor-layout-only" }, "Các lớp"),
      node("div", { class: "editor-layers editor-layout-only" }),
    );
    const zoomControl = node(
      "select",
      { "aria-label": "Mức thu phóng", "data-editor-field": "zoom" },
      ...[0.5, 0.75, 1, 1.5, 2].map((value) =>
        node("option", { value: String(value) }, `${value * 100}%`),
      ),
    );
    zoomControl.value = "1";
    const stageArea = node(
      "section",
      { class: "editor-stage-column", "aria-label": "Bản thiết kế" },
      node("h2", { class: "editor-quick-only" }, "Bố cục thiệp"),
      node(
        "div",
        { class: "editor-stage-tools editor-layout-only" },
        node("span", {}, "Khung thiết kế · 390 × 844"),
        zoomControl,
        button("Vừa khung", "fit"),
        button("Căn giữa", "center"),
        button("Vào khung", "inside"),
        field(
          "Căn hút",
          node("input", {
            type: "checkbox",
            "data-editor-field": "snap",
            checked: snap,
          }),
        ),
      ),
      node("div", { class: "editor-stage-scroll" }),
    );
    const inspector = node("aside", {
      class: "editor-inspector editor-layout-only",
      "aria-label": "Thuộc tính",
    });
    const sceneBar = node(
      "section",
      { class: "editor-scene-bar", "aria-label": "Các cảnh" },
      node("div", { class: "editor-scenes" }),
      node(
        "div",
        { class: "editor-scene-actions editor-layout-only" },
        button("+ Cảnh", "scene-add"),
        button("Nhân bản cảnh", "scene-duplicate"),
        button("Cảnh lên", "scene-up"),
        button("Cảnh xuống", "scene-down"),
        button("Cảnh mở đầu", "scene-entry"),
        button("Xóa cảnh", "scene-delete"),
      ),
    );
    const dock = node(
      "nav",
      { class: "editor-mobile-dock editor-layout-only", "aria-label": "Bảng công cụ" },
      button("Thêm / Nội dung", "sheet-library"),
      button("Các lớp", "sheet-layers"),
      button("Thuộc tính", "sheet-inspector"),
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
      signal,
      getSnap: () => snap,
      isReadOnly: () => quickMode,
      isLayoutLocked: (idValue) =>
        Boolean(design.policy?.lockedElements?.[idValue]),
      onGesture: (active) => main.classList.toggle("editor-dragging", active),
    });
    renderAll();
  }
  function renderLayers() {
    const host = main.querySelector(".editor-layers");
    if (!host) return;
    const scene = currentScene();
    host.replaceChildren(
      ...[...scene.elementIds].reverse().map((idValue) => {
        const item = store
          .get()
          .document.elements.find((element) => element.id === idValue);
        return button(
          `${item.visible === false ? "◌ " : ""}${item.locked || design.policy?.lockedElements?.[item.id] ? "🔒 " : ""}${item.name || registry[item.type].label}`,
          "select",
          {
            "data-id": idValue,
            class: selection === idValue ? "is-selected" : "",
          },
        );
      }),
    );
  }
  function renderScenes() {
    const host = main.querySelector(".editor-scenes");
    if (!host) return;
    host.replaceChildren(
      ...store
        .get()
        .document.scenes.map((scene, index) =>
          button(
            `${index + 1}. ${scene.name}${scene.id === store.get().document.entrySceneId ? " · Mở đầu" : ""}`,
            "scene-select",
            {
              "data-id": scene.id,
              "aria-pressed": sceneId === scene.id,
              class: sceneId === scene.id ? "is-selected" : "",
            },
          ),
        ),
    );
  }
  function renderAssets() {
    const host = main.querySelector(".editor-assets");
    if (!host) return;
    const assets = store.get().document.assets;
    const signature = assets.map((asset) => asset.assetId).join("|");
    if (host.dataset.assetIds === signature) return;
    host.dataset.assetIds = signature;
    host.replaceChildren(
      ...assets.map((asset, index) => {
        const control = button(`Dùng ảnh ${index + 1}`, "reuse-asset", {
          "data-id": asset.assetId,
          class: "editor-asset-choice",
        });
        const image = node("img", {
          src: assetUrl(asset.assetId),
          alt: "",
          width: 40,
          height: 40,
          loading: "lazy",
        });
        control.prepend(image);
        return control;
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
  function renderInspector() {
    const host = main.querySelector(".editor-inspector");
    if (!host || composing) return;
    const element = selected(),
      scene = currentScene();
    const children = [
      node(
        "div",
        { class: "editor-panel-heading" },
        node(
          "h2",
          {},
          element ? registry[element.type].label : "Thuộc tính cảnh",
        ),
        button("Đóng", "close-sheet", { class: "editor-sheet-close" }),
      ),
    ];
    if (!element) {
      children.push(
        input("Tên cảnh", "scene.name", scene.name, { maxlength: 100 }),
        input("Màu nền", "scene.color", scene.background.color, {
          type: "color",
        }),
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
                { "data-editor-field": "props.text", rows: 5, maxlength: 4000 },
                props.text || "",
              ),
            ),
          );
        else
          children.push(
            node(
              "p",
              { class: "editor-help" },
              `Sửa ${bindingLabels[props.textBinding].toLowerCase()} trong bảng Nội dung cá nhân hóa.`,
            ),
          );
        children.push(
          input("Cỡ chữ", "props.fontSize", props.fontSize, {
            type: "number",
            min: 10,
            max: 160,
          }),
          select("Kiểu chữ", "props.fontToken", props.fontToken, [
            ["body", "Nội dung"],
            ["heading", "Tiêu đề"],
            ["serif", "Chữ có chân"],
          ]),
          select("Căn chữ", "props.align", props.align, [
            ["left", "Trái"],
            ["center", "Giữa"],
            ["right", "Phải"],
          ]),
        );
      }
      for (const key of registry[element.type].inspector) {
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
            ]),
          );
        else if (key === "fit")
          children.push(
            select("Khung ảnh", "props.fit", props.fit, [
              ["cover", "Lấp đầy / Crop"],
              ["contain", "Vừa ảnh"],
            ]),
          );
        else if (key === "stickerId")
          children.push(
            select(
              "Sticker",
              "props.stickerId",
              props.stickerId,
              [
                "heart",
                "star",
                "flower",
                "sparkles",
                "balloon",
                "cake",
                "gift",
              ].map((value) => [
                value,
                {
                  heart: "Trái tim",
                  star: "Ngôi sao",
                  flower: "Hoa",
                  sparkles: "Lấp lánh",
                  balloon: "Bóng bay",
                  cake: "Bánh",
                  gift: "Quà",
                }[value],
              ]),
            ),
          );
        else if (key !== "preset")
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
        children.push(
          field(
            "Chọn / Thay ảnh",
            node("input", {
              type: "file",
              accept: "image/png,image/jpeg,image/webp",
              "data-editor-field": "upload",
            }),
          ),
          input(
            "Mô tả ảnh",
            "accessibility.alt",
            element.accessibility.alt || "",
            { maxlength: 500 },
          ),
          input("Crop ngang (0–1)", "crop.x", props.focalPoint.x, {
            type: "number",
            min: 0,
            max: 1,
            step: 0.05,
          }),
          input("Crop dọc (0–1)", "crop.y", props.focalPoint.y, {
            type: "number",
            min: 0,
            max: 1,
            step: 0.05,
          }),
          button("Đặt lại crop", "crop-reset"),
        );
      }
      if (isPhotoFrame(element)) {
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
        if (action?.type !== "replay")
          children.push(
            select(
              "Cảnh đích",
              "action.targetSceneId",
              action?.targetSceneId || "",
              [
                ["", "Chọn cảnh…"],
                ...store
                  .get()
                  .document.scenes.map((value) => [value.id, value.name]),
              ],
            ),
          );
      }
      children.push(
        node("h3", {}, "Vị trí và kích thước"),
        node(
          "div",
          { class: "editor-layout-fields" },
          ...[
            ["x", "X"],
            ["y", "Y"],
            ["width", "Rộng"],
            ["height", "Cao"],
            ["rotation", "Xoay °"],
          ].map(([key, label]) =>
            input(label, `layout.${key}`, Number(layout[key].toFixed(2)), {
              type: "number",
              min:
                key === "width" || key === "height"
                  ? 1
                  : key === "rotation"
                    ? -360
                    : -10000,
              max: key === "rotation" ? 360 : 10000,
              step: 1,
            }),
          ),
        ),
        input("Độ trong suốt", "element.opacity", element.opacity ?? 1, {
          type: "number",
          min: 0,
          max: 1,
          step: 0.1,
        }),
        field(
          "Hiển thị",
          node("input", {
            type: "checkbox",
            "data-editor-field": "element.visible",
            checked: element.visible !== false,
          }),
        ),
        field(
          "Khóa tránh kéo nhầm",
          node("input", {
            type: "checkbox",
            "data-editor-field": "element.locked",
            checked: Boolean(element.locked),
          }),
        ),
        node(
          "div",
          { class: "editor-control-row" },
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
    const policy = design.policy?.lockedElements?.[element?.id];
    if (!element && design.policy?.kind === "creator-template")
      host.querySelectorAll("[data-editor-field]").forEach(control => { control.disabled = true; });
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
          (key === "upload" && permitted.includes("assetId"))
        );
      }
      for (const control of host.querySelectorAll("[data-editor-action]"))
        if (control.dataset.editorAction !== "close-sheet")
          control.disabled = true;
    }
  }
  function renderAll() {
    if (!store || disposed) return;
    const doc = store.get().document;
    if (!doc.scenes.some((value) => value.id === sceneId))
      sceneId = doc.entrySceneId;
    if (!doc.elements.some((value) => value.id === selection)) selection = null;
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
        node("span", { class: "eyebrow" }, "TỰ THIẾT KẾ MÓN QUÀ"),
        node("h1", {}, "Một khởi đầu riêng cho bạn"),
        node(
          "p",
          {},
          "Lưu nháp trước, xem thử và gửi qua link khi bạn sẵn sàng.",
        ),
        node(
          "div",
          { class: "editor-start-options" },
          button("Trang trống", "create-blank", { class: "editor-start-card" }),
          button("Phong bì → Lời chúc → Hồi đáp", "create-starter", {
            class: "editor-start-card",
          }),
        ),
        button("← Về Studio", "studio"),
        node("div", { class: "editor-error", role: "alert", hidden: true }),
      ),
    );
  }
  function fit() {
    if (!store || !stage) return;
    const width = main.querySelector(".editor-stage-scroll").clientWidth - 40;
    zoom = Math.min(
      1,
      Math.max(0.5, width / store.get().document.artboard.baseSize.width),
    );
    stage.setZoom(zoom);
    const control = main.querySelector('[data-editor-field="zoom"]');
    if (control) control.value = String(zoom);
  }
  async function upload(file, elementId) {
    if (!file || assetPending) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    )
      throw new Error(
        "Chọn ảnh PNG/JPEG/WebP tối đa 2 MB. Ảnh hiện tại được giữ nguyên.",
      );
    const frameUpload = isPhotoFrame(store.get().document.elements.find(element => element.id === elementId));
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
      commit((value) => {
        const image = value.document.elements.find(
          (item) => item.id === elementId,
        );
        if (!image) return;
        if (frameUpload && image.type === 'shape') { value.document = insertPhotoFrame(value.document, result.asset.id, elementId); return; }
        if (
          !value.document.assets.some(
            (item) => item.assetId === result.asset.id,
          )
        )
          value.document.assets.push({
            assetId: result.asset.id,
            kind: "image",
          });
        image.props.assetId = result.asset.id;
        if (design.policy?.kind === "creator-template") {
          const used = new Set(value.document.elements.filter(item => item.type === "image").map(item => item.props.assetId));
          value.document.assets = value.document.assets.filter(ref => used.has(ref.assetId));
        }
      }, "Thay ảnh");
      if (frameUpload && !quickMode) choose(store.get().document.elements.find(element => element.type === 'image' && element.props.assetId === result.asset.id)?.id || elementId);
      renderInspector();
    } finally {
      assetPending = false;
      if (!disposed) markStatus(session.dirty ? "Chưa lưu" : `Đã lưu · r${session.revision}`);
    }
  }
  function openPreview() {
    if (assetPending) throw new Error("Chờ ảnh xử lý xong trước khi xem trước.");
    const dialog = node(
      "dialog",
      { class: "editor-preview-dialog", "aria-label": "Xem trước món quà" },
      node(
        "div",
        { class: "editor-preview-heading" },
        node("h2", {}, quickMode ? "Xem như người nhận" : "Xem trước món quà"),
        button("Phát lại", "preview-reset"),
        button(quickMode ? "Sửa nội dung" : "Đóng", "preview-close"),
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
            (item) => item.props.assetId === path.slice(7),
          );
        const binding = /^bindings\.(recipientName|senderName|message)/.exec(
          path,
        )?.[1];
        const control = button(
          blocker.message || blocker.code || "Nội dung chưa sẵn sàng",
          "focus-blocker",
          {
            "data-id": element?.id,
            "data-field": binding ? `binding.${binding}` : null,
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
  function openSheet(kind) {
    const target = main.querySelector(
      kind === "inspector" ? ".editor-inspector" : ".editor-library",
    );
    closeSheet();
    sheet = { target, previous: document.activeElement };
    target.classList.add("editor-sheet-open");
    target.setAttribute("role", "dialog");
    target.setAttribute("aria-modal", "true");
    target.setAttribute("tabindex", "-1");
    target.focus();
    if (kind === "layers")
      target
        .querySelector(".editor-layers")
        ?.scrollIntoView({ block: "nearest" });
  }
  function closeSheet() {
    if (!sheet) return;
    sheet.target.classList.remove("editor-sheet-open");
    sheet.target.removeAttribute("tabindex");
    sheet.target.removeAttribute("role");
    sheet.target.removeAttribute("aria-modal");
    const previous = sheet.previous;
    sheet = null;
    previous?.focus();
  }
  async function action(name, target) {
    if (name === "studio") {
      await navigate(design?.purpose === "creator" ? "/creator" : "/studio");
      return;
    }
    if (name === "create-blank" || name === "create-starter") {
      target.disabled = true;
      try {
        await create(name === "create-blank" ? "blank" : "envelope-basic", {
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
    if (name === "fabric-studio") {
      if (quickMode || design.policy?.kind === "creator-template")
        throw new Error("Chỉ dùng Fabric Studio ở chế độ chỉnh bố cục được phép.");
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
        if (matchMedia("(max-width:800px)").matches) openSheet("inspector");
      }
      if (target.dataset.field) {
        if (!quickMode && matchMedia("(max-width:800px)").matches) openSheet("library");
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
      if (selected()?.type === "image")
        commit((value) => {
          value.document.elements.find(
            (item) => item.id === selection,
          ).props.assetId = assetId;
        }, "Dùng ảnh đã tải");
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
      return;
    }
    if (name === "scene-select") {
      sceneId = target.dataset.id;
      selection = null;
      stage.render();
      renderScenes();
      renderLayers();
      renderInspector();
      return;
    }
    if (name === "fit") {
      fit();
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
    if (name === "publish") {
      await publish();
      return;
    }
    if (name === "submit-template") return submitTemplate();
    if (name.startsWith("sheet-")) {
      openSheet(name.slice(6));
      return;
    }
    if (name === "close-sheet") {
      closeSheet();
      return;
    }
    if (name === "add" || name === "insert-greeting") {
      const scene = currentScene();
      const insertingGreeting = name === "insert-greeting";
      const { width, height } = store.get().document.artboard.baseSize;
      const element = insertingGreeting
        ? createElement("text", {
          id: newId(),
          layout: { x: width * 0.1, y: height * 0.18, width: width * 0.8, height: 120 },
          props: { textBinding: "message", align: "center", color: readableInk(scene.background.color) },
        })
        : createElement(target.dataset.type, { id: newId() });
      if (element.type === "reply") {
        element.layout.height = 300;
        element.layout.rotation = 0;
      }
      commit((value) => {
        value.document.elements.push(element);
        value.document.scenes
          .find((item) => item.id === scene.id)
          .elementIds.push(element.id);
      }, insertingGreeting ? "Chèn lời chúc" : "Thêm phần tử");
      choose(element.id);
      if (insertingGreeting) main.querySelector('[data-editor-action="preview"]').focus();
      return;
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
    const control = event.target.closest("[data-editor-field]");
    if (!control || !store || composing) return;
    const key = control.dataset.editorField;
    if (key === "zoom") {
      zoom = Number(control.value);
      stage.setZoom(zoom);
      return;
    }
    if (key === "snap") {
      snap = control.checked;
      return;
    }
    if (key === "upload" || key === "quick-photo") {
      const target = key === "quick-photo" ? quickPhotoFrame()?.id : selection;
      try {
        if (target) await upload(control.files?.[0], target);
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
        const item = next.document.elements.find(
          (item) => item.id === selection,
        );
        if (!item) return;
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
          item.props.focalPoint[key.slice(5)] = value;
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
        if (key === "action.targetSceneId") {
          item.actions = [
            { on: "activate", type: "goToScene", targetSceneId: value || null },
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
    if (key === "textBinding" || key.startsWith("action.")) renderInspector();
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
  main.addEventListener(
    "input",
    safe((event) => {
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
    if (session?.dirty || assetPending || stage?.gestureActive || composing) {
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
        if (stopKeys(event.target)) {
          event.preventDefault();
          event.target.blur();
          return;
        }
        if (sheet) {
          event.preventDefault();
          closeSheet();
          return;
        }
        return;
      }
      if (sheet && event.key === "Tab") {
        const controls = [
          ...sheet.target.querySelectorAll(
            'button,input,textarea,select,[tabindex="0"]',
          ),
        ].filter((control) => !control.disabled && !control.hidden),
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
