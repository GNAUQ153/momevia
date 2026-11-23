// Điều hướng bàn phím cho bottom sheet; không giữ state của Canvas hay người dùng.
const FOCUSABLE = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function sheetFocusables(panel) {
  if (!panel) return [];
  return [...panel.querySelectorAll(FOCUSABLE)].filter(control =>
    !control.disabled && control.tabIndex >= 0 &&
    !control.closest('[hidden], [inert], [aria-hidden="true"]') &&
    control.getClientRects().length > 0,
  );
}

export function nextSheetFocus(panel, active, shiftKey = false) {
  if (!panel) return null;
  const controls = sheetFocusables(panel);
  if (!controls.length) return panel;
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (active === panel || !panel.contains(active)) return shiftKey ? last : first;
  if (shiftKey && active === first) return last;
  if (!shiftKey && active === last) return first;
  return null;
}
