export function scrollBehavior() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
}

export function focusVisibleTarget(target, { reduce = false, block = "nearest" } = {}) {
  if (!target?.isConnected) return;
  target.tabIndex = -1;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block, inline: "nearest", behavior: reduce ? "instant" : scrollBehavior() });
}
