import { attr, message, onLocaleChange, setAttr } from '../../core/i18n.js';
import { heroTemplateCover, templateValue } from '../catalog/template-copy.js';
import { escapeHtml as e } from '../../shared/locale.js';
import { marketingConnection, marketingDataSaverEnabled } from './motion-preferences.js';

const duration = 5000;

export function heroImages(templates,active=0) {
  return templates.map((template,index)=>`<img ${index===active?heroTemplateCover(template):''} data-hero-image="${e(template.id)}" data-active="${index===active}" alt="" width="390" height="844" ${index===active?'fetchpriority="high"':'decoding="async"'} />`).join('');
}
export function heroSelectors(templates,active=0) {
  return templates.map((template,index)=>`<button type="button" class="mkt-hero__slide" data-hero-select="${index}" aria-pressed="${index===active}" ${attr('aria-label','catalog.actions.viewNamed',{title:templateValue(template,'title')})}><span aria-hidden="true"><span data-hero-progress></span></span></button>`).join('');
}



// One native animation clocks both the progress fill and the next cover.
// The live player is loaded on demand.
export function mountHeroTemplates(host, initialTemplates) {
  const root = host.querySelector('.mkt-hero');
  const cover = root.querySelector('.mkt-hero__cover');
  const rotation = root.querySelector('.mkt-hero__rotation');
  let templates = initialTemplates, images = [...cover.querySelectorAll('[data-hero-image]')], selectors = [...root.querySelectorAll('[data-hero-select]')];
  const notes = [...root.querySelectorAll('.mkt-stage__note, .mkt-stage__reply')];
  const dialog = root.querySelector('.template-preview-dialog');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const reducedData = globalThis.matchMedia?.('(prefers-reduced-data: reduce)');
  const connection = marketingConnection(globalThis.navigator);
  const lifetime = new AbortController();
  const options = { signal: lifetime.signal };
  let index = 0, progress, peek, peekImage, generation = 0, visible = true;
  const savingData = () => marketingDataSaverEnabled({ reducedData: reducedData?.matches, saveData: connection?.saveData });
  let dataPaused = savingData();
  let noteMotions = [], noteStarts;

  function ensureImage(position) {
    const image=images[position], fragment=document.createElement('template');
    fragment.innerHTML='<img '+heroTemplateCover(templates[position])+'>';
    const source=fragment.content.firstElementChild;
    for(const name of ['srcset','sizes','src','data-i18n-src','data-i18n-params','data-i18n-srcset','data-i18n-src-params']) {
      const value=source.getAttribute(name);
      if(value!==null&&image.getAttribute(name)!==value)image.setAttribute(name,value);
    }
    return image;
  }
  function updateTemplates(next) {
    if(!next?.length)return;
    ++generation;resetProgress();templates=next;index=Math.min(index,next.length-1);
    cover.innerHTML=heroImages(templates,index);
    rotation.innerHTML=heroSelectors(templates,index);
    images=[...cover.querySelectorAll('[data-hero-image]')];selectors=[...rotation.querySelectorAll('[data-hero-select]')];
    ensureImage(index);update();schedule();
  }

  function moveNotes(clock) {
    const easing = getComputedStyle(root).getPropertyValue('--ease-in-out').trim();
    noteMotions = notes.map((note, position) => {
      const rest = getComputedStyle(note).transform;
      const direction = position === 0 ? -1 : 1;
      const lag = position * 300 / duration;
      const start = noteStarts?.[position] || rest;
      const outward = `translate3d(${direction * 3}px, ${direction}px, 0) rotate(${direction * 0.6}deg) ${rest}`;
      const motion = note.animate([
        { offset: 0, transform: start, easing },
        ...(lag ? [{ offset: lag, transform: start, easing }] : []),
        { offset: 0.4 + lag, transform: rest },
        { offset: 0.6 + lag, transform: rest, easing },
        // Both end at the same pose/time, keeping the next cycle seamless.
        { offset: 1, transform: outward },
      ], { duration, easing: 'linear', fill: 'forwards' });
      motion.currentTime = Number(clock.currentTime) || 0;
      if (clock.startTime !== null) motion.startTime = clock.startTime;
      return motion;
    });
    noteStarts = null;
  }

  function preparePeek(clock) {
    const image = ensureImage((index + 1) % templates.length);
    image.decode().then(() => {
      if (progress !== clock || lifetime.signal.aborted || reduce.matches) return;
      peekImage = image;
      image.setAttribute('data-peeking', '');
      peek = image.animate([
        { offset: 0, transform: 'rotate(8deg)', opacity: 0, filter: 'none' },
        { offset: 0.6, transform: 'rotate(8deg)', opacity: 0, filter: 'none' },
        { offset: 1, transform: 'rotate(4deg)', opacity: 0.56, filter: 'none' },
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
      !dataPaused && !document.hidden && visible && !dialog.open;
  }
  function schedule() {
    // Dùng cùng trạng thái với đồng hồ thiệp để tạm dừng quầng sáng CSS.
    // Không để animation chạy ngầm khi hero ngoài viewport, tab ẩn hoặc mở preview.
    const running = canRotate();
    root.toggleAttribute('data-mkt-ambient-running', running);
    if (!running) {
      progress?.pause();
      peek?.pause();
      noteMotions.forEach(motion => motion.pause());
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
      moveNotes(animation);
    } else if (progress.playState === 'paused') {
      progress.play();
      if (peek) {
        peek.currentTime = Number(progress.currentTime) || 0;
        peek.play();
      }
      noteMotions.forEach(motion => {
        motion.currentTime = Number(progress.currentTime) || 0;
        motion.play();
      });
    }
  }
  function resetProgress(keepNotePose = false) {
    noteStarts = keepNotePose ? notes.map(note => getComputedStyle(note).transform) : null;
    noteMotions.forEach(motion => motion.cancel());
    noteMotions = [];
    progress?.cancel();
    progress = null;
    clearPeek();
  }
  function update() {
    root.dataset.heroTemplate = templates[index].id;
    images.forEach((image, position) => { image.dataset.active = String(position === index); });
    selectors.forEach((button,position)=>button.setAttribute('aria-pressed',String(position===index)));
    for(const trigger of root.querySelectorAll('[data-template-preview]'))
      setAttr(trigger,'aria-label',message('home.hero.openTemplate',{title:templateValue(templates[index],'title')}));
  }
  async function select(next,automatic=false) {
    if(automatic&&peek)peek.currentTime=duration;
    if(automatic)noteMotions.forEach(motion=>{motion.currentTime=duration;});
    progress?.pause();peek?.pause();noteMotions.forEach(motion=>motion.pause());
    const request=++generation;
    try {
      await ensureImage(next).decode();
      if(request!==generation||lifetime.signal.aborted||(automatic&&!canRotate()))return;
      const held=clearPeek(next!==index&&images[next]===peekImage);
      resetProgress(true);
      if(next!==index)images.forEach((image,position)=>image.toggleAttribute('data-exiting',position===index));
      index=next;update();
      held?.style.removeProperty('transform');held?.style.removeProperty('opacity');held?.style.removeProperty('filter');
    } catch {if(request===generation)resetProgress();}
    finally {if(request===generation)schedule();}
  }
  rotation.addEventListener('click', event => {
    const button=event.target.closest('[data-hero-select]');
    if(button)void select(Number(button.dataset.heroSelect));
  }, options);
  root.addEventListener('click', event => {
    if (event.target.closest('[data-template-preview]')) schedule();
  }, options);
  dialog.addEventListener('close', schedule, options);
  document.addEventListener('visibilitychange', schedule, options);
  globalThis.addEventListener('resize', () => { ++generation; resetProgress(); update(); schedule(); }, options);
  reduce.addEventListener('change', () => { update(); schedule(); }, options);
  function onDataPreferenceChange() {
    dataPaused = savingData();
    schedule();
  }
  reducedData?.addEventListener?.('change', onDataPreferenceChange, options);
  connection?.addEventListener?.('change', onDataPreferenceChange, options);
  const removeLocaleListener = onLocaleChange(() => { ++generation; update(); schedule(); });
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    schedule();
  });
  observer.observe(cover);
  ensureImage(index);
  update();
  schedule();
  return {
    get template() { return templates[index]; },
    updateTemplates,
    dispose() {
      lifetime.abort();
      ++generation;
      resetProgress();
      observer.disconnect();
      root.removeAttribute('data-mkt-ambient-running');
      removeLocaleListener();
    },
  };
}

export function mountHomeChoices(host) {
  const dialog = host.querySelector('.home-create-dialog');
  if (!dialog) return () => {};
  const lifetime = new AbortController();
  const options = {signal:lifetime.signal};
  let opener;
  // Dùng chung hộp thoại chọn loại thiệp cho Hero và CTA sau demo.
  function openChoices(event) {
    if (dialog.open) return;
    opener = event.currentTarget;
    dialog.showModal();
    dialog.querySelector('.home-create-choice')?.focus();
  }
  for (const trigger of host.querySelectorAll('[data-home-create], [data-home-create-after-demo]')) {
    trigger.addEventListener('click', openChoices, options);
  }
  dialog.querySelector('[data-home-create-close]').addEventListener('click', () => dialog.close(), options);
  dialog.addEventListener('click', event => {
    if (event.target.closest('a[data-link]')) dialog.close();
  }, options);
  dialog.addEventListener('close', () => {if (opener?.isConnected) opener.focus();}, options);
  return () => {lifetime.abort();if (dialog.open) dialog.close();};
}
