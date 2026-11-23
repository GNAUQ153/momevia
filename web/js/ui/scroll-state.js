// Replacing content in one panel must not move that panel's scroll position.
export function preserveScroll(region, update) {
  const top = region.scrollTop, left = region.scrollLeft;
  try { return update(); }
  finally { region.scrollTop = top; region.scrollLeft = left; }
}
