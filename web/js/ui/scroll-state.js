// Replacing content in one panel must not move that panel's scroll position.
export function preserveScroll(region, update) {
  const top = region.scrollTop, left = region.scrollLeft;
  try { return update(); }
  finally { region.scrollTop = top; region.scrollLeft = left; }
}

export function captureFieldFocus(region, attribute = 'data-field') {
  const active = globalThis.document.activeElement;
  if (!region.contains(active) || !active.hasAttribute(attribute)) return null;
  return { attribute, key: active.getAttribute(attribute), start: active.selectionStart, end: active.selectionEnd, direction: active.selectionDirection };
}

export function restoreFieldFocus(region, state) {
  if (!state || !region.getClientRects().length) return;
  const control = region.querySelector(`[${state.attribute}="${globalThis.CSS.escape(state.key)}"]`);
  if (!control || control.matches(':disabled')) return;
  control.focus({ preventScroll: true });
  if (typeof state.start === 'number' && typeof control.setSelectionRange === 'function')
    control.setSelectionRange(state.start, state.end, state.direction || 'none');
}
