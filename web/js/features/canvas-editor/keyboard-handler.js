import { t } from '../../core/i18n.js';
import { editableElement } from './clipboard.js';
import { stopKeys } from './designer-helpers.js';
import { historyShortcut } from './editor-guards.js';
import { nextSheetFocus } from './mobile-sheet.js';
import { restoredSelectionIds } from './selection.js';

// Đọc trạng thái tại thời điểm nhận phím; controller vẫn sở hữu store và commit.
export function createKeyboardHandler({ main, document, getContext, getSelection,
  choose, selectAll, selectRestored, currentScene, selected, selectedIds,
  action, closeSheet, flushSave, commit, renderInspector }) {
  return function handleKey(event) {
    const { disposed, store, composing, stage, sheet, design, quickMode } = getContext();
    if (disposed || !store || !stage || composing || event.isComposing) return;
    if (event.key === "Escape") {
      if (document.querySelector("dialog[open]")) return;
      const toolsMenu = main.querySelector('.editor-more-tools[open]');
      if (toolsMenu) {
        event.preventDefault();
        toolsMenu.open = false;
        toolsMenu.querySelector('summary').focus();
        return;
      }
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
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && !document.querySelector('dialog[open]')) {
      event.preventDefault();
      stage.flushText();
      if (stopKeys(event.target) && !event.target.closest('.editor-inline-text')) {
        event.target.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return flushSave({ force: Boolean(design?.reviewTemplateDefaults) });
    }
    if (stopKeys(event.target) || document.querySelector("dialog[open]"))
      return;
    const chord = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
    const objectShortcut = chord && (!event.shiftKey || key === 'v') && ['x', 'c', 'v', 'd', 'a', '[', ']'].includes(key);
    if (!quickMode && !event.altKey && (objectShortcut || ['Delete', 'Backspace'].includes(event.key))) {
      event.preventDefault();
      if (chord && key === 'a') return selectAll();
      if (chord && ['c', 'x'].includes(key)) return action(key === 'c' ? 'element-copy' : 'element-cut', event.target);
      if (chord && key === 'v') return action('element-paste', { dataset: { pasteInPlace: String(event.shiftKey) } });
      if (chord && key === 'd') return action('element-duplicate', event.target);
      // Không để phím đổi thứ tự lớp rơi xuống nhánh xóa đối tượng.
      if (chord && ['[', ']'].includes(key)) {
        if (editableElement(selected(), design.policy)) return action(key === ']' ? 'layer-up' : 'layer-down', event.target);
        return;
      }
      return action('element-delete', event.target);
    }
    const historyAction = historyShortcut(event);
    if (historyAction) {
      event.preventDefault();
      const beforeIds = new Set(store.get().document.elements.map(e => e.id));
      if (historyAction === "redo") store.redo();
      else store.undo();
      const restored = restoredSelectionIds(store.get().document, currentScene(), beforeIds);
      if (restored.length) selectRestored(restored);
      else if (getSelection() && !store.get().document.elements.some(e => e.id === getSelection())) choose(null);
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
      selectedIds().some(id => editableElement(store.get().document.elements.find(e => e.id === id), design.policy))
    ) {
      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      commit((value) => {
        const ids = new Set(selectedIds());
        for (const item of value.document.elements.filter(e => ids.has(e.id) && editableElement(e, design.policy))) {
          const layout = item.layout;
          if (event.key === "ArrowLeft") layout.x -= step;
          if (event.key === "ArrowRight") layout.x += step;
          if (event.key === "ArrowUp") layout.y -= step;
          if (event.key === "ArrowDown") layout.y += step;
        }
      }, t("editor.history.keyboardMove"));
      renderInspector();
    }
  };
}
