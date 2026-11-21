// Chuyển động có chiều sâu trên trang Marketing; không tác động trạng thái Canvas.
// Chỉ bật 3D khi có con trỏ chính xác và người dùng cho phép chuyển động.
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function marketingPointerGeometry(event, bounds) {
  if (!event || !bounds) return null;
  const values = [event.clientX, event.clientY, bounds.left, bounds.top, bounds.width, bounds.height];
  if (!values.every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) return null;

  const x = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
  const y = clamp((event.clientY - bounds.top) / bounds.height, 0, 1);
  return {
    tiltX: `${((1 - y * 2) * 3).toFixed(2)}deg`,
    tiltY: `${((x * 2 - 1) * 4).toFixed(2)}deg`,
    glowX: `${(x * 100).toFixed(1)}%`,
    glowY: `${(y * 100).toFixed(1)}%`,
  };
}

export function mountMarketingMotion(root, { signal } = {}) {
  if (!root || typeof window === 'undefined') return () => {};
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const pointer = window.matchMedia?.('(hover: hover) and (pointer: fine)');
  const stage = root.querySelector('[data-mkt-tilt]');
  const revealItems = [...root.querySelectorAll('[data-mkt-reveal]')];
  const ownerDocument = stage?.ownerDocument || window.document;
  const lifetime = new AbortController();
  let frame = null;
  let pendingPoint = null;
  let observer = null;
  let disposed = false;

  function resetTilt() {
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    pendingPoint = null;
    if (!stage) return;
    for (const property of ['--mkt-tilt-x', '--mkt-tilt-y', '--mkt-glow-x', '--mkt-glow-y']) {
      stage.style.removeProperty(property);
    }
    stage.removeAttribute('data-mkt-pointer-active');
  }

  function motionAllowed() {
    return !media?.matches && Boolean(pointer?.matches) && !ownerDocument?.hidden;
  }

  function onPointerMove(event) {
    if (!stage || !motionAllowed()) {
      resetTilt();
      return;
    }
    if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    pendingPoint = marketingPointerGeometry(event, stage.getBoundingClientRect());
    if (!pendingPoint || frame !== null) return;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      if (disposed || !motionAllowed() || !pendingPoint) {
        resetTilt();
        return;
      }
      stage.style.setProperty('--mkt-tilt-x', pendingPoint.tiltX);
      stage.style.setProperty('--mkt-tilt-y', pendingPoint.tiltY);
      stage.style.setProperty('--mkt-glow-x', pendingPoint.glowX);
      stage.style.setProperty('--mkt-glow-y', pendingPoint.glowY);
      stage.setAttribute('data-mkt-pointer-active', '');
    });
  }

  function showReveal() {
    observer?.disconnect();
    observer = null;
    root.removeAttribute('data-mkt-motion-ready');
    for (const item of revealItems) item.classList.add('mkt-is-visible');
  }

  function syncReveal() {
    // Khi giảm chuyển động giữa chừng, không để nội dung bị ẩn bởi CSS reveal.
    if (media?.matches || typeof window.IntersectionObserver !== 'function') {
      showReveal();
      return;
    }
    if (observer || revealItems.every(item => item.classList.contains('mkt-is-visible'))) return;
    observer = new window.IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('mkt-is-visible');
        observer?.unobserve(entry.target);
      }
    }, { threshold: 0.09, rootMargin: '0px 0px -30px 0px' });
    for (const item of revealItems) {
      if (!item.classList.contains('mkt-is-visible')) observer.observe(item);
    }
    root.setAttribute('data-mkt-motion-ready', '');
  }

  function onPreferenceChange() {
    resetTilt();
    syncReveal();
  }

  function onVisibilityChange() {
    if (ownerDocument?.hidden) resetTilt();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    lifetime.abort();
    observer?.disconnect();
    observer = null;
    resetTilt();
    root.removeAttribute('data-mkt-motion-ready');
    signal?.removeEventListener?.('abort', dispose);
  }

  if (stage) {
    stage.addEventListener('pointermove', onPointerMove, { signal: lifetime.signal });
    stage.addEventListener('pointerleave', resetTilt, { signal: lifetime.signal });
  }
  media?.addEventListener?.('change', onPreferenceChange, { signal: lifetime.signal });
  pointer?.addEventListener?.('change', resetTilt, { signal: lifetime.signal });
  ownerDocument?.addEventListener?.('visibilitychange', onVisibilityChange, { signal: lifetime.signal });
  syncReveal();
  if (signal?.aborted) dispose();
  else signal?.addEventListener?.('abort', dispose, { once: true });
  return dispose;
}
