import { message, onLocaleChange, setAttr } from '../../core/i18n.js';
import { templateValue } from '../catalog/template-copy.js';

// Only the three cover layers transition. The live player is loaded on demand.
export function mountHeroTemplates(host, templates) {
  const root = host.querySelector('.mkt-hero');
  const cover = root.querySelector('.mkt-hero__cover');
  const images = [...cover.querySelectorAll('[data-hero-image]')];
  const selectors = [...root.querySelectorAll('[data-hero-select]')];
  const playback = root.querySelector('[data-hero-playback]');
  const dialog = root.querySelector('.template-preview-dialog');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const lifetime = new AbortController();
  const options = { signal: lifetime.signal };
  let index = 0, timer, generation = 0, paused = false, hovering = false, visible = true;

  function canRotate() {
    const focused = root.contains(document.activeElement) && document.activeElement !== playback;
    return !lifetime.signal.aborted && !paused && !reduce.matches && !hovering && !focused &&
      !document.hidden && visible && !dialog.open;
  }
  function schedule() {
    clearTimeout(timer);
    if (canRotate()) timer = setTimeout(() => void select((index + 1) % templates.length, true), 5000);
  }
  function update() {
    root.dataset.heroTemplate = templates[index].id;
    images.forEach((image, position) => { image.dataset.active = String(position === index); });
    selectors.forEach((button, position) => button.setAttribute('aria-pressed', String(position === index)));
    for (const trigger of root.querySelectorAll('[data-template-preview]')) {
      setAttr(trigger, 'aria-label', message('home.hero.openTemplate', { title: templateValue(templates[index], 'title') }));
    }
    setAttr(playback, 'aria-label', message(paused || reduce.matches ? 'home.hero.play' : 'home.hero.pause'));
    playback.querySelector('[data-hero-pause-icon]').hidden = paused || reduce.matches;
    playback.querySelector('[data-hero-play-icon]').hidden = !paused && !reduce.matches;
    playback.disabled = reduce.matches;
  }
  async function select(next, automatic = false) {
    clearTimeout(timer);
    const request = ++generation;
    try {
      await images[next].decode();
      if (request !== generation || lifetime.signal.aborted || (automatic && !canRotate())) return;
      index = next;
      update();
    } catch { /* Keep the current cover and preview if another cover cannot load. */ }
    finally { if (request === generation) schedule(); }
  }
  selectors.forEach((button, position) => button.addEventListener('click', () => void select(position), options));
  playback.addEventListener('click', () => { paused = !paused; update(); schedule(); }, options);
  cover.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'mouse' || !finePointer.matches) return;
    hovering = true;
    schedule();
  }, options);
  cover.addEventListener('pointerleave', () => { hovering = false; schedule(); }, options);
  root.addEventListener('focusin', schedule, options);
  root.addEventListener('focusout', () => queueMicrotask(schedule), options);
  root.addEventListener('click', event => {
    if (event.target.closest('[data-template-preview]')) schedule();
  }, options);
  dialog.addEventListener('close', schedule, options);
  document.addEventListener('visibilitychange', schedule, options);
  reduce.addEventListener('change', () => { update(); schedule(); }, options);
  finePointer.addEventListener('change', () => { hovering = false; schedule(); }, options);
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
      clearTimeout(timer);
      observer.disconnect();
      removeLocaleListener();
    },
  };
}
