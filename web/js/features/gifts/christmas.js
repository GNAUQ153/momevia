import { message, setText } from '../../core/i18n.js';
import { createSoundtrackPlayback } from '../gift-runtime/soundtrack.js';

export function playGiftUnboxing(anchor, signal) {
  const doc = anchor.ownerDocument;
  const view = doc.defaultView;
  if (signal?.aborted || doc.hidden || doc.documentElement.dataset.festivalStill === 'true' ||
    view.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const overlay = doc.createElement('div');
  overlay.className = 'festival-unboxing';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = '<div class="festival-unboxing__scene"><i class="festival-unboxing__glow"></i><i class="festival-unboxing__card"></i><i class="festival-unboxing__side"></i><i class="festival-unboxing__front"></i><i class="festival-unboxing__lid"></i></div>';
  doc.body.append(overlay);
  return new Promise(resolve => {
    const finish = () => {
      view.clearTimeout(timer);
      overlay.remove();
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    const timer = view.setTimeout(finish, 650);
    signal?.addEventListener('abort', finish, { once: true });
  });
}

export function mountChristmasGift(host, { signal, hasSoundtrack, legacy = false } = {}) {
  host.classList.add('festival-recipient');
  if (legacy) {
    host.querySelector('[data-action="open-gift"]')?.addEventListener('click', event => {
      void playGiftUnboxing(event.currentTarget, signal);
    }, { once: true, signal });
  }
  if (hasSoundtrack) return;
  const doc = host.ownerDocument;
  const control = doc.createElement('button');
  control.type = 'button';
  control.className = 'btn btn--outline festival-recipient__music';
  const status = doc.createElement('span');
  status.setAttribute('role', 'status');
  status.className = 'visually-hidden';
  let playback;
  function sync({ playing, error } = {}) {
    control.setAttribute('aria-pressed', String(Boolean(playing)));
    setText(control, message(playing ? 'festival.music.pause' : 'festival.music.play'));
    setText(status, error ? message('gift.music.error') : '');
  }
  sync();
  control.addEventListener('click', () => {
    playback ??= createSoundtrackPlayback({ id: 'christmas-lights', volume: .4 }, { onState: sync });
    void playback.toggle();
  }, { signal });
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) playback?.pause(); }, { signal });
  signal?.addEventListener('abort', () => playback?.dispose(), { once: true });
  host.before(control, status);
}
