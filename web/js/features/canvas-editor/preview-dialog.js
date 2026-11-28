// Quản lý modal xem trước độc lập với các thao tác lưu và xuất bản.
import { mountPlayer } from "../gift-runtime/index.js";
import { button, iconButton, node, trapDialog } from "./dom.js";

export function openCanvasPreview({
  document: canvasDocument,
  assetUrl,
  quickMode,
  effectPreview,
  signal,
  dialogs,
  message,
  onSend,
  onClose,
}) {
  if (signal?.aborted) return () => {};
  const lifetime = new AbortController();
  const title = message(quickMode ? "editor.mode.recipientPreview" : "editor.preview.title");
  const dialog = node("dialog", {
    class: "editor-preview-dialog",
    "aria-labelledby": "editor-preview-title",
  },
  node("div", { class: "editor-preview-heading" },
    node("h2", { id: "editor-preview-title" }, title),
    button(message("editor.preview.restart"), "preview-reset"),
    quickMode ? button(message("editor.preview.edit"), "preview-close")
      : iconButton(message("editor.preview.close"), "preview-close", "close"),
    quickMode ? button(message("editor.preview.send"), "preview-send", { class: "editor-primary" }) : null,
  ),
  node("div", { class: "editor-preview-player" }),
  );
  document.body.append(dialog);
  dialogs.add(dialog);
  let player = null;
  let previewSizer=null;
  let closed = false;
  const closeDialog = trapDialog(dialog, () => {
    if (closed) return;
    closed = true;
    player?.dispose();
    previewSizer?.disconnect();
    player = null;
    dialogs.delete(dialog);
    onClose?.();
  }, { signal, lifetime });
  const close = () => {
    if (!closed) closeDialog();
  };
  try {
    player = mountPlayer(dialog.querySelector(".editor-preview-player"), {
      document: canvasDocument,
      assetUrl,
      mode: "preview",
      effectPreview,
    });
    const heading=dialog.querySelector('.editor-preview-heading'),host=dialog.querySelector('.editor-preview-player');
    const locale=dialog.querySelector(':scope > .locale-control');
    if(locale){const active=document.activeElement,restore=locale.contains(active);heading.append(locale);if(restore)active.focus({preventScroll:true});}
    const syncSize=()=>{
      if(!dialog.open)return;
      const css=getComputedStyle(dialog);
      const before=host.getBoundingClientRect().top-dialog.getBoundingClientRect().top+dialog.scrollTop;
      host.style.setProperty('--gift-preview-chrome',`${before+(parseFloat(css.paddingBottom)||0)+36}px`);
    };
    previewSizer=globalThis.ResizeObserver?new ResizeObserver(syncSize):null;previewSizer?.observe(heading);syncSize();
  } catch (error) {
    close();
    throw error;
  }
  dialog.addEventListener("click", event => {
    const action = event.target.closest("[data-editor-action]")?.dataset.editorAction;
    if (action === "preview-close") close();
    if (action === "preview-reset") player?.reset();
    if (action === "preview-send") {
      close();
      onSend?.();
    }
  }, { signal: lifetime.signal });
  return close;
}
