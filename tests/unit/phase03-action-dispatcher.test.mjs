import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionDispatcher } from '../../web/js/app/action-dispatcher.js';
import { createFinanceActions } from '../../web/js/app/finance-actions.js';
import { createCatalogActions } from '../../web/js/app/catalog-actions.js';
import { createShellActions } from '../../web/js/app/shell-actions.js';
import { createPaymentActions } from '../../web/js/app/payment-actions.js';
import { createStudioActions } from '../../web/js/app/studio-actions.js';
import { t } from '../../web/js/core/i18n.js';

const element = (dataset = {}) => ({ dataset, isConnected: true, disabled: false });
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

// Khóa danh sách action cũ; không để mất alias hoặc đăng ký trùng khi tách module.
test('Tất cả 56 action hiện hữu có đúng một handler', () => {
  const expected = `creator-finance-export admin-finance-export admin-refund-next admin-refund-prev admin-refund-move admin-refund-history admin-payment-refresh admin-payment-audit retry-admin-queues duplicate-template withdraw-template report-content claim-report resolve-report creator-jump creator-login login register support back-to-top toggle-favorite demo-mode toggle-password close-modal account-menu toggle-menu logout filter-seasonal retry-catalog clear-filters set-page payment-login print-receipt payment-status reconcile-payment refresh-payment retry-canvas-payment archive-design revoke-gift renew-gift archive-gift restore-gift-list recipient-results gift-inbox regift duplicate-design load-more-designs payment-options start-payment demo-buy open-gift reveal-gift copy-link share-gift approve-template reject-template qr`.split(' ');
  const groups = [createFinanceActions({}), createCatalogActions({}), createShellActions({}), createPaymentActions({}), createStudioActions({})];
  assert.deepEqual(groups.flatMap(group => group.flatMap(([names]) => names)).sort(), expected.sort());
  assert.doesNotThrow(() => createActionDispatcher(...groups));
});

test('Dispatcher giữ alias, giá trị trả về và lỗi handler; action lạ không có tác dụng', async () => {
  const trigger = element();
  const failure = new Error('offline');
  const dispatch = createActionDispatcher([
    [['open', 'reveal'], async (name, el) => { assert.equal(el, trigger); return name; }],
    [['failure'], async () => { throw failure; }],
  ]);
  assert.equal(await dispatch('open', trigger), 'open');
  assert.equal(await dispatch('reveal', trigger), 'reveal');
  assert.equal(await dispatch('constructor', trigger), undefined);
  assert.equal(await dispatch('__proto__', trigger), undefined);
  await assert.rejects(dispatch('failure', trigger), error => error === failure);
  assert.throws(() => createActionDispatcher([[['a'], () => {}]], [[['a'], () => {}]]), /Duplicate action/);
});

test('Finance export đọc role hiện tại và chỉ gọi endpoint đúng phạm vi', async () => {
  const state = { user: { role: 'sender' } };
  const calls = [];
  const files = [];
  const report = { records: [{}] };
  const dispatch = createActionDispatcher(createFinanceActions({
    state, api: { get: async path => { calls.push(path); return { audit: report }; } },
    adminExceptionsCsv: value => { assert.equal(value, report); return 'csv'; },
    exportFileName: kind => `${kind}.csv`, downloadCsvFile: (...args) => files.push(args),
  }));
  const trigger = element({ creatorId: 'other' });
  await dispatch('admin-finance-export', trigger);
  assert.deepEqual(calls, []);
  state.user = { role: 'admin' };
  await dispatch('admin-finance-export', trigger);
  assert.deepEqual(calls, ['/checkout/payments/admin/finance/exceptions?limit=100']);
  assert.deepEqual(files, [['admin-exceptions.csv', 'csv']]);
  assert.equal(trigger.disabled, false);
});

test('Phân trang refund lấy cursor mới, không giữ snapshot lúc đăng ký', async () => {
  let queue = { index: 0, cursors: [null], nextCursor: null };
  const calls = [];
  const dispatch = createActionDispatcher(createFinanceActions({
    state: { user: { role: 'admin' } }, getRefundQueue: () => queue,
    loadAdminRefundQueue: async args => calls.push(args),
  }));
  await dispatch('admin-refund-next', element());
  queue = { index: 1, cursors: [null, 'current'], nextCursor: 'next' };
  await dispatch('admin-refund-next', element());
  await dispatch('admin-refund-prev', element());
  assert.deepEqual(calls, [{ index: 2, cursor: 'next' }, { index: 0, cursor: null }]);
});

test('Checkout dừng khi generation thay đổi trong lúc chờ lưu Canvas', async () => {
  let generation = 1;
  const pending = deferred();
  const checkout = { flushSave: () => pending.promise };
  const calls = [];
  const dispatch = createActionDispatcher(createPaymentActions({
    getRenderGeneration: () => generation, getCanvasCheckout: () => checkout,
    api: { post: async (...args) => { calls.push(args); } },
  }));
  const trigger = element({ id: 'premium', method: 'momo' });
  const request = dispatch('start-payment', trigger);
  assert.equal(trigger.disabled, true);
  generation++;
  pending.resolve({});
  await request;
  assert.deepEqual(calls, []);
  assert.equal(trigger.disabled, false);
});

test('Checkout không điều hướng khi context đổi trong lúc API đang xử lý', async () => {
  const pending = deferred();
  let checkout = null;
  const destinations = [];
  const dispatch = createActionDispatcher(createPaymentActions({
    getRenderGeneration: () => 1, getCanvasCheckout: () => checkout,
    api: { post: () => pending.promise }, navigate: path => destinations.push(path),
  }));
  const trigger = element({ id: 'premium', method: 'momo' });
  const request = dispatch('start-payment', trigger);
  checkout = {};
  pending.resolve({ payment: { status: 'paid', orderId: 'order-1' } });
  await request;
  assert.deepEqual(destinations, []);
  assert.equal(trigger.disabled, false);
});

test('Checkout giữ payload mua thêm, URL an toàn và điều hướng đơn paid', async () => {
  const calls = [];
  const destinations = [];
  let payment = { status: 'pending', checkoutUrl: 'http://example.invalid/' };
  const dispatch = createActionDispatcher(createPaymentActions({
    getRenderGeneration: () => 1, getCanvasCheckout: () => null,
    api: { post: async (...args) => { calls.push(args); return { payment }; } },
    closeModal: () => {}, navigate: path => destinations.push(path),
  }));
  const trigger = element({ id: 'premium', method: 'momo', previousOrderId: 'old' });
  await assert.rejects(dispatch('start-payment', trigger), { message: t('payment.checkout.unsafeUrl') });
  assert.equal(trigger.disabled, false);
  assert.deepEqual(destinations, []);
  payment = { status: 'paid', orderId: 'order/1' };
  await dispatch('start-payment', trigger);
  assert.deepEqual(calls[0], ['/checkout/payments/create', { templateId: 'premium', method: 'momo', previousOrderId: 'old' }]);
  assert.deepEqual(destinations, ['/payment-result/order%2F1']);
});

test('Logout giữ beforeLeave và đọc route controller hiện hành', async () => {
  const calls = [];
  let controller = { beforeLeave: () => false, dispose: () => calls.push('unexpected') };
  const dispatch = createActionDispatcher(createShellActions({
    getRouteController: () => controller, clearRouteController: () => { controller = null; calls.push('clear'); },
    api: { post: async path => calls.push(path) }, setUser: user => calls.push(user),
    toast: () => {}, navigate: path => calls.push(path),
  }));
  await dispatch('logout', element());
  assert.deepEqual(calls, []);
  controller = { beforeLeave: () => true, dispose: () => calls.push('dispose') };
  await dispatch('logout', element());
  assert.deepEqual(calls, ['dispose', 'clear', '/auth/logout', null, '/']);
});
