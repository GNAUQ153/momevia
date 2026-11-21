import { message, onLocaleChange, setAttr } from '../../core/i18n.js';
import { templateValue } from '../catalog/template-copy.js';

const duration = 5000;

// One native animation clocks both the progress fill and the next cover.
// The live player is loaded on demand.
export function mountHeroTemplates(host, templates) {
  const root = host.querySelector('.mkt-hero');
  const cover = root.querySelector('.mkt-hero__cover');
  const images = [...cover.querySelectorAll('[data-hero-image]')];
  const selectors = [...root.querySelectorAll('[data-hero-select]')];
  const dialog = root.querySelector('.template-preview-dialog');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const lifetime = new AbortController();
  const options = { signal: lifetime.signal };
  let index = 0, progress, peek, peekImage, generation = 0, visible = true;

  function preparePeek(clock) {
    const image = images[(index + 1) % templates.length];
    image.decode().then(() => {
      if (progress !== clock || lifetime.signal.aborted || reduce.matches) return;
      peekImage = image;
      image.setAttribute('data-peeking', '');
      peek = image.animate([
        { offset: 0, transform: 'rotate(18deg)', opacity: 0 },
        { offset: 0.6, transform: 'rotate(18deg)', opacity: 0 },
        { offset: 1, transform: 'rotate(12deg)', opacity: 0.72 },
      ], { duration, easing: 'linear', fill: 'forwards' });
      peek.currentTime = Number(clock.currentTime) || 0;
      if (!canRotate()) peek.pause();
      else if (clock.startTime !== null) peek.startTime = clock.startTime;
    }).catch(() => { /* Never tease an image that failed to decode. */ });
  }
  function clearPeek(handoff = false) {
    const held = handoff && peek ? peekImage : null;
    // Keep the exact visible pose while changing from the teaser to the active
    // card. A single style read at selection avoids a snap back to the start.
    if (held) peek.commitStyles();
    peek?.cancel();
    peekImage?.removeAttribute('data-peeking');
    peek = peekImage = null;
    if (held) void getComputedStyle(held).transform;
    return held;
  }

  function canRotate() {
    return !lifetime.signal.aborted && !reduce.matches &&
      !document.hidden && visible && !dialog.open;
  }
  function schedule() {
    if (!canRotate()) {
      progress?.pause();
      peek?.pause();
      if (reduce.matches) resetProgress();
      return;
    }
    if (progress && Number(progress.currentTime) >= duration) {
      void select((index + 1) % templates.length, true);
      return;
    }
    if (!progress) {
      const animation = progress = selectors[index].querySelector('[data-hero-progress]').animate(
        [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
        { duration, easing: 'linear', fill: 'forwards' },
      );
      animation.onfinish = () => {
        if (progress === animation && canRotate()) void select((index + 1) % templates.length, true);
      };
      preparePeek(animation);
    } else if (progress.playState === 'paused') {
      progress.play();
      if (peek) {
        peek.currentTime = Number(progress.currentTime) || 0;
        peek.play();
      }
    }
  }
  function resetProgress() {
    progress?.cancel();
    progress = null;
    clearPeek();
  }
  function update() {
    root.dataset.heroTemplate = templates[index].id;
    images.forEach((image, position) => { image.dataset.active = String(position === index); });
    selectors.forEach((button, position) => button.setAttribute('aria-pressed', String(position === index)));
    for (const trigger of root.querySelectorAll('[data-template-preview]')) {
      setAttr(trigger, 'aria-label', message('home.hero.openTemplate', { title: templateValue(templates[index], 'title') }));
    }
  }
  async function select(next, automatic = false) {
    progress?.pause();
    peek?.pause();
    const request = ++generation;
    try {
      await images[next].decode();
      if (request !== generation || lifetime.signal.aborted || (automatic && !canRotate())) return;
      const held = clearPeek(next !== index && images[next] === peekImage);
      resetProgress();
      if (next !== index) images.forEach((image, position) => image.toggleAttribute('data-exiting', position === index));
      index = next;
      update();
      held?.style.removeProperty('transform');
      held?.style.removeProperty('opacity');
    } catch {
      // Retry on a new full cycle, avoiding a tight loop after a failed image.
      if (request === generation) resetProgress();
    }
    finally { if (request === generation) schedule(); }
  }
  selectors.forEach((button, position) => button.addEventListener('click', () => void select(position), options));
  root.addEventListener('click', event => {
    if (event.target.closest('[data-template-preview]')) schedule();
  }, options);
  dialog.addEventListener('close', schedule, options);
  document.addEventListener('visibilitychange', schedule, options);
  reduce.addEventListener('change', () => { update(); schedule(); }, options);
  const removeLocaleListener = onLocaleChange(() => { ++generation; update(); schedule(); });
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    schedule();
  });
  observer.observe(cover);
  update();
  schedule();
  return {
    get template() { return templates[index]; },
    dispose() {
      lifetime.abort();
      ++generation;
      resetProgress();
      observer.disconnect();
      removeLocaleListener();
    },
  };
}
