// Phase 6.3a: UI-only recovery dashboard. Never bypasses server CAS/ACL.
// Browser-only APIs are invoked from openRecoveryCenter; pure helpers are Node-testable.

export const recoveryTones = Object.freeze({
  clean: 'saved', dirty: 'pending', saving: 'progress',
  offline: 'warning', error: 'warning', conflict: 'danger',
  'session-expired': 'danger', 'asset-pending': 'pending', publishing: 'progress',
});

const labels = Object.freeze({
  clean: 'Đã đồng bộ', dirty: 'Có thay đổi chưa lưu', saving: 'Đang lưu lên máy chủ',
  offline: 'Đang ngoại tuyến', error: 'Lưu chưa thành công',
  conflict: 'Có xung đột phiên bản', 'session-expired': 'Phiên đăng nhập đã hết hạn',
  'asset-pending': 'Đang xử lý ảnh', publishing: 'Đang xuất bản',
});

export function recoveryOverview(session) {
  if (!session || typeof session.readRecovery !== 'function')
    throw new TypeError('Thiếu phiên làm việc với bản nháp.');
  let local = null;
  try { local = session.readRecovery(); } catch { /* Storage can be unavailable. */ }
  const status = typeof session.status === 'string' ? session.status : 'unknown';
  const revision = Number.isSafeInteger(session.revision) && session.revision >= 0
    ? session.revision : null;
  const savedAt = Number.isSafeInteger(session.lastSavedAt) && session.lastSavedAt > 0
    ? session.lastSavedAt : null;
  const recoveryAt = Number.isSafeInteger(local?.savedAt) && local.savedAt > 0
    ? local.savedAt : null;
  return {
    status,
    label: labels[status] || 'Chưa xác định trạng thái',
    tone: recoveryTones[status] || 'warning',
    revision,
    lastSavedAt: savedAt,
    recoverySavedAt: recoveryAt,
    hasRecovery: Boolean(local),
    // In-progress save with a cache is NOT proof that the server has a copy.
    hasUnsaved: Boolean(session.dirty) || ['dirty', 'saving', 'offline', 'error', 'conflict'].includes(status),
    canRetry: ['dirty', 'offline', 'error'].includes(status),
    canCompare: status === 'conflict',
  };
}

// An explicitly downloaded *portable snapshot*, not a complete media backup or import contract.
// Deliberately omits recovery.pending, mutation IDs, account IDs, and credentials.
export function makeRecoveryExport({ designId, revision, draft, now = new Date() }) {
  if (typeof designId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(designId))
    throw new TypeError('Mã thiết kế không hợp lệ.');
  if (!draft || typeof draft !== 'object' || Array.isArray(draft) ||
      typeof draft.title !== 'string' || !draft.document ||
      typeof draft.document !== 'object' || Array.isArray(draft.document))
    throw new TypeError('Nội dung bản nháp không hợp lệ.');
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()))
    throw new TypeError('Ngày xuất bản sao không hợp lệ.');
  const payload = {
    format: 'momevia-canvas-review-snapshot', version: 1,
    notice: 'Bản xem lại JSON: có thể chứa nội dung riêng tư và tham chiếu ảnh; không chứa đầy đủ bytes ảnh; không phải file khôi phục tự động.',
    exportedAt: now.toISOString(), designId,
    revision: Number.isSafeInteger(revision) && revision >= 0 ? revision : null,
    title: draft.title, document: draft.document,
  };
  const json = JSON.stringify(payload, null, 2);
  if (!json || json.length > 8 * 1024 * 1024)
    throw new RangeError('Bản sao JSON vượt quá giới hạn 8 MB.');
  return { json, filename: `momevia-ban-nhap-${now.toISOString().slice(0, 10)}.json` };
}

function dom(tag, options = {}, ...children) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(options)) {
    if (name === 'text') el.textContent = value;
    else if (name === 'class') el.className = value;
    else if (value !== undefined && value !== null) el.setAttribute(name, String(value));
  }
  el.append(...children.filter(child => child !== undefined && child !== null));
  return el;
}
function control(label, action, kind = '') {
  return dom('button', { type: 'button', class: `recovery-center__button ${kind}`, 'data-recovery-action': action, text: label });
}
function timeLabel(ms) {
  if (!ms) return 'Chưa có xác nhận trong phiên này';
  return new Date(ms).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

export function openRecoveryCenter({ session, store, design, onRetry, onCompare, onReload, onError = () => {} }) {
  if (!session || !store || !design || typeof store.get !== 'function')
    throw new TypeError('Canvas chưa sẵn sàng để xem bản nháp.');
  const previousFocus = document.activeElement;
  const headingId = 'momevia-recovery-title';
  const title = dom('h2', { id: headingId, text: 'Trung tâm bảo vệ bản nháp' });
  const badge = dom('span', { class: 'recovery-center__badge' });
  const state = dom('p', { class: 'recovery-center__state' });
  const current = dom('p', {});
  const local = dom('p', {});
  const info = dom('p', { class: 'recovery-center__message', role: 'status', 'aria-live': 'polite' });
  const retry = control('Thử lưu lại', 'retry', 'recovery-center__button--primary');
  const compare = control('Xem bản máy chủ', 'compare');
  const reload = control('Tải bản máy chủ', 'reload');
  const exportButton = control('Tải bản sao JSON', 'export');
  const refreshButton = control('Cập nhật', 'refresh');
  const closeButton = control('Đóng', 'close');
  const dialog = dom('dialog', { class: 'recovery-center', 'aria-labelledby': headingId },
    dom('div', { class: 'recovery-center__head' },
      dom('div', {}, dom('p', { class: 'recovery-center__eyebrow', text: 'MOMEVIA · CANVAS' }), title), closeButton),
    dom('div', { class: 'recovery-center__overview' }, badge, state),
    dom('div', { class: 'recovery-center__grid' },
      dom('div', { class: 'recovery-center__panel' }, dom('h3', { text: 'Bản máy chủ' }), current),
      dom('div', { class: 'recovery-center__panel' }, dom('h3', { text: 'Bản cục bộ trong tab' }), local)),
    dom('p', { class: 'recovery-center__note', text: 'Tệp JSON có thể chứa lời chúc và dữ liệu riêng tư; chỉ tải khi cần. Tệp không bao gồm ảnh gốc và chưa hỗ trợ nhập ngược tự động.' }),
    info,
    dom('div', { class: 'recovery-center__actions' }, refreshButton, retry, compare, reload, exportButton));
  const render = () => {
    const overview = recoveryOverview(session);
    badge.textContent = overview.label;
    badge.dataset.tone = overview.tone;
    state.textContent = overview.hasUnsaved
      ? 'Bản chỉnh sửa đang mở chưa được xác nhận đầy đủ trên máy chủ.'
      : 'Không phát hiện thay đổi chưa đồng bộ trong phiên đang mở.';
    current.textContent = `Phiên bản: ${overview.revision === null ? 'không rõ' : `r${overview.revision}`} · Lần lưu: ${timeLabel(overview.lastSavedAt)}`;
    local.textContent = overview.hasRecovery
      ? `Có bản tạm · cập nhật ${timeLabel(overview.recoverySavedAt)}. Đây không phải bản sao đã lưu trên máy chủ.`
      : overview.hasUnsaved
        ? 'Không tìm thấy bản tạm. Tránh đóng tab khi chưa lưu thành công.'
        : 'Không có bản tạm cần khôi phục.';
    retry.hidden = !overview.canRetry;
    compare.hidden = !overview.canCompare;
    reload.hidden = !overview.canCompare;
  };
  let closed = false;
  let observer = null;
  const close = () => { if (!closed && dialog.open) dialog.close(); };
  dialog.addEventListener('close', () => {
    closed = true;
    observer?.disconnect();
    dialog.remove();
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }, { once: true });
  dialog.addEventListener('click', async event => {
    const action = event.target.closest('[data-recovery-action]')?.dataset.recoveryAction;
    if (!action || closed) return;
    if (action === 'close') { close(); return; }
    if (action === 'refresh') { render(); info.textContent = 'Đã cập nhật trạng thái hiện tại.'; return; }
    if (action === 'export') {
      try {
        const { json, filename } = makeRecoveryExport({
          designId: design.id, revision: session.revision, draft: store.get(),
        });
        const objectUrl = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }));
        try {
          const anchor = dom('a', { href: objectUrl, download: filename });
          document.body.append(anchor);
          anchor.click();
          anchor.remove();
        } finally { setTimeout(() => URL.revokeObjectURL(objectUrl), 1000); }
        info.textContent = 'Đã yêu cầu tải bản sao JSON. Hãy lưu tệp ở nơi riêng tư.';
      } catch {
        info.textContent = 'Không thể xuất bản sao trên thiết bị này. Hãy giữ tab mở.';
      }
      return;
    }
    try {
      if (action === 'retry' && typeof onRetry === 'function') {
        await onRetry();
        if (!closed) { render(); info.textContent = 'Đã hoàn tất yêu cầu thử lưu. Kiểm tra trạng thái mới.'; }
      }
      if (action === 'compare' && typeof onCompare === 'function') { close(); await onCompare(); }
      if (action === 'reload' && typeof onReload === 'function') { close(); await onReload(); }
    } catch (error) {
      if (!closed) info.textContent = 'Thao tác chưa thành công. Nội dung đang chỉnh sửa vẫn được giữ.';
      onError(error);
    }
  });
  document.body.append(dialog);
  try {
    dialog.showModal();
    render();
    if (typeof MutationObserver !== 'undefined') {
      const indicator = document.querySelector('.editor-save-status');
      if (indicator) {
        observer = new MutationObserver(() => { if (!closed) render(); });
        observer.observe(indicator, { childList: true, characterData: true, subtree: true });
      }
    }
    closeButton.focus();
  }
  catch (error) { dialog.remove(); throw error; }
  return dialog;
}
