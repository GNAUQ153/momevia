// Hiệu ứng có chiều sâu cho trang chủ. Không thay đổi dữ liệu hay logic Canvas.
// Dùng API của trình duyệt để tránh tải thư viện 3D nặng trên điện thoại.
export function mountMarketingMotion(root, { signal } = {}) {
  if (!root || typeof window === 'undefined') return () => {};
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const pointer = window.matchMedia?.('(hover: hover) and (pointer: fine)');
  const stage = root.querySelector('[data-mkt-tilt]');
  const revealItems = [...root.querySelectorAll('[data-mkt-reveal]')];
  let frame = 0;
  let observer;

  function resetTilt() {
    if (!stage) return;
    stage.style.removeProperty('--mkt-tilt-x');
    stage.style.removeProperty('--mkt-tilt-y');
  }

  function onPointerMove(event) {
    if (!stage || media?.matches || !pointer?.matches) return;
    const bounds = stage.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(() => {
      stage.style.setProperty('--mkt-tilt-x', `${(-y * 3).toFixed(2)}deg`);
      stage.style.setProperty('--mkt-tilt-y', `${(x * 4).toFixed(2)}deg`);
    });
  }

  if (stage) {
    stage.addEventListener('pointermove', onPointerMove, { signal });
    stage.addEventListener('pointerleave', resetTilt, { signal });
    media?.addEventListener?.('change', resetTilt, { signal });
  }

  if (!media?.matches && 'IntersectionObserver' in window && revealItems.length) {
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('mkt-is-visible');
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.09, rootMargin: '0px 0px -30px 0px' });
    for (const item of revealItems) observer.observe(item);
    root.setAttribute('data-mkt-motion-ready', '');
  }

  return () => {
    window.cancelAnimationFrame(frame);
    observer?.disconnect();
    root.removeAttribute('data-mkt-motion-ready');
    resetTilt();
  };
}
