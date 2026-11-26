import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createToast } from '../../web/js/ui/feedback.js';
import { focusDialog, trapDialogTab } from '../../web/js/ui/dialog-focus.js';
import { createComponents } from '../../web/js/ui/components.js';
import { message } from '../../web/js/core/i18n.js';

const read = name => fs.readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');

function toastFixture() {
  const host = { firstElementChild: null, append(node) { this.firstElementChild = node; } };
  const span = {};
  host.ownerDocument = { createElement: () => ({ className: '', querySelector: () => span, remove: () => { host.firstElementChild = null; } }) };
  return { host, span, toast: createToast(host) };
}

test('Toast giữ node khi cập nhật, hiển thị text an toàn và gia hạn thời gian', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { host, span, toast } = toastFixture();
  toast(message('catalog.saved.added'));
  const node = host.firstElementChild;
  assert.match(span.textContent, /yêu thích/);
  t.mock.timers.tick(4700);
  const payload = '<img src=x onerror=alert(1)>';
  toast(payload, 'error');
  assert.equal(host.firstElementChild, node);
  assert.equal(node.className, 'toast toast--error');
  assert.equal(span.textContent, payload);
  assert(!node.innerHTML.includes(payload));
  t.mock.timers.tick(4799);
  assert.equal(host.firstElementChild, node);
  t.mock.timers.tick(3201);
  assert.equal(host.firstElementChild, null);
});

test('Toast chỉ nhận trạng thái trong allowlist, trạng thái lạ dùng info', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { host, toast } = toastFixture();
  for (const [input, expected] of [['warning','warning'], ['info','info'], ['unknown <script>','info'], ['constructor','info']]) {
    toast('test', input);
    assert.equal(host.firstElementChild.className, `toast toast--${expected}`);
  }
});

function dialogFixture() {
  const doc = { activeElement: null, defaultView: { getComputedStyle: node => ({ visibility: node.visibility }) } };
  const node = (kind, props = {}) => ({
    ownerDocument: doc, tabIndex: 0, visibility: 'visible',
    matches(selector) { return selector === ':disabled' ? Boolean(this.disabled) : kind === 'input'; },
    closest() { return this.hidden ? this : null; },
    getClientRects() { return this.hidden ? [] : [1]; },
    focus() { doc.activeElement = this; }, ...props,
  });
  const close = node('button'), field = node('input'), hidden = node('input', { hidden: true }), disabled = node('button', { disabled: true }), invisible = node('button', { visibility: 'hidden' });
  const dialog = node('dialog', { tabIndex: -1, querySelectorAll: () => [close, hidden, field, disabled, invisible] });
  return { doc, dialog, close, field };
}
function tab(shiftKey = false) { return { key: 'Tab', shiftKey, prevented: false, preventDefault() { this.prevented = true; } }; }

test('Modal ưu tiên input khả dụng và giữ Tab/Shift+Tab trong hộp thoại', () => {
  const { doc, dialog, close, field } = dialogFixture();
  focusDialog(dialog);
  assert.equal(doc.activeElement, field);
  const forward = tab();
  trapDialogTab(dialog, forward);
  assert.equal(forward.prevented, true);
  assert.equal(doc.activeElement, close);
  const backward = tab(true);
  trapDialogTab(dialog, backward);
  assert.equal(backward.prevented, true);
  assert.equal(doc.activeElement, field);
  const normal = tab(true);
  trapDialogTab(dialog, normal);
  assert.equal(normal.prevented, false);
});

test('Modal phục hồi focus bên ngoài và có fallback khi không có điều khiển', () => {
  const { doc, dialog, close, field } = dialogFixture();
  doc.activeElement = {};
  trapDialogTab(dialog, tab());
  assert.equal(doc.activeElement, close);
  doc.activeElement = {};
  trapDialogTab(dialog, tab(true));
  assert.equal(doc.activeElement, field);
  dialog.querySelectorAll = () => [];
  focusDialog(dialog);
  assert.equal(doc.activeElement, dialog);
  const event = tab();
  trapDialogTab(dialog, event);
  assert.equal(event.prevented, true);
  assert.equal(doc.activeElement, dialog);
});

test('Card giữ nguyên giá từ i18n, chỉ thêm phân loại CSS cho giá miễn phí', () => {
  const { templateCard } = createComponents({ state: { favorites: new Set() } });
  const base = { id: 'creator-fixture', title: 'Mẫu <b>test</b>', creator: 'Creator', subtitle: 'Description', style: 'classic', scenes: 1, cardType: 'greeting' };
  const free = templateCard({ ...base, price: 0 });
  const paid = templateCard({ ...base, price: 29000 });
  assert.match(free, /class="template-card__price template-card__price--free"/);
  assert.match(free, /Miễn phí/);
  assert.match(paid, /class="template-card__price"/);
  assert.doesNotMatch(paid, /template-card__price--free/);
  assert.match(free, /Mẫu &lt;b&gt;test&lt;\/b&gt;/);
});

test('Feedback và card dùng token, modal không ghi đè Auth và giữ live region', () => {
  const css = read('web/css/open-me-system.css');
  const html = read('web/index.html');
  assert.match(css, /\.catalog-compact \.template-card__price--free \{[^}]*background: var\(--color-success-soft\)/);
  assert.match(css, /#modal-root \.dialog:not\(:has\(\.auth-modal\)\) \{[^}]*overflow-y: auto/);
  assert.match(css, /\.toast-host \.toast--error \{[^}]*color: var\(--color-error\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.toast-host \.toast \{\s*animation: none/);
  assert.match(html, /id="toast-host" role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(read('web/js/app/main.js'), /role="dialog" aria-modal="true" tabindex="-1"/);
});
