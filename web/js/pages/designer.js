import { mountRecipientOptions } from '../features/canvas-editor/recipient-options.js';
import { RECIPIENT_TOKEN } from '../shared/recipient-naming.js';
import { RESTYLE_PAIRS } from '../shared/canvas/template-slots.js';
import {materializeInsertionMedia} from '../features/canvas-editor/natural-insert.js';
import { openTemplateTrial } from '../features/catalog/template-trial.js';
import { captureTranslator, createLocaleControl, currentLocale, message, onLocaleChange, setAttr, setText, t } from "../core/i18n.js";
import { errorCopy } from "../core/api.js";
import {
  createElement,
  registry,
  validateDocument,
  insertPhotoFrame,
  isPhotoFrame,
  assetIds,
  createDocument,
  LIMITS,
} from "../shared/canvas/index.js";
import { requiresCanvasV2 } from "../shared/canvas/schema.js";
import { usesSound, SOUND_TYPES } from '../shared/canvas/sound.js';
import { eventTimeFromLocal, interactionKinds, localEventTime, photoSlots } from "../shared/canvas/interactions.js";
import { effectsFor, elementEffectFamilies, sceneEffectFamilies, effectPreset, effectLabel } from "../shared/canvas/effects.js";
import { starterPresets } from '../shared/canvas/presets.js';
import { loadCanvasLibrary, configureLibrary } from '../features/canvas-editor/library-client.js';
import { librarySnapshot, libraryLabel as libraryText } from '../shared/canvas/library-state.js';
import { refreshElementArtwork } from '../shared/canvas/library-materialize.js';
import { textFont } from "../features/gift-runtime/renderer.js";
import { bindingLabels, clearTemplateBindingDefaults, lockedVisibleNames, visibleBindingKeys } from "../shared/canvas/personalization.js";
import { submissionChanges } from "../shared/canvas/submission.js";
import { framePhoto, MEMORY_TEMPLATE_ID, memoryGreetingStarterKeys } from "../shared/canvas/basic-templates.js";
import { materializeTemplateStart } from '../features/canvas-editor/template-start.js';
import { createEventFields, updateEventFields, createStoryTextFields, updateStoryTextFields, storyAlbum, storyClock } from '../features/canvas-editor/event-fields.js';
import { createInvitationFields, updateInvitationFields } from '../features/canvas-editor/invitation-fields.js';
import { editInvitation } from '../shared/canvas/invitation.js';
import { predictionCard, PREDICTION_KIND } from '../shared/canvas/prediction.js';
import { createPredictionFields, updatePredictionFields } from '../features/canvas-editor/prediction-fields.js';
import { celebrationFields } from '../features/canvas-editor/celebration-fields.js';
import { CELEBRATION_IDS, celebrationSettings } from '../shared/canvas/effects.js';
import { createEditorStore } from "../features/canvas-editor/store.js";
import {copyElements,pasteElements,removeElements,editableElement} from '../features/canvas-editor/clipboard.js';
import {
  zoomLevels,
  libraryTabs,
  sceneActions,
  starterActions,
  toPercent,
  imagePicker,
  stopKeys,
  readableInk,
} from "../features/canvas-editor/designer-helpers.js";
import { createSaveSession } from "../features/canvas-editor/session.js";
import { openRecoveryCenter } from "../features/canvas-editor/recovery-center.js";
import { renderCanvasConflictReview } from "../features/canvas-editor/conflict-review.js";
import { describeSaveFeedback } from "../features/canvas-editor/save-feedback.js";
import { hasPendingEditorWork, historyShortcut } from "../features/canvas-editor/editor-guards.js";
import { nextSheetFocus } from "../features/canvas-editor/mobile-sheet.js";
import { syncHistoryControls } from "../features/canvas-editor/history-controls.js";
import { createStage } from "../features/canvas-editor/stage.js";
import { applyFabricWorkspacePatch } from "../features/canvas-editor/fabric-workspace.js";
import { sceneThumbnail, thumbnail } from "../features/canvas-editor/thumbnail.js";
import { bounds, catalog, fillPolaroid, isPolaroidPlaceholder, placeBlock, sampleBindings } from "../features/canvas-editor/library.js";
import { addRecent, readRecent, recentKey } from "../features/canvas-editor/library-discovery.js";
import { createDiscoveryPanel, filterDiscoveryPanel } from "../features/canvas-editor/discovery-panel.js";
import { cropEditor } from "../features/canvas-editor/crop.js";
import { canOpenAdvancedEditor, scenePositionLabel, selectionDescription } from "../features/canvas-editor/editor-experience.js";
import { canStartInlineFabric, assertInlineFabricRevision } from "../features/canvas-editor/fabric-inline.js";
import { soundtrackById } from '../shared/canvas/soundtracks.js';
import { createMusicPanel, filterMusicPanel, syncMusicPanel } from '../features/canvas-editor/music-panel.js';
import { openCanvasPreview } from "../features/canvas-editor/preview-dialog.js";
import { openGiftAccessDialog } from "../features/canvas-editor/gift-access-dialog.js";
import { createSceneLayerPanel } from "../features/canvas-editor/scene-layer-panel.js";
import { buildInspectorPropertyFields, buildInspectorGeometryFields, lockInspectorControls } from "../features/canvas-editor/inspector-fields.js";
import { createSoundtrackPlayback } from '../features/gift-runtime/soundtrack.js';
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
const isLegacyFrame = element => isPhotoFrame(element) && !isPolaroidPlaceholder(element);

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
  const libraryMediaCache=new Map();
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
  let musicPreview = null, recipientOptions = null;
  // Nghe thử chỉ hoạt động khi Sender đang xem tab thiết kế.
  globalThis.document.addEventListener("visibilitychange", () => {
    if (globalThis.document.hidden) musicPreview?.pause();
  }, { signal });
  let unsubscribe = null,
    closePreview = null,
    sheet = null,
    creating = false;
  let libraryTab = "content", fitted = true, stageObserver;
  let discoveryMode = "all";
  // Đổi ngôn ngữ không thay đổi nháp; chỉ cập nhật kết quả tìm và trạng thái bộ lọc.
  const removeLocaleListener = onLocaleChange(() => {
    if (disposed || !main.isConnected) return;
    const search = main.querySelector('[data-block-search]');
    const query = search?.value || '';
    const snapshot = librarySnapshot();
    if (snapshot) {
      configureLibrary(snapshot, currentLocale());
      const panel = main.querySelector('#editor-panel-add');
      if (panel?.hasChildNodes()) { panel.replaceChildren(...blockLibrary()); panel.querySelector('[data-block-search]').value = query; }
      if (store) renderInspector(); else if (!creating) picker();
    }
    if (main.querySelector('[data-block-search]')) filterBlocks(query);
    // Lọc lại theo bản dịch mới mà không xoá truy vấn người dùng đang nhập.
    filterMusicPanel(main);
  });
  signal.addEventListener('abort', removeLocaleListener, { once: true });
  let inlineFabricSession = null;
  let modalFabric = null;
  let inlineFabricOpening = false;
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
      message("editor.loading"),
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
    if (disposed) throw new DOMException(t("editor.error.closeDesign"), "AbortError");
    return result;
  }
  function warn(error) {
    if (!disposed && error.name !== "AbortError") {
      toast(errorCopy(error), "error");
      const banner = main.querySelector(".editor-error");
      if (banner) {
        banner.hidden = false;
        setText(banner, errorCopy(error));
      }
    }
  }
  function clearError() {
    const banner = main.querySelector(".editor-error");
    if (banner) {
      banner.hidden = true;
      setText(banner, "");
    }
    const blockers = main.querySelector(".editor-preflight");
    if (blockers) blockers.hidden = true;
  }
  function renderSaveFeedback({ label, tone, detail = "" }) {
    const status = main.querySelector(".editor-save-status");
    if (status) {
      setText(status, label);
      status.dataset.tone = tone;
      setAttr(status, "title", detail);
    }
    const hint = main.querySelector(".editor-save-hint");
    if (hint) {
      setText(hint, detail);
      hint.hidden = !detail;
    }
  }
  function markStatus(key, tone) {
    renderSaveFeedback({ label: message(key), tone });
  }
  function saveStatus(info) {
    renderSaveFeedback(describeSaveFeedback(info, message));
    if (info.status === "clean") clearError();
    if (info.revision > design.revision) {
      design.reviewTemplateDefaults = false;
      const note = main.querySelector(".editor-template-defaults");
      if (note) note.hidden = true;
    }
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
      setText(banner, errorCopy(info.error));
    }
  }
  function currentScene() {
    const doc = store.get().document;
    return doc.scenes.find((item) => item.id === sceneId) || doc.scenes[0];
  }
  let selectedSet=new Set(),elementClipboard=null,pasteCount=0;
  const selectedIds=()=>{const doc=store?.get().document,scene=doc?.scenes.find(s=>s.id===sceneId)||doc?.scenes[0];return [...new Set([...selectedSet,...(selection?[selection]:[])])].filter(id=>scene?.elementIds.includes(id)&&doc.elements.some(e=>e.id===id));};
  function selected() {
    return store.get().document.elements.find((item) => item.id === selection);
  }
  function choose(idValue,{additive=false}={}) {
    if(additive&&idValue){if(selectedSet.has(idValue))selectedSet.delete(idValue);else selectedSet.add(idValue);selection=[...selectedSet].at(-1)||null;}
    else {selection=idValue;selectedSet=new Set(idValue?[idValue]:[]);}
    store?.endMerge();
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
    if (sceneStatus) setText(sceneStatus, scenePositionLabel(document, sceneId, message));
    if (selectionStatus) setText(selectionStatus, selectionDescription(document, sceneId, selection, design.policy, message));
  }
  function commit(mutate, label, options) {
    const next = structuredClone(store.get());
    mutate(next);
    if (next.document.schemaVersion === 1 && requiresCanvasV2(next.document)) {
      next.document.schemaVersion = 2;
      next.document.registryVersion = 2;
    }
    if(usesSound(next.document))next.document.schemaVersion=next.document.registryVersion=3;
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
  async function editSound({newButton=false}={}) {
    if(assetPending||design.policy?.kind==='creator-template')return;
    const model=newButton?null:selected(),elementId=model?.id;
    if(model&&(!SOUND_TYPES.includes(model.type)||model.locked||design.policy?.lockedElements?.[model.id]||design.policy?.kind==='creator-template'))return;
    const {openSoundEditor}=await import('../features/canvas-editor/sound-editor.js');
    let uploadMutation=newId(),uploadBytes=null;
    await openSoundEditor({current:model?.sound,assetUrl,registerDialog:dialog=>dialogs.add(dialog),
      upload:async bytes=>{
        if(bytes!==uploadBytes){uploadMutation=newId();uploadBytes=bytes;}
        assetPending=true;
        try{return (await request(`/designs/designs/${encodeURIComponent(design.id)}/audio`,undefined,{method:'POST',headers:{'content-type':'audio/wav','x-mutation-id':uploadMutation},body:bytes})).asset;}
        finally{assetPending=false;}
      },
      onApply:sound=>{
        let inserted;
        commit(value=>{
          let target=value.document.elements.find(e=>e.id===elementId);
          if(!elementId){target=createElement('sound-button',{layout:{width:205,height:54}},t);placeBlock([target],stage.visibleArea(),value.document.elements.filter(e=>currentScene().elementIds.includes(e.id)));inserted=target.id;value.document.elements.push(target);value.document.scenes.find(s=>s.id===sceneId).elementIds.push(target.id);}
          if(!target)throw new Error(t('sfx.targetMissing'));
          target.sound=sound;
          if(sound.kind==='audio'&&!value.document.assets.some(a=>a.assetId===sound.assetId))value.document.assets.push({assetId:sound.assetId,kind:'audio'});
          const used=new Set(assetIds(value.document));value.document.assets=value.document.assets.filter(a=>used.has(a.assetId));
        },t('sfx.history'));
        if(inserted)choose(inserted);else renderInspector();
      },
      onRemove:()=>{commit(value=>{const target=value.document.elements.find(e=>e.id===elementId);if(target)delete target.sound;const used=new Set(assetIds(value.document));value.document.assets=value.document.assets.filter(a=>used.has(a.assetId));},t('sfx.remove'));renderInspector();},
    });
  }
  function textOptions(element) {
    if (element?.type !== "text" || element.visible === false) return null;
    const binding = element.props.textBinding;
    if (design.policy?.lockedElements?.[element.id] && (!binding || !design.policy.editableBindings?.includes(binding))) return null;
    return binding
      ? { label: bindingLabels[binding], maxlength: binding === "message" ? 1000 : 60 }
      : { label: t("editor.designer.cardText"), maxlength: LIMITS.text };
  }

  function commitInlineText(elementId, value) {
    try {
      commit(({ document }) => {
        const element = document.elements.find(item => item.id === elementId);
        if (!textOptions(element)) return;
        if (element.props.textBinding) document.bindings[element.props.textBinding].value = value;
        else element.props.text = value;
      }, t("editor.history.editCardText"));
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
  const statusNode = () => node(
    "div", { class: "editor-save-group" },
    node("span", { class: "editor-save-status", "data-tone": "saved", role: "status", "aria-live": "polite" }),
    node("span", { class: "editor-save-hint", hidden: true }),
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
    if (id === "hai-phong-bi") return document.elements.find(element => element.type === "text" && element.id === "envelope-memory")
      || document.elements.find(element => element.type === "text" && element.name === "Nội dung kỷ niệm");
    return id === MEMORY_TEMPLATE_ID ? document.elements.find(element => element.type === "text" && element.name === "Chú thích ảnh" && Object.hasOwn(element.props, "text")) : null;
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
    if (mode) setText(mode, message(quickMode ? "editor.mode.editLayout" : "editor.mode.quick"));
    const preview = workspace.querySelector('[data-editor-action="preview"]');
    const save = workspace.querySelector('[data-editor-action="save"]');
    setText(preview, message(quickMode ? "editor.mode.recipientPreview" : "editor.actions.preview"));
    preview.classList.toggle("editor-primary", quickMode);
    if (quickMode) {
      workspace.querySelector('[data-editor-action="undo"]').before(preview, save);
    } else {
      workspace.querySelector('[data-editor-action="redo"]').after(save, preview);
    }
    setAttr(workspace.querySelector(".editor-library"), "aria-label", message(quickMode ? "editor.mode.quickLabel" : "editor.tools"));
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
    return createDiscoveryPanel({ policy: design.policy, discoveryMode, signal });
  }

  function filterBlocks(query) {
    filterDiscoveryPanel(main.querySelector("#editor-panel-add"), { query, discoveryMode, recentBlocks });
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
      button(message("editor.interface.draft"), "recovery-center", { class: "editor-recovery-entry", title: message("editor.interface.draftHint") }),
      createLocaleControl(),
      iconButton(message("editor.actions.undo"), "undo", "undo"),
      iconButton(message("editor.actions.redo"), "redo", "redo"),
      button(message("editor.actions.saveDraft"), "save", { class: "editor-save" }),
      button(message("editor.actions.preview"), "preview"),
      canOpenAdvancedEditor(design.policy)
        ? button(message("editor.actions.inline"), "inline-fabric", {
          class: "editor-inline-cta",
          title: message("editor.actions.inlineHint"),
        }) : null,
      canOpenAdvancedEditor(design.policy)
        ? button(message("editor.actions.advanced"), "advanced-design", {
          class: "editor-advanced-cta",
          title: message("editor.actions.advancedHint"),
        })
        : null,
      design.purpose === "creator"
        ? button(message("editor.actions.submit"), "submit-template", { class: "editor-primary" })
        : button(message("editor.actions.publish"), "publish", { class: "editor-primary editor-layout-only" }),
    );
    const heading = node(
      "div",
      { class: "editor-heading" },
      button(message(design.purpose === "creator" ? "editor.actions.myTemplates" : "editor.actions.studio"), "studio"),
      node("input", {
        class: "editor-title",
        "aria-label": message("editor.fields.title"),
        "data-editor-field": "title",
        value: store.get().title,
        maxlength: 120,
      }),
      statusNode(),
      design.restyledFrom ? button(message("restyle.original"),"restyle-original") : null,
      design.policy?.kind === "sender-basic" && RESTYLE_PAIRS[design.source.templateId] ? button(message("restyle.title"), "restyle") : null,
      design.source?.kind === "template" ? button("", "toggle-mode", { class: "editor-mode" }) : null,
    );
    const top = node("header", { class: "editor-topbar" }, heading, tools);
    const sidebar = node(
      "aside",
      { class: "editor-library", id: "editor-library", "aria-label": message("editor.tools") },
      node(
        "div",
        { class: "editor-panel-heading editor-layout-only" },
        node("h2", {}, message("editor.tools")),
        iconButton(message("editor.actions.closeTools"), "close-sheet", "close", { class: "editor-sheet-close" }),
      ),
      node(
        "nav",
        { class: "editor-library-tabs editor-layout-only", "aria-label": message("editor.tools") },
        ...Object.entries(libraryTabs).map(([key, label]) =>
          button(message(`editor.interface.tab.${key}`), "library-tab", { "data-tab": key, "aria-controls": `editor-panel-${key}` })),
      ),
      node(
        "div",
        { "data-library-panel": "add", id: "editor-panel-add" },
      ),
      node("div", { "data-library-panel": "content", id: "editor-panel-content" },
        node("h2", { class: "editor-quick-only" }, message("editor.quick.title")),
        ...Object.keys(bindingLabels).filter(key =>
          design.policy?.kind !== "creator-template" || design.policy.editableBindings.includes(key)).map(key =>
            key === "message"
              ? field(
                message(`editor.binding.${key}`),
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
                message(`editor.binding.${key}`),
                `binding.${key}`,
                store.get().document.bindings[key].value,
                { maxlength: 60 },
              ),
          ),
        design.purpose !== 'creator' ? button(message('recipient.insert'), 'insert-recipient', { disabled: design.policy?.kind === 'creator-template' && (!design.policy.editableBindings.includes('recipientName') || !design.policy.editableBindings.includes('message')), title: message('recipient.insertHint') }) : null,
        design.policy?.kind === 'sender-basic' && design.purpose !== 'creator' && (design.source.templateId === 'loi-moi-ben-hien' || store.get().document.invitation)
          ? createInvitationFields(store.get().document, design.invitationSlotIds) : null,
        node("div", { class: "editor-quick-only" },
          design.policy?.kind === 'sender-basic' ? createStoryTextFields(store.get().document) : null,
          predictionCard(store.get().document) ? createPredictionFields(predictionCard(store.get().document)) : null,
          design.policy?.kind === 'sender-basic' && ['birthday-radiance','hai-phong-bi','proud-of-you','loi-moi-ben-hien','cuon-phim-ngay-ay'].includes(design.source.templateId) ? createEventFields(store.get().document) : null,
          design.source.templateId === MEMORY_TEMPLATE_ID ? node("div", { class: "editor-greeting-starters" },
            node("p", { class: "editor-help" }, message("editor.quick.startGreeting")),
            ...memoryGreetingStarterKeys.map((key, index) => button(message(key), "greeting-starter", { "data-index": index })),
          ) : null,
          design.source.templateId === "hai-phong-bi" && quickTemplateText(store.get().document) ? field(
            message("templates.hai-phong-bi.memoryField"), node("textarea", {
              "data-editor-field": "quick-template-text", maxlength: LIMITS.text, rows: 6,
            }, quickTemplateText(store.get().document).props.text),
          ) : quickTemplateText(store.get().document) ? input(
            quickTemplateText(store.get().document).name, "quick-template-text", quickTemplateText(store.get().document).props.text, { maxlength: 500 },
          ) : null,
          node("div", { class: "editor-quick-photo", hidden: true },
            field(message("editor.quick.photo"), node("input", {
              type: "file",
              accept: "image/png,image/jpeg,image/webp",
              "data-editor-field": "quick-photo",
            })),
            node("p", { class: "editor-help" }, message("editor.quick.photoLimits")),
            design.source.templateId === MEMORY_TEMPLATE_ID ? button(message("editor.quick.removePhoto"), "remove-frame-photo", { hidden: true }) : null,
          ),
        ),
        design.purpose !== 'creator' ? createMusicPanel(store.get().document.soundtrack) : null,
        node("p", { class: "editor-help editor-layout-only" },
          message("editor.quick.bindingsHelp"),
        ),
      ),
      node("div", { "data-library-panel": "assets", id: "editor-panel-assets", class: "editor-assets" }),
      node('div',{'data-library-panel':'sounds',id:'editor-panel-sounds'},node('h3',{},message('sfx.title')),node('p',{class:'editor-help'},message('sfx.hint')),button(message('sfx.addButton'),'sound-add',{disabled:design.policy?.kind==='creator-template'}),button(message('sfx.open'),'sound-picker',{disabled:design.policy?.kind==='creator-template'})),
      node("div", { "data-library-panel": "layers", id: "editor-panel-layers", class: "editor-layers" }),
    );
    const zoomControl = node(
      "select",
      { "aria-label": message("editor.zoom.level"), "data-editor-field": "zoom" },
      ...zoomLevels.map((value) =>
        node("option", { value: String(value) }, `${value * 100}%`),
      ),
    );
    zoomControl.value = "1";
    const stageArea = node(
      "section",
      { class: "editor-stage-column", "aria-label": message("editor.stage.label") },
      node("h2", { class: "editor-quick-only" }, message("editor.stage.layout")),
      node("div", { class: "editor-experience-header editor-layout-only" },
        node("div", { class: "editor-experience-heading" },
          node("span", { class: "editor-experience-kicker" }, message("editor.stage.badge")),
          node("h2", {}, message("editor.stage.title")),
          node("p", {}, message("editor.stage.body")),
        ),
        node("span", { class: "editor-scene-progress", "data-editor-scene-progress": "" }, message("editor.stage.initialScene")),
      ),
      node("p", { class: "editor-quick-tip editor-quick-only" },
        message("editor.stage.tip")),
      node(
        "div",
        { class: "editor-stage-tools editor-layout-only" },
        iconButton(message("editor.zoom.out"), "zoom-out", "zoom-out"),
        zoomControl,
        iconButton(message("editor.zoom.in"), "zoom-in", "zoom-in"),
        iconButton(message("editor.zoom.fit"), "fit", "fit"),
        field(
          message("editor.zoom.snap"),
          node("input", {
            type: "checkbox",
            "data-editor-field": "snap",
            checked: snap,
          }),
        ),
      ),
      node("p", { class: "editor-selection-summary editor-layout-only", "data-editor-selection": "", role: "status", "aria-live": "polite" },
        message("editor.stage.select")),
      // Các nút lịch sử được chuyển gần vùng thiết kế trên mobile, dùng chung store.
      node("div", { class: "editor-mobile-history editor-layout-only", role: "group", "aria-label": message("editor.mobileHistory.title") },
        button(message("editor.mobileHistory.undo"), "mobile-undo", { class: "editor-history-control", disabled: true }),
        button(message("editor.mobileHistory.redo"), "mobile-redo", { class: "editor-history-control", disabled: true }),
      ),
      node("div", { class: "editor-stage-scroll" }),
      node("div", { class: "editor-inline-mount", hidden: true, "aria-label": message("editor.stage.fabricLabel") }),
      node("details", { class: "editor-editing-help editor-layout-only" },
        node("summary", {}, message("editor.help.title")),
        node("ol", {},
          node("li", {}, message("editor.help.add")),
          node("li", {}, message("editor.help.select")),
          node("li", {}, message("editor.help.advanced")),
          node("li", {}, message("editor.help.save")),
        ),
      ),
    );
    const inspector = node("aside", {
      class: "editor-inspector editor-layout-only",
      id: "editor-inspector",
      "aria-label": message("editor.interface.edit"),
    });
    const sceneBar = node(
      "section",
      { class: "editor-scene-bar", id: "editor-scene-bar", "aria-label": message("editor.scenes.label") },
      node("div", { class: "editor-panel-heading editor-layout-only" },
        node("h2", {}, message("editor.interface.scene")),
        iconButton(message("editor.scenes.close"), "close-sheet", "close", { class: "editor-sheet-close" })),
      node("div", { class: "editor-scenes" }),
      node(
        "div",
        { class: "editor-scene-actions editor-layout-only" },
        button(message("editor.scenes.add"), "scene-add"),
      ),
    );
    const dock = node(
      "nav",
      { class: "editor-mobile-dock editor-layout-only", "aria-label": message("editor.tools.panels") },
      button(message("editor.interface.add"), "sheet-library", { "aria-controls": "editor-library", "aria-expanded": false }),
      button(message("editor.interface.layers"), "sheet-layers", { "aria-controls": "editor-library", "aria-expanded": false }),
      button(message("editor.interface.edit"), "sheet-inspector", { "aria-controls": "editor-inspector", "aria-expanded": false }),
      button(message("editor.interface.scene"), "sheet-scenes", { "aria-controls": "editor-scene-bar", "aria-expanded": false }),
    );
    main.replaceChildren(
      node(
        "section",
        { class: "editor-workspace" },
        top,
        design.policy?.kind === "creator-template" && lockedVisibleNames(design.document, design.policy.editableBindings).length
          ? node("p", { class: "editor-help" }, message("editor.interface.lockedNames"))
          : null,
        design.reviewTemplateDefaults
          ? node("p", { class: "editor-help editor-template-defaults", role: "status" }, message("editor.interface.defaultsCleared"))
          : null,
        node("div", { class: "editor-error", role: "alert", hidden: true }),
        node("div", { class: "editor-preflight", hidden: true }),
        node(
          "div",
          { class: "editor-session-actions", hidden: true },
          button(message("editor.interface.retrySave"), "retry-save"),
          button(message("editor.interface.viewServer"), "server-view"),
          button(message("editor.interface.useServer"), "server-reload"),
        ),
        node("div", { class: "editor-grid" }, sidebar, stageArea, inspector),
        sceneBar,
        button("", "close-sheet", {
          class: "editor-sheet-backdrop",
          hidden: true,
          tabindex: -1,
          "aria-hidden": "true",
        }),
        dock,
      ),
    );
    if (design.policy?.kind === "creator-template") {
      for (const control of main.querySelectorAll('[data-editor-action="add"], .editor-scene-actions button, [data-editor-action="center"], [data-editor-action="inside"]'))
        control.disabled = true;
    }
    recipientOptions = design.purpose !== 'creator' ? mountRecipientOptions(main.querySelector('#editor-panel-content'), { store, commit, policy: design.policy, signal }) : null;
    showMode();
    stage = createStage(main.querySelector(".editor-stage-scroll"), {
      store,
      getSceneId: () => sceneId,
      getSelection: () => selection,
      getSelections: selectedIds,
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
    stageObserver = new ResizeObserver(() => { if (fitted && !sheet && !inlineFabricSession && !inlineFabricOpening) fit(); });
    stageObserver.observe(main.querySelector(".editor-stage-scroll"));
    renderAll();
  }
  // Chỉ điều phối; DOM và cache thumbnail nằm trong Scene/Layer Panel riêng.
  const sceneLayerPanel = createSceneLayerPanel({
    main,
    getDocument: () => store.get().document,
    getSceneId: () => sceneId,
    getSelection: () => selection,
    getPolicy: () => design.policy,
    isQuickMode: () => quickMode,
    assetUrl,
    message,
  });
  const { renderLayers, renderScenes } = sceneLayerPanel;
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
          const control = button(message("editor.interface.usePhoto", { name: model.name || index + 1 }), "reuse-asset", {
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
          message("editor.interface.emptyAssets"),
        ),
      );
  }
  function effectFields(model, element) {
    const categories = element ? elementEffectFamilies : sceneEffectFamilies;
    const fields = categories.flatMap(family => {
      const preset = model.effects?.[family];
      const options = effectsFor(family, element).filter(([id]) => !(family === 'ambience' && model.effects?.celebrations && CELEBRATION_IDS.includes(id)));
      if (preset && !options.some(([id]) => id === preset.id)) options.push([preset.id, preset.id]);
      if (!options.length) return [];
      const prefix = `effect.${family}.`;
      return [node("fieldset", { class: "editor-effect-settings" },
        node("legend", {}, family === 'ambience' && model.effects?.celebrations ? message('editor.celebrations.once') : message(`editor.effects.family.${family}`)),
        select(message("editor.interface.effects"), prefix + "id", preset?.id, [["", message("editor.interface.effectOff")], ...options.map(([id]) => [id, id === preset?.id && preset.definition ? libraryText(preset.definition.title, currentLocale()) : /^[SEATBR][0-9]{2}$/.test(id) ? message(`editor.effects.preset.${id}`) : effectLabel(id, currentLocale())])]),
        preset && family !== "surface" ? select(message("editor.interface.speed"), prefix + "speed", preset.speed || "normal",
          [["slow", message("editor.interface.slow")], ["normal", message("editor.interface.normal")], ["fast", message("editor.interface.fast")]]) : null,
        preset && family === "entrance" ? select(message("editor.interface.delay"), prefix + "delay", preset.delay || 0,
          [[0, message("editor.interface.delayImmediate")], [150, "150 ms"], [300, "300 ms"]]) : null,
        preset && family === "ambience" ? select(message("editor.interface.density"), prefix + "density", preset.density || "normal",
          [["sparse", message("editor.interface.sparse")], ["normal", message("editor.interface.normal")]]) : null,
        preset?.definition?.animation.engine === 'particles' ? field(message('editor.celebrations.loop'), node('input', {
          type: 'checkbox', checked: preset.loop === true, 'data-editor-field': prefix + 'loop',
        })) : null,
        family==='emphasis'&&preset?.definition?.animation.engine==='keyframes'?field(message('editor.celebrations.loop'),node('input',{
          type:'checkbox',checked:preset.definition.animation.iterations==='infinite','data-editor-field':prefix+'repeat',
        })):null,
        preset && (["S02", "S04"].includes(preset.id) || preset.definition?.animation.styles?.shadowBlur !== undefined) ? input(message(preset.definition?.animation.styles?.shadowBlur !== undefined ? "adminLibrary.style.shadowColor" : "editor.interface.stroke"), prefix + "color",
          preset.color || preset.definition?.animation.styles?.shadowColor || (preset.id === "S02" ? "#6D488A" : "#F3DA97"), { type: "color" }) : null,
        preset ? node("div", { class: "editor-control-row" },
          button(message("editor.interface.preview"), "effect-preview", { "data-family": family }),
          button(message("editor.interface.removeEffect"), "effect-remove", { "data-family": family })) : null,
      )];
    });
    if (!element) fields.push(celebrationFields(model));
    return fields;
  }
  function interactionFields(model) {
    const p = model.props, spec = interactionKinds[p.kind], doc = store.get().document;
    const fields = [input(message("editor.interface.blockBackground"), "props.color", p.color, { type: "color" })];
    if (p.kind === 'light-a-candle') fields.push(select(message('interactive.candleAppearance'),'props.appearance',p.appearance || 'classic',[['classic',message('interactive.candleClassic')],['cake-overlay-v1',message('interactive.candleOverlay')],['cake-photo-v2',message('interactive.candlePhoto')]]));
    if(p.kind==='foldout-letter')fields.push(select(message('interactive.foldPaper'),'props.appearance',p.appearance || 'classic',[['classic',message('interactive.foldClassic')],['paper-fold-v2',message('interactive.foldPaper')]]));
    if (p.kind === PREDICTION_KIND) return [...fields, createPredictionFields(model, 'inspector')];
    for (const [i, entry] of (p.entries || []).entries()) {
      fields.push(input(message(`editor.interactionField.${p.kind}.${i}.0`), `entry.${i}.heading`, entry.heading, { maxlength: 120 }));
      if (spec.fields[i][1]) fields.push(field(message(`editor.interactionField.${p.kind}.${i}.1`), node("textarea", {
        "data-editor-field": `entry.${i}.body`, maxlength: LIMITS.text, rows: 3,
      }, entry.body)));
    }
    for (const [i, action] of (model.actions || []).entries())
      fields.push(select(message("editor.interface.doorTarget", { index: i + 1 }), `door.${i}`, action.targetSceneId,
        [["", message("editor.interface.chooseScene")], ...doc.scenes.map(scene => [scene.id, scene.name])]));
    for (const [i, photo] of (p.photos || []).entries()) {
      const labelKey = p.kind === "photo-comparison"
        ? `editor.interface.${i ? 'photoAfter' : 'photoBefore'}` : "editor.interface.photoNumber";
      const label = message(labelKey, p.kind === "photo-comparison" ? undefined : { index: i + 1 });
      const picture = createElement("image", {
        id: photo.id, layout: model.layout,
        props: { assetId: photo.assetId, focalPoint: photo.focalPoint }, accessibility: { alt: photo.alt }
      });
      const editPhoto = edit => commit(({ document }) => {
        const slot = document.elements.find(item => item.id === model.id)?.props.photos.find(item => item.id === photo.id);
        if (slot) edit(slot);
      }, t("editor.history.editPhotoSlot"));
      fields.push(node("fieldset", { class: "editor-interaction-photo" }, node("legend", {}, label),
        imagePicker(message(photo.assetId ? "editor.interface.replaceNamedPhoto" : "editor.interface.chooseNamedPhoto", {
          name: { format: "message", key: labelKey, params: { index: i + 1 } },
        }), photo.id),
        doc.assets.length ? select(message("editor.interface.photoUploaded"), `slot.${photo.id}.assetId`, photo.assetId,
          [["", message("editor.interface.photoMissing")], ...doc.assets.map(({ assetId }, index) => [assetId, message("editor.interface.assetNumber", { index: index + 1 })])]) : null,
        input(message("editor.interface.photoAlt"), `slot.${photo.id}.alt`, photo.alt, { maxlength: LIMITS.accessibilityText }),
        field(message("editor.interface.caption"), node("textarea", { "data-editor-field": `slot.${photo.id}.caption`, maxlength: LIMITS.text, rows: 2 }, photo.caption)),
        photo.assetId ? cropEditor(picture, {
          document: doc, assetUrl,
          editable: !design.policy?.lockedElements?.[model.id],
          onChange: safe(point => { editPhoto(slot => { slot.focalPoint = point; }); renderInspector(); }),
          onPreview: () => { },
        }) : null,
        node("div", { class: "editor-layout-fields" },
          ...["x", "y"].map((axis, index) => input(message(index ? "editor.interface.crop.vertical" : "editor.interface.crop.horizontal"),
            `slot.${photo.id}.${axis}`, toPercent(photo.focalPoint[axis]), { type: "number", min: 0, max: 100, step: .1 }))),
      ));
    }
    if (spec.clock) {
      if (Object.hasOwn(p, 'clockMode')) fields.push(select(message('templates.story.dateMode'), 'props.clockMode', p.clockMode,
        [['countdown', message('templates.story.countdown')], ['elapsed', message('templates.story.elapsed')]]));
      const zones = new Set(["Asia/Ho_Chi_Minh", "UTC", p.timeZone, ...Intl.supportedValuesOf("timeZone")]);
      fields.push(select(message("editor.interface.timezone"), "props.timeZone", p.timeZone, [...zones].map(zone => [zone, zone])),
        input(message("editor.interface.eventAt"), "event-time", p.eventAt ? localEventTime(p.eventAt, p.timeZone) : "", { type: "datetime-local" }));
    }
    if (Object.hasOwn(p, 'autoplay')) fields.push(field(message('templates.story.autoplay'), node('input', { type: 'checkbox', checked: p.autoplay, 'data-editor-field': 'props.autoplay' })));
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
          element ? element.name || registry[element.type].label : message("editor.interface.sceneEdit"),
        ),
        iconButton(message("editor.interface.closeInspector"), "close-sheet", "close", { class: "editor-sheet-close" }),
      ),
    ];
    if (!element) {
      children.push(
        input(message("editor.interface.sceneName"), "scene.name", scene.name, { maxlength: 100 }),
        input(message("editor.interface.background"), "scene.color", scene.background.color, {
          type: "color",
        }),
        ...effectFields(scene),
        node(
          "p",
          { class: "editor-help" },
          message("editor.interface.sceneHint"),
        ),
      );
    } else {
      const { props } = element;
      children.push(
        input(message("editor.interface.layerName"), "element.name", element.name || "", {
          maxlength: 100,
        }),
        element.type === "image" ? imagePicker(message(props.assetId ? "editor.interface.replacePhoto" : "editor.interface.choosePhoto")) : null,
      );
      if (element.type === "text") {
        children.push(
          select(message("editor.interface.content"), "textBinding", props.textBinding || "", [
            ["", message("editor.interface.customText")],
            ...Object.entries(bindingLabels),
          ]),
        );
        if (!props.textBinding)
          children.push(
            field(
              message("editor.interface.text"),
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
              message("editor.interface.linkedField", { field: { format: "message", key: `editor.binding.${props.textBinding}` } }),
            ),
          );
        if (!props.textBinding && design.policy?.kind !== 'creator-template') children.push(button(message('recipient.insert'), 'insert-recipient'));
        children.push(
          textOptions(element) ? button(message("editor.interface.editOnCard"), "inline-text") : null,
          node("div", { class: "editor-font-options", role: "group", "aria-label": message("editor.interface.fontStyle") },
            ...["body", "heading", "serif"].map(token => {
              const sample = node("span", { "aria-hidden": "true" }, "Aa");
              sample.style.fontFamily = textFont(token);
              const control = button("", "text-font", {
                "data-font": token, "aria-label": message("editor.interface.fontNamed", { name: { format: "message", key: `editor.interface.font.${token}` } }),
                "aria-pressed": (props.fontToken || "body") === token,
              });
              control.append(sample, node("span", {}, message(`editor.interface.font.${token}`)));
              return control;
            })),
          input(message("editor.interface.fontSize"), "props.fontSize", props.fontSize, {
            type: "number",
            min: 10,
            max: 160,
          }),
          input(message("editor.interface.lineHeight"), "props.lineHeight", props.lineHeight ?? 1.4, {
            type: "number", min: 1, max: 3, step: 0.05,
          }),
          node("div", { class: "editor-control-row", role: "group", "aria-label": message("editor.interface.textAlign") },
            ...["left", "center", "right"].map(align =>
              iconButton(message("editor.interface.alignNamed", { name: { format: "message", key: `editor.interface.align.${align}` } }), "text-align", `align-${align}`, {
                "data-align": align, "aria-pressed": props.align === align,
              }))),
        );
      }
      if (element.type === "interaction") children.push(...interactionFields(element));
      if(SOUND_TYPES.includes(element.type)&&!element.locked&&!policy&&design.policy?.kind!=='creator-template')children.push(node('h3',{},message('sfx.onPress')),button(message(element.sound?'sfx.replace':'sfx.open'),'sound-picker'),element.sound?node('p',{class:'editor-help'},message(element.sound.kind==='library'?'sfx.library':'sfx.personal')):null);
      children.push(...buildInspectorPropertyFields(element));
      if (element.type === "image") {
        const focal = props.focalPoint || { x: 0.5, y: 0.5 };
        children.push(
          field(
            message("editor.interface.photoAlt"),
            node("textarea", {
              "data-editor-field": "accessibility.alt", rows: 2, maxlength: LIMITS.accessibilityText,
              disabled: Boolean(element.accessibility.decorative),
              value: element.accessibility.alt || "",
            }),
          ),
          node("label", { class: "editor-checkbox" }, node("input", {
            type: "checkbox", "data-editor-field": "accessibility.decorative",
            checked: Boolean(element.accessibility.decorative),
          }), message("editor.interface.decorativePhoto")),
          props.assetId ? cropEditor(element, {
            document: store.get().document,
            assetUrl,
            editable: !policy || policy.editableProps.includes("focalPoint"),
            onPreview: point => stage.previewFocal(element.id, point),
            onChange: safe(point => {
              commit(({ document }) => {
                const image = document.elements.find(item => item.id === element.id);
                if (image?.type === "image") image.props.focalPoint = point;
              }, t("editor.history.editFocalPoint"));
              renderInspector();
            }),
          }) : null,
          props.assetId && !policy ? node("p", { class: "editor-help" }, message("editor.interface.cropHint")) : null,
          node("div", { class: "editor-layout-fields" },
            input(message("editor.interface.crop.horizontal"), "crop.x", toPercent(focal.x), { type: "number", min: 0, max: 100, step: 0.1, "aria-label": message("editor.interface.crop.focusX") }),
            input(message("editor.interface.crop.vertical"), "crop.y", toPercent(focal.y), { type: "number", min: 0, max: 100, step: 0.1, "aria-label": message("editor.interface.crop.focusY") })),
          button(message("editor.interface.cropReset"), "crop-reset"),
        );
      }
      if (isPolaroidPlaceholder(element)) {
        children.push(imagePicker(message("editor.interface.polaroidAdd")),
          node("p", { class: "editor-help" }, message("editor.interface.polaroidHelp")));
      }
      if (isLegacyFrame(element)) {
        children.push(field(message("editor.interface.addFramePhoto"), node('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', 'data-editor-field': 'upload' })), node("p", { class: "editor-help" }, message("editor.interface.addFrameHint")));
      }
      if (registry[element.type].actions.length) {
        const action = element.actions?.[0];
        children.push(
          select(message("editor.interface.interaction"), "action.type", action?.type || "goToScene", [
            ["goToScene", message("editor.interface.nextScene")],
            ["replay", message("editor.interface.replay")],
          ]),
        );
        if (action?.type !== "replay") {
          const doc = store.get().document;
          const destination = doc.scenes.find(scene => scene.id === action?.targetSceneId);
          children.push(node("details", { class: "editor-target-picker" },
            node("summary", {}, destination ? message("editor.interface.targetScene", { name: destination.name }) : message("editor.interface.chooseTarget")),
            node("div", { class: "editor-target-scenes" }, ...doc.scenes.map(scene => {
              const choice = button("", "action-target", {
                "data-id": scene.id,
                "aria-pressed": scene.id === destination?.id,
              });
              choice.append(sceneThumbnail(doc, scene, { width: 28, assetUrl }), node("span", {}, scene.name));
              return choice;
            }))));
          if (!destination) children.push(node("p", { class: "editor-help" },
            message("editor.interface.targetHint")));
        }
      }
      children.push(...effectFields(element, element));
      if(element.type==='image'&&element.effects?.emphasis?.definition?.animation.iterations!=='infinite'){
        const loopCard=catalog.flatMap(g=>g.items).find(b=>b.id.startsWith('natural-motion-')&&b.create()[0]?.name===element.name);
        if(loopCard)children.push(button(message('editor.celebrations.loop'),'motion-loop-enable',{'data-motion-card':loopCard.id,disabled:!editableElement(element,design.policy)}));
      }
      children.push(...buildInspectorGeometryFields(element, store.get().document.artboard.baseSize));
    }
    if(!quickMode&&design.policy?.kind!=='creator-template')children.push(node('div',{class:'editor-control-row'},
      button(message('editor.interface.copyElements'),'element-copy',{disabled:!selectedIds().some(id=>editableElement(store.get().document.elements.find(e=>e.id===id),design.policy)),'aria-keyshortcuts':'Control+c Meta+c'}),
      button(message('editor.interface.cutElements'),'element-cut',{disabled:!selectedIds().some(id=>editableElement(store.get().document.elements.find(e=>e.id===id),design.policy)),'aria-keyshortcuts':'Control+x Meta+x'}),
      button(message('editor.interface.pasteElements'),'element-paste',{disabled:!elementClipboard?.models.length,'aria-keyshortcuts':'Control+v Meta+v'})));
    host.replaceChildren(...children);
    if (keepGeometry) host.querySelector(".editor-geometry").open = true;
    if (!element && design.policy?.kind === "creator-template")
      host.querySelectorAll("[data-editor-field], [data-editor-action='effect-remove']").forEach(control => { control.disabled = true; });
    lockInspectorControls(host, policy, Boolean(textOptions(element)));
    if (previousField && !composing)
      host.querySelector(`[data-editor-field="${CSS.escape(previousField)}"]`)?.focus({ preventScroll: true });
  }
  function renderAll(change) {
    if (!store || disposed) return;
    const doc = store.get().document;
    recipientOptions?.sync();
    if (!doc.scenes.some((value) => value.id === sceneId))
      sceneId = doc.entrySceneId;
    if (!currentScene().elementIds.includes(selection)) selection = null;
    stage?.render();
    renderLayers();
    renderScenes();
    renderAssets();
    main.querySelector(".editor-quick-photo").hidden = !quickPhotoFrame();
    updateEventFields(main, doc, assetUrl);
    updateStoryTextFields(main,doc);
    updateInvitationFields(main, doc, design.invitationSlotIds);
    updatePredictionFields(main, doc);
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
    // Desktop và mobile phải có cùng trạng thái khả dụng với lịch sử của store.
    syncHistoryControls(main, { canUndo: store.canUndo, canRedo: store.canRedo });
    for (const [key] of Object.entries(bindingLabels)) {
      const control = main.querySelector(
        `[data-editor-field="binding.${key}"]`,
      );
      if (control && key === 'message') control.closest('label').hidden = Boolean(predictionCard(doc) && !visibleBindingKeys(doc).has('message'));
      if (control && control !== document.activeElement)
        control.value = doc.bindings[key].value;
    }
    const title = main.querySelector(".editor-title");
    if (title && title !== document.activeElement)
      title.value = store.get().title;
    if (musicPreview && musicPreview.track.id !== (doc.soundtrack?.id || "")) {
      musicPreview.dispose();
      musicPreview = null;
    }
    syncMusicPanel(main, doc.soundtrack, { playing: Boolean(musicPreview?.playing) });
    updateCanvasGuidance();
  }
  async function initialize(loaded) {
    if (disposed) return;
    sceneLayerPanel.clear();
    unsubscribe?.();
    session?.dispose();
    stage?.dispose();
    musicPreview?.dispose();
    musicPreview = null;
    design = loaded;
    if (id && !templateId && !["quick", "layout"].includes(mode)) {
      try { quickMode = localStorage.getItem(modeKey(id)) === "quick"; } catch { /* Optional cache. */ }
    }
    quickMode = quickMode && design.source?.kind === "template";
    sceneId = design.document.entrySceneId;
    selection = null;
    store = createEditorStore(design);
    if(quickMode){
      const frame=quickPhotoFrame();
      if(framePhoto(design.document,frame)?.props.assetId)sceneId=design.document.scenes.find(scene=>scene.elementIds.includes(frame.id))?.id||sceneId;
    }
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
           t("editor.interface.savingRecoveryConfirm"),
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
    if (!session.dirty) renderSaveFeedback(describeSaveFeedback(session, message));
    fit();
  }
  async function create(presetId, source) {
    if (creating) return;
    creating = true;
    const localize = captureTranslator();
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
        loaded = await materializeTemplateStart(loaded, { template, createMutationId: mutationId, request, localize,signal });
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
        createLocaleControl(),
        node("h1", {}, message("editor.start.title")),
        node(
          "div",
          { class: "editor-start-options" },
          ...starterPresets(captureTranslator()).map(({ id, labelKey, label }) => {
            const doc = sampleBindings(createDocument({ presetId: id }));
            const scene = doc.scenes.find(scene => scene.id === doc.entrySceneId);
            const card = button("", starterActions[id] || 'create-library-preset', { class: "editor-start-card", "data-preset": id });
            card.append(sceneThumbnail(doc, scene, { width: 104 }), node("span", {}, labelKey ? message(labelKey) : label));
            return card;
          }),
        ),
        button(message("editor.start.back"), "studio"),
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
      if(element.props.kind === "swipe-album" && element.props.optional === true && design.policy?.kind !== "creator-template") photo.focalPoint={x:.5,y:.5};
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
    if (design.policy?.kind === "creator-template" || value.document.schemaVersion >= 2) {
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
        t("editor.upload.invalid"),
      );
    const frameUpload = isLegacyFrame(store.get().document.elements.find(element => element.id === elementId));
    assetPending = true;
    markStatus("editor.status.photo", "pending");
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
        throw new Error(t("editor.upload.notReady"));
      commit(value => assignImage(value, elementId, result.asset.id, slotId), t("editor.history.replacePhoto"));
      if (frameUpload && !quickMode && selection === elementId) {
        const doc = store.get().document;
        const frame = doc.elements.find(element => element.id === elementId);
        choose(framePhoto(doc, frame)?.id || elementId);
      }
      renderInspector();
    } finally {
      assetPending = false;
      if (!disposed) renderSaveFeedback(describeSaveFeedback(session, message));
    }
  }
  function openPreview(effectPreview) {
    if (assetPending) throw new Error(t("editor.preview.waitPhoto"));
    // Player xem trước được quản lý riêng, không sửa bản nháp đang thao tác.
    closePreview?.();
    closePreview = openCanvasPreview({
      document: structuredClone(store.get().document),
      assetUrl,
      quickMode,
      effectPreview,
      signal,
      dialogs,
      message,
      onSend: () => void safe(publish)(),
      onClose: () => { closePreview = null; },
    });
  }
  async function flushSave(options) {
    if (composing)
      throw new Error(t("editor.save.composing"));
    if (assetPending) throw new Error(t("editor.save.waitPhoto"));
    if (!session) throw new Error(t("editor.save.notReady"));
    return session.save(options);
  }
  async function submitTemplate() {
    const workspace = `/catalog/creator/workspaces/${encodeURIComponent(design.id)}`;
    const { previous } = await request(workspace + "/submission");
    const saved = await flushSave();
    if (session.dirty || session.revision !== saved.revision)
      throw new Error(t("editor.submission.changed"));
    const snapshot = store.get();
    const { elements } = snapshot.document;
    const visible = elements.filter(element => element.visible !== false && element.opacity !== 0);
    const keys = visibleBindingKeys(snapshot.document);
    const bindings = Object.keys(bindingLabels).filter(key => keys.has(key));
    const images = visible.filter(element => element.type === "image" && element.props.assetId);
    const currentAssets = assetIds(snapshot.document);
    const canKeepRights = previous && currentAssets.length && currentAssets.every(id => previous.assetIds.includes(id));
    const controls = bindings.map(key => field(message(`editor.binding.${key}`), node("input", {
      type: "checkbox", value: key, checked: !previous || previous.bindings.includes(key), name: "binding",
    })));
    const photo = select(message("editor.submission.photo"), "template-photo", images.some(image => image.id === previous?.photoId) ? previous.photoId : "",
      [["", message("editor.interface.none")], ...images.map((image, index) => [image.id, `${image.name || t("editor.designer.photo")} (${index + 1})`])]);
    const photoSelect = photo.querySelector("select");
    const scenes = snapshot.document.scenes;
    const cover = select(message("editor.submission.cover"), "template-cover",
      scenes.some(scene => scene.id === previous?.coverSceneId) ? previous.coverSceneId : snapshot.document.entrySceneId,
      scenes.map(scene => [scene.id, scene.name]));
    const coverSelect = cover.querySelector("select");
    const rights = node("textarea", { name: "rights", maxlength: 500, value: canKeepRights ? previous.rights || "" : "" });
    rights.required = currentAssets.length > 0;
    const changes = node("ul", { "aria-label": message("editor.submission.changes"), "aria-live": "polite" });
    const identityWarning = node("p", { role: "status" });
    const form = node("form", {},
      node("h2", {}, message("editor.actions.submit")),
      node("p", {}, message("editor.submission.help")),
      identityWarning,
      ...controls, photo, cover,
      rights.required ? field(message("editor.submission.rights"), rights) : null,
      previous ? node("section", {}, node("h3", {}, message("editor.submission.changes")), changes) : null,
      node("p", { role: "alert" }),
      node("button", { type: "submit", class: "editor-primary" }, message("editor.submission.send")),
      node("button", { type: "button" }, message("editor.actions.back")),
    );
    const dialog = node("dialog", { class: "editor-preview-dialog", "aria-label": message("editor.actions.submit") }, form);
    const current = () => ({
      title: snapshot.title, bindings: new FormData(form).getAll("binding"),
      photoId: photoSelect.value || null, rights: rights.value.trim(), assetIds: currentAssets, coverSceneId: coverSelect.value
    });
    const updateChanges = () => {
      const selection = current();
      identityWarning.textContent = lockedVisibleNames(snapshot.document, selection.bindings).length
        ? t("editor.interface.reviewIdentity") : "";
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
    // Hộp thoại chỉ thu lựa chọn; API vẫn xác minh quyền ở phía máy chủ.
    return openGiftAccessDialog({ message, signal, dialogs });
  }
  async function publish() {
    if (publishing) return;
    publishing = true;
    const control = main.querySelector('[data-editor-action="publish"]');
    control.disabled = true;
    try {
      const saved = await flushSave();
      markStatus("editor.status.checking", "saving");
      const preflight = await request(
        `/designs/designs/${encodeURIComponent(design.id)}/preflight`,
        { expectedRevision: saved.revision },
      );
      if (session.dirty || session.revision !== saved.revision)
        throw new Error(
          t("editor.preflight.changed"),
        );
      if (preflight.blockers?.some(({ code }) => code === "EMPTY_DESIGN")) {
        showBlockers(preflight.blockers);
        return;
      }
      if (preflight.authorization.status === "needs_template_license") {
        markStatus("editor.status.license", "warning");
        if (!onCheckout)
          throw new Error(t("editor.preflight.license"));
        publishing = false;
        await onCheckout({ design: designView(), preflight, flushSave, mode: quickMode ? "quick" : "layout" });
        return;
      }
      if (!preflight.canPublish) {
        showBlockers(preflight.blockers || []);
        const messages = (preflight.blockers || [])
          .map(item => item.messageKey?.startsWith("prediction.") ? t(item.messageKey, item.messageParams)
            : `${item.path ? `${item.path}: ` : ""}${item.messageKey ? t(item.messageKey, item.messageParams) : item.message}`)
          .join("\n");
        throw new Error(
          messages || t("editor.preflight.cannotPublish", { status: preflight.authorization.status }),
        );
      }
      const access = await chooseGiftAccess();
      if (!access || disposed) return;
      if (session.dirty || session.revision !== saved.revision)
        throw new Error(t("editor.preflight.changed"));
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
      markStatus("editor.status.publishing", "saving");
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
      toast(message("editor.publish.done"));
      await navigate(`/success/${encodeURIComponent(result.gift.slug)}`);
    } catch (error) {
      if (error.code !== "PUBLISH_BLOCKED" || !error.details?.some(({ code }) => code === "EMPTY_DESIGN")) throw error;
      showBlockers(error.details);
    } finally {
      publishing = false;
      if (!disposed) {
        control.disabled = false;
        if (session.status === "clean")
          renderSaveFeedback(describeSaveFeedback(session, message));
      }
    }
  }
  function showBlockers(blockers) {
    const host = main.querySelector(".editor-preflight");
    host.hidden = false;
    host.replaceChildren(
      node("strong", {}, message("editor.preflight.title")),
      ...blockers.map((blocker) => {
        const label = blocker.messageKey ? message(blocker.messageKey, blocker.messageParams)
          : blocker.message || blocker.code || message("editor.preflight.notReady");
        if (blocker.code === "EMPTY_DESIGN") {
          return node("div", {},
            node("p", { role: "alert" }, label),
            button(message("editor.preflight.insertGreeting"), "insert-greeting"),
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
        const predictionField = element?.props.kind === PREDICTION_KIND ? path.split('.props.')[1] : null;
        const predictionLabel = predictionField ? message(blocker.code === 'PREDICTION_DUPLICATE_CHOICES' ? 'prediction.duplicate'
          : predictionField === 'prediction' ? 'prediction.chooseRequired' : 'prediction.required', { field: { format: 'message', key: `prediction.${predictionField}` } }) : label;
        const control = button(
          predictionLabel,
          "focus-blocker",
          {
            "data-id": element?.id,
            "data-field": path === "invitation" ? "invitation.date" : predictionField && quickMode ? `prediction.${element.id}.${predictionField}` : binding ? `binding.${binding}` : null,
            "data-photo-slot": slot?.id,
            "data-element-field": predictionField && !quickMode ? `prediction.${element.id}.${predictionField}`
              : slot && missingPhoto[2] === "alt" ? `slot.${slot.id}.alt`
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
    }, t("editor.history.reorderScenes"));
  }
  function openSheet(kind, trigger) {
    if (!mobile.matches || quickMode) return;
    const target = main.querySelector(
      kind === "inspector" ? ".editor-inspector" :
        kind === "scenes" ? ".editor-scene-bar" : ".editor-library",
    );
    if (!target) return;
    // Không trả focus về dock khi chuyển nhanh giữa các bảng mobile.
    closeSheet(false);
    if (target.matches(".editor-library")) showLibrary(kind === "layers" ? "layers" : kind === "content" ? "content" : "add");
    const dockTrigger = trigger?.closest(".editor-mobile-dock") ? trigger :
      main.querySelector(`[data-editor-action="sheet-${kind === "content" ? "library" : kind}"]`);
    const backdrop = main.querySelector(".editor-sheet-backdrop");
    const background = [];
    for (let panel = target; panel && !panel.matches(".editor-workspace"); panel = panel.parentElement) {
      for (const peer of panel.parentElement.children) {
        // Backdrop phải nhận click để có thể đóng sheet, còn vùng phía sau bị inert.
        if (peer !== panel && peer !== backdrop && !peer.inert) {
          peer.inert = true;
          background.push(peer);
        }
      }
    }
    sheet = { target, previous: trigger || document.activeElement, dockTrigger, background, backdrop };
    dockTrigger?.setAttribute("aria-expanded", "true");
    target.classList.add("editor-sheet-open");
    target.setAttribute("role", "dialog");
    target.setAttribute("aria-modal", "true");
    target.setAttribute("tabindex", "-1");
    if (backdrop) backdrop.hidden = false;
    // Tập trung vào nút đóng; nếu không có thì tập trung container.
    const closeControl = target.querySelector('[data-editor-action="close-sheet"]');
    (closeControl?.getClientRects().length ? closeControl : target).focus({ preventScroll: true });
  }
  function closeSheet(restoreFocus = true) {
    if (!sheet) return;
    sheet.target.classList.remove("editor-sheet-open");
    sheet.target.removeAttribute("tabindex");
    sheet.target.removeAttribute("role");
    sheet.target.removeAttribute("aria-modal");
    const { previous, dockTrigger, background, backdrop } = sheet;
    if (backdrop) backdrop.hidden = true;
    for (const panel of background) panel.inert = false;
    dockTrigger?.setAttribute("aria-expanded", "false");
    sheet = null;
    if (restoreFocus) {
      const candidate = previous?.isConnected && previous.getClientRects().length ? previous : dockTrigger;
      if (candidate?.isConnected && candidate.getClientRects().length) candidate.focus({ preventScroll: true });
    }
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
    if (Object.values(starterActions).includes(name) || name === 'create-library-preset') {
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
    if (modalFabric && (name === "advanced-design" || name === "fabric-studio" || name === "inline-fabric")) return;
    // Khi Fabric nhúng đang mở, chỉ Áp dụng/Hủy trong Fabric mới được thay document.
    if (inlineFabricSession || inlineFabricOpening) {
      throw new Error(t("editor.error.inlinePending"));
    }
    if (name === "inline-fabric") {
      if (!canOpenAdvancedEditor(design.policy))
        throw new Error(t("editor.error.layoutDenied"));
      if (quickMode) switchMode();
      if (!canStartInlineFabric(design.policy, quickMode))
        throw new Error(t("editor.error.inlineNotAllowed"));
      closeSheet();
      const mount = main.querySelector(".editor-inline-mount");
      const stageScroll = main.querySelector(".editor-stage-scroll");
      if (!mount || !stageScroll) throw new Error(t("editor.error.noStage"));
      const editingScene = sceneId;
      const initialSequence = store.sequence;
      const previousTrigger = target;
      inlineFabricOpening = true;
      stageScroll.hidden = true;
      mount.hidden = false;
      main.classList.add("editor-inline-active");
      const restore = () => {
        if (inlineFabricSession?.dialog) dialogs.delete(inlineFabricSession.dialog);
        inlineFabricSession = null;
        mount.hidden = true;
        stageScroll.hidden = false;
        main.classList.remove("editor-inline-active");
        if (!disposed && main.isConnected) {
          if (fitted) fit();
          if (previousTrigger?.isConnected) previousTrigger.focus({ preventScroll: true });
        }
      };
      try {
        const { openFabricStudio } = await import("../features/canvas-editor/fabric-studio.js");
        if (disposed) return;
        const studio = await openFabricStudio({
          snapshot: structuredClone(store.get().document),
          sceneId: editingScene,
          policy: design.policy,
          assetUrl,
          inlineHost: mount,
          signal,
          onApply: patch => {
            assertInlineFabricRevision(initialSequence, store.sequence, editingScene, sceneId, disposed);
            commit(value => {
              value.document = applyFabricWorkspacePatch(value.document, editingScene, patch, design.policy);
            }, t("editor.history.fabricInline"));
          },
          onClose: restore,
        });
        if (!studio?.dialog?.open) return;
        if (disposed) {
          studio.close();
          return;
        }
        inlineFabricSession = studio;
        dialogs.add(studio.dialog);
      } catch (error) {
        restore();
        throw error;
      } finally {
        inlineFabricOpening = false;
      }
      return;
    }
    if (name === "advanced-design" || name === "fabric-studio") {
      if (!canOpenAdvancedEditor(design.policy))
        throw new Error(t("editor.error.fabricLocked"));
      // Người dùng vào từ chế độ nhanh sẽ được chuyển sang chế độ bố cục có quyền chỉnh.
      if (quickMode && name === "advanced-design") switchMode();
      if (quickMode) throw new Error(t("editor.error.quickFabric"));
      const token = modalFabric = {};
      const initialSequence = store.sequence;
      const editingScene = sceneId;
      const restore = () => { if (modalFabric === token) modalFabric = null; };
      try {
        const { openFabricStudio } = await import("../features/canvas-editor/fabric-studio.js");
        if (signal.aborted || modalFabric !== token) return;
        await openFabricStudio({
          snapshot: structuredClone(store.get().document),
          sceneId: editingScene,
          policy: design.policy,
          assetUrl,
          signal,
          onApply: (patch) => {
            if (store.sequence !== initialSequence || editingScene !== sceneId || signal.aborted)
              throw new Error(t("editor.error.fabricOutdated"));
            commit(value => {
              value.document = applyFabricWorkspacePatch(value.document, editingScene, patch, design.policy);
            }, t("editor.history.fabricDialog"));
          },
          onClose: restore,
        });
      } catch (error) {
        restore();
        throw error;
      }
      return;
    }
    if (name === "toggle-mode") {
      switchMode();
      return;
    }
    if (name === "focus-blocker") {
      if (target.dataset.field?.startsWith('prediction.') && quickMode) {
        main.querySelector(`[data-editor-field="${CSS.escape(target.dataset.field)}"]`)?.focus();
        return;
      }
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
        if (focus) main.querySelector(".editor-inspector")?.querySelector(focus)?.focus();
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
        commit(value => assignImage(value, selection, assetId), t("editor.history.useUploadedPhoto"));
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
        }, t("editor.history.addUploadedPhoto"));
        choose(image.id);
      }
      return;
    }
    /* phase63a: recovery dashboard */
    if (name === "recovery-center") {
      const dialog = openRecoveryCenter({
        session, store, design,
        onRetry: () => action("retry-save", target),
        onCompare: () => action("server-view", target),
        onReload: () => action("server-reload", target),
        onError: warn,
      });
      dialogs.add(dialog);
      dialog.addEventListener("close", () => dialogs.delete(dialog), { once: true });
      return;
    }
    if (name === "server-view") {
      const current = (
        await request(`/designs/designs/${encodeURIComponent(design.id)}`)
      ).design;
      // Phase 6.3b: read-only structural comparison; no save/reload/mutation.
      const dialog = renderCanvasConflictReview({
        local: store.get(), remote: current, localRevision: session.revision,
      });
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
          t("editor.interface.reloadConfirm"),
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
    if (name === 'soundtrack-pick') {
      const id = target.dataset.trackId ?? '';
      if (id && !soundtrackById(id)) return;
      const musicSelect = main.querySelector('[data-editor-field="soundtrack"]');
      if (!musicSelect || musicSelect.value === id) return;
      // Dùng chung handler của dropdown để duy trì validation, Undo/Redo và trạng thái nghe thử.
      musicSelect.value = id;
      await change({ target: musicSelect });
      return;
    }
    if (name === 'soundtrack-preview') {
      const selectedTrack = store?.get().document.soundtrack;
      if (!selectedTrack) return;
      if (!musicPreview) musicPreview = createSoundtrackPlayback(selectedTrack, {
        onState: ({ playing, error }) => {
          if (disposed) return;
          const control = main.querySelector('[data-editor-action="soundtrack-preview"]');
          if (control) setText(control, message(playing ? 'editor.music.stop' : 'editor.music.listen'));
          if (error) toast(t('gift.music.error'), 'error');
        },
      });
      if (musicPreview) await musicPreview.toggle();
      return;
    }
    if (name === "save" || name === "retry-save") {
      await flushSave({ force: Boolean(design.reviewTemplateDefaults) });
      return;
    }
    if (name === "undo" || name === "mobile-undo") {
      store.undo();
      return;
    }
    if (name === "redo" || name === "mobile-redo") {
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
    if(name==='sound-add'||name==='sound-picker'){
      await editSound({newButton:name==='sound-add'||!SOUND_TYPES.includes(selected()?.type)});return;
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
    if (name === 'insert-recipient') {
      const selected = store.get().document.elements.find(e => e.id === selection);
      const literal = !quickMode && selected?.type === 'text' && !selected.props.textBinding && design.policy?.kind !== 'creator-template';
      commit(next => {
        next.document.personalization ||= { version: 1, mode: 'manual' };
        if (literal) next.document.elements.find(e => e.id === selected.id).props.text += RECIPIENT_TOKEN;
        else next.document.bindings.message.value += RECIPIENT_TOKEN;
      }, t('recipient.insert'));
      return;
    }
    if (name === "greeting-starter") {
      const key = memoryGreetingStarterKeys[Number(target.dataset.index)];
      const starter = key && t(key);
      const message = store.get().document.bindings.message.value;
      const next = message ? `${message}\n${starter}` : starter;
      if (next.length > 1000) throw new Error(t("editor.error.tooLong"));
      commit(value => { value.document.bindings.message.value = next; }, t("editor.history.insertOpening"));
      const control = main.querySelector('[data-editor-field="binding.message"]');
      control.focus();
      control.setSelectionRange(next.length, next.length);
      return;
    }
    if (name === 'event-remove-photo') {
      commit(next => {
        const photo = storyAlbum(next.document)?.props.photos.find(p => p.id === target.dataset.slot);
        if (photo) { photo.assetId = null; photo.alt = ''; photo.caption = ''; }
        const used = new Set(assetIds(next.document));
        next.document.assets = next.document.assets.filter(a => used.has(a.assetId));
      }, t("editor.history.removeAlbumPhoto"));
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
      }, message("editor.quick.removePhoto"));
      return;
    }
    if (name === "preview") {
      openPreview();
      return;
    }
    if (name === 'celebration-preview') {
      openPreview({ family: 'ambience', sceneId: currentScene().id, celebrationId: target.dataset.celebration });
      return;
    }
    if (name === "restyle-original") {await flushSave();navigate(`/design/${design.restyledFrom.designId}?mode=quick`);return;}
    if (name === "restyle") return openTemplateTrial({templateId:design.source.templateId,sourceDesign:design,request,navigate,save:()=>session.save(),signal});
    if (name === "effect-preview") {
      openPreview({ family: target.dataset.family, elementId: selection, sceneId: currentScene().id });
      return;
    }
    if (name === "effect-remove") {
      commit(({ document }) => {
        const model = document.elements.find(item => item.id === selection) || document.scenes.find(scene => scene.id === sceneId);
        delete model.effects[target.dataset.family];
        if (!Object.keys(model.effects).length) delete model.effects;
      }, t("editor.history.removeEffect"));
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
      let models = block.create(),addedAssets=[];
      if(models.some(e=>photoSlots(e).some(slot=>slot.assetId))){
        const designId=design.id;target.disabled=true;
        try{
          const prepared=await materializeInsertionMedia(models,{signal,namespace:designId,cache:libraryMediaCache,upload:async(bytes,mutationId)=>(await request(`/designs/designs/${encodeURIComponent(designId)}/assets`,undefined,{method:'POST',headers:{'content-type':'image/webp','x-mutation-id':mutationId},body:bytes})).asset});
          if(disposed||signal.aborted||design.id!==designId||!store.get().document.scenes.some(s=>s.id===scene.id))return;models=prepared.models;addedAssets=prepared.assets;
        }catch(error){if(disposed||signal.aborted)return;throw new Error(t('editor.library.mediaUnavailable'),{cause:error});
        }finally{if(!disposed)target.disabled=false;}
      }
      if (insertingGreeting) models[0].props.color = readableInk(scene.background.color);
      models.at(-1).name ||= block.title;
      const dropX=Number(target.dataset.dropX),dropY=Number(target.dataset.dropY);
      if(Number.isFinite(dropX)&&Number.isFinite(dropY)){
        const box=bounds(models),size=store.get().document.artboard.baseSize,w=box.right-box.left,h=box.bottom-box.top;
        const dx=Math.max(0,Math.min(size.width-w,dropX-w/2))-box.left,dy=Math.max(0,Math.min(size.height-h,dropY-h/2))-box.top;
        for(const model of models){model.layout.x=Math.round((model.layout.x+dx)*100)/100;model.layout.y=Math.round((model.layout.y+dy)*100)/100;}
      }else placeBlock(models, stage.visibleArea(), store.get().document.elements.filter(item => scene.elementIds.includes(item.id)));
      commit((value) => {
        for(const ref of addedAssets)if(!value.document.assets.some(a=>a.assetId===ref.assetId))value.document.assets.push(ref);
        value.document.elements.push(...models);
        value.document.scenes
          .find((item) => item.id === scene.id)
          .elementIds.push(...models.map(item => item.id));
      }, t("editor.history.insertBlock", { name: { format: "message", key: `editor.library.item.${block.id}` } }));
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
        t("editor.history.addScene"),
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
      }, t("editor.history.duplicateScene"));
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
      }, t("editor.history.changeEntryScene"));
      return;
    }
    if (name === "scene-delete") {
      if (store.get().document.scenes.length === 1)
        throw new Error(t("editor.error.noScene"));
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
          t("editor.error.sceneReferences", { names: refs.map((item) => item.name || registry[item.type].label).join(", ") }),
        );
      if (
        !window.confirm(
          t("editor.error.deleteScene", { name: original.name, count: original.elementIds.length }),
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
      }, t("editor.history.deleteScene"));
      selection = null;
      renderAll();
      return;
    }
    if (!selected()&&name!=='element-paste') throw new Error(t("editor.error.noSelection"));
    if(name==='motion-loop-enable'){
      if(!editableElement(selected(),design.policy))return;
      const card=catalog.flatMap(g=>g.items).find(b=>b.id===target.dataset.motionCard),effect=card?.create()[0]?.effects?.emphasis;
      if(effect?.definition?.animation.iterations!=='infinite')return;
      commit(value=>{const e=value.document.elements.find(e=>e.id===selection),speed=e.effects?.emphasis?.speed||e.effects?.entrance?.speed||effect.speed;e.effects??={};delete e.effects.entrance;e.effects.emphasis={...structuredClone(effect),speed};},t('editor.celebrations.loop'));renderInspector();return;
    }
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
      }, t("editor.interface.chooseTarget"));
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
        name === "center" ? t("editor.history.centerLayer") : t("editor.history.fitLayer"),
      );
      renderInspector();
      return;
    }
    if (name === "crop-reset") {
      commit((value) => {
        value.document.elements.find(
          (item) => item.id === selection,
        ).props.focalPoint = { x: 0.5, y: 0.5 };
      }, t("editor.history.resetCrop"));
      renderInspector();
      return;
    }
    if(['element-copy','element-cut','element-paste'].includes(name)){
      if(quickMode||design.policy?.kind==='creator-template')return;
      if(name==='element-paste'){
        const pasted=pasteElements(store.get().document,sceneId,elementClipboard,design.id,newId,target.dataset?.pasteInPlace==='true'?0:16*(++pasteCount));
        if(pasted.ids.length){commit(value=>{value.document=pasted.document;},t('editor.history.pasteElements'));choose(pasted.ids.at(-1));selectedSet=new Set(pasted.ids);stage.render();}
      }else{
        elementClipboard=copyElements(store.get().document,selectedIds(),design.id,design.policy);pasteCount=0;
        if(name==='element-cut'&&elementClipboard.models.length){commit(value=>{value.document=removeElements(value.document,elementClipboard.models.map(e=>e.id),design.policy);},t('editor.history.cutElements'));choose(null);}
      }
      renderInspector();return;
    }
    if (name === "element-delete") {
      if(quickMode)return;
      commit(value=>{value.document=removeElements(value.document,selectedIds(),design.policy);},t("editor.history.deleteElement"));
      selection = null;selectedSet.clear();stage.render();
      renderInspector();
      return;
    }
    if (name === "element-duplicate") {
      if(quickMode)return;const clip=copyElements(store.get().document,selectedIds(),design.id,design.policy),pasted=pasteElements(store.get().document,sceneId,clip,design.id,newId);
      if(!pasted.ids.length)return;commit(value=>{value.document=pasted.document;},t("editor.history.duplicateElement"));choose(pasted.ids.at(-1));selectedSet=new Set(pasted.ids);stage.render();
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
      }, t("editor.history.reorderLayers"));
      return;
    }
  }
  async function change(event) {
    if (event.target.matches('[data-editor-music-filter], [data-editor-music-occasion], [data-editor-music-market], [data-editor-music-vocals]')) {
      filterMusicPanel(main);
      return;
    }
    if (event.target.matches("[data-block-group-select]")) {
      filterBlocks(main.querySelector("[data-block-search]").value);
      return;
    }
    const control = event.target.closest("[data-editor-field]");
    if (!control || !store || composing) return;
    const key = control.dataset.editorField;
    if (key.startsWith('invitation.')) {
      const field = key.slice('invitation.'.length);
      try {
        commit(next => editInvitation(next.document, field, field === 'enabled' ? control.checked : control.value, design.invitationSlotIds),
          t('invitation.title'), { merge: field === 'venue' ? key : null });
      } catch (error) {
        control.blur();
        updateInvitationFields(main, store.get().document, design.invitationSlotIds);
        throw new Error(t(field === 'date' ? 'invitation.error.date' : 'invitation.error.structure'));
      }
      return;
    }
    if (key === "zoom") {
      fitted = false;
      setZoom(Number(control.value));
      return;
    }
    if (key === "snap") {
      snap = control.checked;
      return;
    }
    if (key === 'soundtrack') {
      musicPreview?.dispose();
      musicPreview = null;
      commit(next => {
        if (control.value) next.document.soundtrack = { id: control.value, volume: next.document.soundtrack?.volume ?? 0.55 };
        else delete next.document.soundtrack;
      }, t('editor.history.selectMusic'));
      const listen = main.querySelector('[data-editor-action="soundtrack-preview"]');
      if (listen) {
        listen.disabled = !control.value;
        setText(listen, message('editor.music.listen'));
      }
      return;
    }
    if (key === 'soundtrack-volume') {
      const percent = Number(control.value);
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) return;
      if (!store.get().document.soundtrack) return;
      commit(next => {
        next.document.soundtrack.volume = percent / 100;
      }, t('editor.history.setMusicVolume'));
      musicPreview?.setVolume(percent / 100);
      return;
    }
    if (key === "upload" || key === "quick-photo" || key === 'event-photo') {
      const target = key === 'event-photo' ? control.dataset.target : key === "quick-photo" ? quickPhotoFrame()?.id : selection;
      try {
        if (target) await upload(control.files?.[0], target, control.dataset.slot);
        if(key==='quick-photo'&&target){
          const photoScene=store.get().document.scenes.find(scene=>scene.elementIds.includes(target));
          if(photoScene&&photoScene.id!==sceneId){sceneId=photoScene.id;renderAll();}
        }
        if (key === 'event-photo') commit(next => {
          const album = storyAlbum(next.document), photo = album?.props.photos.find(p => p.id === control.dataset.slot);
          if (photo?.assetId && !photo.alt) photo.alt = t('templates.story.photo', { index: album.props.photos.indexOf(photo) + 1 });
        }, t("editor.history.describeMemoryPhoto"));
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
      throw new Error(t("editor.error.invalidNumber"));
    commit(
      (next) => {
        if (key === "title") {
          next.title = String(value).trim() || "Món quà của tôi";
          return;
        }
        if (key.startsWith('prediction.')) {
          const [, id, field] = key.split('.');
          const card = next.document.elements.find(e => e.id === id && e.type === 'interaction' && e.props.kind === PREDICTION_KIND);
          if (card) card.props[field] = field === 'prediction' ? value || null : value;
          return;
        }
        if (key.startsWith('story-text.')) {const e=next.document.elements.find(e=>e.id===key.split('.')[1]);if(e)e.props.text=value;return;}
        if (key.startsWith('story-fold.')) {const [,id,index,property]=key.split('.');const e=next.document.elements.find(e=>e.id===id);if(e)e.props.entries[index][property]=value;return;}
        if (key.startsWith("binding.")) {
          next.document.bindings[key.slice(8)].value = value;
          return;
        }
        if (key === "quick-template-text") {
          const text = quickTemplateText(next.document);
          if (text) text.props.text = value;
          return;
        }
        if (key.startsWith('event-date.') || key.startsWith('event-zone.')) {
          const clock = storyClock(next.document, key.split('.')[1]);
          if (clock) {
            if (key.startsWith('event-date.')) clock.props.eventAt = value ? eventTimeFromLocal(value, clock.props.timeZone) : null;
            else clock.props.timeZone = value;
          }
          return;
        }
        if (key.startsWith('event-caption.') || key.startsWith('event-alt.')) {
          const photo = storyAlbum(next.document)?.props.photos.find(p => p.id === key.split('.')[1]);
          if (photo) photo[key.startsWith('event-alt.') ? 'alt' : 'caption'] = value;
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
        if (key.startsWith('celebration.')) {
          const [, id, property] = key.split('.');
          const scene = next.document.scenes.find(s => s.id === sceneId);
          scene.effects ??= {};
          const settings = celebrationSettings(scene.effects);
          if (CELEBRATION_IDS.includes(scene.effects.ambience?.id)) delete scene.effects.ambience;
          settings[id][property] = value;
          if (settings[id].enabled && !settings[id].definition) {
            const definition = effectPreset(id, 'ambience').definition;
            if (definition) settings[id].definition = definition;
          }
          scene.effects.celebrations = settings;
          return;
        }
        if (key.startsWith("effect.")) {
          const [, family, field] = key.split(".");
          const model = next.document.elements.find(item => item.id === selection) ||
            next.document.scenes.find(scene => scene.id === sceneId);
          if (field === "id") {
            if (value) (model.effects ??= {})[family] = effectPreset(value, family);
            else {
              delete model.effects?.[family];
              if (model.effects && !Object.keys(model.effects).length) delete model.effects;
            }
          } else if(field==='repeat'&&family==='emphasis'&&model.effects[family].definition?.animation.engine==='keyframes')model.effects[family].definition.animation.iterations=value?'infinite':1;
          else model.effects[family][field] = field === "delay" ? Number(value) : value;
          return;
        }
        const item = next.document.elements.find(
          (item) => item.id === selection,
        );
        if (!item) return;
        if (key.startsWith("entry.")) {
          const [, index, field] = key.split(".");
          item.props.entries[index][field] = value;
          return;
        }
        if (key.startsWith("door.")) {
          item.actions[Number(key.slice(5))].targetSceneId = value || null;
          return;
        }
        if (key.startsWith("slot.")) {
          const [, id, field] = key.split(".");
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
        if (group === 'props' && (['stickerId','mask','pattern'].includes(fieldName) || fieldName === 'kind' && item.type === 'shape')) refreshElementArtwork(item);
        if (
          ["label", "title"].includes(fieldName) &&
          ["button", "envelope", "gift-box", "sound-button"].includes(item.type)
        )
          item.accessibility.label = value;
      },
      t("editor.history.editProperties"),
      {
        merge:
          event.type === "input" || event.type === "compositionend"
            ? control
            : null,
      },
    );
    if (["textBinding", "action.type", "props.fit", "props.radius", "props.timeZone", "accessibility.decorative"].includes(key) ||
      key.endsWith(".assetId") || (key.startsWith("effect.") && key.endsWith(".id")) ||
      key.startsWith("crop.") || key.startsWith('celebration.')) renderInspector();
  }
  let draggedBlock=null;
  main.addEventListener('dragstart',event=>{
    const control=event.target.closest('[data-block]');
    if(!control||control.disabled||quickMode||design?.policy?.kind==='creator-template')return;
    draggedBlock=control.dataset.block;event.dataTransfer.setData('application/x-momevia-block',draggedBlock);event.dataTransfer.effectAllowed='copy';
  },{signal});
  main.addEventListener('dragend',()=>{draggedBlock=null;},{signal});
  main.addEventListener('dragover',event=>{
    if(draggedBlock&&event.target.closest('.editor-artboard')&&!quickMode){event.preventDefault();event.dataTransfer.dropEffect='copy';}
  },{signal});
  main.addEventListener('drop',safe(async event=>{
    const board=event.target.closest('.editor-artboard'),id=draggedBlock;draggedBlock=null;
    if(!board||!id||quickMode||design?.policy?.kind==='creator-template'||event.dataTransfer.getData('application/x-momevia-block')!==id)return;
    event.preventDefault();const rect=board.getBoundingClientRect(),size=store.get().document.artboard.baseSize,target=globalThis.document.createElement('button');
    target.dataset.block=id;target.dataset.dropX=String((event.clientX-rect.left)/rect.width*size.width);target.dataset.dropY=String((event.clientY-rect.top)/rect.height*size.height);
    await action('add',target);
  }),{signal});
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
      if (event.target.matches("[data-editor-music-search]")) {
        filterMusicPanel(main);
        return;
      }
      if (event.target.matches("[data-block-search]")) {
        filterBlocks(event.target.value);
        return;
      }
      if (event.target.matches('[data-editor-field="soundtrack-volume"]')) {
        // Khi kéo thanh, cập nhật số phần trăm và nghe thử mà chưa lưu lịch sử.
        const percent = Number(event.target.value);
        if (Number.isFinite(percent) && percent >= 0 && percent <= 100) {
          const readout = main.querySelector('[data-editor-music-percent]');
          if (readout) setText(readout, `${percent}%`);
          musicPreview?.setVolume(percent / 100);
        }
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
    // Đồng bộ với cảnh báo rời route; Fabric đang mở cũng có thay đổi chưa áp dụng.
    if (hasUnsaved()) {
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
        if (sheet) {
          event.preventDefault();
          closeSheet();
          return;
        }
        if (stage.gestureActive) {
          event.preventDefault();
          stage.cancel();
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
        choose(null);
        return;
      }
      if (sheet && event.key === "Tab") {
        const next = nextSheetFocus(sheet.target, document.activeElement, event.shiftKey);
        if (next) {
          event.preventDefault();
          next.focus({ preventScroll: true });
        }
        return;
      }
      // Không cho shortcut Undo/Redo hoặc dịch lớp hoạt động phía sau modal sheet.
      if (sheet) return;
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'&&!document.querySelector('dialog[open]')){
        event.preventDefault();stage.flushText();
        if(stopKeys(event.target)&&!event.target.closest('.editor-inline-text'))event.target.dispatchEvent(new Event('change',{bubbles:true}));
        return flushSave({force:Boolean(design?.reviewTemplateDefaults)});
      }
      if (stopKeys(event.target) || document.querySelector("dialog[open]"))
        return;
      const chord=event.ctrlKey||event.metaKey,key=event.key.toLowerCase();
      if(!quickMode&&!event.altKey&&((chord&&(!event.shiftKey||key==='v')&&['x','c','v','d','a','[',']'].includes(key))||['Delete','Backspace'].includes(event.key))){
        event.preventDefault();
        if(chord&&key==='a'){selectedSet=new Set(currentScene().elementIds.filter(id=>{const e=store.get().document.elements.find(e=>e.id===id);return e.visible!==false&&editableElement(e,design.policy);}));selection=[...selectedSet].at(-1)||null;stage.render();renderInspector();return;}
        if(chord&&['c','x'].includes(key))return action(key==='c'?'element-copy':'element-cut',event.target);
        if(chord&&key==='v')return action('element-paste',{dataset:{pasteInPlace:String(event.shiftKey)}});
        if(chord&&key==='d')return action('element-duplicate',event.target);
        if(chord&&['[',']'].includes(key)&&editableElement(selected(),design.policy))return action(key===']'?'layer-up':'layer-down',event.target);
        return action('element-delete',event.target);
      }
      const historyAction = historyShortcut(event);
      if (historyAction) {
        event.preventDefault();
        const beforeIds=new Set(store.get().document.elements.map(e=>e.id));
        if (historyAction === "redo") store.redo();
        else store.undo();
        const restored=store.get().document.elements.filter(e=>!beforeIds.has(e.id)&&currentScene().elementIds.includes(e.id));
        if(restored.length){choose(restored.at(-1).id);selectedSet=new Set(restored.map(e=>e.id));stage.render();}
        else if(selection&&!store.get().document.elements.some(e=>e.id===selection))choose(null);
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
        selectedIds().some(id=>editableElement(store.get().document.elements.find(e=>e.id===id),design.policy))
      ) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        commit((value) => {
          for(const item of value.document.elements.filter(e=>selectedIds().includes(e.id)&&editableElement(e,design.policy))){const layout=item.layout;
          if (event.key === "ArrowLeft") layout.x -= step;
          if (event.key === "ArrowRight") layout.x += step;
          if (event.key === "ArrowUp") layout.y -= step;
          if (event.key === "ArrowDown") layout.y += step;
          }
        }, t("editor.history.keyboardMove"));
        renderInspector();
      }
    }),
    { signal },
  );
  function hasUnsaved() {
    return hasPendingEditorWork({
      sessionDirty: session?.dirty,
      inlineFabricOpening,
      inlineFabricActive: Boolean(inlineFabricSession),
      assetPending,
      gestureActive: stage?.gestureActive,
      textDirty: stage?.textDirty,
      publishing,
      composing,
    });
  }
  function beforeLeave() {
    if (inlineFabricSession) {
      return window.confirm(t("editor.interface.leaveFabric"));
    }
    return (
      !hasUnsaved() ||
      window.confirm(
        t("editor.interface.leaveDraft"),
      )
    );
  }
  const ready = (async () => {
    if (!ownerId) throw new Error(t("editor.interface.notReady"));
    await loadCanvasLibrary({ get: path => request(path) }, currentLocale());
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
        button(message("editor.interface.loadingRetry"), "load-retry"),
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
      if (inlineFabricSession?.dialog) dialogs.delete(inlineFabricSession.dialog);
      inlineFabricSession?.close();
      // Hoàn nguyên inert của phần nền trước khi rời màn hình thiết kế.
      closeSheet(false);
      lifecycle.abort();
      musicPreview?.dispose();
      session?.dispose();
      unsubscribe?.();
      stageObserver?.disconnect();
      stage?.dispose();
      closePreview?.();
      for (const dialog of dialogs) {
        dialog.close();
        dialog.remove();
      }
      dialogs.clear();
      main.classList.remove("editor-main", "editor-dragging", "editor-inline-active");
    },
  };
}
