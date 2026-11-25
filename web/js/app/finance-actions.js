import { message, text } from '../core/i18n.js';
import { refundHistoryPanel } from '../pages/refund-review.js';

// Nhóm hành động finance; nhận dependency từ Application Controller.
export function createFinanceActions({
  state,
  api,
  toast,
  render,
  openModal,
  getRefundQueue,
  loadAdminRefundQueue,
  adminExceptionsCsv,
  creatorSalesCsv,
  exportFileName,
  downloadCsvFile,
  paymentAuditRows,
}) {
  return [
    [["creator-finance-export", "admin-finance-export"], async (action, element) => {
      const isAdmin = action === 'admin-finance-export';
      if (isAdmin ? state.user?.role !== 'admin' : !['creator', 'admin'].includes(state.user?.role)) return;
      element.disabled = true;
      try {
        // Luôn tải báo cáo mới, chỉ từ API đã xác thực; không nhận creatorId từ trình duyệt.
        const result = await api.get(isAdmin
          ? '/checkout/payments/admin/finance/exceptions?limit=100'
          : '/checkout/payments/creator/statement?limit=100');
        if (!element.isConnected) return;
        const report = isAdmin ? result.audit : result.statement;
        const records = isAdmin ? report?.records : report?.recent;
        if (!Array.isArray(records) || !records.length) return toast(message('finance.export.empty'));
        const csv = isAdmin ? adminExceptionsCsv(report) : creatorSalesCsv(report);
        const kind = isAdmin ? 'admin-exceptions' : 'creator-sales';
        downloadCsvFile(exportFileName(kind), csv);
      } catch {
        if (element.isConnected) toast(message('finance.export.error'), 'error');
      } finally {
        if (element.isConnected) element.disabled = false;
      }
      return;
    }],
    [["admin-refund-next", "admin-refund-prev"], async (action, element) => {
      const refundQueue = getRefundQueue();
      if (state.user?.role !== 'admin') return;
      const forward = action === 'admin-refund-next';
      if (forward && !refundQueue.nextCursor) return;
      if (!forward && refundQueue.index === 0) return;
      const index = refundQueue.index + (forward ? 1 : -1);
      const cursor = forward ? refundQueue.nextCursor : refundQueue.cursors[index];
      element.disabled = true;
      try {
        await loadAdminRefundQueue({ index, cursor });
      } finally { if (element.isConnected) element.disabled = false; }
      return;
    }],
    [["admin-refund-move"], async (action, element) => {
      if (state.user?.role !== 'admin') return;
      const card = element.closest('[data-refund-item]');
      const status = card?.querySelector('[data-refund-next]')?.value;
      const note = card?.querySelector('[data-refund-note]')?.value.trim() || '';
      if (!status || note.length < 10) return toast(message('refund.admin.noteRequired'), 'error');
      element.disabled = true;
      try {
        await api.post(`/checkout/payments/admin/refund-requests/${encodeURIComponent(element.dataset.requestId)}/transition`, {
          expectedStatus: element.dataset.expectedStatus, status, note,
        });
        toast(message('refund.admin.updated'));
        await render();
      } finally { if (element.isConnected) element.disabled = false; }
      return;
    }],
    [["admin-refund-history"], async (action, element) => {
      if (state.user?.role !== 'admin') return;
      element.disabled = true;
      try {
        const { events } = await api.get(`/checkout/payments/admin/refund-requests/${encodeURIComponent(element.dataset.requestId)}/history?limit=50`);
        if (element.isConnected) openModal(`<h2>${text('refund.admin.history')}</h2>${refundHistoryPanel(events)}`);
      } finally { if (element.isConnected) element.disabled = false; }
      return;
    }],
    [["admin-payment-refresh"], async (action, element) => {
      return render();
    }],
    [["admin-payment-audit"], async (action, element) => {
      const panel = element.closest(".payment-review-card")?.querySelector("[data-payment-audit]");
      if (!panel) return;
      panel.hidden = false;
      panel.innerHTML = `<p role="status">${text('admin.payments.auditLoading')}</p>`;
      element.disabled = true;
      try {
        const { attempts } = await api.get(`/checkout/payments/admin/orders/${encodeURIComponent(element.dataset.orderId)}/audit?limit=50`);
        if (panel.isConnected) panel.innerHTML = paymentAuditRows(attempts);
      } catch {
        if (panel.isConnected) panel.innerHTML = `<p role="alert">${text('admin.payments.auditError')}</p>`;
      } finally { if (element.isConnected) element.disabled = false; }
      return;
    }],
    [["retry-admin-queues"], async (action, element) => {
      return render();
    }],
  ];
}
