// Only public pages share this motion; editors and gift players own their lifecycle.
export function canTransitionPage(path) {
  return /^\/(?:$|explore\/?$|template\/[^/]+\/?$|creator\/?$|pricing\/?$|about\/?$|policies\/[^/]+\/?$|login\/?$|register\/?$|recover\/?$|verify-email\/?$)/.test(path);
}

export function sameDocument(from, to) {
  const previous = new URL(from, 'https://momevia.invalid');
  const next = new URL(to, previous);
  return previous.pathname === next.pathname && previous.search === next.search;
}

export function createPageTransition(main, root = document.documentElement) {
  let generation = 0;
  let animation;
  return {
    begin(enabled) {
      const current = ++generation;
      let finished = false;
      animation?.cancel();
      animation = null;
      root.classList.toggle('is-page-pending', enabled);
      if (enabled) main.setAttribute('aria-busy', 'true');
      else main.removeAttribute('aria-busy');
      return () => {
        if (current !== generation || finished) return;
        finished = true;
        root.classList.remove('is-page-pending');
        main.removeAttribute('aria-busy');
        if (!enabled || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !main.animate) return;
        animation = main.animate([
          { opacity: .72, transform: 'translateY(6px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ], { duration: 220, easing: 'cubic-bezier(.2,.65,.3,1)' });
        const active = animation;
        active.finished.then(() => {
          if (animation === active) { active.cancel(); animation = null; }
        }, () => {});
      };
    },
  };
}
