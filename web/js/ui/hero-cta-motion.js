// Animate the existing floating actions from the hero's two action positions.
export function createHeroCtaMotion(panel) {
  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  let source = null, origins = [], crossed = false, travelled = false, generation = 0;
  let animations = [];

  function stop() {
    generation++;
    for (const animation of animations) animation.cancel();
    animations = [];
    panel.inert = false;
    panel.classList?.remove('floating-cta--travelling');
  }

  function prepare(nextSource, headerBottom = 0) {
    if (source !== nextSource) {
      stop(); source = nextSource; origins = []; crossed = false; travelled = false;
    }
    if (!source) return false;
    const box = source.getBoundingClientRect();
    if (!box.width || !box.height) return false;
    crossed = box.bottom <= headerBottom + 8;
    if (!crossed) {
      travelled = false;
      stop();
      const offset = Math.max(0, headerBottom + 12 - box.top);
      origins = [...source.querySelectorAll('a,button')].slice(0, 2).map(control => {
        const rect = control.getBoundingClientRect();
        return { left: rect.left, top: rect.top + offset, width: rect.width, height: rect.height };
      });
    } else if (!origins.length) {
      // Restored scroll positions still enter from the hero's horizontal alignment.
      const offset = Math.max(0, headerBottom + 12 - box.top);
      origins = [...source.querySelectorAll('a,button')].slice(0, 2).map(control => {
        const rect = control.getBoundingClientRect();
        return { left: rect.left, top: rect.top + offset, width: rect.width, height: rect.height };
      });
    }
    return crossed;
  }

  function sync(visible) {
    if (!visible) { stop(); return; }
    if (!source || !crossed || travelled) return;
    travelled = true;
    if (reduced?.matches) return;
    const controls = [...panel.querySelectorAll('nav > a')];
    const request = ++generation;
    animations = controls.flatMap((control, index) => {
      const from = origins[index], to = control.getBoundingClientRect();
      if (!from?.width || !from.height || !to.width || !to.height || !control.animate) return [];
      return [control.animate([
        { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`, opacity: 0.85 },
        { transform: 'translate(0, 0) scale(1, 1)', opacity: 1 },
      ], { duration: 440, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'none' })];
    });
    if (!animations.length) return;
    // Moving controls cannot intercept a click while travelling across the page.
    panel.inert = true;
    panel.classList.add('floating-cta--travelling');
    Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
      if (request !== generation) return;
      animations = []; panel.inert = false;
      panel.classList.remove('floating-cta--travelling');
    });
  }

  reduced?.addEventListener?.('change', () => { if (reduced.matches) stop(); });
  return { prepare, sync, willTravel: () => Boolean(source && crossed && !travelled && origins.length && !reduced?.matches) };
}
