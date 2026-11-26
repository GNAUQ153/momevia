// Chỉ quản lý hộp thoại của app shell, không can thiệp dialog native của Canvas.
const selector = 'button, input, textarea, select, a[href], [tabindex], [contenteditable="true"]';

function controls(dialog) {
  return [...dialog.querySelectorAll(selector)]
    .filter(node => node.tabIndex >= 0 && !node.matches(':disabled') &&
      !node.closest('[hidden], [inert]') && node.getClientRects().length &&
      node.ownerDocument.defaultView.getComputedStyle(node).visibility === 'visible')
    .sort((a, b) => (a.tabIndex || Infinity) - (b.tabIndex || Infinity));
}

export function focusDialog(dialog) {
  if (!dialog) return;
  const available = controls(dialog);
  const input = available.find(node => node.matches('input:not([type="hidden"])'));
  (input || available[0] || dialog).focus();
}

export function trapDialogTab(dialog, event) {
  if (!dialog || event.key !== 'Tab') return;
  const available = controls(dialog);
  const first = available[0];
  const last = available.at(-1);
  const active = dialog.ownerDocument.activeElement;
  if (!available.includes(active) || (event.shiftKey ? active === first : active === last)) {
    event.preventDefault();
    ((event.shiftKey ? last : first) || dialog).focus();
  }
}
