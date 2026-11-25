// Keep the fixed frame still for collision checks while its surface slides out.
export function createCtaExitMotion(panel) {
  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  const nav = panel.querySelector?.('nav');
  let animation = null, phase = null, generation = 0;

  function cancel() {
    generation++;
    animation?.cancel(); animation = null;
    phase = null;
    panel.classList?.remove('floating-cta--leaving');
    panel.classList?.remove('floating-cta--entering');
    panel.inert = false;
    panel.removeAttribute?.('aria-hidden');
    panel.style?.removeProperty('--cta-motion-from');
    panel.style?.removeProperty('--cta-motion-opacity');
  }

  function settle(visible) {
    panel.hidden = !visible;
    cancel();
  }

  function start(nextPhase, from) {
    const entering = nextPhase === 'entering';
    cancel(); panel.hidden = false;
    phase = nextPhase;
    panel.inert = true;
    panel.setAttribute?.('aria-hidden', 'true');
    panel.style?.setProperty('--cta-motion-from', from.transform);
    panel.style?.setProperty('--cta-motion-opacity', String(from.opacity));
    panel.classList.add(`floating-cta--${nextPhase}`);
    const request = ++generation;
    animation = nav.animate([
      from,
      { transform: entering ? 'translateX(0)' : 'translateX(calc(100% + 48px))', opacity: entering ? 1 : 0 },
    ], { duration: entering ? 320 : 260, easing: entering ? 'cubic-bezier(.22,1,.36,1)' : 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    animation.finished.then(() => { if (request === generation) settle(entering); }, () => {
      if (request === generation) settle(entering);
    });
  }

  function current(fallback) {
    if (!animation || typeof getComputedStyle !== 'function') return fallback;
    const style = getComputedStyle(nav);
    return { transform: style.transform, opacity: Number(style.opacity) };
  }

  function sync(visible, { animate = true } = {}) {
    if (visible) {
      if (phase === 'entering') {
        if (!animate) settle(true);
        return;
      }
      if (!panel.hidden && phase !== 'leaving') return;
      const from = current({ transform: 'translateX(calc(100% + 48px))', opacity: 0 });
      if (!animate || reduced?.matches || !nav?.animate) { settle(true); return; }
      panel.hidden = false;
      start('entering', from);
      return;
    }
    if (panel.hidden) return;
    panel.inert = true;
    panel.setAttribute?.('aria-hidden', 'true');
    if (phase === 'leaving') return;
    if (reduced?.matches || !nav?.animate) { settle(false); return; }
    start('leaving', current({ transform: 'translateX(0)', opacity: 1 }));
  }

  reduced?.addEventListener?.('change', () => { if (reduced.matches && animation) settle(phase === 'entering'); });
  return { sync };
}
