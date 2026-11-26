// Chuyển động có chiều sâu trên trang Marketing; không tác động trạng thái Canvas.
// Chỉ bật 3D khi có con trỏ chính xác và người dùng cho phép chuyển động.
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

import { mountJourney } from './journey.js';
import { createLatestFrameScheduler } from './latest-frame.js';
import { marketingConnection, marketingShouldShowStatic } from './motion-preferences.js';

export function marketingPointerGeometry(event, bounds, strength = 1) {
  if (!event || !bounds) return null;
  const values = [event.clientX, event.clientY, bounds.left, bounds.top, bounds.width, bounds.height];
  if (!values.every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) return null;

  const x = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
  const y = clamp((event.clientY - bounds.top) / bounds.height, 0, 1);
  const amplitude = Number.isFinite(strength) ? clamp(strength, 0, 1) : 1;
  return {
    tiltX: `${((1 - y * 2) * 3 * amplitude).toFixed(2)}deg`,
    tiltY: `${((x * 2 - 1) * 4 * amplitude).toFixed(2)}deg`,
    glowX: `${(x * 100).toFixed(1)}%`,
    glowY: `${(y * 100).toFixed(1)}%`,
  };
}

export function mountMarketingMotion(root, { signal } = {}) {
  if (!root || typeof window === 'undefined') return () => {};
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const reducedData = window.matchMedia?.('(prefers-reduced-data: reduce)');
  const connection = marketingConnection(window.navigator);
  const pointer = window.matchMedia?.('(hover: hover) and (pointer: fine)');
  const stage = root.querySelector('[data-mkt-tilt]');
  const revealItems = [...root.querySelectorAll('[data-mkt-reveal]')];
  const ownerDocument = stage?.ownerDocument || window.document;
  const lifetime = new AbortController();
  const disposeJourney = mountJourney(root, { signal: lifetime.signal });
  let observer = null;
  let disposed = false;

  function staticPreferred() {
    return marketingShouldShowStatic({
      reducedMotion: media?.matches, reducedData: reducedData?.matches, saveData: connection?.saveData,
    });
  }

  function motionAllowed() {
    return !staticPreferred() && Boolean(pointer?.matches) && !ownerDocument?.hidden;
  }

  // Đọc kích thước phần tử trong RAF, không đọc ở từng sự kiện pointermove.
  // Nhiều sự kiện trong cùng một frame chỉ sử dụng tọa độ cuối cùng.
  const pointerFrame = createLatestFrameScheduler({
    requestFrame: callback => window.requestAnimationFrame(callback),
    cancelFrame: id => window.cancelAnimationFrame(id),
    render: point => {
      if (disposed || !stage || !motionAllowed()) {
        resetTilt();
        return;
      }
      const geometry = marketingPointerGeometry(point, stage.getBoundingClientRect(), Number(stage.dataset?.mktTiltStrength ?? 1));
      if (!geometry) {
        resetTilt();
        return;
      }
      stage.style.setProperty('--mkt-tilt-x', geometry.tiltX);
      stage.style.setProperty('--mkt-tilt-y', geometry.tiltY);
      stage.style.setProperty('--mkt-glow-x', geometry.glowX);
      stage.style.setProperty('--mkt-glow-y', geometry.glowY);
      stage.setAttribute('data-mkt-pointer-active', '');
    },
  });

  function resetTilt() {
    pointerFrame.clear();
    if (!stage) return;
    for (const property of ['--mkt-tilt-x', '--mkt-tilt-y', '--mkt-glow-x', '--mkt-glow-y']) {
      stage.style.removeProperty(property);
    }
    stage.removeAttribute('data-mkt-pointer-active');
  }

  function onPointerMove(event) {
    if (!stage || !motionAllowed()) {
      resetTilt();
      return;
    }
    if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    pointerFrame.enqueue({ clientX: event.clientX, clientY: event.clientY });
  }

  function showReveal() {
    observer?.disconnect();
    observer = null;
    root.removeAttribute('data-mkt-motion-ready');
    for (const item of revealItems) item.classList.add('mkt-is-visible');
  }

  function syncReveal() {
    // Khi giảm chuyển động giữa chừng, không để nội dung bị ẩn bởi CSS reveal.
    if (staticPreferred() || typeof window.IntersectionObserver !== 'function') {
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
    disposeJourney();
    observer?.disconnect();
    observer = null;
    resetTilt();
    pointerFrame.dispose();
    root.removeAttribute('data-mkt-motion-ready');
    signal?.removeEventListener?.('abort', dispose);
  }

  if (stage) {
    stage.addEventListener('pointermove', onPointerMove, { signal: lifetime.signal });
    stage.addEventListener('pointerleave', resetTilt, { signal: lifetime.signal });
  }
  media?.addEventListener?.('change', onPreferenceChange, { signal: lifetime.signal });
  reducedData?.addEventListener?.('change', onPreferenceChange, { signal: lifetime.signal });
  connection?.addEventListener?.('change', onPreferenceChange, { signal: lifetime.signal });
  pointer?.addEventListener?.('change', resetTilt, { signal: lifetime.signal });
  ownerDocument?.addEventListener?.('visibilitychange', onVisibilityChange, { signal: lifetime.signal });
  syncReveal();
  if (signal?.aborted) dispose();
  else signal?.addEventListener?.('abort', dispose, { once: true });
  return dispose;
}
