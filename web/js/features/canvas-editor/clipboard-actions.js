import { t } from '../../core/i18n.js';
import { copyElements, pasteElements, removeElements } from './clipboard.js';

const actions = new Set(['element-copy', 'element-cut', 'element-paste', 'element-delete', 'element-duplicate']);
export const isClipboardAction = name => actions.has(name);

// Mỗi Designer giữ clipboard riêng; mọi thay đổi document đi qua commit hiện có.
export function createClipboardActions({ getContext, selectedIds, choose, selectRestored,
  clearSelection, commit, renderInspector, newId }) {
  let clipboard = null;
  let pasteCount = 0;
  let disposed = false;
  function handle(name, target) {
    if (disposed || !isClipboardAction(name)) return;
    const { store, design, sceneId, quickMode } = getContext();
    if (quickMode) return;
    const policy = design.policy;
    if (['element-copy', 'element-cut', 'element-paste'].includes(name)) {
      if (policy?.kind === 'creator-template') return;
      if (name === 'element-paste') {
        const offset = target.dataset?.pasteInPlace === 'true' ? 0 : 16 * (++pasteCount);
        const pasted = pasteElements(store.get().document, sceneId, clipboard, design.id, newId, offset);
        if (pasted.ids.length) {
          commit(value => { value.document = pasted.document; }, t('editor.history.pasteElements'));
          selectRestored(pasted.ids);
        }
      } else {
        clipboard = copyElements(store.get().document, selectedIds(), design.id, policy);
        pasteCount = 0;
        if (name === 'element-cut' && clipboard.models.length) {
          commit(value => { value.document = removeElements(value.document, clipboard.models.map(e => e.id), policy); }, t('editor.history.cutElements'));
          choose(null);
        }
      }
      renderInspector();
      return;
    }
    if (name === 'element-delete') {
      commit(value => { value.document = removeElements(value.document, selectedIds(), policy); }, t("editor.history.deleteElement"));
      clearSelection();
      renderInspector();
      return;
    }
    const clip = copyElements(store.get().document, selectedIds(), design.id, policy);
    const pasted = pasteElements(store.get().document, sceneId, clip, design.id, newId);
    if (!pasted.ids.length) return;
    commit(value => { value.document = pasted.document; }, t("editor.history.duplicateElement"));
    selectRestored(pasted.ids);
  }
  // Xóa dữ liệu cũ khi nạp lại thiết kế hoặc đóng Editor.
  function clear() {
    clipboard = null;
    pasteCount = 0;
  }
  function dispose() {
    disposed = true;
    clear();
  }
  return { handle, clear, dispose, getClipboard: () => clipboard };
}
